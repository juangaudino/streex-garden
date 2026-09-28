-- Gardenpedia's server route runs this as service_role. The catalog table is
-- deliberately not exposed through PostgREST's garden schema.
begin;

create or replace function public.garden_x_sync_library_catalog(p_catalog jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if jsonb_typeof(p_catalog) <> 'array' or jsonb_array_length(p_catalog) = 0 then
    raise exception 'Catalog entries are required';
  end if;
  insert into garden.library_catalog_items(
    library_plant_id,catalog_version,common_name,scientific_name,cultivar,
    aliases,category,status,provenance,synced_at
  )
  select
    trim(item->>'libraryPlantId'),
    trim(item->>'catalogVersion'),
    trim(item->>'commonName'),
    nullif(trim(coalesce(item->>'scientificName','')),''),
    nullif(trim(coalesce(item->>'cultivar','')),''),
    coalesce(item->'aliases','[]'::jsonb),
    trim(item->>'category'),
    coalesce(nullif(trim(item->>'status'),''),'active'),
    coalesce(item->'provenance','[]'::jsonb),
    now()
  from jsonb_array_elements(p_catalog) item
  where trim(coalesce(item->>'libraryPlantId','')) <> ''
    and trim(coalesce(item->>'catalogVersion','')) <> ''
    and trim(coalesce(item->>'commonName','')) <> ''
  on conflict (library_plant_id) do update set
    catalog_version=excluded.catalog_version,
    common_name=excluded.common_name,
    scientific_name=excluded.scientific_name,
    cultivar=excluded.cultivar,
    aliases=excluded.aliases,
    category=excluded.category,
    status=excluded.status,
    provenance=excluded.provenance,
    synced_at=excluded.synced_at;
  get diagnostics v_count = row_count;
  if v_count <> jsonb_array_length(p_catalog) then
    raise exception 'Catalog contains invalid entries';
  end if;
  return jsonb_build_object('synced',v_count);
end;
$$;

revoke all on function public.garden_x_sync_library_catalog(jsonb) from public;
revoke all on function public.garden_x_sync_library_catalog(jsonb) from anon, authenticated;
grant execute on function public.garden_x_sync_library_catalog(jsonb) to service_role;

commit;
