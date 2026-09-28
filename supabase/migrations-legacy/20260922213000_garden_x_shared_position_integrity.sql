-- Temporary shared positions are valid during physical reorganization. Keep
-- owner/cycle checks and historical interval protection, but allow two current
-- (open-ended) occupancies to coexist at one position.
begin;

create or replace function garden.assert_occupancy_integrity()
returns trigger
language plpgsql
security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_garden_id uuid;
begin
  select g.owner_id, g.id into v_owner, v_garden_id
  from garden.positions p join garden.gardens g on g.id = p.garden_id
  where p.id = new.position_id;
  if v_owner is null then raise exception 'Position not found'; end if;
  if not exists (select 1 from garden.grow_cycles gc where gc.id = new.grow_cycle_id and gc.owner_id = v_owner) then
    raise exception 'Cycle and position must belong to the same owner';
  end if;
  if exists (
    select 1
    from garden.cycle_occupancies o
    join garden.positions other_position on other_position.id = o.position_id
    where o.grow_cycle_id = new.grow_cycle_id
      and o.id is distinct from new.id
      and other_position.garden_id <> v_garden_id
  ) then
    raise exception 'A cycle cannot move between gardens';
  end if;
  if new.occupied_from is not null and exists (
    select 1 from garden.cycle_occupancies o
    where o.position_id = new.position_id
      and o.id is distinct from new.id
      and o.occupied_from is not null
      -- Multiple open-ended rows are the intentional temporary shared state.
      and not (o.occupied_until is null and new.occupied_until is null)
      and daterange(o.occupied_from, coalesce(o.occupied_until, 'infinity'::date), '[)')
          && daterange(new.occupied_from, coalesce(new.occupied_until, 'infinity'::date), '[)')
  ) then
    raise exception 'Known occupancy dates overlap';
  end if;
  return new;
end;
$$;

commit;
