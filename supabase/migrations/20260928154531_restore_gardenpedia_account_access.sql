-- Restore the already-approved Gardenpedia private account RPC surface on the
-- canonical Garden X Production baseline. No catalog or inventory data is
-- created here; all reads and writes remain owner-scoped to auth.uid().
begin;

create or replace function public.garden_seed_packages_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_result jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select jsonb_build_object('packages', coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'libraryPlantId', p.library_plant_id, 'seedName', p.seed_name,
    'brand', p.brand, 'packageStatus', p.package_status, 'quantityLevel', p.quantity_level,
    'storageLocation', p.storage_location, 'purchaseDate', p.purchase_date,
    'purchaseYear', p.legacy_purchase_year, 'germinationTestDate', p.germination_test_date,
    'germinationResultPct', p.germination_result_pct, 'notes', p.notes,
    'archived', p.archived, 'createdAt', p.created_at, 'updatedAt', p.updated_at
  ) order by p.created_at, p.id), '[]'::jsonb)) into v_result
  from garden.seed_packages p where p.owner_id = v_owner;
  return v_result;
end;
$$;

create or replace function public.garden_seed_package_save(p_package jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid(); v_id uuid; v_name text; v_plant_id text;
  v_status text; v_quantity text; v_rows integer;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if jsonb_typeof(p_package) <> 'object' then raise exception 'Invalid seed package'; end if;
  v_name := nullif(trim(coalesce(p_package->>'seedName','')), '');
  if v_name is null or char_length(v_name) > 160 then raise exception 'Seed name is required'; end if;
  v_plant_id := nullif(trim(coalesce(p_package->>'libraryPlantId','')), '');
  if v_plant_id is not null and not exists (
    select 1 from garden.library_catalog_items c where c.library_plant_id = v_plant_id and c.status = 'active'
  ) then raise exception 'Gardenpedia identity is unavailable'; end if;
  v_status := coalesce(p_package->>'packageStatus','unknown');
  v_quantity := coalesce(p_package->>'quantityLevel','unknown');
  if v_status not in ('opened','unopened','unknown') then raise exception 'Invalid package status'; end if;
  if v_quantity not in ('full','high','medium','low','almost_empty','unknown') then raise exception 'Invalid quantity'; end if;
  if nullif(p_package->>'id','') is not null then
    v_id := (p_package->>'id')::uuid;
    update garden.seed_packages set
      library_plant_id = v_plant_id, seed_name = v_name,
      brand = nullif(trim(coalesce(p_package->>'brand','')), ''),
      package_status = v_status, quantity_level = v_quantity,
      storage_location = nullif(trim(coalesce(p_package->>'storageLocation','')), ''),
      purchase_date = case when coalesce(p_package->>'purchaseDate','') ~ '^\d{4}-\d{2}-\d{2}$' then (p_package->>'purchaseDate')::date end,
      legacy_purchase_year = nullif(trim(coalesce(p_package->>'purchaseYear','')), ''),
      germination_test_date = case when coalesce(p_package->>'germinationTestDate','') ~ '^\d{4}-\d{2}-\d{2}$' then (p_package->>'germinationTestDate')::date end,
      germination_result_pct = case when coalesce(p_package->>'germinationResultPct','') ~ '^\d{1,3}$' and (p_package->>'germinationResultPct')::integer between 0 and 100 then (p_package->>'germinationResultPct')::integer end,
      notes = nullif(coalesce(p_package->>'notes',''), ''),
      archived = coalesce((p_package->>'archived')::boolean, false), updated_at = now()
    where id = v_id and owner_id = v_owner;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then raise exception 'Seed package not found'; end if;
  else
    insert into garden.seed_packages(owner_id, library_plant_id, seed_name, brand, package_status,
      quantity_level, storage_location, purchase_date, legacy_purchase_year,
      germination_test_date, germination_result_pct, notes)
    values (v_owner, v_plant_id, v_name, nullif(trim(coalesce(p_package->>'brand','')), ''),
      v_status, v_quantity, nullif(trim(coalesce(p_package->>'storageLocation','')), ''),
      case when coalesce(p_package->>'purchaseDate','') ~ '^\d{4}-\d{2}-\d{2}$' then (p_package->>'purchaseDate')::date end,
      nullif(trim(coalesce(p_package->>'purchaseYear','')), ''),
      case when coalesce(p_package->>'germinationTestDate','') ~ '^\d{4}-\d{2}-\d{2}$' then (p_package->>'germinationTestDate')::date end,
      case when coalesce(p_package->>'germinationResultPct','') ~ '^\d{1,3}$' and (p_package->>'germinationResultPct')::integer between 0 and 100 then (p_package->>'germinationResultPct')::integer end,
      nullif(coalesce(p_package->>'notes',''), '')) returning id into v_id;
  end if;
  return jsonb_build_object('saved', true, 'id', v_id);
end;
$$;

create or replace function public.garden_seed_packages_reconcile_legacy(
  p_local_state jsonb default '{}'::jsonb, p_local_custom jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid(); v_inserted integer := 0; v_count integer := 0;
  r record; v_custom jsonb; v_identity text; v_name text; v_brand text;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  for r in select s.* from garden_lab.seed_personal_state s where s.owner_id = v_owner loop
    select to_jsonb(c) into v_custom from garden_lab.custom_seeds c
      where c.owner_id = v_owner and c.seed_key = r.seed_key;
    v_identity := case when exists(select 1 from garden.library_catalog_items c where c.library_plant_id = r.seed_key and c.status = 'active') then r.seed_key else null end;
    select coalesce(v_custom->>'packet_name', c.common_name, r.seed_key) into v_name
      from (select 1) seed left join garden.library_catalog_items c on c.library_plant_id = v_identity;
    v_brand := nullif(trim(coalesce(v_custom->>'brand','')), '');
    insert into garden.seed_packages(owner_id, library_plant_id, seed_name, brand,
      package_status, quantity_level, storage_location, purchase_date, legacy_purchase_year,
      germination_test_date, germination_result_pct, notes, archived, legacy_source, legacy_source_key)
    values(v_owner, v_identity, v_name, v_brand, r.package_status, r.quantity_level,
      r.storage_location, r.purchase_date, r.legacy_purchase_year, r.germination_test_date,
      r.germination_result_pct, r.notes, r.archived, 'garden_lab', r.seed_key)
    on conflict do nothing;
    get diagnostics v_count = row_count; v_inserted := v_inserted + v_count;
  end loop;
  for r in select c.* from garden_lab.custom_seeds c where c.owner_id = v_owner loop
    if not exists(select 1 from garden.seed_packages p where p.owner_id = v_owner and p.legacy_source='garden_lab' and p.legacy_source_key=r.seed_key) then
      insert into garden.seed_packages(owner_id, seed_name, brand, legacy_source, legacy_source_key)
      values(v_owner, r.packet_name, nullif(trim(coalesce(r.brand,'')), ''), 'garden_lab', r.seed_key)
      on conflict do nothing;
      get diagnostics v_count = row_count; v_inserted := v_inserted + v_count;
    end if;
  end loop;
  if jsonb_typeof(coalesce(p_local_state,'{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_local_custom,'[]'::jsonb)) <> 'array' then
    raise exception 'Invalid local inventory export';
  end if;
  for r in select key, value from jsonb_each(coalesce(p_local_state,'{}'::jsonb)) loop
    select value into v_custom from jsonb_array_elements(coalesce(p_local_custom,'[]'::jsonb)) where value->>'id'=r.key limit 1;
    v_identity := case when exists(select 1 from garden.library_catalog_items c where c.library_plant_id=r.key and c.status='active') then r.key else null end;
    select coalesce(v_custom->>'packetName', c.common_name, r.key) into v_name
      from (select 1) seed left join garden.library_catalog_items c on c.library_plant_id=v_identity;
    insert into garden.seed_packages(owner_id, library_plant_id, seed_name, brand,
      package_status, quantity_level, storage_location, purchase_date, legacy_purchase_year,
      germination_test_date, germination_result_pct, notes, archived, legacy_source, legacy_source_key)
    values(v_owner, v_identity, v_name, nullif(trim(coalesce(v_custom->>'brand','')), ''),
      case when r.value->>'packageStatus' in ('opened','unopened','unknown') then r.value->>'packageStatus' else 'unknown' end,
      case when r.value->>'quantityLevel' in ('full','high','medium','low','almost_empty','unknown') then r.value->>'quantityLevel' else 'unknown' end,
      nullif(trim(coalesce(r.value->>'storageLocation','')), ''),
      case when coalesce(r.value->>'purchaseDate','') ~ '^\d{4}-\d{2}-\d{2}$' then (r.value->>'purchaseDate')::date end,
      coalesce(nullif(r.value->>'legacyPurchaseYear',''), nullif(r.value->>'purchaseYear','')),
      case when coalesce(r.value->>'lastGerminationTestAt','') ~ '^\d{4}-\d{2}-\d{2}$' then (r.value->>'lastGerminationTestAt')::date end,
      case when coalesce(r.value->>'lastGerminationResultPct','') ~ '^\d{1,3}$' and (r.value->>'lastGerminationResultPct')::integer between 0 and 100 then (r.value->>'lastGerminationResultPct')::integer end,
      nullif(coalesce(r.value->>'notes',''), ''), coalesce((r.value->>'archived')::boolean,false), 'local_storage_v1', r.key)
    on conflict do nothing;
    get diagnostics v_count = row_count; v_inserted := v_inserted + v_count;
  end loop;
  for r in select value from jsonb_array_elements(coalesce(p_local_custom,'[]'::jsonb)) loop
    if nullif(trim(coalesce(r.value->>'id','')), '') is not null and nullif(trim(coalesce(r.value->>'packetName','')), '') is not null then
      insert into garden.seed_packages(owner_id, seed_name, brand, legacy_source, legacy_source_key)
      values(v_owner, trim(r.value->>'packetName'), nullif(trim(coalesce(r.value->>'brand','')), ''), 'local_storage_v1', r.value->>'id')
      on conflict do nothing;
      get diagnostics v_count = row_count; v_inserted := v_inserted + v_count;
    end if;
  end loop;
  return jsonb_build_object('imported',v_inserted,'inventory',public.garden_seed_packages_list());
end;
$$;

create or replace function public.garden_seed_package_delete(p_package_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_rows integer;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  delete from garden.seed_packages where id=p_package_id and owner_id=v_owner;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Seed package not found'; end if;
  return jsonb_build_object('deleted',true,'id',p_package_id);
end;
$$;

create or replace function public.gardenpedia_get_my_machines()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_result jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select jsonb_build_object('instances',coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'name',s.name,'gardenId',g.id,'gardenName',g.name,
    'gardenKind',g.kind,'positions',g.position_capacity,
    'systemDefinitionKey',s.system_definition_key,'modelId',s.gardenpedia_model_id,
    'status',s.status
  ) order by g.sort_order,g.created_at,s.created_at,s.id),'[]'::jsonb)) into v_result
  from garden.system_instances s join garden.gardens g on g.id=s.garden_id
  where s.owner_id=v_owner and g.owner_id=v_owner and s.status <> 'archived' and g.archived_at is null;
  return v_result;
end;
$$;

revoke all on function public.garden_seed_packages_list() from public, anon;
revoke all on function public.garden_seed_package_save(jsonb) from public, anon;
revoke all on function public.garden_seed_packages_reconcile_legacy(jsonb,jsonb) from public, anon;
revoke all on function public.garden_seed_package_delete(uuid) from public, anon;
revoke all on function public.gardenpedia_get_my_machines() from public, anon;
grant execute on function public.garden_seed_packages_list() to authenticated;
grant execute on function public.garden_seed_package_save(jsonb) to authenticated;
grant execute on function public.garden_seed_packages_reconcile_legacy(jsonb,jsonb) to authenticated;
grant execute on function public.garden_seed_package_delete(uuid) to authenticated;
grant execute on function public.gardenpedia_get_my_machines() to authenticated;

commit;
