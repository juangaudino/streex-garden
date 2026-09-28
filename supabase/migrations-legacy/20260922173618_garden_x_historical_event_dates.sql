-- Additive successor for harvest recording with an explicit effective date.
-- The existing four-argument function remains available to older clients.
begin;

create or replace function public.garden_record_harvest(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_expected_revision integer,
  p_occurred_on date,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object(
    'grow_cycle_id', p_grow_cycle_id,
    'expected_revision', p_expected_revision,
    'occurred_on', p_occurred_on,
    'note', nullif(trim(p_note), '')
  );
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'record_harvest', v_payload);
  if v_response is not null then return v_response; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'active' then raise exception 'Current grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before recording harvest'; end if;
  insert into garden.events(owner_id, grow_cycle_id, event_type, occurred_at, event_data, note)
  values (
    v_owner,
    p_grow_cycle_id,
    'harvest',
    ((p_occurred_on::timestamp + interval '12 hours') at time zone 'UTC'),
    jsonb_build_object('source', 'garden_x', 'occurred_on', p_occurred_on, 'occurred_at_precision', 'date'),
    nullif(trim(p_note), '')
  ) returning id into v_event_id;
  v_response := jsonb_build_object('event_id', v_event_id, 'grow_cycle_id', p_grow_cycle_id);
  perform garden.store_command_response(v_owner, p_request_id, 'record_harvest', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_record_harvest(uuid, uuid, integer, date, text) from public;
grant execute on function public.garden_record_harvest(uuid, uuid, integer, date, text) to authenticated;

commit;
