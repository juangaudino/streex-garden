-- Phase 9: resumable guided maintenance and deterministic Control V2.
begin;

create table garden.maintenance_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'in_progress' check (state in ('in_progress', 'paused', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  cursor_position integer not null default 0 check (cursor_position >= 0),
  check ((state in ('in_progress', 'paused') and completed_at is null) or (state in ('completed', 'abandoned') and completed_at is not null))
);
create index maintenance_sessions_owner_open on garden.maintenance_sessions(owner_id, started_at desc) where state in ('in_progress', 'paused');

create table garden.maintenance_session_positions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references garden.maintenance_sessions(id) on delete cascade,
  garden_id uuid not null references garden.gardens(id) on delete restrict,
  position_id uuid not null references garden.positions(id) on delete restrict,
  captured_grow_cycle_id uuid references garden.grow_cycles(id) on delete restrict,
  position_number integer not null check (position_number > 0),
  ordinal integer not null check (ordinal > 0),
  progress text not null default 'not_reviewed' check (progress in ('not_reviewed', 'reviewed', 'skipped')),
  visual_review_event_id uuid references garden.events(id) on delete restrict,
  progressed_at timestamptz,
  unique (session_id, position_id), unique (session_id, ordinal),
  check ((progress = 'reviewed' and visual_review_event_id is not null) or (progress in ('not_reviewed', 'skipped') and visual_review_event_id is null))
);
create index maintenance_session_positions_session on garden.maintenance_session_positions(session_id, ordinal);

alter table garden.maintenance_sessions enable row level security;
alter table garden.maintenance_session_positions enable row level security;
create policy "owners read maintenance sessions" on garden.maintenance_sessions for select using ((select auth.uid()) = owner_id);
create policy "owners read maintenance positions" on garden.maintenance_session_positions for select using (exists (select 1 from garden.maintenance_sessions s where s.id = session_id and s.owner_id = (select auth.uid())));

create or replace function public.garden_start_maintenance_session(p_request_id uuid, p_garden_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_payload jsonb; v_response jsonb; v_session_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if coalesce(cardinality(p_garden_ids), 0) not between 1 and 2 then raise exception 'Select one or two gardens'; end if;
  if array_length(array(select distinct unnest(p_garden_ids)), 1) <> cardinality(p_garden_ids) then raise exception 'Garden selection contains duplicates'; end if;
  if (select count(*) from garden.gardens where owner_id = v_owner and id = any(p_garden_ids)) <> cardinality(p_garden_ids) then raise exception 'Garden not found'; end if;
  v_payload := jsonb_build_object('garden_ids', p_garden_ids);
  v_response := garden.command_response(v_owner, p_request_id, 'start_maintenance_session', v_payload);
  if v_response is not null then return v_response; end if;
  if exists (select 1 from garden.maintenance_sessions where owner_id = v_owner and state in ('in_progress', 'paused')) then raise exception 'Resume or abandon the existing maintenance session first'; end if;
  insert into garden.maintenance_sessions(owner_id) values (v_owner) returning id into v_session_id;
  insert into garden.maintenance_session_positions(session_id, garden_id, position_id, captured_grow_cycle_id, position_number, ordinal)
  select v_session_id, p.garden_id, p.id, current_cycle.grow_cycle_id, p.position_number,
    row_number() over (order by array_position(p_garden_ids, p.garden_id), p.position_number)::integer
  from garden.positions p
  left join garden.cycle_occupancies current_cycle on current_cycle.position_id = p.id and current_cycle.occupied_until is null
  where p.garden_id = any(p_garden_ids);
  v_response := jsonb_build_object('session_id', v_session_id);
  perform garden.store_command_response(v_owner, p_request_id, 'start_maintenance_session', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_get_maintenance_session(p_session_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id, 'state', s.state, 'started_at', s.started_at, 'cursor_position', s.cursor_position,
    'positions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', sp.id, 'garden_id', sp.garden_id, 'garden_name', g.name, 'position_id', sp.position_id,
      'position_number', sp.position_number, 'captured_grow_cycle_id', sp.captured_grow_cycle_id,
      'current_grow_cycle_id', current_cycle.grow_cycle_id, 'crop_name', c.common_name,
      'progress', sp.progress, 'ordinal', sp.ordinal
    ) order by sp.ordinal) from garden.maintenance_session_positions sp
      join garden.gardens g on g.id = sp.garden_id
      left join garden.cycle_occupancies current_cycle on current_cycle.position_id = sp.position_id and current_cycle.occupied_until is null
      left join garden.grow_cycles gc on gc.id = current_cycle.grow_cycle_id
      left join garden.crops c on c.id = gc.crop_id where sp.session_id = s.id), '[]'::jsonb)
  ) from garden.maintenance_sessions s where s.id = p_session_id and s.owner_id = public.garden_owner_id()
$$;

create or replace function public.garden_progress_maintenance_position(p_request_id uuid, p_session_position_id uuid, p_progress text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_payload jsonb; v_response jsonb; v_position garden.maintenance_session_positions%rowtype; v_session garden.maintenance_sessions%rowtype; v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_progress not in ('reviewed', 'skipped') then raise exception 'Invalid maintenance progress'; end if;
  v_payload := jsonb_build_object('session_position_id', p_session_position_id, 'progress', p_progress);
  v_response := garden.command_response(v_owner, p_request_id, 'progress_maintenance_position', v_payload);
  if v_response is not null then return v_response; end if;
  select sp.* into v_position from garden.maintenance_session_positions sp join garden.maintenance_sessions s on s.id = sp.session_id where sp.id = p_session_position_id and s.owner_id = v_owner for update of sp;
  if not found then raise exception 'Open maintenance position not found'; end if;
  select * into v_session from garden.maintenance_sessions where id = v_position.session_id and owner_id = v_owner for update;
  if v_session.state not in ('in_progress', 'paused') then raise exception 'Open maintenance position not found'; end if;
  if v_position.progress <> 'not_reviewed' then raise exception 'Maintenance position already progressed'; end if;
  if p_progress = 'reviewed' then
    if v_position.captured_grow_cycle_id is null then raise exception 'Empty positions can only be skipped'; end if;
    if not exists (select 1 from garden.cycle_occupancies where position_id = v_position.position_id and grow_cycle_id = v_position.captured_grow_cycle_id and occupied_until is null) then raise exception 'Occupant changed; review the new cycle explicitly'; end if;
    insert into garden.events(owner_id, garden_id, grow_cycle_id, event_type, note, event_data)
    values (v_owner, v_position.garden_id, v_position.captured_grow_cycle_id, 'visual_review', 'Se ve bien', jsonb_build_object('result', 'reassuring', 'source', 'maintenance_session', 'session_id', v_session.id)) returning id into v_event_id;
  end if;
  update garden.maintenance_session_positions set progress = p_progress, visual_review_event_id = v_event_id, progressed_at = now() where id = v_position.id;
  update garden.maintenance_sessions set state = 'in_progress', cursor_position = greatest(cursor_position, v_position.ordinal) where id = v_session.id;
  v_response := jsonb_build_object('session_id', v_session.id, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'progress_maintenance_position', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_set_maintenance_session_state(p_request_id uuid, p_session_id uuid, p_state text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_session garden.maintenance_sessions%rowtype; v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_state not in ('paused', 'in_progress', 'completed', 'abandoned') then raise exception 'Invalid session state'; end if;
  v_payload := jsonb_build_object('session_id', p_session_id, 'state', p_state);
  v_response := garden.command_response(v_owner, p_request_id, 'set_maintenance_session_state', v_payload);
  if v_response is not null then return; end if;
  select * into v_session from garden.maintenance_sessions where id = p_session_id and owner_id = v_owner for update;
  if not found or v_session.state not in ('in_progress', 'paused') then raise exception 'Open maintenance session not found'; end if;
  update garden.maintenance_sessions set state = p_state, completed_at = case when p_state in ('completed', 'abandoned') then now() else null end where id = v_session.id;
  perform garden.store_command_response(v_owner, p_request_id, 'set_maintenance_session_state', v_payload, '{}'::jsonb);
end;
$$;

create or replace function public.garden_get_control_v2()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'garden_id', g.id, 'garden_name', g.name, 'position_id', p.id, 'position_number', p.position_number,
    'grow_cycle_id', gc.id, 'crop_name', c.common_name, 'planted_on', gc.planted_on,
    'harvest_readiness', gc.harvest_readiness,
    'attention_count', (select count(*) from garden.attention_items a where a.owner_id = g.owner_id and a.status = 'open' and (a.garden_id = g.id or a.grow_cycle_id = gc.id))
  ) order by g.name, p.position_number), '[]'::jsonb)
  from garden.gardens g join garden.positions p on p.garden_id = g.id
  left join garden.cycle_occupancies o on o.position_id = p.id and o.occupied_until is null
  left join garden.grow_cycles gc on gc.id = o.grow_cycle_id and gc.state = 'active'
  left join garden.crops c on c.id = gc.crop_id
  where g.owner_id = public.garden_owner_id()
$$;

revoke all on function public.garden_start_maintenance_session(uuid, uuid[]) from public;
revoke all on function public.garden_get_maintenance_session(uuid) from public;
revoke all on function public.garden_progress_maintenance_position(uuid, uuid, text) from public;
revoke all on function public.garden_set_maintenance_session_state(uuid, uuid, text) from public;
revoke all on function public.garden_get_control_v2() from public;
grant execute on function public.garden_start_maintenance_session(uuid, uuid[]) to authenticated;
grant execute on function public.garden_get_maintenance_session(uuid) to authenticated;
grant execute on function public.garden_progress_maintenance_position(uuid, uuid, text) to authenticated;
grant execute on function public.garden_set_maintenance_session_state(uuid, uuid, text) to authenticated;
grant execute on function public.garden_get_control_v2() to authenticated;
commit;
