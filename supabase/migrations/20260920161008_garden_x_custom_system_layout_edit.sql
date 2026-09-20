-- Garden X — edit a custom system's rectangular geometry without changing
-- position identity, occupancy, cycles, events, photos, or history.
begin;

create or replace function public.garden_x_update_custom_system_layout(
  p_request_id uuid,
  p_garden_id uuid,
  p_levels jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_system garden.system_instances%rowtype;
  v_definition_id uuid;
  v_expected_total integer;
  v_position_total integer;
  v_level jsonb;
  v_level_number integer := 0;
  v_rows integer;
  v_columns integer;
  v_position_number integer := 0;
  v_row integer;
  v_column integer;
  v_position_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_request_id is null or p_garden_id is null then raise exception 'Ids are required'; end if;
  if jsonb_typeof(p_levels) <> 'array' or jsonb_array_length(p_levels) not between 1 and 12 then
    raise exception 'One to twelve levels are required';
  end if;

  select response into v_response
  from garden.command_receipts
  where owner_id = v_owner and request_id = p_request_id
    and command_name = 'garden_x_update_custom_system_layout';
  if found then return v_response; end if;

  select s.* into v_system
  from garden.system_instances s
  where s.garden_id = p_garden_id
    and s.owner_id = v_owner
    and s.status = 'active'
    and s.metadata->>'custom_definition_id' is not null
  for update;
  if not found then raise exception 'Custom system not found'; end if;

  v_definition_id := (v_system.metadata->>'custom_definition_id')::uuid;
  select count(*) into v_position_total
  from garden.positions p
  where p.system_instance_id = v_system.id;

  v_expected_total := 0;
  for v_level in select value from jsonb_array_elements(p_levels) loop
    v_level_number := v_level_number + 1;
    if jsonb_typeof(v_level) <> 'object'
      or coalesce(v_level->>'rows', '') !~ '^[0-9]+$'
      or coalesce(v_level->>'columns', '') !~ '^[0-9]+$' then
      raise exception 'Each level needs rows and columns';
    end if;
    v_rows := (v_level->>'rows')::integer;
    v_columns := (v_level->>'columns')::integer;
    if v_rows not between 1 and 9 or v_columns not between 1 and 8 then
      raise exception 'Rows must be 1–9 and columns must be 1–8';
    end if;
    v_expected_total := v_expected_total + v_rows * v_columns;
  end loop;

  if v_expected_total <> v_position_total then
    raise exception 'Layout must preserve the existing position count';
  end if;

  delete from garden.custom_system_levels where definition_id = v_definition_id;
  -- Temporarily remove the active-point uniqueness constraint while a layout
  -- is being rearranged (for example 2×4 ↔ 4×2).
  update garden.layout_sites
  set is_active = false, updated_at = now()
  where system_instance_id = v_system.id;
  v_level_number := 0;
  for v_level in select value from jsonb_array_elements(p_levels) loop
    v_level_number := v_level_number + 1;
    v_rows := (v_level->>'rows')::integer;
    v_columns := (v_level->>'columns')::integer;
    insert into garden.custom_system_levels(definition_id, level_number, row_count, column_count)
    values (v_definition_id, v_level_number, v_rows, v_columns);

    for v_row in 1..v_rows loop
      for v_column in 1..v_columns loop
        v_position_number := v_position_number + 1;
        select p.id into v_position_id
        from garden.positions p
        where p.system_instance_id = v_system.id
          and p.position_number = v_position_number;
        if v_position_id is null then raise exception 'Position numbering is incomplete'; end if;
        update garden.layout_sites
        set level_number = v_level_number,
            row_number = v_row,
            column_number = v_column,
            grid_x = v_column,
            grid_y = v_row,
            updated_at = now()
        where system_instance_id = v_system.id and position_id = v_position_id;
        if not found then raise exception 'Position layout is incomplete'; end if;
      end loop;
    end loop;
  end loop;

  update garden.layout_sites
  set is_active = true, updated_at = now()
  where system_instance_id = v_system.id;

  update garden.custom_system_definitions
  set updated_at = now()
  where id = v_definition_id and owner_id = v_owner;

  v_response := jsonb_build_object(
    'garden_id', p_garden_id,
    'custom_definition_id', v_definition_id,
    'position_count', v_position_total,
    'updated', true
  );
  insert into garden.command_receipts(owner_id, request_id, command_name, response)
  values (v_owner, p_request_id, 'garden_x_update_custom_system_layout', v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_update_custom_system_layout(uuid, uuid, jsonb) from public;
grant execute on function public.garden_x_update_custom_system_layout(uuid, uuid, jsonb) to authenticated;

commit;
