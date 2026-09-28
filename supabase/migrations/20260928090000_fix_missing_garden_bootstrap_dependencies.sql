-- Restore the dependency chain omitted from the canonical production baseline.
-- This changes functions and privileges only; it does not touch application data.

create or replace function public.garden_owner_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.uid()
$$;

create or replace function public.garden_x_get_bootstrap_legacy()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with owner as (
  select public.garden_owner_id() as id
),
canonical_systems as (
  select s.*
  from garden.system_instances s, owner o
  where s.owner_id = o.id
    and s.status = 'active'
    and s.metadata->>'baseline_bridge' = 'garden_x_v1'
),
canonical_gardens as (
  select g.*, s.id as system_instance_id, s.name as system_instance_name,
         s.system_definition_key, s.legacy_system_model
  from garden.gardens g
  join canonical_systems s on s.garden_id = g.id
),
plant_cycles as (
  select distinct on (gc.id)
    pi.id as plant_instance_id,
    pi.nickname,
    pi.reference_key,
    pi.common_name,
    pi.scientific_name,
    pi.cultivar,
    pi.status as plant_status,
    gc.id as grow_cycle_id,
    gc.state as cycle_state,
    gc.planted_on,
    gc.planted_on_precision,
    gc.harvest_readiness,
    p.id as position_id,
    p.position_number,
    p.system_instance_id,
    g.id as garden_id,
    g.name as garden_name,
    o.occupied_from,
    o.occupied_until
  from garden.plant_instances pi
  join garden.grow_cycles gc on gc.plant_instance_id = pi.id
  join garden.cycle_occupancies o on o.grow_cycle_id = gc.id
  join garden.positions p on p.id = o.position_id
  join canonical_gardens g on g.id = p.garden_id
  where pi.owner_id = (select id from owner)
  order by gc.id, (o.occupied_until is null) desc, o.occupied_until desc nulls first, o.created_at desc
),
plant_rows as (
  select
    pc.*,
    latest_photo.id as latest_photo_id,
    latest_photo.storage_path as latest_photo_storage_path,
    latest_photo.captured_at as latest_photo_captured_at,
    latest_photo.captured_at_precision as latest_photo_captured_at_precision
  from plant_cycles pc
  left join lateral (
    select ph.id, ph.storage_path, ph.captured_at, ph.captured_at_precision
    from garden.events e
    join garden.photos ph on ph.event_id = e.id and ph.upload_status = 'uploaded'
    where e.grow_cycle_id = pc.grow_cycle_id
      and e.invalidated_at is null
      and ph.media_scope = 'cycle_evidence'
    order by coalesce(ph.captured_at, e.occurred_at, ph.created_at) desc, ph.created_at desc
    limit 1
  ) latest_photo on true
),
event_rows as (
  select e.*, gc.plant_instance_id
  from garden.events e
  join garden.grow_cycles gc on gc.id = e.grow_cycle_id
  join plant_cycles pc on pc.grow_cycle_id = gc.id
  where e.owner_id = (select id from owner)
    and e.invalidated_at is null
),
photo_rows as (
  select ph.*, e.grow_cycle_id, gc.plant_instance_id
  from garden.photos ph
  join garden.events e on e.id = ph.event_id
  join garden.grow_cycles gc on gc.id = e.grow_cycle_id
  join plant_cycles pc on pc.grow_cycle_id = gc.id
  where ph.owner_id = (select id from owner)
    and ph.upload_status = 'uploaded'
    and e.invalidated_at is null
),
attention_rows as (
  select a.*, gc.plant_instance_id
  from garden.attention_items a
  join garden.grow_cycles gc on gc.id = a.grow_cycle_id
  join plant_cycles pc on pc.grow_cycle_id = gc.id
  where a.owner_id = (select id from owner)
    and a.status = 'open'
)
select jsonb_build_object(
  'gardens', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'system_instance_id', g.system_instance_id,
      'system_instance_name', g.system_instance_name,
      'system_definition_key', g.system_definition_key,
      'legacy_system_model', g.legacy_system_model,
      'position_capacity', g.position_capacity,
      'map_layout', g.map_layout,
      'kind', g.kind,
      'place', g.place,
      'note', g.note,
      'sort_order', g.sort_order,
      'archived_at', g.archived_at,
      'cover_photo_id', g.cover_photo_id,
      'positions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'position_number', p.position_number,
          'layout', case when ls.id is null then null else jsonb_build_object(
            'site_id', ls.id,
            'site_kind', ls.site_kind,
            'is_active', ls.is_active,
            'grid_x', ls.grid_x,
            'grid_y', ls.grid_y,
            'label', ls.label
          ) end
        ) order by p.position_number)
        from garden.positions p
        left join garden.layout_sites ls
          on ls.position_id = p.id and ls.system_instance_id = g.system_instance_id
        where p.system_instance_id = g.system_instance_id
      ), '[]'::jsonb)
    ) order by g.sort_order, g.created_at, g.id)
    from canonical_gardens g
  ), '[]'::jsonb),
  'plants', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.plant_instance_id,
      'nickname', p.nickname,
      'reference_key', p.reference_key,
      'common_name', p.common_name,
      'scientific_name', p.scientific_name,
      'cultivar', p.cultivar,
      'status', p.plant_status,
      'grow_cycle_id', p.grow_cycle_id,
      'cycle_state', p.cycle_state,
      'planted_on', p.planted_on,
      'planted_on_precision', p.planted_on_precision,
      'harvest_readiness', p.harvest_readiness,
      'garden_id', p.garden_id,
      'system_instance_id', p.system_instance_id,
      'position_id', p.position_id,
      'position_number', p.position_number,
      'occupied_from', p.occupied_from,
      'occupied_until', p.occupied_until,
      'latest_photo_id', p.latest_photo_id,
      'latest_photo_storage_path', p.latest_photo_storage_path,
      'latest_photo_captured_at', p.latest_photo_captured_at,
      'latest_photo_captured_at_precision', p.latest_photo_captured_at_precision
    ) order by p.garden_name, p.position_number, p.planted_on nulls last)
    from plant_rows p
  ), '[]'::jsonb),
  'events', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id,
      'plant_instance_id', e.plant_instance_id,
      'grow_cycle_id', e.grow_cycle_id,
      'event_type', e.event_type,
      'occurred_at', e.occurred_at,
      'created_at', e.created_at,
      'note', e.note,
      'event_data', e.event_data,
      'revision', e.revision
    ) order by e.occurred_at desc, e.created_at desc)
    from event_rows e
  ), '[]'::jsonb),
  'photos', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'plant_instance_id', p.plant_instance_id,
      'grow_cycle_id', p.grow_cycle_id,
      'event_id', p.event_id,
      'storage_path', p.storage_path,
      'original_filename', p.original_filename,
      'content_type', p.content_type,
      'byte_size', p.byte_size,
      'captured_at', p.captured_at,
      'captured_at_precision', p.captured_at_precision,
      'width', p.width,
      'height', p.height,
      'media_scope', p.media_scope
    ) order by coalesce(p.captured_at, p.created_at) desc)
    from photo_rows p
  ), '[]'::jsonb),
  'attention', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'plant_instance_id', a.plant_instance_id,
      'grow_cycle_id', a.grow_cycle_id,
      'garden_id', a.garden_id,
      'purpose', a.purpose,
      'subject_key', a.subject_key,
      'title', a.title,
      'origin', a.origin,
      'status', a.status,
      'due_on', a.due_on,
      'next_review_on', a.next_review_on,
      'created_at', a.created_at
    ) order by coalesce(a.due_on, a.next_review_on) nulls last, a.created_at)
    from attention_rows a
  ), '[]'::jsonb)
)
$$;

create or replace function public.garden_x_get_bootstrap_b35_base()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with base as (select public.garden_x_get_bootstrap_legacy() as value),
garden_levels as (
  select g.id as garden_id,
    coalesce(jsonb_agg(jsonb_build_object(
      'level_number', l.level_number,
      'row_count', l.row_count,
      'column_count', l.column_count,
      'active_cells', case when jsonb_typeof(l.active_cells) = 'array' and jsonb_array_length(l.active_cells) > 0 then l.active_cells else (
        select jsonb_agg(jsonb_build_object('row', r.row_number, 'column', c.column_number) order by r.row_number, c.column_number)
        from generate_series(1, l.row_count) as r(row_number) cross join generate_series(1, l.column_count) as c(column_number)
      ) end
    ) order by l.level_number), '[]'::jsonb) as levels
  from garden.gardens g
  join garden.system_instances s on s.garden_id = g.id and s.owner_id = g.owner_id
  join garden.custom_system_definitions d on d.id = nullif(s.metadata->>'custom_definition_id', '')::uuid and d.owner_id = g.owner_id
  join garden.custom_system_levels l on l.definition_id = d.id
  where g.owner_id = public.garden_owner_id()
  group by g.id
), enriched_gardens as (
  select coalesce(jsonb_agg(item || jsonb_build_object('levels', coalesce(gl.levels, item->'levels')) order by entries.ordinality), '[]'::jsonb) as value
  from base
  cross join lateral jsonb_array_elements(base.value->'gardens') with ordinality as entries(item, ordinality)
  left join garden_levels gl on gl.garden_id = (entries.item->>'id')::uuid
), enriched_base as (
  select jsonb_set(base.value, '{gardens}', enriched_gardens.value, true) as value from base cross join enriched_gardens
), plants as (
  select coalesce(jsonb_agg(item || jsonb_strip_nulls(jsonb_build_object(
    'library_plant_id', pi.library_plant_id,
    'library_catalog_version', pi.library_catalog_version,
    'library_common_name_snapshot', pi.library_common_name_snapshot,
    'library_scientific_name_snapshot', pi.library_scientific_name_snapshot,
    'library_cultivar_snapshot', pi.library_cultivar_snapshot
  )) order by ordinality), '[]'::jsonb) as value
  from enriched_base
  cross join lateral jsonb_array_elements(enriched_base.value->'plants') with ordinality as entries(item, ordinality)
  left join garden.plant_instances pi on pi.id = (entries.item->>'id')::uuid
)
select jsonb_set(enriched_base.value, '{plants}', plants.value, true) from enriched_base cross join plants;
$$;

revoke all on function public.garden_owner_id() from public;
revoke all on function public.garden_x_get_bootstrap_legacy() from public;
revoke all on function public.garden_x_get_bootstrap_b35_base() from public;
revoke all on function public.garden_x_get_bootstrap() from public;
grant execute on function public.garden_x_get_bootstrap() to authenticated;

