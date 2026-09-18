-- Garden X V1 — canonical baseline bridge for Garden 1 / Garden 2
-- Preserves all legacy ids/history. Adds only V1 identity/system links.
begin;

-- One compatibility System Instance per canonical legacy Garden.
insert into garden.system_instances (
  owner_id, garden_id, name, system_definition_key, legacy_system_model, metadata
)
select
  g.owner_id,
  g.id,
  g.name,
  case g.map_layout
    when 'uruq_8_v1' then 'uruq_8_v1'
    when 'uruq_12_v1' then 'uruq_12_v1'
    else null
  end,
  g.system_model,
  jsonb_build_object(
    'migration_source', 'legacy_garden',
    'legacy_garden_id', g.id,
    'baseline_bridge', 'garden_x_v1'
  )
from garden.gardens g
where g.name in ('Garden 1','Garden 2')
  and not exists (
    select 1 from garden.system_instances s
    where s.garden_id = g.id
      and s.metadata->>'baseline_bridge' = 'garden_x_v1'
  );

update garden.positions p
set system_instance_id = s.id
from garden.system_instances s
join garden.gardens g on g.id = s.garden_id
where p.garden_id = g.id
  and g.name in ('Garden 1','Garden 2')
  and s.metadata->>'baseline_bridge' = 'garden_x_v1'
  and p.system_instance_id is null;

update garden.layout_sites ls
set system_instance_id = s.id
from garden.system_instances s
join garden.gardens g on g.id = s.garden_id
where ls.garden_id = g.id
  and g.name in ('Garden 1','Garden 2')
  and s.metadata->>'baseline_bridge' = 'garden_x_v1'
  and ls.system_instance_id is null;

-- Deterministic compatibility bridge:
-- each legacy grow cycle becomes one Plant Instance because the legacy model
-- has no stronger persistent identity above grow_cycle. We preserve that
-- provenance explicitly so a future human-approved merge can reconcile
-- multiple cycles into one persistent plant if needed.
insert into garden.plant_instances (
  owner_id, common_name, scientific_name, status, metadata
)
select distinct
  gc.owner_id,
  c.common_name,
  c.scientific_name,
  case when gc.state = 'active' then 'active' else 'ended' end,
  jsonb_build_object(
    'migration_source', 'legacy_grow_cycle',
    'legacy_grow_cycle_id', gc.id,
    'identity_confidence', 'compatibility_bridge',
    'baseline_bridge', 'garden_x_v1'
  )
from garden.grow_cycles gc
join garden.crops c on c.id = gc.crop_id
join garden.cycle_occupancies o on o.grow_cycle_id = gc.id
join garden.positions p on p.id = o.position_id
join garden.gardens g on g.id = p.garden_id
where g.name in ('Garden 1','Garden 2')
  and not exists (
    select 1 from garden.plant_instances pi
    where pi.metadata->>'legacy_grow_cycle_id' = gc.id::text
  );

update garden.grow_cycles gc
set plant_instance_id = pi.id
from garden.plant_instances pi
where pi.metadata->>'legacy_grow_cycle_id' = gc.id::text
  and pi.metadata->>'baseline_bridge' = 'garden_x_v1'
  and gc.plant_instance_id is null;

commit;
