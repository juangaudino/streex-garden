-- Allow an instance without a Gardenpedia model link to change its own
-- capacity and physical layout in one owner-scoped transaction.
-- Known Gardenpedia model instances remain fixed-capacity.
create or replace function public.garden_x_update_custom_system_layout_v2(
  p_request_id uuid,
  p_garden_id uuid,
  p_levels jsonb,
  p_position_capacity integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_system garden.system_instances%rowtype;
  v_definition_id uuid;
  v_current_total integer;
  v_expected_total integer := 0;
  v_level jsonb;
  v_cell jsonb;
  v_active jsonb;
  v_normalized_levels jsonb := '[]'::jsonb;
  v_level_number integer := 0;
  v_rows integer;
  v_columns integer;
  v_row integer;
  v_column integer;
  v_position_number integer := 0;
  v_position_id uuid;
  v_removed_position_ids uuid[];
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_request_id is null or p_garden_id is null then
    raise exception 'Ids are required';
  end if;
  if p_position_capacity not between 1 and 36 then
    raise exception 'A system can have between 1 and 36 positions';
  end if;
  if jsonb_typeof(p_levels) <> 'array' or jsonb_array_length(p_levels) not between 1 and 12 then
    raise exception 'One to twelve levels are required';
  end if;

  select response into v_response
  from garden.command_receipts
  where owner_id = v_owner
    and request_id = p_request_id
    and command_name = 'garden_x_update_custom_system_layout_v2';
  if found then return v_response; end if;

  select s.* into v_system
  from garden.system_instances s
  where s.garden_id = p_garden_id
    and s.owner_id = v_owner
    and s.status = 'active'
  for update;
  if not found then raise exception 'System not found'; end if;
  if v_system.gardenpedia_model_id is not null then
    raise exception 'Known Gardenpedia machine models have fixed capacity';
  end if;

  v_definition_id := nullif(v_system.metadata->>'custom_definition_id', '')::uuid;
  select count(*)::integer into v_current_total
  from garden.positions p
  where p.system_instance_id = v_system.id;

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
    v_active := v_level->'active_cells';
    if v_active is null then
      select jsonb_agg(jsonb_build_object('row', row_number, 'column', column_number) order by row_number, column_number)
      into v_active
      from generate_series(1, v_rows) as rows(row_number)
      cross join generate_series(1, v_columns) as columns(column_number);
    end if;
    if jsonb_typeof(v_active) <> 'array' or jsonb_array_length(v_active) < 1 then
      raise exception 'Each level needs at least one active cell';
    end if;
    for v_cell in select value from jsonb_array_elements(v_active) loop
      if jsonb_typeof(v_cell) <> 'object'
        or coalesce(v_cell->>'row', '') !~ '^[0-9]+$'
        or coalesce(v_cell->>'column', '') !~ '^[0-9]+$' then
        raise exception 'Active cells need row and column';
      end if;
      v_row := (v_cell->>'row')::integer;
      v_column := (v_cell->>'column')::integer;
      if v_row not between 1 and v_rows or v_column not between 1 and v_columns then
        raise exception 'Active cell is outside its grid';
      end if;
      if (select count(*) from jsonb_array_elements(v_active) prior where prior = v_cell) > 1 then
        raise exception 'Active cells cannot repeat';
      end if;
    end loop;
    v_expected_total := v_expected_total + jsonb_array_length(v_active);
    v_normalized_levels := v_normalized_levels || jsonb_build_array(jsonb_build_object(
      'levelNumber', v_level_number,
      'rows', v_rows,
      'columns', v_columns,
      'activeCells', v_active
    ));
  end loop;
  if v_expected_total <> p_position_capacity then
    raise exception 'Active cells must equal the confirmed position capacity';
  end if;

  if p_position_capacity < v_current_total then
    select array_agg(p.id order by p.position_number)
    into v_removed_position_ids
    from garden.positions p
    where p.system_instance_id = v_system.id
      and p.position_number > p_position_capacity;
    if exists (
      select 1 from garden.cycle_occupancies o
      where o.position_id = any(coalesce(v_removed_position_ids, '{}'::uuid[]))
    ) or exists (
      select 1 from garden.maintenance_session_positions m
      where m.position_id = any(coalesce(v_removed_position_ids, '{}'::uuid[]))
    ) then
      raise exception 'Capacity cannot be reduced while removed positions have plant history; relocate first';
    end if;
    delete from garden.layout_sites
    where position_id = any(coalesce(v_removed_position_ids, '{}'::uuid[]));
    delete from garden.positions
    where id = any(coalesce(v_removed_position_ids, '{}'::uuid[]));
  elsif p_position_capacity > v_current_total then
    for v_position_number in (v_current_total + 1)..p_position_capacity loop
      insert into garden.positions(garden_id, system_instance_id, position_number)
      values (p_garden_id, v_system.id, v_position_number)
      returning id into v_position_id;
      insert into garden.layout_sites(
        garden_id, system_instance_id, position_id, site_kind, is_active,
        grid_x, grid_y, level_number, row_number, column_number
      ) values (p_garden_id, v_system.id, v_position_id, 'grow', false, 1, 1, 1, 1, 1);
    end loop;
  end if;

  update garden.layout_sites
  set is_active = false, updated_at = now()
  where system_instance_id = v_system.id;
  if v_definition_id is not null then
    delete from garden.custom_system_levels where definition_id = v_definition_id;
  end if;

  v_level_number := 0;
  v_position_number := 0;
  for v_level in select value from jsonb_array_elements(p_levels) loop
    v_level_number := v_level_number + 1;
    v_rows := (v_level->>'rows')::integer;
    v_columns := (v_level->>'columns')::integer;
    v_active := v_level->'active_cells';
    if v_active is null then
      select jsonb_agg(jsonb_build_object('row', row_number, 'column', column_number) order by row_number, column_number)
      into v_active
      from generate_series(1, v_rows) as rows(row_number)
      cross join generate_series(1, v_columns) as columns(column_number);
    end if;
    if v_definition_id is not null then
      insert into garden.custom_system_levels(definition_id, level_number, row_count, column_count, active_cells)
      values (v_definition_id, v_level_number, v_rows, v_columns, v_active);
    end if;
    for v_cell in select value from jsonb_array_elements(v_active) order by (value->>'row')::integer, (value->>'column')::integer loop
      v_position_number := v_position_number + 1;
      v_row := (v_cell->>'row')::integer;
      v_column := (v_cell->>'column')::integer;
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
          is_active = true,
          updated_at = now()
      where system_instance_id = v_system.id
        and position_id = v_position_id;
      if not found then raise exception 'Position layout is incomplete'; end if;
    end loop;
  end loop;

  if v_definition_id is null then
    update garden.system_instances
    set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{layout_levels}', v_normalized_levels, true), updated_at = now()
    where id = v_system.id and owner_id = v_owner;
  else
    update garden.custom_system_definitions set updated_at = now() where id = v_definition_id and owner_id = v_owner;
  end if;
  perform garden.refresh_position_capacity(p_garden_id);
  insert into garden.layout_events(owner_id, garden_id, operation, event_data)
  values (
    v_owner,
    p_garden_id,
    'layout_updated',
    jsonb_build_object('previous_position_count', v_current_total, 'position_count', p_position_capacity)
  );
  v_response := jsonb_build_object(
    'garden_id', p_garden_id,
    'position_count', p_position_capacity,
    'previous_position_count', v_current_total,
    'updated', true
  );
  insert into garden.command_receipts(owner_id, request_id, command_name, response)
  values (v_owner, p_request_id, 'garden_x_update_custom_system_layout_v2', v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_update_custom_system_layout_v2(uuid, uuid, jsonb, integer) from public, anon;
grant execute on function public.garden_x_update_custom_system_layout_v2(uuid, uuid, jsonb, integer) to authenticated, service_role;
