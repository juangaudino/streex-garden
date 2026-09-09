-- Maintenance contextual actions: distinguish an inspected position from an
-- explicit healthy visual review while preserving the existing session model.
begin;

alter table garden.maintenance_session_positions
  add column if not exists inspected_at timestamptz,
  add column if not exists inspection_source text;

-- Existing reviewed rows were explicit "Se ve bien" actions. Backfill their
-- inspection metadata so the new invariant remains compatible with history.
update garden.maintenance_session_positions
set inspected_at = coalesce(progressed_at, now()),
    inspection_source = 'healthy_review'
where progress = 'reviewed' and inspected_at is null;

alter table garden.maintenance_session_positions
  drop constraint if exists maintenance_session_positions_check;

alter table garden.maintenance_session_positions
  add constraint maintenance_session_positions_progress_check
  check (
    (progress = 'reviewed' and inspected_at is not null)
    or (
      progress in ('not_reviewed', 'skipped')
      and inspected_at is null
      and visual_review_event_id is null
    )
  ),
  add constraint maintenance_session_positions_source_check
  check (inspection_source is null or inspection_source in ('healthy_review', 'observation', 'fact', 'manual'));

create or replace function public.garden_get_maintenance_session(p_session_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id, 'state', s.state, 'started_at', s.started_at, 'cursor_position', s.cursor_position,
    'positions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', sp.id, 'garden_id', sp.garden_id, 'garden_name', g.name, 'position_id', sp.position_id,
      'position_number', sp.position_number, 'captured_grow_cycle_id', sp.captured_grow_cycle_id,
      'current_grow_cycle_id', current_cycle.grow_cycle_id, 'crop_name', c.common_name,
      'progress', sp.progress, 'inspected_at', sp.inspected_at,
      'inspection_source', sp.inspection_source,
      'health_confirmed', exists (
        select 1 from garden.events health_event
        where health_event.id = sp.visual_review_event_id and health_event.invalidated_at is null
      ),
      'ordinal', sp.ordinal
    ) order by sp.ordinal) from garden.maintenance_session_positions sp
      join garden.gardens g on g.id = sp.garden_id
      left join garden.cycle_occupancies current_cycle on current_cycle.position_id = sp.position_id and current_cycle.occupied_until is null
      left join garden.grow_cycles gc on gc.id = current_cycle.grow_cycle_id
      left join garden.crops c on c.id = gc.crop_id where sp.session_id = s.id), '[]'::jsonb)
  ) from garden.maintenance_sessions s where s.id = p_session_id and s.owner_id = public.garden_owner_id()
$$;

create or replace function public.garden_progress_maintenance_position(p_request_id uuid, p_session_position_id uuid, p_progress text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
  v_position garden.maintenance_session_positions%rowtype;
  v_session garden.maintenance_sessions%rowtype;
  v_event_id uuid;
  v_progressed_at timestamptz := now();
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_progress not in ('reviewed', 'skipped') then raise exception 'Invalid maintenance progress'; end if;
  v_payload := jsonb_build_object('session_position_id', p_session_position_id, 'progress', p_progress);
  v_response := garden.command_response(v_owner, p_request_id, 'progress_maintenance_position', v_payload);
  if v_response is not null then return v_response; end if;
  select sp.* into v_position
  from garden.maintenance_session_positions sp
  join garden.maintenance_sessions s on s.id = sp.session_id
  where sp.id = p_session_position_id and s.owner_id = v_owner
  for update of sp;
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
  update garden.maintenance_session_positions
  set progress = p_progress,
      visual_review_event_id = v_event_id,
      inspected_at = case when p_progress = 'reviewed' then v_progressed_at else null end,
      inspection_source = case when p_progress = 'reviewed' then 'healthy_review' else null end,
      progressed_at = v_progressed_at
  where id = v_position.id;
  update garden.maintenance_sessions set state = 'in_progress', cursor_position = greatest(cursor_position, v_position.ordinal) where id = v_session.id;
  v_response := jsonb_build_object('session_id', v_session.id, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'progress_maintenance_position', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_mark_maintenance_position_inspected(
  p_request_id uuid,
  p_session_position_id uuid,
  p_inspection_source text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
  v_position garden.maintenance_session_positions%rowtype;
  v_session garden.maintenance_sessions%rowtype;
  v_inspected_at timestamptz := now();
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_inspection_source not in ('observation', 'fact', 'manual') then raise exception 'Invalid inspection source'; end if;
  v_payload := jsonb_build_object('session_position_id', p_session_position_id, 'inspection_source', p_inspection_source);
  v_response := garden.command_response(v_owner, p_request_id, 'mark_maintenance_position_inspected', v_payload);
  if v_response is not null then return v_response; end if;
  select sp.* into v_position
  from garden.maintenance_session_positions sp
  join garden.maintenance_sessions s on s.id = sp.session_id
  where sp.id = p_session_position_id and s.owner_id = v_owner
  for update of sp;
  if not found then raise exception 'Open maintenance position not found'; end if;
  select * into v_session from garden.maintenance_sessions where id = v_position.session_id and owner_id = v_owner for update;
  if v_session.state not in ('in_progress', 'paused') then raise exception 'Open maintenance session not found'; end if;
  if v_position.progress = 'reviewed' then
    v_response := jsonb_build_object('session_id', v_session.id, 'already_inspected', true);
    perform garden.store_command_response(v_owner, p_request_id, 'mark_maintenance_position_inspected', v_payload, v_response);
    return v_response;
  end if;
  if v_position.progress = 'skipped' then raise exception 'Skipped maintenance position cannot be marked inspected'; end if;
  if v_position.captured_grow_cycle_id is null then raise exception 'Empty positions cannot be marked inspected'; end if;
  if not exists (
    select 1 from garden.cycle_occupancies
    where position_id = v_position.position_id
      and grow_cycle_id = v_position.captured_grow_cycle_id
      and occupied_until is null
  ) then raise exception 'Occupant changed; review the new cycle explicitly'; end if;
  update garden.maintenance_session_positions
  set progress = 'reviewed', inspected_at = v_inspected_at, inspection_source = p_inspection_source, progressed_at = v_inspected_at
  where id = v_position.id;
  update garden.maintenance_sessions set state = 'in_progress', cursor_position = greatest(cursor_position, v_position.ordinal) where id = v_session.id;
  v_response := jsonb_build_object('session_id', v_session.id, 'session_position_id', v_position.id, 'already_inspected', false);
  perform garden.store_command_response(v_owner, p_request_id, 'mark_maintenance_position_inspected', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_get_maintenance_session(uuid) from public;
revoke all on function public.garden_progress_maintenance_position(uuid, uuid, text) from public;
revoke all on function public.garden_mark_maintenance_position_inspected(uuid, uuid, text) from public;
grant execute on function public.garden_get_maintenance_session(uuid) to authenticated;
grant execute on function public.garden_progress_maintenance_position(uuid, uuid, text) to authenticated;
grant execute on function public.garden_mark_maintenance_position_inspected(uuid, uuid, text) to authenticated;

commit;
