-- A relocation with an effective date can legitimately overlap a prior
-- occupancy while the physical reorganization is in progress. Keep the
-- historical interval guard for two closed records, but allow an open current
-- occupancy to share a position with an older closed record.
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
  if not exists (
    select 1 from garden.grow_cycles gc
    where gc.id = new.grow_cycle_id and gc.owner_id = v_owner
  ) then
    raise exception 'Cycle and position must belong to the same owner';
  end if;
  if new.occupied_from is not null and exists (
    select 1
    from garden.cycle_occupancies o
    where o.position_id = new.position_id
      and o.id is distinct from new.id
      and o.occupied_from is not null
      -- Open-ended rows represent active plants and may intentionally share a
      -- position during physical reorganization. Closed historical intervals
      -- must still remain non-overlapping with each other.
      and o.occupied_until is not null
      and new.occupied_until is not null
      and daterange(o.occupied_from, o.occupied_until, '[)')
          && daterange(new.occupied_from, new.occupied_until, '[)')
  ) then
    raise exception 'Known occupancy dates overlap';
  end if;
  return new;
end;
$$;

commit;
