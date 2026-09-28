-- Canonical private My Seeds inventory and explicit links from system instances
-- to public Gardenpedia machine definitions. No Garden Labs or local records
-- are imported by this migration.
begin;

alter table garden.system_instances
  add column if not exists gardenpedia_model_id text;

comment on column garden.system_instances.gardenpedia_model_id is
  'Optional link to a public Gardenpedia machine model. Set only from an explicit system-definition mapping; never inferred from editable labels.';

-- These are the only currently verified Garden X definition -> Gardenpedia
-- model links. Custom and other system definitions remain unlinked.
update garden.system_instances
set gardenpedia_model_id = case system_definition_key
  when 'uruq_8_v1' then 'uruq-hp-gc001'
  when 'uruq_12_v1' then 'uruq-hp-gc202'
end,
updated_at = now()
where system_definition_key in ('uruq_8_v1', 'uruq_12_v1')
  and gardenpedia_model_id is null;

create table garden.seed_packages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  library_plant_id text references garden.library_catalog_items(library_plant_id) on update cascade on delete set null,
  seed_name text not null check (char_length(trim(seed_name)) between 1 and 160),
  brand text check (brand is null or char_length(trim(brand)) <= 160),
  package_status text not null default 'unknown' check (package_status in ('opened','unopened','unknown')),
  quantity_level text not null default 'unknown' check (quantity_level in ('full','high','medium','low','almost_empty','unknown')),
  storage_location text check (storage_location is null or char_length(storage_location) <= 300),
  purchase_date date,
  legacy_purchase_year text check (legacy_purchase_year is null or char_length(legacy_purchase_year) <= 12),
  germination_test_date date,
  germination_result_pct integer check (germination_result_pct between 0 and 100),
  notes text check (notes is null or char_length(notes) <= 5000),
  archived boolean not null default false,
  legacy_source text,
  legacy_source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((legacy_source is null) = (legacy_source_key is null))
);

create index seed_packages_owner_updated_idx
  on garden.seed_packages(owner_id, archived, updated_at desc);
create unique index seed_packages_legacy_reconciliation_idx
  on garden.seed_packages(owner_id, legacy_source, legacy_source_key)
  where legacy_source is not null;
alter table garden.seed_packages enable row level security;
create policy "owners read their seed packages" on garden.seed_packages
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "owners insert their seed packages" on garden.seed_packages
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "owners update their seed packages" on garden.seed_packages
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "owners delete their seed packages" on garden.seed_packages
  for delete to authenticated using ((select auth.uid()) = owner_id);
revoke all on garden.seed_packages from public, anon, authenticated;

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

-- Called only after the user explicitly chooses Import. It preserves legacy
-- localStorage and garden_lab rows, and a unique source key makes retries safe.
create or replace function public.garden_seed_packages_reconcile_legacy(
  p_local_state jsonb default '{}'::jsonb, p_local_custom jsonb default '[]'::jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid(); v_inserted integer := 0; v_count integer := 0;
  r record; v_custom jsonb; v_identity text; v_name text; v_brand text;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  -- Prior private Garden Labs entries are explicit personal inventory, unlike
  -- the 37 read-only packet-evidence source records (which are never imported).
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
  -- Custom legacy packages may have no seed_personal_state row.
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
  -- Include local custom packages that had no personal-state object yet.
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
revoke all on function public.gardenpedia_get_my_machines() from public, anon;
grant execute on function public.garden_seed_packages_list() to authenticated;
grant execute on function public.garden_seed_package_save(jsonb) to authenticated;
grant execute on function public.garden_seed_packages_reconcile_legacy(jsonb,jsonb) to authenticated;
grant execute on function public.gardenpedia_get_my_machines() to authenticated;

commit;
