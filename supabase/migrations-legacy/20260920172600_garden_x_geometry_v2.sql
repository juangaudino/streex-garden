-- Garden X Geometry V2: rectangular grids may contain inactive cells.
begin;

alter table garden.custom_system_levels
  add column if not exists active_cells jsonb not null default '[]'::jsonb;

create or replace function public.garden_x_create_custom_system(
  p_request_id uuid,
  p_garden_id uuid,
  p_system_instance_id uuid,
  p_definition_id uuid,
  p_name text,
  p_levels jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_total integer := 0;
  v_position_number integer := 0;
  v_level jsonb;
  v_cell jsonb;
  v_active jsonb;
  v_level_number integer := 0;
  v_rows integer;
  v_columns integer;
  v_row integer;
  v_column integer;
  v_position_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_request_id is null or p_garden_id is null or p_system_instance_id is null or p_definition_id is null then raise exception 'Ids are required'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'System name is required'; end if;
  if jsonb_typeof(p_levels) <> 'array' or jsonb_array_length(p_levels) not between 1 and 12 then raise exception 'One to twelve levels are required'; end if;
  select response into v_response from garden.command_receipts where owner_id = v_owner and request_id = p_request_id and command_name = 'garden_x_create_custom_system';
  if found then return v_response; end if;

  for v_level in select value from jsonb_array_elements(p_levels) loop
    v_level_number := v_level_number + 1;
    if jsonb_typeof(v_level) <> 'object' or coalesce(v_level->>'rows', '') !~ '^[0-9]+$' or coalesce(v_level->>'columns', '') !~ '^[0-9]+$' then raise exception 'Each level needs rows and columns'; end if;
    v_rows := (v_level->>'rows')::integer; v_columns := (v_level->>'columns')::integer;
    if v_rows not between 1 and 9 or v_columns not between 1 and 8 then raise exception 'Rows must be 1–9 and columns must be 1–8'; end if;
    v_active := v_level->'active_cells';
    if v_active is null then
      select jsonb_agg(jsonb_build_object('row', row_number, 'column', column_number) order by row_number, column_number) into v_active
      from generate_series(1, v_rows) as rows(row_number) cross join generate_series(1, v_columns) as columns(column_number);
    end if;
    if jsonb_typeof(v_active) <> 'array' or jsonb_array_length(v_active) < 1 then raise exception 'Each level needs at least one active cell'; end if;
    for v_cell in select value from jsonb_array_elements(v_active) loop
      if jsonb_typeof(v_cell) <> 'object' or coalesce(v_cell->>'row', '') !~ '^[0-9]+$' or coalesce(v_cell->>'column', '') !~ '^[0-9]+$' then raise exception 'Active cells need row and column'; end if;
      v_row := (v_cell->>'row')::integer; v_column := (v_cell->>'column')::integer;
      if v_row not between 1 and v_rows or v_column not between 1 and v_columns then raise exception 'Active cell is outside its grid'; end if;
      if (select count(*) from jsonb_array_elements(v_active) prior where prior = v_cell) > 1 then raise exception 'Active cells cannot repeat'; end if;
    end loop;
    v_total := v_total + jsonb_array_length(v_active);
  end loop;
  if v_total > 36 then raise exception 'A custom system supports at most 36 positions'; end if;

  insert into garden.custom_system_definitions(id, owner_id, name, metadata) values (p_definition_id, v_owner, trim(p_name), jsonb_build_object('created_via', 'garden_x_v2_custom_system_builder'));
  insert into garden.gardens(id, owner_id, name, system_model, position_capacity, map_layout, kind, place, note, sort_order)
  values (p_garden_id, v_owner, trim(p_name), 'Custom System', v_total, 'custom_grid', 'hydroponic', '', 'Custom system layout', coalesce((select max(sort_order) + 1 from garden.gardens where owner_id = v_owner), 0));
  insert into garden.system_instances(id, owner_id, garden_id, name, system_definition_key, legacy_system_model, status, metadata)
  values (p_system_instance_id, v_owner, p_garden_id, trim(p_name), 'custom:' || p_definition_id::text, 'Custom System', 'active', jsonb_build_object('created_via', 'garden_x_v2_custom_system_builder', 'baseline_bridge', 'garden_x_v1', 'custom_definition_id', p_definition_id));

  v_level_number := 0;
  for v_level in select value from jsonb_array_elements(p_levels) loop
    v_level_number := v_level_number + 1; v_rows := (v_level->>'rows')::integer; v_columns := (v_level->>'columns')::integer;
    v_active := v_level->'active_cells';
    if v_active is null then
      select jsonb_agg(jsonb_build_object('row', row_number, 'column', column_number) order by row_number, column_number) into v_active
      from generate_series(1, v_rows) as rows(row_number) cross join generate_series(1, v_columns) as columns(column_number);
    end if;
    insert into garden.custom_system_levels(definition_id, level_number, row_count, column_count, active_cells) values (p_definition_id, v_level_number, v_rows, v_columns, v_active);
    for v_cell in select value from jsonb_array_elements(v_active) order by (value->>'row')::integer, (value->>'column')::integer loop
      v_position_number := v_position_number + 1; v_row := (v_cell->>'row')::integer; v_column := (v_cell->>'column')::integer;
      insert into garden.positions(garden_id, system_instance_id, position_number) values (p_garden_id, p_system_instance_id, v_position_number) returning id into v_position_id;
      insert into garden.layout_sites(garden_id, system_instance_id, position_id, site_kind, is_active, grid_x, grid_y, level_number, row_number, column_number)
      values (p_garden_id, p_system_instance_id, v_position_id, 'grow', true, v_column, v_row, v_level_number, v_row, v_column);
    end loop;
  end loop;
  insert into garden.layout_events(owner_id, garden_id, operation, event_data) values (v_owner, p_garden_id, 'site_added', jsonb_build_object('source', 'garden_x_v2_custom_system_builder', 'level_count', jsonb_array_length(p_levels), 'position_count', v_total));
  v_response := jsonb_build_object('garden_id', p_garden_id, 'system_instance_id', p_system_instance_id, 'custom_definition_id', p_definition_id, 'position_count', v_total);
  insert into garden.command_receipts(owner_id, request_id, command_name, response) values (v_owner, p_request_id, 'garden_x_create_custom_system', v_response);
  return v_response;
end;
$$;

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
  v_expected_total integer := 0;
  v_position_total integer;
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
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_request_id is null or p_garden_id is null then raise exception 'Ids are required'; end if;
  if jsonb_typeof(p_levels) <> 'array' or jsonb_array_length(p_levels) not between 1 and 12 then raise exception 'One to twelve levels are required'; end if;
  select response into v_response from garden.command_receipts where owner_id = v_owner and request_id = p_request_id and command_name = 'garden_x_update_custom_system_layout';
  if found then return v_response; end if;
  select s.* into v_system from garden.system_instances s where s.garden_id = p_garden_id and s.owner_id = v_owner and s.status = 'active' for update;
  if not found then raise exception 'System not found'; end if;
  v_definition_id := nullif(v_system.metadata->>'custom_definition_id', '')::uuid;
  select count(*) into v_position_total from garden.positions p where p.system_instance_id = v_system.id;

  for v_level in select value from jsonb_array_elements(p_levels) loop
    v_level_number := v_level_number + 1;
    if jsonb_typeof(v_level) <> 'object' or coalesce(v_level->>'rows', '') !~ '^[0-9]+$' or coalesce(v_level->>'columns', '') !~ '^[0-9]+$' then raise exception 'Each level needs rows and columns'; end if;
    v_rows := (v_level->>'rows')::integer; v_columns := (v_level->>'columns')::integer;
    if v_rows not between 1 and 9 or v_columns not between 1 and 8 then raise exception 'Rows must be 1–9 and columns must be 1–8'; end if;
    v_active := v_level->'active_cells';
    if v_active is null then
      select jsonb_agg(jsonb_build_object('row', row_number, 'column', column_number) order by row_number, column_number) into v_active
      from generate_series(1, v_rows) as rows(row_number) cross join generate_series(1, v_columns) as columns(column_number);
    end if;
    if jsonb_typeof(v_active) <> 'array' or jsonb_array_length(v_active) < 1 then raise exception 'Each level needs at least one active cell'; end if;
    for v_cell in select value from jsonb_array_elements(v_active) loop
      if jsonb_typeof(v_cell) <> 'object' or coalesce(v_cell->>'row', '') !~ '^[0-9]+$' or coalesce(v_cell->>'column', '') !~ '^[0-9]+$' then raise exception 'Active cells need row and column'; end if;
      v_row := (v_cell->>'row')::integer; v_column := (v_cell->>'column')::integer;
      if v_row not between 1 and v_rows or v_column not between 1 and v_columns then raise exception 'Active cell is outside its grid'; end if;
      if (select count(*) from jsonb_array_elements(v_active) prior where prior = v_cell) > 1 then raise exception 'Active cells cannot repeat'; end if;
    end loop;
    v_expected_total := v_expected_total + jsonb_array_length(v_active);
    v_normalized_levels := v_normalized_levels || jsonb_build_array(jsonb_build_object('levelNumber', v_level_number, 'rows', v_rows, 'columns', v_columns, 'activeCells', v_active));
  end loop;
  if v_expected_total <> v_position_total then raise exception 'Active cells must equal the existing position count'; end if;

  update garden.layout_sites set is_active = false, updated_at = now() where system_instance_id = v_system.id;
  if v_definition_id is not null then delete from garden.custom_system_levels where definition_id = v_definition_id; end if;
  v_level_number := 0;
  for v_level in select value from jsonb_array_elements(p_levels) loop
    v_level_number := v_level_number + 1; v_rows := (v_level->>'rows')::integer; v_columns := (v_level->>'columns')::integer; v_active := v_level->'active_cells';
    if v_active is null then select jsonb_agg(jsonb_build_object('row', row_number, 'column', column_number) order by row_number, column_number) into v_active from generate_series(1, v_rows) as rows(row_number) cross join generate_series(1, v_columns) as columns(column_number); end if;
    if v_definition_id is not null then insert into garden.custom_system_levels(definition_id, level_number, row_count, column_count, active_cells) values (v_definition_id, v_level_number, v_rows, v_columns, v_active); end if;
    for v_cell in select value from jsonb_array_elements(v_active) order by (value->>'row')::integer, (value->>'column')::integer loop
      v_position_number := v_position_number + 1; v_row := (v_cell->>'row')::integer; v_column := (v_cell->>'column')::integer;
      select p.id into v_position_id from garden.positions p where p.system_instance_id = v_system.id and p.position_number = v_position_number;
      if v_position_id is null then raise exception 'Position numbering is incomplete'; end if;
      update garden.layout_sites set level_number = v_level_number, row_number = v_row, column_number = v_column, grid_x = v_column, grid_y = v_row, is_active = true, updated_at = now() where system_instance_id = v_system.id and position_id = v_position_id;
      if not found then raise exception 'Position layout is incomplete'; end if;
    end loop;
  end loop;
  if v_definition_id is null then update garden.system_instances set metadata = jsonb_set(metadata, '{layout_levels}', v_normalized_levels, true), updated_at = now() where id = v_system.id and owner_id = v_owner; else update garden.custom_system_definitions set updated_at = now() where id = v_definition_id and owner_id = v_owner; end if;
  v_response := jsonb_build_object('garden_id', p_garden_id, 'position_count', v_position_total, 'updated', true);
  insert into garden.command_receipts(owner_id, request_id, command_name, response) values (v_owner, p_request_id, 'garden_x_update_custom_system_layout', v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_create_custom_system(uuid, uuid, uuid, uuid, text, jsonb) from public;
grant execute on function public.garden_x_create_custom_system(uuid, uuid, uuid, uuid, text, jsonb) to authenticated;
revoke all on function public.garden_x_update_custom_system_layout(uuid, uuid, jsonb) from public;
grant execute on function public.garden_x_update_custom_system_layout(uuid, uuid, jsonb) to authenticated;

create or replace function public.garden_x_get_bootstrap()
returns jsonb
language sql stable security definer set search_path = '' as $$
with base as (select public.garden_x_get_bootstrap_legacy() as value),
garden_levels as (
  select g.id as garden_id,
    coalesce(jsonb_agg(jsonb_build_object(
      'level_number', l.level_number,
      'row_count', l.row_count,
      'column_count', l.column_count,
      'active_cells', case when jsonb_typeof(l.active_cells) = 'array' and jsonb_array_length(l.active_cells) > 0 then l.active_cells else (
        select jsonb_agg(jsonb_build_object('row', r.row_number, 'column', c.column_number) order by r.row_number, c.column_number)
        from generate_series(1, l.row_count) as r(row_number) cross join generate_series(1, l.column_count) as c(column_number)
      ) end
    ) order by l.level_number), '[]'::jsonb) as levels
  from garden.gardens g
  join garden.system_instances s on s.garden_id = g.id and s.owner_id = g.owner_id
  join garden.custom_system_definitions d on d.id = nullif(s.metadata->>'custom_definition_id', '')::uuid and d.owner_id = g.owner_id
  join garden.custom_system_levels l on l.definition_id = d.id
  where g.owner_id = public.garden_owner_id()
  group by g.id
), enriched_gardens as (
  select coalesce(jsonb_agg(item || jsonb_build_object('levels', coalesce(gl.levels, item->'levels')) order by entries.ordinality), '[]'::jsonb) as value
  from base
  cross join lateral jsonb_array_elements(base.value->'gardens') with ordinality as entries(item, ordinality)
  left join garden_levels gl on gl.garden_id = (entries.item->>'id')::uuid
), enriched_base as (
  select jsonb_set(base.value, '{gardens}', enriched_gardens.value, true) as value from base cross join enriched_gardens
), plants as (
  select coalesce(jsonb_agg(item || jsonb_strip_nulls(jsonb_build_object(
    'library_plant_id', pi.library_plant_id,
    'library_catalog_version', pi.library_catalog_version,
    'library_common_name_snapshot', pi.library_common_name_snapshot,
    'library_scientific_name_snapshot', pi.library_scientific_name_snapshot,
    'library_cultivar_snapshot', pi.library_cultivar_snapshot
  )) order by ordinality), '[]'::jsonb) as value
  from enriched_base
  cross join lateral jsonb_array_elements(enriched_base.value->'plants') with ordinality as entries(item, ordinality)
  left join garden.plant_instances pi on pi.id = (entries.item->>'id')::uuid
)
select jsonb_set(enriched_base.value, '{plants}', plants.value, true) from enriched_base cross join plants;
$$;

revoke all on function public.garden_x_get_bootstrap() from public;
grant execute on function public.garden_x_get_bootstrap() to authenticated;
commit;
