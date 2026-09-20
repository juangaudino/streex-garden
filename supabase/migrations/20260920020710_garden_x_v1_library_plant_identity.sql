-- Garden X V1 — Library-backed plant identities. Gardenpedia remains the
-- source of knowledge; this table is only a small, deployment-synced identity cache.
begin;

create table garden.library_catalog_items (
  library_plant_id text primary key check (library_plant_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  catalog_version text not null check (char_length(catalog_version) between 1 and 120),
  common_name text not null check (char_length(trim(common_name)) between 1 and 100),
  scientific_name text,
  cultivar text,
  aliases jsonb not null default '[]'::jsonb check (jsonb_typeof(aliases) = 'array'),
  category text not null check (char_length(trim(category)) between 1 and 80),
  status text not null default 'active' check (status in ('active','retired')),
  provenance jsonb not null default '[]'::jsonb check (jsonb_typeof(provenance) = 'array'),
  synced_at timestamptz not null default now()
);
alter table garden.library_catalog_items enable row level security;
revoke all on table garden.library_catalog_items from anon, authenticated;

alter table garden.plant_instances
  add column if not exists library_plant_id text references garden.library_catalog_items(library_plant_id) on update cascade,
  add column if not exists library_catalog_version text,
  add column if not exists library_common_name_snapshot text,
  add column if not exists library_scientific_name_snapshot text,
  add column if not exists library_cultivar_snapshot text;

alter table garden.plant_instances
  add constraint plant_instances_library_identity_check check (
    (library_plant_id is null and library_catalog_version is null)
    or (library_plant_id is not null and library_catalog_version is not null)
  ) not valid;
alter table garden.plant_instances validate constraint plant_instances_library_identity_check;
create index if not exists plant_instances_owner_library_plant_idx
  on garden.plant_instances(owner_id, library_plant_id) where library_plant_id is not null;

create or replace function public.garden_x_create_library_plant(
  p_request_id uuid,
  p_plant_instance_id uuid,
  p_position_id uuid,
  p_library_plant_id text,
  p_nickname text default null,
  p_planted_on date default null,
  p_planted_on_precision text default 'unknown'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_catalog garden.library_catalog_items%rowtype;
  v_crop_id uuid;
  v_cycle_id uuid;
  v_event_id uuid;
  v_garden_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
  where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_create_library_plant';
  if found then return v_response; end if;
  if p_plant_instance_id is null or p_position_id is null then raise exception 'Plant and position are required'; end if;
  if p_planted_on_precision not in ('exact','approximate','unknown') then raise exception 'Invalid planted date precision'; end if;
  if (p_planted_on is null and p_planted_on_precision <> 'unknown')
    or (p_planted_on is not null and p_planted_on_precision='unknown') then
    raise exception 'Planting date and precision do not match';
  end if;

  select * into v_catalog from garden.library_catalog_items
  where library_plant_id = trim(coalesce(p_library_plant_id,'')) and status='active';
  if not found then raise exception 'Garden Library identity is unavailable'; end if;

  select g.id into v_garden_id
  from garden.positions p
  join garden.system_instances s on s.id=p.system_instance_id
  join garden.gardens g on g.id=s.garden_id
  where p.id=p_position_id and s.owner_id=v_owner and g.owner_id=v_owner and s.status='active';
  if v_garden_id is null then raise exception 'Position not found'; end if;
  if exists(select 1 from garden.cycle_occupancies where position_id=p_position_id and occupied_until is null) then
    raise exception 'Position already has a current plant';
  end if;

  insert into garden.crops(owner_id,common_name,scientific_name)
  values(v_owner,v_catalog.common_name,v_catalog.scientific_name)
  on conflict(owner_id,common_name) do update
    set scientific_name=coalesce(garden.crops.scientific_name,excluded.scientific_name)
  returning id into v_crop_id;

  insert into garden.plant_instances(
    id,owner_id,nickname,reference_key,common_name,scientific_name,cultivar,status,metadata,
    library_plant_id,library_catalog_version,library_common_name_snapshot,
    library_scientific_name_snapshot,library_cultivar_snapshot
  ) values(
    p_plant_instance_id,v_owner,nullif(trim(coalesce(p_nickname,'')),''),
    v_catalog.library_plant_id,v_catalog.common_name,v_catalog.scientific_name,v_catalog.cultivar,'active',
    jsonb_build_object('created_via','garden_x_v1_library','library_plant_id',v_catalog.library_plant_id),
    v_catalog.library_plant_id,v_catalog.catalog_version,v_catalog.common_name,
    v_catalog.scientific_name,v_catalog.cultivar
  );
  insert into garden.grow_cycles(owner_id,crop_id,plant_instance_id,planted_on,planted_on_precision)
  values(v_owner,v_crop_id,p_plant_instance_id,p_planted_on,p_planted_on_precision)
  returning id into v_cycle_id;
  insert into garden.cycle_occupancies(position_id,grow_cycle_id,occupied_from)
  values(p_position_id,v_cycle_id,p_planted_on);
  insert into garden.events(owner_id,grow_cycle_id,garden_id,event_type,occurred_at,note,event_data)
  values(v_owner,v_cycle_id,v_garden_id,'cycle_started',coalesce(p_planted_on::timestamptz,now()),'Added to garden',
    jsonb_build_object('source','garden_x_v1_library','library_plant_id',v_catalog.library_plant_id,
      'library_catalog_version',v_catalog.catalog_version,'occurred_on',p_planted_on,
      'occurred_at_precision',case when p_planted_on is null then 'unknown' else 'date' end))
  returning id into v_event_id;
  v_response := jsonb_build_object('plant_instance_id',p_plant_instance_id,'grow_cycle_id',v_cycle_id,'event_id',v_event_id);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_create_library_plant',v_response);
  return v_response;
end;
$$;

create or replace function public.garden_x_update_library_plant_identity(
  p_request_id uuid,
  p_plant_instance_id uuid,
  p_nickname text,
  p_library_plant_id text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_catalog garden.library_catalog_items%rowtype;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
  where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_update_library_plant_identity';
  if found then return v_response; end if;
  select * into v_catalog from garden.library_catalog_items
  where library_plant_id=trim(coalesce(p_library_plant_id,'')) and status='active';
  if not found then raise exception 'Garden Library identity is unavailable'; end if;
  update garden.plant_instances
  set nickname=nullif(trim(coalesce(p_nickname,'')),''), reference_key=v_catalog.library_plant_id,
      common_name=v_catalog.common_name, scientific_name=v_catalog.scientific_name, cultivar=v_catalog.cultivar,
      library_plant_id=v_catalog.library_plant_id, library_catalog_version=v_catalog.catalog_version,
      library_common_name_snapshot=coalesce(library_common_name_snapshot,v_catalog.common_name),
      library_scientific_name_snapshot=coalesce(library_scientific_name_snapshot,v_catalog.scientific_name),
      library_cultivar_snapshot=coalesce(library_cultivar_snapshot,v_catalog.cultivar), updated_at=now()
  where id=p_plant_instance_id and owner_id=v_owner;
  if not found then raise exception 'Plant not found'; end if;
  v_response:=jsonb_build_object('plant_instance_id',p_plant_instance_id,'updated',true);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_update_library_plant_identity',v_response);
  return v_response;
end;
$$;

-- Replacement keeps the established lifecycle closure semantics, while the
-- successor resolves an active Garden Library identity before any write.
create or replace function public.garden_x_replace_library_plant(
  p_request_id uuid,
  p_old_plant_instance_id uuid,
  p_new_plant_instance_id uuid,
  p_nickname text,
  p_library_plant_id text,
  p_started_on date default current_date
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_catalog garden.library_catalog_items%rowtype;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
  where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_replace_library_plant';
  if found then return v_response; end if;
  select * into v_catalog from garden.library_catalog_items
  where library_plant_id=trim(coalesce(p_library_plant_id,'')) and status='active';
  if not found then raise exception 'Garden Library identity is unavailable'; end if;
  v_response := public.garden_x_replace_plant(
    p_request_id,p_old_plant_instance_id,p_new_plant_instance_id,p_nickname,
    v_catalog.common_name,v_catalog.scientific_name,v_catalog.cultivar,
    v_catalog.library_plant_id,p_started_on
  );
  update garden.plant_instances
  set library_plant_id=v_catalog.library_plant_id, library_catalog_version=v_catalog.catalog_version,
      library_common_name_snapshot=v_catalog.common_name,
      library_scientific_name_snapshot=v_catalog.scientific_name,
      library_cultivar_snapshot=v_catalog.cultivar,
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('created_via','garden_x_v1_library_replacement'),
      updated_at=now()
  where id=p_new_plant_instance_id and owner_id=v_owner;
  v_response := v_response || jsonb_build_object('library_plant_id',v_catalog.library_plant_id,'library_catalog_version',v_catalog.catalog_version);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_replace_library_plant',v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_create_library_plant(uuid,uuid,uuid,text,text,date,text) from public;
revoke all on function public.garden_x_update_library_plant_identity(uuid,uuid,text,text) from public;
revoke all on function public.garden_x_replace_library_plant(uuid,uuid,uuid,text,text,date) from public;
grant execute on function public.garden_x_create_library_plant(uuid,uuid,uuid,text,text,date,text) to authenticated;
grant execute on function public.garden_x_update_library_plant_identity(uuid,uuid,text,text) to authenticated;
grant execute on function public.garden_x_replace_library_plant(uuid,uuid,uuid,text,text,date) to authenticated;

-- Preserve the established projection while enriching it with the immutable
-- Library identity snapshot. The legacy projection stays private to this wrapper.
alter function public.garden_x_get_bootstrap() rename to garden_x_get_bootstrap_legacy;
create or replace function public.garden_x_get_bootstrap()
returns jsonb
language sql stable security definer set search_path = '' as $$
with payload as (
  select public.garden_x_get_bootstrap_legacy() as value
), plants as (
  select coalesce(jsonb_agg(
    item || jsonb_strip_nulls(jsonb_build_object(
      'library_plant_id', pi.library_plant_id,
      'library_catalog_version', pi.library_catalog_version,
      'library_common_name_snapshot', pi.library_common_name_snapshot,
      'library_scientific_name_snapshot', pi.library_scientific_name_snapshot,
      'library_cultivar_snapshot', pi.library_cultivar_snapshot
    )) order by ordinality
  ), '[]'::jsonb) as value
  from payload
  cross join lateral jsonb_array_elements(payload.value->'plants') with ordinality as entries(item, ordinality)
  left join garden.plant_instances pi on pi.id = (entries.item->>'id')::uuid
)
select jsonb_set(payload.value, '{plants}', plants.value, true)
from payload cross join plants;
$$;
revoke all on function public.garden_x_get_bootstrap_legacy() from public;
revoke all on function public.garden_x_get_bootstrap() from public;
grant execute on function public.garden_x_get_bootstrap() to authenticated;

commit;
