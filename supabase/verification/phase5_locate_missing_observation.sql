-- Read-only diagnosis for the active cycle in Jardin 1 / Posición 7.
-- It never writes or changes photo state.
select
  e.id as event_id,
  e.occurred_at,
  e.note,
  ph.id as photo_id,
  ph.upload_status,
  ph.storage_path,
  ph.original_filename,
  ph.byte_size
from garden.events e
join garden.grow_cycles gc on gc.id = e.grow_cycle_id
join garden.cycle_occupancies co on co.grow_cycle_id = gc.id and co.occupied_until is null
join garden.positions p on p.id = co.position_id
join garden.gardens g on g.id = p.garden_id
left join garden.photos ph on ph.event_id = e.id
where g.name in ('Jardin 1', 'Jardín 1')
  and p.position_number = 7
order by e.occurred_at desc
limit 20;
