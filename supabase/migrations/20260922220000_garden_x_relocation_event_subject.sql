-- A cycle_moved event belongs to the garden of the cycle's current
-- occupancy. Historical occupancies remain available for the relocation story
-- but must not win subject resolution for a new event.
begin;

create or replace function garden.assert_event_subject_integrity()
returns trigger
language plpgsql
security definer set search_path = '' as $$
declare
  v_garden_id uuid;
  v_owner_id uuid;
begin
  if new.grow_cycle_id is not null then
    select p.garden_id, gc.owner_id into v_garden_id, v_owner_id
    from garden.grow_cycles gc
    join garden.cycle_occupancies o on o.grow_cycle_id = gc.id
    join garden.positions p on p.id = o.position_id
    where gc.id = new.grow_cycle_id
    order by (o.occupied_until is null) desc, o.created_at desc
    limit 1;
    if v_garden_id is null or v_owner_id <> new.owner_id then raise exception 'Cycle subject not found'; end if;
    if new.garden_id is null then new.garden_id := v_garden_id;
    elsif new.garden_id <> v_garden_id then raise exception 'Cycle and garden subjects do not match'; end if;
  else
    select owner_id into v_owner_id from garden.gardens where id = new.garden_id;
    if v_owner_id is null or v_owner_id <> new.owner_id then raise exception 'Garden subject not found'; end if;
  end if;
  return new;
end;
$$;

commit;
