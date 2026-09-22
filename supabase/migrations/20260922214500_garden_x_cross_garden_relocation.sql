-- Garden X relocations may cross gardens/systems. Historical occupancies keep
-- their original garden; only the current cycle position is canonical.
begin;

create or replace function garden.assert_occupancy_integrity()
returns trigger
language plpgsql
security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  select g.owner_id into v_owner
  from garden.positions p join garden.gardens g on g.id = p.garden_id
  where p.id = new.position_id;
  if v_owner is null then raise exception 'Position not found'; end if;
  if not exists (select 1 from garden.grow_cycles gc where gc.id = new.grow_cycle_id and gc.owner_id = v_owner) then
    raise exception 'Cycle and position must belong to the same owner';
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
