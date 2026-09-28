-- Preserve canonical physical layout coordinates in the Garden X bootstrap.
-- This is a read-shape correction only; it does not change Garden data.

create or replace function public.garden_x_get_bootstrap_legacy_with_geometry()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with base as (
  select public.garden_x_get_bootstrap_legacy() as value
),
enriched_gardens as (
  select coalesce(jsonb_agg(
    item || jsonb_build_object(
      'positions', coalesce((
        select jsonb_agg(
          position_item || jsonb_build_object(
            'layout', coalesce(position_item->'layout', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
              'level_number', site.level_number,
              'row_number', site.row_number,
              'column_number', site.column_number
            ))
          ) order by (position_item->>'position_number')::integer
        )
        from jsonb_array_elements(item->'positions') as position_entry(position_item)
        left join garden.layout_sites site
          on site.position_id = nullif(position_item->>'id', '')::uuid
         and site.garden_id = nullif(item->>'id', '')::uuid
      ), '[]'::jsonb)
    ) order by garden_entry.ordinality
  ), '[]'::jsonb) as value
  from base
  cross join lateral jsonb_array_elements(base.value->'gardens') with ordinality as garden_entry(item, ordinality)
)
select jsonb_set(base.value, '{gardens}', enriched_gardens.value, true)
from base cross join enriched_gardens;
$$;

create or replace function public.garden_x_get_bootstrap_b35_base()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with base as (select public.garden_x_get_bootstrap_legacy_with_geometry() as value),
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

create or replace function public.garden_x_set_machine_model(
  p_request_id uuid,
  p_garden_id uuid,
  p_gardenpedia_model_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_system_id uuid;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if nullif(trim(coalesce(p_gardenpedia_model_id, '')), '') is null then raise exception 'Gardenpedia machine model is required'; end if;
  select s.id into v_system_id
  from garden.system_instances s
  where s.garden_id = p_garden_id and s.owner_id = v_owner and s.status = 'active'
  for update;
  if v_system_id is null then raise exception 'Garden system not found'; end if;
  select response into v_response
  from garden.command_receipts
  where owner_id = v_owner and request_id = p_request_id and command_name = 'garden_x_set_machine_model';
  if v_response is not null then return v_response; end if;
  update garden.system_instances
  set gardenpedia_model_id = trim(p_gardenpedia_model_id), updated_at = now()
  where id = v_system_id;
  v_response := jsonb_build_object('garden_id', p_garden_id, 'system_instance_id', v_system_id, 'gardenpedia_model_id', trim(p_gardenpedia_model_id));
  insert into garden.command_receipts(owner_id, request_id, command_name, response)
  values (v_owner, p_request_id, 'garden_x_set_machine_model', v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_get_bootstrap_legacy_with_geometry() from public, anon;
revoke all on function public.garden_x_set_machine_model(uuid, uuid, text) from public, anon;
grant execute on function public.garden_x_get_bootstrap_legacy_with_geometry() to authenticated;
grant execute on function public.garden_x_set_machine_model(uuid, uuid, text) to authenticated;
