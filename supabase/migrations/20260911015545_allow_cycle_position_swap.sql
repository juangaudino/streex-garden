-- Allow an explicit position swap when every grow position is occupied.
-- The source cycle is still guarded by the revision supplied by the client;
-- the target cycle is locked and audited in the same transaction.
begin;

create or replace function public.garden_move_cycle(
  p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_target_position_id uuid, p_moved_on date
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'target_position_id', p_target_position_id, 'moved_on', p_moved_on);
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_target_cycle garden.grow_cycles%rowtype;
  v_source garden.cycle_occupancies%rowtype;
  v_target garden.cycle_occupancies%rowtype;
  v_source_garden uuid;
  v_target_garden uuid;
  v_event_id uuid;
  v_target_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'move_cycle', v_payload);
  if v_response is not null then return v_response; end if;
  if p_moved_on is null then raise exception 'Move date is required'; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'active' then raise exception 'Current grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before moving'; end if;
  select * into v_source from garden.cycle_occupancies where grow_cycle_id = p_grow_cycle_id and occupied_until is null for update;
  if not found then raise exception 'Current occupancy not found'; end if;
  select garden_id into v_source_garden from garden.positions where id = v_source.position_id;
  select p.garden_id into v_target_garden
    from garden.positions p
    join garden.gardens g on g.id = p.garden_id
    join garden.layout_sites s on s.position_id = p.id and s.site_kind = 'grow' and s.is_active
   where p.id = p_target_position_id and g.owner_id = v_owner;
  if v_target_garden is null then raise exception 'Target position is not available for cultivation'; end if;
  if v_target_garden <> v_source_garden then raise exception 'A cycle can only move within its garden'; end if;
  if p_target_position_id = v_source.position_id then raise exception 'Target position is already current'; end if;
  if v_source.occupied_from is not null and p_moved_on < v_source.occupied_from then raise exception 'Move cannot precede occupancy'; end if;

  select * into v_target from garden.cycle_occupancies where position_id = p_target_position_id and occupied_until is null for update;
  if found then
    select * into v_target_cycle from garden.grow_cycles where id = v_target.grow_cycle_id and owner_id = v_owner for update;
    if not found or v_target_cycle.state <> 'active' then raise exception 'Target position has no movable current grow cycle'; end if;
    if v_target_cycle.id = v_cycle.id then raise exception 'Target position is already current'; end if;

    update garden.cycle_occupancies set occupied_until = p_moved_on where id in (v_source.id, v_target.id);
    insert into garden.cycle_occupancies(position_id, grow_cycle_id, occupied_from)
      values (p_target_position_id, p_grow_cycle_id, p_moved_on), (v_source.position_id, v_target_cycle.id, p_moved_on);

    update garden.grow_cycles set revision = revision + 1, updated_at = now() where id in (v_cycle.id, v_target_cycle.id);
    insert into garden.events(owner_id, grow_cycle_id, event_type, note)
      values (v_owner, p_grow_cycle_id, 'cycle_moved', 'Ciclo trasladado e intercambiado de posición') returning id into v_event_id;
    insert into garden.events(owner_id, grow_cycle_id, event_type, note)
      values (v_owner, v_target_cycle.id, 'cycle_moved', 'Ciclo trasladado e intercambiado de posición') returning id into v_target_event_id;
    insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
      values
        (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'moved', jsonb_build_object('position_id', v_source.position_id), jsonb_build_object('position_id', p_target_position_id), 'movement_swap'),
        (v_owner, v_target_cycle.id, v_target_cycle.revision + 1, 'moved', jsonb_build_object('position_id', p_target_position_id), jsonb_build_object('position_id', v_source.position_id), 'movement_swap');
    v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1, 'event_id', v_event_id, 'swapped', true, 'swapped_grow_cycle_id', v_target_cycle.id, 'swapped_event_id', v_target_event_id);
  else
    insert into garden.cycle_occupancies(position_id, grow_cycle_id, occupied_from)
      values (p_target_position_id, p_grow_cycle_id, p_moved_on);
    update garden.cycle_occupancies set occupied_until = p_moved_on where id = v_source.id;
    update garden.grow_cycles set revision = revision + 1, updated_at = now() where id = p_grow_cycle_id;
    insert into garden.events(owner_id, grow_cycle_id, event_type, note)
      values (v_owner, p_grow_cycle_id, 'cycle_moved', 'Ciclo trasladado') returning id into v_event_id;
    insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
      values (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'moved', jsonb_build_object('position_id', v_source.position_id), jsonb_build_object('position_id', p_target_position_id), 'movement');
    v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1, 'event_id', v_event_id, 'swapped', false);
  end if;
  perform garden.store_command_response(v_owner, p_request_id, 'move_cycle', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_move_cycle(uuid, uuid, integer, uuid, date) from public;
grant execute on function public.garden_move_cycle(uuid, uuid, integer, uuid, date) to authenticated;

commit;
