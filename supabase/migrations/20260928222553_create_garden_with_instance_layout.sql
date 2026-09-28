-- Known Gardenpedia machine creation must configure an independent instance layout.
-- The existing create/update functions are reused inside one transaction so an
-- existing system's layout can never become the new instance's committed state.
create or replace function public.garden_x_create_garden_with_layout(
  p_request_id uuid,
  p_garden_id uuid,
  p_system_instance_id uuid,
  p_name text,
  p_kind text,
  p_place text,
  p_note text,
  p_system_definition_key text,
  p_system_name text,
  p_position_capacity integer,
  p_levels jsonb,
  p_gardenpedia_model_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if nullif(trim(coalesce(p_gardenpedia_model_id, '')), '') is null then
    raise exception 'Gardenpedia machine model is required';
  end if;
  if p_levels is null or jsonb_typeof(p_levels) <> 'array' then
    raise exception 'Instance layout is required';
  end if;

  select response into v_response
  from garden.command_receipts
  where owner_id = v_owner
    and request_id = p_request_id
    and command_name = 'garden_x_create_garden_with_layout';
  if found then
    return v_response;
  end if;

  v_response := public.garden_x_create_garden(
    p_request_id,
    p_garden_id,
    p_system_instance_id,
    p_name,
    p_kind,
    p_place,
    p_note,
    p_system_definition_key,
    p_system_name,
    p_position_capacity
  );

  perform public.garden_x_update_custom_system_layout(
    gen_random_uuid(),
    p_garden_id,
    p_levels
  );

  perform public.garden_x_set_machine_model(
    gen_random_uuid(),
    p_garden_id,
    p_gardenpedia_model_id
  );

  v_response := v_response || jsonb_build_object(
    'gardenpedia_model_id', trim(p_gardenpedia_model_id),
    'layout_configured', true
  );
  insert into garden.command_receipts(owner_id, request_id, command_name, response)
  values (v_owner, p_request_id, 'garden_x_create_garden_with_layout', v_response);
  return v_response;
end;
$function$;

revoke all on function public.garden_x_create_garden_with_layout(uuid, uuid, uuid, text, text, text, text, text, text, integer, jsonb, text) from public;
revoke all on function public.garden_x_create_garden_with_layout(uuid, uuid, uuid, text, text, text, text, text, text, integer, jsonb, text) from anon;
grant execute on function public.garden_x_create_garden_with_layout(uuid, uuid, uuid, text, text, text, text, text, text, integer, jsonb, text) to authenticated;
grant execute on function public.garden_x_create_garden_with_layout(uuid, uuid, uuid, text, text, text, text, text, text, integer, jsonb, text) to service_role;
