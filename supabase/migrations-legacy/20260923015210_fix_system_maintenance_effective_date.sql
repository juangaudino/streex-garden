-- Date-only system maintenance is stored at UTC noon so local rendering does
-- not move the user-selected calendar date to the previous day.
create or replace function public.garden_x_record_system_maintenance(
  p_request_id uuid,
  p_garden_id uuid,
  p_action text,
  p_occurred_on date,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_event_id uuid;
  v_class text;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_action not in ('water_change', 'nutrients', 'water_and_nutrients') then raise exception 'Invalid system maintenance action'; end if;
  if p_occurred_on is null then raise exception 'Maintenance date is required'; end if;
  if not exists (select 1 from garden.gardens where id = p_garden_id and owner_id = v_owner and archived_at is null) then raise exception 'Garden not found'; end if;
  select response into v_response from garden.command_receipts where owner_id = v_owner and request_id = p_request_id and command_name = 'garden_x_record_system_maintenance';
  if found then return v_response; end if;
  v_class := case p_action when 'water_change' then 'water_change' when 'nutrients' then 'nutrients' else 'water_and_nutrients' end;
  insert into garden.events(owner_id, garden_id, grow_cycle_id, event_type, occurred_at, note, event_data)
  values (
    v_owner,
    p_garden_id,
    null,
    'system_maintenance',
    ((p_occurred_on::timestamp + interval '12 hours') at time zone 'UTC'),
    nullif(trim(p_note), ''),
    jsonb_build_object('class', v_class, 'source', 'garden_detail', 'occurred_on', p_occurred_on, 'occurred_at_precision', 'date')
  )
  returning id into v_event_id;
  v_response := jsonb_build_object('event_id', v_event_id, 'garden_id', p_garden_id, 'action', p_action, 'occurred_on', p_occurred_on);
  insert into garden.command_receipts(owner_id, request_id, command_name, response) values (v_owner, p_request_id, 'garden_x_record_system_maintenance', v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_record_system_maintenance(uuid, uuid, text, date, text) from public, anon, service_role;
grant execute on function public.garden_x_record_system_maintenance(uuid, uuid, text, date, text) to authenticated;
