-- Deterministic Ask Garden capability: answer a specific last-harvest
-- question from canonical harvest events. This is read-only and owner-scoped.
begin;

create or replace function public.garden_get_harvest_history()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with harvests as (
    select
      e.id as event_id,
      e.grow_cycle_id,
      e.note,
      e.occurred_at,
      coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) as occurred_on,
      g.id as garden_id,
      g.name as garden_name,
      p.id as position_id,
      p.position_number,
      c.common_name as crop_name
    from garden.events e
    join garden.grow_cycles gc on gc.id = e.grow_cycle_id
    join garden.crops c on c.id = gc.crop_id
    join garden.gardens g on g.owner_id = e.owner_id
    left join lateral (
      select o.position_id
      from garden.cycle_occupancies o
      where o.grow_cycle_id = e.grow_cycle_id
      order by
        case when o.occupied_from is not null and o.occupied_from <= coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date)
          and (o.occupied_until is null or o.occupied_until > coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date)) then 0 else 1 end,
        (o.occupied_until is null) desc,
        o.occupied_from desc nulls last,
        o.created_at desc,
        o.id desc
      limit 1
    ) occupancy on true
    left join garden.positions p on p.id = occupancy.position_id
    where e.owner_id = public.garden_owner_id()
      and e.event_type = 'harvest'
      and e.invalidated_at is null
      and g.id = e.garden_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', event_id,
    'grow_cycle_id', grow_cycle_id,
    'garden_id', garden_id,
    'garden_name', garden_name,
    'position_id', position_id,
    'position_number', position_number,
    'crop_name', crop_name,
    'occurred_on', occurred_on,
    'occurred_at', occurred_at,
    'note', note
  ) order by occurred_on desc, occurred_at desc, event_id desc), '[]'::jsonb)
  from (select * from harvests order by occurred_on desc, occurred_at desc, event_id desc limit 200) bounded;
$$;

revoke all on function public.garden_get_harvest_history() from public;
revoke execute on function public.garden_get_harvest_history() from anon;
grant execute on function public.garden_get_harvest_history() to authenticated;

commit;
