-- Phase 4 read model for position history and the minimal manual harvest command.
begin;

create or replace function public.garden_record_harvest(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_expected_revision integer,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'note', nullif(trim(p_note), ''));
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'record_harvest', v_payload);
  if v_response is not null then return v_response; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'active' then raise exception 'Current grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before recording harvest'; end if;
  insert into garden.events(owner_id, grow_cycle_id, event_type, note)
  values (v_owner, p_grow_cycle_id, 'harvest', nullif(trim(p_note), '')) returning id into v_event_id;
  v_response := jsonb_build_object('event_id', v_event_id, 'grow_cycle_id', p_grow_cycle_id);
  perform garden.store_command_response(v_owner, p_request_id, 'record_harvest', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_get_garden(p_garden_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'id', g.id, 'name', g.name, 'system_model', g.system_model,
    'position_capacity', g.position_capacity, 'map_layout', g.map_layout,
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'position_number', p.position_number,
        'current_cycle', case when current_cycle.id is null then null else jsonb_build_object(
          'id', current_cycle.id, 'crop_name', current_crop.common_name, 'planted_on', current_cycle.planted_on,
          'planted_on_precision', current_cycle.planted_on_precision, 'harvest_readiness', current_cycle.harvest_readiness
        ) end,
        'previous_cycles', coalesce(history.cycles, '[]'::jsonb)
      ) order by p.position_number)
      from garden.positions p
      left join garden.cycle_occupancies current_occupancy on current_occupancy.position_id = p.id and current_occupancy.occupied_until is null
      left join garden.grow_cycles current_cycle on current_cycle.id = current_occupancy.grow_cycle_id and current_cycle.state = 'active'
      left join garden.crops current_crop on current_crop.id = current_cycle.crop_id
      left join lateral (
        select jsonb_agg(jsonb_build_object(
          'id', historical_cycle.id, 'crop_name', historical_crop.common_name,
          'planted_on', historical_cycle.planted_on, 'planted_on_precision', historical_cycle.planted_on_precision,
          'harvest_readiness', historical_cycle.harvest_readiness, 'state', historical_cycle.state,
          'last_occupied_on', historical.last_occupied_on
        ) order by historical.last_occupied_on desc nulls last, historical_cycle.created_at desc) as cycles
        from (
          select o.grow_cycle_id, max(coalesce(o.occupied_until, o.occupied_from)) as last_occupied_on
          from garden.cycle_occupancies o
          where o.position_id = p.id and o.occupied_until is not null
          group by o.grow_cycle_id
        ) historical
        join garden.grow_cycles historical_cycle on historical_cycle.id = historical.grow_cycle_id
        join garden.crops historical_crop on historical_crop.id = historical_cycle.crop_id
      ) history on true
      where p.garden_id = g.id
    ), '[]'::jsonb)
  ) into v_result
  from garden.gardens g where g.id = p_garden_id and g.owner_id = public.garden_owner_id();
  if v_result is null then raise exception 'Garden not found'; end if;
  return v_result;
end;
$$;

revoke all on function public.garden_record_harvest(uuid, uuid, integer, text) from public;
revoke all on function public.garden_get_garden(uuid) from public;
grant execute on function public.garden_record_harvest(uuid, uuid, integer, text) to authenticated;
grant execute on function public.garden_get_garden(uuid) to authenticated;

commit;
