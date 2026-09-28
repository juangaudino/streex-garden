-- Garden X V1 — Garden commands + atomic replace/reseed.
begin;

create or replace function public.garden_x_create_garden(
  p_request_id uuid,
  p_garden_id uuid,
  p_system_instance_id uuid,
  p_name text,
  p_kind text,
  p_place text,
  p_note text,
  p_system_definition_key text,
  p_system_name text,
  p_position_capacity integer
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_layout text := 'custom_grid';
  v_position_id uuid;
  v_n integer;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
   where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_create_garden';
  if found then return v_response; end if;

  if p_garden_id is null or p_system_instance_id is null then raise exception 'Ids are required'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 80 then raise exception 'Garden name is required'; end if;
  if p_position_capacity not between 1 and 36 then raise exception 'Position capacity must be from 1 to 36'; end if;

  v_layout := case
    when p_system_definition_key='uruq_8_v1' then 'uruq_8_v1'
    when p_system_definition_key='uruq_12_v1' then 'uruq_12_v1'
    else 'custom_grid'
  end;

  insert into garden.gardens(
    id,owner_id,name,system_model,position_capacity,map_layout,kind,place,note,sort_order
  ) values(
    p_garden_id,v_owner,trim(p_name),nullif(trim(coalesce(p_system_name,'')),''),
    p_position_capacity,v_layout,coalesce(nullif(trim(coalesce(p_kind,'')),''),'hydroponic'),
    coalesce(trim(p_place),''),coalesce(trim(p_note),''),
    coalesce((select max(sort_order)+1 from garden.gardens where owner_id=v_owner),0)
  );

  insert into garden.system_instances(
    id,owner_id,garden_id,name,system_definition_key,legacy_system_model,status,metadata
  ) values(
    p_system_instance_id,v_owner,p_garden_id,
    coalesce(nullif(trim(coalesce(p_system_name,'')),''),trim(p_name)),
    nullif(trim(coalesce(p_system_definition_key,'')),''),
    nullif(trim(coalesce(p_system_name,'')),''),
    'active',jsonb_build_object('created_via','garden_x_v1','baseline_bridge','garden_x_v1')
  );

  for v_n in 1..p_position_capacity loop
    insert into garden.positions(garden_id,system_instance_id,position_number)
    values(p_garden_id,p_system_instance_id,v_n) returning id into v_position_id;

    insert into garden.layout_sites(
      garden_id,system_instance_id,position_id,site_kind,is_active,grid_x,grid_y
    ) values(
      p_garden_id,p_system_instance_id,v_position_id,'grow',true,
      case
        when v_layout='uruq_8_v1' then case v_n when 1 then 2 when 2 then 6 when 3 then 1 when 4 then 4 when 5 then 7 when 6 then 1 when 7 then 4 when 8 then 7 end
        when v_layout='uruq_12_v1' then case v_n when 1 then 4 when 2 then 1 when 3 then 3 when 4 then 5 when 5 then 7 when 6 then 2 when 7 then 4 when 8 then 6 when 9 then 1 when 10 then 3 when 11 then 5 when 12 then 7 end
        else ((v_n-1)%4)*2+1
      end,
      case
        when v_layout='uruq_8_v1' then case when v_n<=2 then 1 when v_n<=5 then 2 else 3 end
        when v_layout='uruq_12_v1' then case when v_n=1 then 1 when v_n<=5 then 2 when v_n<=8 then 3 else 4 end
        else ((v_n-1)/4)+1
      end
    );
  end loop;

  insert into garden.layout_events(owner_id,garden_id,operation,event_data)
  values(v_owner,p_garden_id,'site_added',jsonb_build_object('source','garden_x_v1','layout',v_layout));

  v_response:=jsonb_build_object('garden_id',p_garden_id,'system_instance_id',p_system_instance_id);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_create_garden',v_response);
  return v_response;
end;
$$;

create or replace function public.garden_x_update_garden(
  p_request_id uuid,
  p_garden_id uuid,
  p_name text,
  p_kind text,
  p_place text,
  p_note text,
  p_archived boolean default false
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
   where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_update_garden';
  if found then return v_response; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 80 then raise exception 'Garden name is required'; end if;

  update garden.gardens
  set name=trim(p_name),
      kind=coalesce(nullif(trim(coalesce(p_kind,'')),''),kind),
      place=coalesce(trim(p_place),''),
      note=coalesce(trim(p_note),''),
      archived_at=case when p_archived then coalesce(archived_at,now()) else null end,
      updated_at=now()
  where id=p_garden_id and owner_id=v_owner;
  if not found then raise exception 'Garden not found'; end if;

  v_response:=jsonb_build_object('garden_id',p_garden_id,'updated',true,'archived',p_archived);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_update_garden',v_response);
  return v_response;
end;
$$;

create or replace function public.garden_x_reorder_gardens(
  p_request_id uuid,
  p_garden_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_id uuid;
  v_i integer := 0;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
   where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_reorder_gardens';
  if found then return v_response; end if;
  if coalesce(cardinality(p_garden_ids),0)=0 then raise exception 'Garden order is required'; end if;
  if (select count(*) from garden.gardens where owner_id=v_owner and id=any(p_garden_ids)) <> cardinality(p_garden_ids)
    then raise exception 'Garden order contains an unavailable garden'; end if;

  foreach v_id in array p_garden_ids loop
    update garden.gardens set sort_order=v_i,updated_at=now() where id=v_id and owner_id=v_owner;
    v_i:=v_i+1;
  end loop;

  v_response:=jsonb_build_object('updated',true,'count',cardinality(p_garden_ids));
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_reorder_gardens',v_response);
  return v_response;
end;
$$;

create or replace function public.garden_x_delete_garden(
  p_request_id uuid,
  p_garden_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
   where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_delete_garden';
  if found then return v_response; end if;
  if not exists(select 1 from garden.gardens where id=p_garden_id and owner_id=v_owner and archived_at is not null)
    then raise exception 'Archive the garden before permanent deletion'; end if;

  delete from garden.gardens where id=p_garden_id and owner_id=v_owner;
  v_response:=jsonb_build_object('garden_id',p_garden_id,'deleted',true);
  -- Receipt intentionally cannot survive owner/garden cascade semantics if dependencies remove it later.
  return v_response;
end;
$$;

create or replace function public.garden_x_replace_plant(
  p_request_id uuid,
  p_old_plant_instance_id uuid,
  p_new_plant_instance_id uuid,
  p_nickname text,
  p_common_name text,
  p_scientific_name text default null,
  p_cultivar text default null,
  p_reference_key text default null,
  p_started_on date default current_date
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_old_cycle garden.grow_cycles%rowtype;
  v_occ garden.cycle_occupancies%rowtype;
  v_crop_id uuid;
  v_new_cycle_id uuid;
  v_end_event_id uuid;
  v_start_event_id uuid;
  v_garden_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
   where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_replace_plant';
  if found then return v_response; end if;
  if p_started_on is null then raise exception 'Start date is required'; end if;
  if char_length(trim(coalesce(p_common_name,''))) not between 1 and 100 then raise exception 'Common name is required'; end if;

  select gc.* into v_old_cycle
  from garden.grow_cycles gc
  where gc.plant_instance_id=p_old_plant_instance_id and gc.owner_id=v_owner and gc.state='active'
  order by gc.created_at desc limit 1 for update;
  if not found then raise exception 'Current plant cycle not found'; end if;

  select * into v_occ from garden.cycle_occupancies
  where grow_cycle_id=v_old_cycle.id and occupied_until is null for update;
  if not found then raise exception 'Current occupancy not found'; end if;
  if v_occ.occupied_from is not null and p_started_on<v_occ.occupied_from then raise exception 'Replacement cannot precede occupancy'; end if;

  select p.garden_id into v_garden_id from garden.positions p where p.id=v_occ.position_id;

  update garden.cycle_occupancies set occupied_until=p_started_on where id=v_occ.id;
  update garden.grow_cycles set state='closed',revision=revision+1,updated_at=now() where id=v_old_cycle.id;
  update garden.plant_instances set status='ended',updated_at=now() where id=p_old_plant_instance_id and owner_id=v_owner;

  insert into garden.events(owner_id,grow_cycle_id,garden_id,event_type,occurred_at,note,event_data)
  values(v_owner,v_old_cycle.id,v_garden_id,'cycle_ended',p_started_on::timestamptz,
    'Cycle closed: replacement',jsonb_build_object('source','garden_x_v1','reason','replacement','occurred_on',p_started_on,'occurred_at_precision','date'))
  returning id into v_end_event_id;

  insert into garden.cycle_revisions(owner_id,grow_cycle_id,revision_number,operation,previous_values,next_values,reason)
  values(v_owner,v_old_cycle.id,v_old_cycle.revision+1,'closed',
    jsonb_build_object('state',v_old_cycle.state,'occupied_until',v_occ.occupied_until),
    jsonb_build_object('state','closed','occupied_until',p_started_on),'replacement');

  insert into garden.crops(owner_id,common_name,scientific_name)
  values(v_owner,trim(p_common_name),nullif(trim(coalesce(p_scientific_name,'')),''))
  on conflict(owner_id,common_name) do update set scientific_name=coalesce(garden.crops.scientific_name,excluded.scientific_name)
  returning id into v_crop_id;

  insert into garden.plant_instances(id,owner_id,nickname,reference_key,common_name,scientific_name,cultivar,status,metadata)
  values(p_new_plant_instance_id,v_owner,nullif(trim(coalesce(p_nickname,'')),''),
    nullif(trim(coalesce(p_reference_key,'')),''),
    trim(p_common_name),nullif(trim(coalesce(p_scientific_name,'')),''),
    nullif(trim(coalesce(p_cultivar,'')),''),'active',jsonb_build_object('created_via','garden_x_v1','replaced_plant_id',p_old_plant_instance_id));

  insert into garden.grow_cycles(owner_id,crop_id,plant_instance_id,planted_on,planted_on_precision)
  values(v_owner,v_crop_id,p_new_plant_instance_id,p_started_on,'exact') returning id into v_new_cycle_id;
  insert into garden.cycle_occupancies(position_id,grow_cycle_id,occupied_from)
  values(v_occ.position_id,v_new_cycle_id,p_started_on);

  insert into garden.events(owner_id,grow_cycle_id,garden_id,event_type,occurred_at,note,event_data)
  values(v_owner,v_new_cycle_id,v_garden_id,'cycle_started',p_started_on::timestamptz,'Added to garden',
    jsonb_build_object('source','garden_x_v1','replaced_plant_id',p_old_plant_instance_id,'occurred_on',p_started_on,'occurred_at_precision','date'))
  returning id into v_start_event_id;

  v_response:=jsonb_build_object('old_plant_instance_id',p_old_plant_instance_id,'new_plant_instance_id',p_new_plant_instance_id,
    'new_grow_cycle_id',v_new_cycle_id,'end_event_id',v_end_event_id,'start_event_id',v_start_event_id,'position_id',v_occ.position_id);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_replace_plant',v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_create_garden(uuid,uuid,uuid,text,text,text,text,text,text,integer) from public;
revoke all on function public.garden_x_update_garden(uuid,uuid,text,text,text,text,boolean) from public;
revoke all on function public.garden_x_reorder_gardens(uuid,uuid[]) from public;
revoke all on function public.garden_x_delete_garden(uuid,uuid) from public;
revoke all on function public.garden_x_replace_plant(uuid,uuid,uuid,text,text,text,text,text,date) from public;
grant execute on function public.garden_x_create_garden(uuid,uuid,uuid,text,text,text,text,text,text,integer) to authenticated;
grant execute on function public.garden_x_update_garden(uuid,uuid,text,text,text,text,boolean) to authenticated;
grant execute on function public.garden_x_reorder_gardens(uuid,uuid[]) to authenticated;
grant execute on function public.garden_x_delete_garden(uuid,uuid) to authenticated;
grant execute on function public.garden_x_replace_plant(uuid,uuid,uuid,text,text,text,text,text,date) to authenticated;

commit;
