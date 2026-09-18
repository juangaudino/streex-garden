-- Garden X V1 — preserve user-selected dates for observation events.
begin;

create or replace function public.garden_x_create_observation(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_occurred_on date,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object(
    'grow_cycle_id', p_grow_cycle_id,
    'occurred_on', p_occurred_on,
    'note', nullif(trim(p_note), '')
  );
  v_response jsonb;
  v_garden_id uuid;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_occurred_on is null then raise exception 'Observation date is required'; end if;
  if nullif(trim(p_note), '') is null then raise exception 'Observation needs a note'; end if;
  if char_length(trim(p_note)) > 1000 then raise exception 'Observation note is too long'; end if;

  v_response := garden.command_response(v_owner, p_request_id, 'garden_x_create_observation', v_payload);
  if v_response is not null then return v_response; end if;

  select p.garden_id into v_garden_id
  from garden.grow_cycles gc
  join garden.cycle_occupancies o on o.grow_cycle_id = gc.id and o.occupied_until is null
  join garden.positions p on p.id = o.position_id
  where gc.id = p_grow_cycle_id and gc.owner_id = v_owner and gc.state = 'active'
  limit 1;
  if not found then raise exception 'Current grow cycle not found'; end if;

  insert into garden.events(owner_id, garden_id, grow_cycle_id, event_type, occurred_at, note, event_data)
  values (
    v_owner, v_garden_id, p_grow_cycle_id, 'observation',
    (p_occurred_on::timestamp + interval '12 hours') at time zone 'UTC',
    trim(p_note),
    jsonb_build_object('source','garden_x','occurred_on',p_occurred_on,'occurred_at_precision','date')
  )
  returning id into v_event_id;

  v_response := jsonb_build_object('event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'garden_x_create_observation', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_create_observation(uuid, uuid, date, text) from public;
grant execute on function public.garden_x_create_observation(uuid, uuid, date, text) to authenticated;

commit;
