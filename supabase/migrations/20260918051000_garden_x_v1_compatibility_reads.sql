-- Garden X V1 — compatibility read projections
-- These RPCs expose the new target concepts without changing legacy consumers.
begin;

create or replace function public.garden_x_get_systems(p_garden_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'garden_id', s.garden_id,
    'name', s.name,
    'system_definition_key', s.system_definition_key,
    'legacy_system_model', s.legacy_system_model,
    'status', s.status,
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'position_number', p.position_number,
        'layout', case when ls.id is null then null else jsonb_build_object(
          'site_id', ls.id,
          'site_kind', ls.site_kind,
          'is_active', ls.is_active,
          'grid_x', ls.grid_x,
          'grid_y', ls.grid_y,
          'label', ls.label
        ) end,
        'current_cycle_id', o.grow_cycle_id,
        'plant_instance_id', gc.plant_instance_id
      ) order by p.position_number)
      from garden.positions p
      left join garden.layout_sites ls
        on ls.position_id = p.id and ls.system_instance_id = s.id
      left join garden.cycle_occupancies o
        on o.position_id = p.id and o.occupied_until is null
      left join garden.grow_cycles gc on gc.id = o.grow_cycle_id
      where p.system_instance_id = s.id
    ), '[]'::jsonb)
  ) order by s.created_at, s.id), '[]'::jsonb)
  from garden.system_instances s
  where s.garden_id = p_garden_id
    and s.owner_id = public.garden_owner_id()
$$;

create or replace function public.garden_x_get_plant(p_plant_instance_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'id', pi.id,
    'nickname', pi.nickname,
    'reference_key', pi.reference_key,
    'common_name', pi.common_name,
    'scientific_name', pi.scientific_name,
    'cultivar', pi.cultivar,
    'status', pi.status,
    'cycles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', gc.id,
        'state', gc.state,
        'planted_on', gc.planted_on,
        'planted_on_precision', gc.planted_on_precision,
        'harvest_readiness', gc.harvest_readiness
      ) order by gc.created_at)
      from garden.grow_cycles gc
      where gc.plant_instance_id = pi.id
    ), '[]'::jsonb)
  ) into v_result
  from garden.plant_instances pi
  where pi.id = p_plant_instance_id
    and pi.owner_id = public.garden_owner_id();

  if v_result is null then raise exception 'Plant not found'; end if;
  return v_result;
end;
$$;

revoke all on function public.garden_x_get_systems(uuid) from public;
revoke all on function public.garden_x_get_plant(uuid) from public;
grant execute on function public.garden_x_get_systems(uuid) to authenticated;
grant execute on function public.garden_x_get_plant(uuid) to authenticated;

commit;
