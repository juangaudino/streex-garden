-- Phase 7: Home visit checkpoints and the canonical attention projection.
-- A visit is server-owned and shared across the owner's devices. The client
-- acknowledges a successfully rendered snapshot separately, so loading or a
-- failed render can never consume changes from "Desde la última vez".

begin;

create table garden.owner_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  since_last_time_visit_gap_minutes integer not null default 30
    check (since_last_time_visit_gap_minutes between 1 and 1440),
  config_version integer not null default 1 check (config_version > 0),
  updated_at timestamptz not null default now()
);

create table garden.owner_home_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  last_shown_cursor bigint not null default 0 check (last_shown_cursor >= 0),
  last_shown_at timestamptz,
  updated_at timestamptz not null default now()
);

create table garden.home_visits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  base_cursor bigint not null check (base_cursor >= 0),
  base_shown_at timestamptz,
  snapshot_cursor bigint not null default 0 check (snapshot_cursor >= 0),
  snapshot_at timestamptz not null default now(),
  opened_at timestamptz not null default now(),
  last_gardens_access_at timestamptz not null default now(),
  visit_gap_minutes integer not null check (visit_gap_minutes between 1 and 1440),
  config_version integer not null check (config_version > 0),
  acknowledged_at timestamptz
);
create index home_visits_owner_access on garden.home_visits(owner_id, last_gardens_access_at desc);

create table garden.owner_change_log (
  cursor bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  change_kind text not null check (change_kind in ('event', 'correction', 'attention')),
  garden_id uuid references garden.gardens(id) on delete set null,
  grow_cycle_id uuid references garden.grow_cycles(id) on delete set null,
  source_id uuid not null,
  occurred_at timestamptz not null,
  committed_at timestamptz not null default now(),
  summary text not null check (char_length(trim(summary)) between 1 and 240)
);
create index owner_change_log_owner_cursor on garden.owner_change_log(owner_id, cursor);

-- This table deliberately contains only the canonical task identity and its
-- status. Creation flows, recurrence materialization and AI proposals belong
-- to later phases; all read surfaces will use this same projection.
create table garden.attention_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  garden_id uuid references garden.gardens(id) on delete cascade,
  grow_cycle_id uuid references garden.grow_cycles(id) on delete cascade,
  purpose text not null check (char_length(trim(purpose)) between 1 and 80),
  subject_key text not null default 'general' check (char_length(trim(subject_key)) between 1 and 160),
  title text not null check (char_length(trim(title)) between 1 and 180),
  origin text not null check (origin in ('manual', 'rule', 'follow_up', 'visual_review', 'incident', 'ai_proposal')),
  status text not null default 'open' check (status in ('open', 'completed', 'dismissed')),
  due_on date,
  next_review_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index attention_items_owner_open on garden.attention_items(owner_id, status, due_on, created_at) where status = 'open';
create unique index attention_items_one_open_identity on garden.attention_items (
  owner_id, coalesce(garden_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(grow_cycle_id, '00000000-0000-0000-0000-000000000000'::uuid), purpose, subject_key
) where status = 'open';

alter table garden.owner_settings enable row level security;
alter table garden.owner_home_state enable row level security;
alter table garden.home_visits enable row level security;
alter table garden.owner_change_log enable row level security;
alter table garden.attention_items enable row level security;

create policy "owners read their garden settings" on garden.owner_settings for select using ((select auth.uid()) = owner_id);
create policy "owners read their home state" on garden.owner_home_state for select using ((select auth.uid()) = owner_id);
create policy "owners read their visits" on garden.home_visits for select using ((select auth.uid()) = owner_id);
create policy "owners read their change log" on garden.owner_change_log for select using ((select auth.uid()) = owner_id);
create policy "owners read their attention" on garden.attention_items for select using ((select auth.uid()) = owner_id);

create or replace function garden.log_event_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_garden_id uuid;
begin
  select p.garden_id into v_garden_id
  from garden.cycle_occupancies o join garden.positions p on p.id = o.position_id
  where o.grow_cycle_id = new.grow_cycle_id
  order by o.created_at
  limit 1;
  insert into garden.owner_change_log(owner_id, change_kind, garden_id, grow_cycle_id, source_id, occurred_at, summary)
  values (
    new.owner_id, 'event', v_garden_id, new.grow_cycle_id, new.id, new.occurred_at,
    case new.event_type
      when 'harvest' then 'Cosecha registrada'
      when 'cycle_started' then 'Ciclo iniciado'
      when 'cycle_ended' then 'Ciclo cerrado'
      when 'observation' then 'Observación registrada'
      else 'Acción registrada'
    end
  );
  return new;
end;
$$;

create or replace function garden.log_cycle_correction_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_garden_id uuid;
begin
  select p.garden_id into v_garden_id
  from garden.cycle_occupancies o join garden.positions p on p.id = o.position_id
  where o.grow_cycle_id = new.grow_cycle_id
  order by o.created_at
  limit 1;
  insert into garden.owner_change_log(owner_id, change_kind, garden_id, grow_cycle_id, source_id, occurred_at, summary)
  values (new.owner_id, 'correction', v_garden_id, new.grow_cycle_id, new.id, new.created_at, 'Corrección de ciclo registrada');
  return new;
end;
$$;

create or replace function garden.log_event_correction_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_cycle_id uuid; v_garden_id uuid;
begin
  select e.grow_cycle_id into v_cycle_id from garden.events e where e.id = new.event_id;
  select p.garden_id into v_garden_id
  from garden.cycle_occupancies o join garden.positions p on p.id = o.position_id
  where o.grow_cycle_id = v_cycle_id order by o.created_at limit 1;
  insert into garden.owner_change_log(owner_id, change_kind, garden_id, grow_cycle_id, source_id, occurred_at, summary)
  values (new.owner_id, 'correction', v_garden_id, v_cycle_id, new.id, new.created_at, 'Corrección de registro aplicada');
  return new;
end;
$$;

create or replace function garden.log_attention_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into garden.owner_change_log(owner_id, change_kind, garden_id, grow_cycle_id, source_id, occurred_at, summary)
    values (new.owner_id, 'attention', new.garden_id, new.grow_cycle_id, new.id, now(), 'Atención actualizada');
  elsif new.status is distinct from old.status or new.due_on is distinct from old.due_on or new.next_review_on is distinct from old.next_review_on then
    insert into garden.owner_change_log(owner_id, change_kind, garden_id, grow_cycle_id, source_id, occurred_at, summary)
    values (new.owner_id, 'attention', new.garden_id, new.grow_cycle_id, new.id, now(),
      case new.status when 'open' then 'Atención actualizada' when 'completed' then 'Atención completada' else 'Atención descartada' end);
  end if;
  return new;
end;
$$;

create trigger events_log_change after insert on garden.events for each row execute function garden.log_event_change();
create trigger cycle_revisions_log_change after insert on garden.cycle_revisions for each row execute function garden.log_cycle_correction_change();
create trigger event_revisions_log_change after insert on garden.event_revisions for each row execute function garden.log_event_correction_change();
create trigger attention_items_log_change after insert or update on garden.attention_items for each row execute function garden.log_attention_change();

create or replace function public.garden_get_home_dashboard(p_visit_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_settings garden.owner_settings%rowtype;
  v_state garden.owner_home_state%rowtype;
  v_visit garden.home_visits%rowtype;
  v_cursor bigint;
  v_now timestamptz := now();
  v_is_first_visit boolean;
  v_gardens jsonb;
  v_changes jsonb;
  v_attention jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  insert into garden.owner_settings(owner_id) values (v_owner) on conflict (owner_id) do nothing;
  insert into garden.owner_home_state(owner_id) values (v_owner) on conflict (owner_id) do nothing;
  select * into v_settings from garden.owner_settings where owner_id = v_owner for update;
  select * into v_state from garden.owner_home_state where owner_id = v_owner for update;

  -- The newest active visit is intentionally shared across devices. A client
  -- id only helps retain a stable reference after a reload; it does not split
  -- the owner's logical visit into per-device sessions.
  select * into v_visit from garden.home_visits
  where owner_id = v_owner
    and last_gardens_access_at >= v_now - make_interval(mins => v_settings.since_last_time_visit_gap_minutes)
  order by last_gardens_access_at desc
  limit 1
  for update;

  if not found then
    insert into garden.home_visits(
      id, owner_id, base_cursor, base_shown_at, snapshot_cursor, snapshot_at,
      opened_at, last_gardens_access_at, visit_gap_minutes, config_version
    ) values (
      gen_random_uuid(), v_owner, v_state.last_shown_cursor,
      v_state.last_shown_at, v_state.last_shown_cursor, v_now, v_now, v_now,
      v_settings.since_last_time_visit_gap_minutes, v_settings.config_version
    ) returning * into v_visit;
  else
    update garden.home_visits set last_gardens_access_at = v_now where id = v_visit.id returning * into v_visit;
  end if;

  select coalesce(max(cursor), 0) into v_cursor from garden.owner_change_log where owner_id = v_owner;
  update garden.home_visits set snapshot_cursor = v_cursor, snapshot_at = v_now where id = v_visit.id returning * into v_visit;
  v_is_first_visit := v_visit.base_shown_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'system_model', g.system_model,
    'position_capacity', g.position_capacity, 'map_layout', g.map_layout,
    'active_positions', coalesce(active.active_positions, 0)
  ) order by g.created_at), '[]'::jsonb) into v_gardens
  from garden.gardens g
  left join lateral (
    select count(*)::integer as active_positions from garden.positions p
    join garden.cycle_occupancies o on o.position_id = p.id and o.occupied_until is null
    where p.garden_id = g.id
  ) active on true
  where g.owner_id = v_owner;

  select coalesce(jsonb_agg(jsonb_build_object(
    'cursor', l.cursor, 'kind', l.change_kind, 'garden_id', l.garden_id,
    'grow_cycle_id', l.grow_cycle_id, 'occurred_at', l.occurred_at,
    'committed_at', l.committed_at, 'summary', l.summary
  ) order by l.cursor desc), '[]'::jsonb) into v_changes
  from garden.owner_change_log l
  where l.owner_id = v_owner
    and not v_is_first_visit
    and l.cursor > v_visit.base_cursor
    and l.cursor <= v_visit.snapshot_cursor;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'garden_id', a.garden_id, 'grow_cycle_id', a.grow_cycle_id,
    'title', a.title, 'origin', a.origin, 'due_on', a.due_on,
    'next_review_on', a.next_review_on, 'created_at', a.created_at
  ) order by
    case when a.due_on is not null and a.due_on < current_date then 0
         when a.due_on = current_date or a.next_review_on <= current_date then 1
         when a.due_on is null then 2 else 3 end,
    a.due_on nulls last, a.created_at, a.id), '[]'::jsonb) into v_attention
  from garden.attention_items a where a.owner_id = v_owner and a.status = 'open';

  return jsonb_build_object(
    'visit', jsonb_build_object(
      'id', v_visit.id, 'base_cursor', v_visit.base_cursor,
      'snapshot_cursor', v_visit.snapshot_cursor, 'snapshot_at', v_visit.snapshot_at,
      'first_visit', v_is_first_visit, 'visit_gap_minutes', v_visit.visit_gap_minutes
    ),
    'gardens', v_gardens,
    'since_last_time', jsonb_build_object('changes', v_changes),
    'attention', jsonb_build_object('items', v_attention)
  );
end;
$$;

create or replace function public.garden_ack_home_snapshot(p_visit_id uuid, p_snapshot_cursor bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_visit garden.home_visits%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_visit from garden.home_visits
  where id = p_visit_id and owner_id = v_owner for update;
  if not found then raise exception 'Home visit not found'; end if;
  if p_snapshot_cursor <> v_visit.snapshot_cursor then raise exception 'Home snapshot changed; refresh before acknowledging'; end if;
  update garden.owner_home_state
  set last_shown_cursor = greatest(last_shown_cursor, p_snapshot_cursor),
      last_shown_at = greatest(coalesce(last_shown_at, '-infinity'::timestamptz), v_visit.snapshot_at),
      updated_at = now()
  where owner_id = v_owner;
  update garden.home_visits set acknowledged_at = now() where id = v_visit.id;
end;
$$;

create or replace function public.garden_get_attention()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'garden_id', a.garden_id, 'grow_cycle_id', a.grow_cycle_id,
    'title', a.title, 'origin', a.origin, 'due_on', a.due_on,
    'next_review_on', a.next_review_on, 'created_at', a.created_at
  ) order by
    case when a.due_on is not null and a.due_on < current_date then 0
         when a.due_on = current_date or a.next_review_on <= current_date then 1
         when a.due_on is null then 2 else 3 end,
    a.due_on nulls last, a.created_at, a.id), '[]'::jsonb)
  from garden.attention_items a
  where a.owner_id = public.garden_owner_id() and a.status = 'open'
$$;

revoke all on function public.garden_get_home_dashboard(uuid) from public;
revoke all on function public.garden_ack_home_snapshot(uuid, bigint) from public;
revoke all on function public.garden_get_attention() from public;
grant execute on function public.garden_get_home_dashboard(uuid) to authenticated;
grant execute on function public.garden_ack_home_snapshot(uuid, bigint) to authenticated;
grant execute on function public.garden_get_attention() to authenticated;

commit;
