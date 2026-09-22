-- Garden X temporary reorganization: a position may briefly hold more than one
-- active cycle while plants are moved between systems. Each cycle still has one
-- current position; only the position-level uniqueness is relaxed.
begin;

drop index if exists garden.cycle_occupancies_one_current_position;

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

  -- Do not reject an occupied target: temporary shared occupancy is intentional
  -- during physical reorganization. The cycle-level unique index still ensures
  -- this plant/cycle cannot have two current positions.
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

revoke all on function public.garden_x_move_plant(uuid,uuid,uuid,date) from public;
grant execute on function public.garden_x_move_plant(uuid,uuid,uuid,date) to authenticated;

commit;
