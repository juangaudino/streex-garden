-- F1B Plant Life Model: store cycle origin and extend the existing F1 fact
-- metadata. Moments remain observations/events; no second history is created.
begin;

alter table garden.grow_cycles
  add column if not exists origin_type text not null default 'unknown';

alter table garden.grow_cycles
  add constraint grow_cycles_origin_type_check
  check (origin_type in ('unknown', 'seed', 'bare_root', 'cutting', 'seedling', 'transplant'))
  not valid;
alter table garden.grow_cycles validate constraint grow_cycles_origin_type_check;
comment on column garden.grow_cycles.origin_type is
  'How this observed plant life cycle began; unknown preserves cycles created before origin capture.';

-- Replace, rather than overload, these RPC identities. Older callers may omit
-- the trailing defaulted argument; PostgREST therefore still has one match.
drop function public.garden_x_create_plant(uuid,uuid,uuid,text,text,text,text,text,date,text);
create function public.garden_x_create_plant(
  p_request_id uuid,
  p_plant_instance_id uuid,
  p_position_id uuid,
  p_nickname text,
  p_common_name text,
  p_scientific_name text default null,
  p_cultivar text default null,
  p_reference_key text default null,
  p_planted_on date default null,
  p_planted_on_precision text default 'unknown',
  p_origin_type text default 'unknown'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_crop_id uuid;
  v_cycle_id uuid;
  v_event_id uuid;
  v_garden_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
  where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_create_plant';
  if found then return v_response; end if;
  if p_plant_instance_id is null then raise exception 'Plant id is required'; end if;
  if char_length(trim(coalesce(p_common_name,''))) not between 1 and 100 then raise exception 'Common name is required'; end if;
  if p_planted_on_precision not in ('exact','approximate','unknown') then raise exception 'Invalid planted date precision'; end if;
  if (p_planted_on is null and p_planted_on_precision <> 'unknown')
     or (p_planted_on is not null and p_planted_on_precision='unknown') then
    raise exception 'Planting date and precision do not match';
  end if;
  if p_origin_type is null or p_origin_type not in ('unknown','seed','bare_root','cutting','seedling','transplant') then
    raise exception 'Invalid plant origin';
  end if;

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
  values(v_owner,trim(p_common_name),nullif(trim(coalesce(p_scientific_name,'')),''))
  on conflict(owner_id,common_name) do update
    set scientific_name=coalesce(garden.crops.scientific_name,excluded.scientific_name)
  returning id into v_crop_id;
  insert into garden.plant_instances(
    id,owner_id,nickname,reference_key,common_name,scientific_name,cultivar,status,metadata
  ) values(
    p_plant_instance_id,v_owner,nullif(trim(coalesce(p_nickname,'')),''),
    nullif(trim(coalesce(p_reference_key,'')),''),trim(p_common_name),
    nullif(trim(coalesce(p_scientific_name,'')),''),nullif(trim(coalesce(p_cultivar,'')),''),
    'active',jsonb_build_object('created_via','garden_x_v1')
  );
  insert into garden.grow_cycles(owner_id,crop_id,plant_instance_id,planted_on,planted_on_precision,origin_type)
  values(v_owner,v_crop_id,p_plant_instance_id,p_planted_on,p_planted_on_precision,p_origin_type)
  returning id into v_cycle_id;
  insert into garden.cycle_occupancies(position_id,grow_cycle_id,occupied_from)
  values(p_position_id,v_cycle_id,p_planted_on);
  insert into garden.events(owner_id,grow_cycle_id,garden_id,event_type,occurred_at,note,event_data)
  values(v_owner,v_cycle_id,v_garden_id,'cycle_started',coalesce(p_planted_on::timestamptz,now()),'Added to garden',
    jsonb_build_object('source','garden_x_v1','occurred_on',p_planted_on,
      'occurred_at_precision',case when p_planted_on is null then 'unknown' else 'date' end))
  returning id into v_event_id;
  v_response := jsonb_build_object('plant_instance_id',p_plant_instance_id,'grow_cycle_id',v_cycle_id,'event_id',v_event_id);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_create_plant',v_response);
  return v_response;
end;
$$;
revoke all on function public.garden_x_create_plant(uuid,uuid,uuid,text,text,text,text,text,date,text,text) from public, anon;
grant execute on function public.garden_x_create_plant(uuid,uuid,uuid,text,text,text,text,text,date,text,text) to authenticated;

drop function public.garden_x_create_library_plant(uuid,uuid,uuid,text,text,date,text);
create function public.garden_x_create_library_plant(
  p_request_id uuid,
  p_plant_instance_id uuid,
  p_position_id uuid,
  p_library_plant_id text,
  p_nickname text default null,
  p_planted_on date default null,
  p_planted_on_precision text default 'unknown',
  p_origin_type text default 'unknown'
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
  if p_origin_type is null or p_origin_type not in ('unknown','seed','bare_root','cutting','seedling','transplant') then
    raise exception 'Invalid plant origin';
  end if;

  select * into v_catalog from garden.library_catalog_items
  where library_plant_id=trim(coalesce(p_library_plant_id,'')) and status='active';
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
  insert into garden.grow_cycles(owner_id,crop_id,plant_instance_id,planted_on,planted_on_precision,origin_type)
  values(v_owner,v_crop_id,p_plant_instance_id,p_planted_on,p_planted_on_precision,p_origin_type)
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
revoke all on function public.garden_x_create_library_plant(uuid,uuid,uuid,text,text,date,text,text) from public, anon;
grant execute on function public.garden_x_create_library_plant(uuid,uuid,uuid,text,text,date,text,text) to authenticated;

-- F1's metadata key/values remain readable. New stable identifiers are added
-- to the same optional field; no historic rows are rewritten.
create or replace function public.garden_x_create_journal_moment(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_occurred_on date,
  p_note text default null,
  p_milestone text default null,
  p_has_photo boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
  v_garden_id uuid;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_occurred_on is null then raise exception 'Moment date is required'; end if;
  if p_milestone is not null and p_milestone not in (
    'germinated','sprouted','flowering','fruiting','harvest',
    'growth_observed','flowered','fruited','harvested','regrowth','propagated',
    'transplanted','damaged','recovered'
  ) then raise exception 'Unsupported journal milestone'; end if;
  if char_length(coalesce(trim(p_note), '')) > 1000 then raise exception 'Moment note is too long'; end if;
  if nullif(trim(p_note), '') is null and p_milestone is null and not coalesce(p_has_photo, false) then
    raise exception 'A moment needs a photo, note, or milestone';
  end if;
  v_payload := jsonb_build_object('grow_cycle_id',p_grow_cycle_id,'occurred_on',p_occurred_on,
    'note',nullif(trim(p_note),''),'milestone',p_milestone,'has_photo',coalesce(p_has_photo,false));
  v_response := garden.command_response(v_owner,p_request_id,'garden_x_create_journal_moment',v_payload);
  if v_response is not null then return v_response; end if;
  select p.garden_id into v_garden_id
  from garden.grow_cycles gc
  join garden.cycle_occupancies o on o.grow_cycle_id=gc.id and o.occupied_until is null
  join garden.positions p on p.id=o.position_id
  where gc.id=p_grow_cycle_id and gc.owner_id=v_owner and gc.state='active'
  limit 1;
  if not found then raise exception 'Current grow cycle not found'; end if;
  insert into garden.events(owner_id,garden_id,grow_cycle_id,event_type,occurred_at,note,event_data)
  values(v_owner,v_garden_id,p_grow_cycle_id,'observation',
    (p_occurred_on::timestamp + interval '12 hours') at time zone 'UTC',nullif(trim(p_note),''),
    jsonb_build_object('source','garden_x_journal','occurred_on',p_occurred_on,
      'occurred_at_precision','date','journal_milestone',p_milestone,
      'photo_expected',coalesce(p_has_photo,false)))
  returning id into v_event_id;
  v_response := jsonb_build_object('event_id',v_event_id);
  perform garden.store_command_response(v_owner,p_request_id,'garden_x_create_journal_moment',v_payload,v_response);
  return v_response;
end;
$$;
revoke all on function public.garden_x_create_journal_moment(uuid,uuid,date,text,text,boolean) from public, anon;
grant execute on function public.garden_x_create_journal_moment(uuid,uuid,date,text,text,boolean) to authenticated;

-- Keep the deployed bootstrap wrapper intact while projecting cycle origin into
-- the existing plant payload. Missing/legacy cycle values safely read unknown.
create or replace function public.garden_x_get_bootstrap()
returns jsonb
language sql stable security definer set search_path = '' as $$
with base as (
  select public.garden_x_get_bootstrap_b35_base() as value
), gardens as (
  select coalesce(jsonb_agg(
    item || jsonb_strip_nulls(jsonb_build_object(
      'cultivation_method', case
        when s.metadata->>'cultivation_method' in ('hydroponic','soil','container') then s.metadata->>'cultivation_method'
        else null
      end
    )) order by entries.ordinality
  ), '[]'::jsonb) as value
  from base
  cross join lateral jsonb_array_elements(base.value->'gardens') with ordinality as entries(item, ordinality)
  left join garden.system_instances s
    on s.id=nullif(item->>'system_instance_id','')::uuid
   and s.owner_id=public.garden_owner_id()
), plants as (
  select coalesce(jsonb_agg(
    item || jsonb_build_object('origin_type',coalesce(gc.origin_type,'unknown')) order by entries.ordinality
  ), '[]'::jsonb) as value
  from base
  cross join lateral jsonb_array_elements(base.value->'plants') with ordinality as entries(item, ordinality)
  left join garden.grow_cycles gc
    on gc.id=nullif(item->>'grow_cycle_id','')::uuid
   and gc.owner_id=public.garden_owner_id()
)
select jsonb_set(
  jsonb_set(base.value,'{gardens}',gardens.value,true),
  '{plants}',plants.value,true
)
from base cross join gardens cross join plants;
$$;
revoke all on function public.garden_x_get_bootstrap() from public, anon;
grant execute on function public.garden_x_get_bootstrap() to authenticated;

notify pgrst, 'reload schema';
commit;
