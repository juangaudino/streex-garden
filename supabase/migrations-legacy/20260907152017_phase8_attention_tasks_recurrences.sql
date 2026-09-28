-- Phase 8: accepted attention tasks, their auditable outcomes, and inactive
-- recurrence definitions. A task is never a substitute for a garden event.

begin;

alter table garden.events add column if not exists garden_id uuid references garden.gardens(id) on delete restrict;
alter table garden.events add column if not exists event_data jsonb not null default '{}'::jsonb;
update garden.events e set garden_id = p.garden_id
from garden.cycle_occupancies o
join garden.positions p on p.id = o.position_id
where o.grow_cycle_id = e.grow_cycle_id
  and e.garden_id is null;
alter table garden.events alter column garden_id set not null;
alter table garden.events alter column grow_cycle_id drop not null;
alter table garden.events add constraint events_subject_present check (garden_id is not null);
create index events_garden_occurred_at on garden.events(garden_id, occurred_at desc);

create or replace function garden.assert_event_subject_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_garden_id uuid; v_owner_id uuid;
begin
  if new.grow_cycle_id is not null then
    select p.garden_id, gc.owner_id into v_garden_id, v_owner_id
    from garden.grow_cycles gc
    join garden.cycle_occupancies o on o.grow_cycle_id = gc.id
    join garden.positions p on p.id = o.position_id
    where gc.id = new.grow_cycle_id
    order by o.created_at limit 1;
    if v_garden_id is null or v_owner_id <> new.owner_id then raise exception 'Cycle subject not found'; end if;
    if new.garden_id is null then new.garden_id := v_garden_id;
    elsif new.garden_id <> v_garden_id then raise exception 'Cycle and garden subjects do not match'; end if;
  else
    select owner_id into v_owner_id from garden.gardens where id = new.garden_id;
    if v_owner_id is null or v_owner_id <> new.owner_id then raise exception 'Garden subject not found'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists events_assert_subject_integrity on garden.events;
create trigger events_assert_subject_integrity before insert or update on garden.events
for each row execute function garden.assert_event_subject_integrity();

create or replace function garden.log_event_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into garden.owner_change_log(owner_id, change_kind, garden_id, grow_cycle_id, source_id, occurred_at, summary)
  values (
    new.owner_id, 'event', new.garden_id, new.grow_cycle_id, new.id, new.occurred_at,
    case new.event_type
      when 'harvest' then 'Cosecha registrada'
      when 'cycle_started' then 'Ciclo iniciado'
      when 'cycle_ended' then 'Ciclo cerrado'
      when 'observation' then 'Observación registrada'
      when 'system_maintenance' then 'Mantenimiento registrado'
      when 'visual_review' then 'Revisión visual registrada'
      when 'development_review' then 'Revisión de desarrollo registrada'
      else 'Acción registrada'
    end
  );
  return new;
end;
$$;

alter table garden.attention_items add column if not exists completed_event_id uuid references garden.events(id) on delete restrict;
alter table garden.attention_items add column if not exists completed_at timestamptz;
alter table garden.attention_items add column if not exists dismissed_at timestamptz;
alter table garden.attention_items add column if not exists dismissed_reason text;
alter table garden.attention_items add constraint attention_items_terminal_details check (
  (status = 'open' and completed_event_id is null and completed_at is null and dismissed_at is null and dismissed_reason is null)
  or (status = 'completed' and completed_event_id is not null and completed_at is not null and dismissed_at is null and dismissed_reason is null)
  or (status = 'dismissed' and completed_event_id is null and completed_at is null and dismissed_at is not null and char_length(trim(dismissed_reason)) between 1 and 500)
);

create table garden.attention_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  attention_item_id uuid not null references garden.attention_items(id) on delete restrict,
  from_status text check (from_status in ('open', 'completed', 'dismissed')),
  to_status text not null check (to_status in ('open', 'completed', 'dismissed')),
  operation text not null check (operation in ('created', 'deferred', 'completed', 'dismissed')),
  reason text,
  related_event_id uuid references garden.events(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index attention_history_item_created_at on garden.attention_history(attention_item_id, created_at desc);
alter table garden.attention_history enable row level security;
create policy "owners read their attention history" on garden.attention_history for select using ((select auth.uid()) = owner_id);

create table garden.recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  garden_id uuid not null references garden.gardens(id) on delete cascade,
  grow_cycle_id uuid references garden.grow_cycles(id) on delete cascade,
  purpose text not null check (purpose in (
    'evaluate_visual_review', 'evaluate_thinning', 'evaluate_pruning', 'evaluate_support',
    'perform_thinning', 'perform_pruning', 'perform_support', 'perform_harvest',
    'perform_water_change', 'perform_refill', 'perform_nutrients', 'perform_cleaning'
  )),
  schedule_type text not null check (schedule_type in ('interval_from_action', 'alternate_tuesday')),
  interval_days integer check (interval_days > 0),
  anchor_on date,
  active boolean not null default false,
  paused_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (schedule_type = 'interval_from_action' and interval_days is not null and anchor_on is null)
    or (schedule_type = 'alternate_tuesday' and interval_days is null and anchor_on is not null and extract(isodow from anchor_on) = 2)
  )
);
create unique index recurrence_rules_one_active_identity on garden.recurrence_rules(
  owner_id, garden_id, coalesce(grow_cycle_id, '00000000-0000-0000-0000-000000000000'::uuid), purpose
) where active;
alter table garden.recurrence_rules enable row level security;
create policy "owners read their recurrence rules" on garden.recurrence_rules for select using ((select auth.uid()) = owner_id);

create or replace function garden.attention_purpose_title(p_purpose text)
returns text language sql immutable security invoker set search_path = '' as $$
  select case p_purpose
    when 'evaluate_visual_review' then 'Revisar visualmente'
    when 'evaluate_thinning' then 'Evaluar aclareo'
    when 'evaluate_pruning' then 'Evaluar poda'
    when 'evaluate_support' then 'Evaluar soporte'
    when 'perform_thinning' then 'Realizar aclareo'
    when 'perform_pruning' then 'Realizar poda'
    when 'perform_support' then 'Instalar soporte'
    when 'perform_harvest' then 'Realizar cosecha'
    when 'perform_water_change' then 'Cambiar toda el agua'
    when 'perform_refill' then 'Rellenar agua'
    when 'perform_nutrients' then 'Añadir nutrientes'
    when 'perform_cleaning' then 'Limpiar el sistema'
  end
$$;

create or replace function garden.attention_assert_subject(
  p_owner uuid, p_garden_id uuid, p_grow_cycle_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_garden_id uuid;
begin
  if p_grow_cycle_id is not null then
    select p.garden_id into v_garden_id
    from garden.grow_cycles gc join garden.cycle_occupancies o on o.grow_cycle_id = gc.id
    join garden.positions p on p.id = o.position_id
    where gc.id = p_grow_cycle_id and gc.owner_id = p_owner and gc.state = 'active'
    order by o.created_at limit 1;
    if v_garden_id is null then raise exception 'Current grow cycle not found'; end if;
    if p_garden_id is not null and p_garden_id <> v_garden_id then raise exception 'Task subject does not match garden'; end if;
    return v_garden_id;
  end if;
  if p_garden_id is null or not exists (select 1 from garden.gardens where id = p_garden_id and owner_id = p_owner) then
    raise exception 'Garden subject not found';
  end if;
  return p_garden_id;
end;
$$;

create or replace function public.garden_create_attention_item(
  p_request_id uuid, p_garden_id uuid, p_grow_cycle_id uuid, p_purpose text,
  p_subject_key text default 'general', p_due_on date default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id(); v_payload jsonb;
  v_response jsonb; v_garden_id uuid; v_item garden.attention_items%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('garden_id', p_garden_id, 'grow_cycle_id', p_grow_cycle_id, 'purpose', p_purpose, 'subject_key', coalesce(nullif(trim(p_subject_key), ''), 'general'), 'due_on', p_due_on);
  v_response := garden.command_response(v_owner, p_request_id, 'create_attention_item', v_payload);
  if v_response is not null then return v_response; end if;
  if p_purpose not in ('evaluate_visual_review', 'evaluate_thinning', 'evaluate_pruning', 'evaluate_support', 'perform_thinning', 'perform_pruning', 'perform_support', 'perform_harvest', 'perform_water_change', 'perform_refill', 'perform_nutrients', 'perform_cleaning') then raise exception 'Invalid attention purpose'; end if;
  if char_length(coalesce(nullif(trim(p_subject_key), ''), 'general')) > 160 then raise exception 'Task subject is too long'; end if;
  v_garden_id := garden.attention_assert_subject(v_owner, p_garden_id, p_grow_cycle_id);
  select * into v_item from garden.attention_items
  where owner_id = v_owner and garden_id = v_garden_id and grow_cycle_id is not distinct from p_grow_cycle_id
    and purpose = p_purpose and subject_key = coalesce(nullif(trim(p_subject_key), ''), 'general') and status = 'open'
  for update;
  if found then
    v_response := jsonb_build_object('task_id', v_item.id, 'created', false);
    perform garden.store_command_response(v_owner, p_request_id, 'create_attention_item', v_payload, v_response);
    return v_response;
  end if;
  insert into garden.attention_items(owner_id, garden_id, grow_cycle_id, purpose, subject_key, title, origin, due_on)
  values (v_owner, v_garden_id, p_grow_cycle_id, p_purpose, coalesce(nullif(trim(p_subject_key), ''), 'general'), garden.attention_purpose_title(p_purpose), 'manual', p_due_on)
  returning * into v_item;
  insert into garden.attention_history(owner_id, attention_item_id, to_status, operation)
  values (v_owner, v_item.id, 'open', 'created');
  v_response := jsonb_build_object('task_id', v_item.id, 'created', true);
  perform garden.store_command_response(v_owner, p_request_id, 'create_attention_item', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_defer_attention_item(
  p_request_id uuid, p_task_id uuid, p_next_review_on date, p_reason text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_task garden.attention_items%rowtype; v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_next_review_on is null then raise exception 'Next review date is required'; end if;
  v_payload := jsonb_build_object('task_id', p_task_id, 'next_review_on', p_next_review_on, 'reason', nullif(trim(p_reason), ''));
  v_response := garden.command_response(v_owner, p_request_id, 'defer_attention_item', v_payload);
  if v_response is not null then return; end if;
  select * into v_task from garden.attention_items where id = p_task_id and owner_id = v_owner for update;
  if not found or v_task.status <> 'open' then raise exception 'Open attention item not found'; end if;
  update garden.attention_items set next_review_on = p_next_review_on, updated_at = now() where id = v_task.id;
  insert into garden.attention_history(owner_id, attention_item_id, from_status, to_status, operation, reason)
  values (v_owner, v_task.id, 'open', 'open', 'deferred', nullif(trim(p_reason), ''));
  perform garden.store_command_response(v_owner, p_request_id, 'defer_attention_item', v_payload, '{}'::jsonb);
end;
$$;

create or replace function public.garden_dismiss_attention_item(
  p_request_id uuid, p_task_id uuid, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_task garden.attention_items%rowtype; v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 500 then raise exception 'Dismissal reason is required'; end if;
  v_payload := jsonb_build_object('task_id', p_task_id, 'reason', trim(p_reason));
  v_response := garden.command_response(v_owner, p_request_id, 'dismiss_attention_item', v_payload);
  if v_response is not null then return; end if;
  select * into v_task from garden.attention_items where id = p_task_id and owner_id = v_owner for update;
  if not found or v_task.status <> 'open' then raise exception 'Open attention item not found'; end if;
  update garden.attention_items set status = 'dismissed', dismissed_at = now(), dismissed_reason = trim(p_reason), updated_at = now() where id = v_task.id;
  insert into garden.attention_history(owner_id, attention_item_id, from_status, to_status, operation, reason)
  values (v_owner, v_task.id, 'open', 'dismissed', 'dismissed', trim(p_reason));
  perform garden.store_command_response(v_owner, p_request_id, 'dismiss_attention_item', v_payload, '{}'::jsonb);
end;
$$;

create or replace function public.garden_complete_attention_item(
  p_request_id uuid, p_task_id uuid, p_note text default null, p_review_result text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id(); v_task garden.attention_items%rowtype;
  v_payload jsonb; v_response jsonb; v_event_type text; v_event_data jsonb; v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('task_id', p_task_id, 'note', nullif(trim(p_note), ''), 'review_result', p_review_result);
  v_response := garden.command_response(v_owner, p_request_id, 'complete_attention_item', v_payload);
  if v_response is not null then return v_response; end if;
  select * into v_task from garden.attention_items where id = p_task_id and owner_id = v_owner for update;
  if not found or v_task.status <> 'open' then raise exception 'Open attention item not found'; end if;
  if v_task.purpose = 'evaluate_visual_review' then
    if p_review_result not in ('reassuring', 'watch', 'action_required', 'insufficient_evidence') then raise exception 'A personal visual review result is required'; end if;
    v_event_type := 'visual_review'; v_event_data := jsonb_build_object('result', p_review_result, 'source', 'attention_task');
  elsif v_task.purpose like 'evaluate_%' then
    if p_review_result not in ('ready', 'not_yet', 'not_required', 'undetermined') then raise exception 'A development review result is required'; end if;
    v_event_type := 'development_review'; v_event_data := jsonb_build_object('result', p_review_result, 'purpose', v_task.purpose, 'source', 'attention_task');
  elsif v_task.purpose = 'perform_harvest' then
    v_event_type := 'harvest'; v_event_data := jsonb_build_object('source', 'attention_task');
  elsif v_task.purpose in ('perform_thinning', 'perform_pruning', 'perform_support') then
    v_event_type := 'intervention'; v_event_data := jsonb_build_object('class', replace(v_task.purpose, 'perform_', ''), 'source', 'attention_task');
  else
    v_event_type := 'system_maintenance'; v_event_data := jsonb_build_object('class', replace(v_task.purpose, 'perform_', ''), 'source', 'attention_task');
  end if;
  insert into garden.events(owner_id, garden_id, grow_cycle_id, event_type, note, event_data)
  values (v_owner, v_task.garden_id, v_task.grow_cycle_id, v_event_type, nullif(trim(p_note), ''), v_event_data)
  returning id into v_event_id;
  update garden.attention_items set status = 'completed', completed_at = now(), completed_event_id = v_event_id, updated_at = now() where id = v_task.id;
  insert into garden.attention_history(owner_id, attention_item_id, from_status, to_status, operation, related_event_id)
  values (v_owner, v_task.id, 'open', 'completed', 'completed', v_event_id);
  v_response := jsonb_build_object('task_id', v_task.id, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'complete_attention_item', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_get_attention()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'garden_id', a.garden_id, 'grow_cycle_id', a.grow_cycle_id,
    'purpose', a.purpose, 'subject_key', a.subject_key, 'title', a.title,
    'origin', a.origin, 'due_on', a.due_on, 'next_review_on', a.next_review_on,
    'created_at', a.created_at
  ) order by
    case when a.due_on is not null and a.due_on < current_date then 0
         when a.due_on = current_date or a.next_review_on <= current_date then 1
         when a.due_on is null then 2 else 3 end,
    a.due_on nulls last, a.created_at, a.id), '[]'::jsonb)
  from garden.attention_items a
  where a.owner_id = public.garden_owner_id() and a.status = 'open'
$$;

create or replace function public.garden_get_home_dashboard(p_visit_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id(); v_settings garden.owner_settings%rowtype;
  v_state garden.owner_home_state%rowtype; v_visit garden.home_visits%rowtype;
  v_cursor bigint; v_now timestamptz := now(); v_is_first_visit boolean;
  v_gardens jsonb; v_changes jsonb; v_attention jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  insert into garden.owner_settings(owner_id) values (v_owner) on conflict (owner_id) do nothing;
  insert into garden.owner_home_state(owner_id) values (v_owner) on conflict (owner_id) do nothing;
  select * into v_settings from garden.owner_settings where owner_id = v_owner for update;
  select * into v_state from garden.owner_home_state where owner_id = v_owner for update;
  select * into v_visit from garden.home_visits where owner_id = v_owner
    and last_gardens_access_at >= v_now - make_interval(mins => v_settings.since_last_time_visit_gap_minutes)
  order by last_gardens_access_at desc limit 1 for update;
  if not found then
    insert into garden.home_visits(id, owner_id, base_cursor, base_shown_at, snapshot_cursor, snapshot_at, opened_at, last_gardens_access_at, visit_gap_minutes, config_version)
    values (gen_random_uuid(), v_owner, v_state.last_shown_cursor, v_state.last_shown_at, v_state.last_shown_cursor, v_now, v_now, v_now, v_settings.since_last_time_visit_gap_minutes, v_settings.config_version)
    returning * into v_visit;
  else
    update garden.home_visits set last_gardens_access_at = v_now where id = v_visit.id returning * into v_visit;
  end if;
  select coalesce(max(cursor), 0) into v_cursor from garden.owner_change_log where owner_id = v_owner;
  update garden.home_visits set snapshot_cursor = v_cursor, snapshot_at = v_now where id = v_visit.id returning * into v_visit;
  v_is_first_visit := v_visit.base_shown_at is null;
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'system_model', g.system_model, 'position_capacity', g.position_capacity, 'map_layout', g.map_layout, 'active_positions', coalesce(active.active_positions, 0)) order by g.created_at), '[]'::jsonb) into v_gardens
  from garden.gardens g left join lateral (select count(*)::integer as active_positions from garden.positions p join garden.cycle_occupancies o on o.position_id = p.id and o.occupied_until is null where p.garden_id = g.id) active on true where g.owner_id = v_owner;
  select coalesce(jsonb_agg(jsonb_build_object('cursor', l.cursor, 'kind', l.change_kind, 'garden_id', l.garden_id, 'grow_cycle_id', l.grow_cycle_id, 'occurred_at', l.occurred_at, 'committed_at', l.committed_at, 'summary', l.summary) order by l.cursor desc), '[]'::jsonb) into v_changes
  from garden.owner_change_log l where l.owner_id = v_owner and not v_is_first_visit and l.cursor > v_visit.base_cursor and l.cursor <= v_visit.snapshot_cursor;
  select public.garden_get_attention() into v_attention;
  return jsonb_build_object('visit', jsonb_build_object('id', v_visit.id, 'base_cursor', v_visit.base_cursor, 'snapshot_cursor', v_visit.snapshot_cursor, 'snapshot_at', v_visit.snapshot_at, 'first_visit', v_is_first_visit, 'visit_gap_minutes', v_visit.visit_gap_minutes), 'gardens', v_gardens, 'since_last_time', jsonb_build_object('changes', v_changes), 'attention', jsonb_build_object('items', v_attention));
end;
$$;

revoke all on function public.garden_create_attention_item(uuid, uuid, uuid, text, text, date) from public;
revoke all on function public.garden_defer_attention_item(uuid, uuid, date, text) from public;
revoke all on function public.garden_dismiss_attention_item(uuid, uuid, text) from public;
revoke all on function public.garden_complete_attention_item(uuid, uuid, text, text) from public;
revoke all on function public.garden_get_attention() from public;
revoke all on function public.garden_get_home_dashboard(uuid) from public;
grant execute on function public.garden_create_attention_item(uuid, uuid, uuid, text, text, date) to authenticated;
grant execute on function public.garden_defer_attention_item(uuid, uuid, date, text) to authenticated;
grant execute on function public.garden_dismiss_attention_item(uuid, uuid, text) to authenticated;
grant execute on function public.garden_complete_attention_item(uuid, uuid, text, text) to authenticated;
grant execute on function public.garden_get_attention() to authenticated;
grant execute on function public.garden_get_home_dashboard(uuid) to authenticated;

commit;
