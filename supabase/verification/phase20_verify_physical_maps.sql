-- Run after Phase 20 migration. It is read-only and should return two rows for the current gardens.
select
  g.name,
  g.system_model,
  g.map_layout,
  g.position_capacity as active_cultivation_positions,
  count(s.id) filter (where s.is_active) as active_physical_points,
  count(s.id) filter (where s.is_active and s.site_kind = 'utility') as active_technical_points
from garden.gardens g
left join garden.layout_sites s on s.garden_id = g.id
group by g.id
order by g.created_at;

-- Expected numbering: Garden 1 = 1-2 / 3-5 / 6-8; Garden 2 = 1 / 2-5 / 6-8 / 9-12.
select
  g.name,
  p.position_number,
  s.grid_x as column,
  s.grid_y as row,
  s.site_kind,
  s.is_active
from garden.layout_sites s
join garden.gardens g on g.id = s.garden_id
left join garden.positions p on p.id = s.position_id
where g.system_model ilike 'uruq%'
order by g.created_at, s.grid_y, s.grid_x;
