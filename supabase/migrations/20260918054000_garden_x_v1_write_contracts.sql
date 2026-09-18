-- Garden X V1 — write contracts for the approved Lovable frontend.
-- Commands are additive and owner-scoped. Canonical writes remain explicit user actions.
begin;

create or replace function public.garden_x_create_plant(
  p_request_id uuid,
  p_plant_instance_id uuid,
  p_position_id uuid,
  p_nickname text,
  p_common_name text,
  p_scientific_name text default null,
  p_cultivar text default null,
  p_reference_key text default null,
  p_planted_on date default null,
  p_planted_on_precision text default 'unknown'
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
    nullif(trim(coalesce(p_reference_key,'')),''),
    trim(p_common_name),nullif(trim(coalesce(p_scientific_name,'')),''),
    nullif(trim(coalesce(p_cultivar,'')),''),'active',
    jsonb_build_object('created_via','garden_x_v1')
  );

  insert into garden.grow_cycles(owner_id,crop_id,plant_instance_id,planted_on,planted_on_precision)
  values(v_owner,v_crop_id,p_plant_instance_id,p_planted_on,p_planted_on_precision)
  returning id into v_cycle_id;

  insert into garden.cycle_occupancies(position_id,grow_cycle_id,occupied_from)
  values(p_position_id,v_cycle_id,p_planted_on);

  insert into garden.events(owner_id,grow_cycle_id,garden_id,event_type,occurred_at,note,event_data)
  values(
    v_owner,v_cycle_id,v_garden_id,'cycle_started',
    coalesce(p_planted_on::timestamptz,now()),
    'Added to garden',
    jsonb_build_object(
      'source','garden_x_v1',
      'occurred_on',p_planted_on,
      'occurred_at_precision',case when p_planted_on is null then 'unknown' else 'date' end
    )
  ) returning id into v_event_id;

  v_response := jsonb_build_object(
    'plant_instance_id',p_plant_instance_id,'grow_cycle_id',v_cycle_id,'event_id',v_event_id
  );
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_create_plant',v_response);
  return v_response;
end;
$$;

create or replace function public.garden_x_update_plant_identity(
  p_request_id uuid,
  p_plant_instance_id uuid,
  p_nickname text,
  p_common_name text,
  p_scientific_name text default null,
  p_cultivar text default null,
  p_reference_key text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
  where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_update_plant_identity';
  if found then return v_response; end if;
  if char_length(trim(coalesce(p_common_name,''))) not between 1 and 100 then raise exception 'Common name is required'; end if;

  update garden.plant_instances
  set nickname=nullif(trim(coalesce(p_nickname,'')),''),
      common_name=trim(p_common_name),
      scientific_name=nullif(trim(coalesce(p_scientific_name,'')),''),
      cultivar=nullif(trim(coalesce(p_cultivar,'')),''),
      reference_key=nullif(trim(coalesce(p_reference_key,'')),''),
      updated_at=now()
  where id=p_plant_instance_id and owner_id=v_owner;
  if not found then raise exception 'Plant not found'; end if;

  v_response:=jsonb_build_object('plant_instance_id',p_plant_instance_id,'updated',true);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_update_plant_identity',v_response);
  return v_response;
end;
$$;

create or replace function public.garden_x_move_plant(
  p_request_id uuid,
  p_plant_instance_id uuid,
  p_target_position_id uuid,
  p_moved_on date
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_source garden.cycle_occupancies%rowtype;
  v_source_garden uuid;
  v_target_garden uuid;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
  where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_move_plant';
  if found then return v_response; end if;
  if p_moved_on is null then raise exception 'Move date is required'; end if;

  select gc.* into v_cycle from garden.grow_cycles gc
  where gc.plant_instance_id=p_plant_instance_id and gc.owner_id=v_owner and gc.state='active'
  order by gc.created_at desc limit 1 for update;
  if not found then raise exception 'Active plant cycle not found'; end if;

  select * into v_source from garden.cycle_occupancies
  where grow_cycle_id=v_cycle.id and occupied_until is null for update;
  if not found then raise exception 'Current occupancy not found'; end if;

  select p.garden_id into v_source_garden from garden.positions p where p.id=v_source.position_id;
  select s.garden_id into v_target_garden
  from garden.positions p join garden.system_instances s on s.id=p.system_instance_id
  where p.id=p_target_position_id and s.owner_id=v_owner and s.status='active';
  if v_target_garden is null then raise exception 'Target position not found'; end if;
  if p_target_position_id=v_source.position_id then raise exception 'Target position is already current'; end if;
  if exists(select 1 from garden.cycle_occupancies where position_id=p_target_position_id and occupied_until is null) then
    raise exception 'Target position already has a current plant';
  end if;

  update garden.cycle_occupancies set occupied_until=p_moved_on where id=v_source.id;
  insert into garden.cycle_occupancies(position_id,grow_cycle_id,occupied_from)
  values(p_target_position_id,v_cycle.id,p_moved_on);
  update garden.grow_cycles set revision=revision+1,updated_at=now() where id=v_cycle.id;

  insert into garden.events(owner_id,grow_cycle_id,garden_id,event_type,occurred_at,note,event_data)
  values(
    v_owner,v_cycle.id,v_target_garden,'cycle_moved',p_moved_on::timestamptz,'Relocated',
    jsonb_build_object('source','garden_x_v1','from_garden_id',v_source_garden,'from_position_id',v_source.position_id,
      'to_garden_id',v_target_garden,'to_position_id',p_target_position_id,'occurred_on',p_moved_on,'occurred_at_precision','date')
  ) returning id into v_event_id;

  v_response:=jsonb_build_object('plant_instance_id',p_plant_instance_id,'grow_cycle_id',v_cycle.id,'event_id',v_event_id);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_move_plant',v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_create_plant(uuid,uuid,uuid,text,text,text,text,text,date,text) from public;
revoke all on function public.garden_x_update_plant_identity(uuid,uuid,text,text,text,text,text) from public;
revoke all on function public.garden_x_move_plant(uuid,uuid,uuid,date) from public;
grant execute on function public.garden_x_create_plant(uuid,uuid,uuid,text,text,text,text,text,date,text) to authenticated;
grant execute on function public.garden_x_update_plant_identity(uuid,uuid,text,text,text,text,text) to authenticated;
grant execute on function public.garden_x_move_plant(uuid,uuid,uuid,date) to authenticated;

commit;
