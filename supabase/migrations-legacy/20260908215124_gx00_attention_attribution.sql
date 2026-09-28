-- GX-00 Phase 1: preserve the canonical Attention Queue while making its
-- subject attribution explicit and preventing closed cycles from leaking work
-- into a successor position.
begin;

create index if not exists attention_items_open_cycle
  on garden.attention_items(owner_id, grow_cycle_id, due_on, next_review_on, created_at)
  where status = 'open' and grow_cycle_id is not null;

create index if not exists attention_items_open_garden
  on garden.attention_items(owner_id, garden_id, due_on, next_review_on, created_at)
  where status = 'open' and grow_cycle_id is null;

-- A task follows its grow cycle, never merely the physical position. Closing a
-- cycle therefore dismisses only that cycle's still-open tasks. The historical
-- record makes the reason visible; it does not turn a pending action into a
-- completed gardening event.
create or replace function garden.dismiss_open_attention_for_closed_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.state = 'active' and new.state = 'closed' then
    with dismissed as (
      update garden.attention_items
      set status = 'dismissed',
          dismissed_at = now(),
          dismissed_reason = 'Ciclo cerrado',
          updated_at = now()
      where owner_id = new.owner_id
        and grow_cycle_id = new.id
        and status = 'open'
      returning id, owner_id
    )
    insert into garden.attention_history(
      owner_id, attention_item_id, from_status, to_status, operation, reason
    )
    select owner_id, id, 'open', 'dismissed', 'dismissed', 'Ciclo cerrado'
    from dismissed;
  end if;
  return new;
end;
$$;

drop trigger if exists grow_cycles_dismiss_open_attention_on_close on garden.grow_cycles;
create trigger grow_cycles_dismiss_open_attention_on_close
after update of state on garden.grow_cycles
for each row execute function garden.dismiss_open_attention_for_closed_cycle();

-- The queue remains the sole source of pending work. Context is derived at
-- read time from the active cycle occupancy, so a moved cycle gets its current
-- position and a garden-level task remains shared instead of being duplicated
-- across every occupied position.
create or replace function public.garden_get_attention()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'garden_id', a.garden_id,
    'garden_name', g.name,
    'grow_cycle_id', a.grow_cycle_id,
    'position_id', context.position_id,
    'position_number', context.position_number,
    'crop_name', context.crop_name,
    'purpose', a.purpose,
    'subject_key', a.subject_key,
    'title', a.title,
    'origin', a.origin,
    'due_on', a.due_on,
    'next_review_on', a.next_review_on,
    'created_at', a.created_at
  ) order by
    case when a.due_on is not null and a.due_on < current_date then 0
         when a.due_on = current_date or a.next_review_on <= current_date then 1
         when a.due_on is null then 2 else 3 end,
    a.due_on nulls last, a.created_at, a.id), '[]'::jsonb)
  from garden.attention_items a
  join garden.gardens g on g.id = a.garden_id
  left join lateral (
    select o.position_id, p.position_number, c.common_name as crop_name
    from garden.grow_cycles gc
    join garden.cycle_occupancies o
      on o.grow_cycle_id = gc.id and o.occupied_until is null
    join garden.positions p on p.id = o.position_id
    join garden.crops c on c.id = gc.crop_id
    where gc.id = a.grow_cycle_id
      and gc.owner_id = a.owner_id
      and gc.state = 'active'
    limit 1
  ) context on a.grow_cycle_id is not null
  where a.owner_id = public.garden_owner_id()
    and a.status = 'open';
$$;

revoke all on function garden.dismiss_open_attention_for_closed_cycle() from public;
revoke all on function public.garden_get_attention() from public;
grant execute on function public.garden_get_attention() to authenticated;

commit;
