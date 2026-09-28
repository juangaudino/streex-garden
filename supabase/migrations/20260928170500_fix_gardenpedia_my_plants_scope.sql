begin;

create or replace function public.gardenpedia_get_my_plants()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_result jsonb;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', coalesce(nullif(trim(p.nickname), ''), p.common_name),
    'commonName', p.common_name,
    'scientificName', p.scientific_name,
    'cultivar', p.cultivar,
    'referenceKey', p.reference_key,
    'libraryPlantId', p.library_plant_id,
    'status', p.status,
    'gardenId', system_info.garden_id,
    'gardenName', system_info.garden_name,
    'cycleId', c.id,
    'cycleState', c.state,
    'plantedOn', c.planted_on,
    'positionNumber', system_info.position_number,
    'journalPath', '/plants/' || p.id::text
  ) order by system_info.garden_name, system_info.position_number nulls last, p.created_at, p.id), '[]'::jsonb)
  into v_result
  from garden.plant_instances p
  left join lateral (
    select c1.*
    from garden.grow_cycles c1
    where c1.plant_instance_id = p.id
      and c1.owner_id = v_owner
    order by case when c1.state = 'active' then 0 else 1 end, c1.created_at desc, c1.id
    limit 1
  ) c on true
  left join lateral (
    select g.id as garden_id, g.name as garden_name, pos.position_number
    from garden.cycle_occupancies co
    join garden.positions pos on pos.id = co.position_id
    join garden.gardens g on g.id = pos.garden_id
    where co.grow_cycle_id = c.id
      and g.owner_id = v_owner
      and g.archived_at is null
    order by co.occupied_until is not null, co.occupied_from desc, co.created_at desc, pos.position_number
    limit 1
  ) system_info on true
  where p.owner_id = v_owner
    and p.status <> 'archived'
    and system_info.garden_id is not null;

  return jsonb_build_object('plants', v_result);
end;
$$;

revoke all on function public.gardenpedia_get_my_plants() from public, anon;
grant execute on function public.gardenpedia_get_my_plants() to authenticated;

commit;
