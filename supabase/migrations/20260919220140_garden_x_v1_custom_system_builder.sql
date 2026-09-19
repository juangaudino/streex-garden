-- Garden X V1 — Custom System Builder.
-- Custom definitions belong to one owner and never alter the static preset catalog.
begin;

create table garden.custom_system_definitions (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  photo_id uuid references garden.photos(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index custom_system_definitions_owner_created
  on garden.custom_system_definitions(owner_id, created_at desc);
alter table garden.custom_system_definitions enable row level security;
create policy "owners read their custom system definitions"
  on garden.custom_system_definitions for select to authenticated
  using ((select auth.uid()) = owner_id);

create table garden.custom_system_levels (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references garden.custom_system_definitions(id) on delete cascade,
  level_number integer not null check (level_number between 1 and 12),
  row_count integer not null check (row_count between 1 and 9),
  column_count integer not null check (column_count between 1 and 8),
  created_at timestamptz not null default now(),
  unique (definition_id, level_number)
);
alter table garden.custom_system_levels enable row level security;
create policy "owners read their custom system levels"
  on garden.custom_system_levels for select to authenticated
  using (exists (
    select 1 from garden.custom_system_definitions d
    where d.id = custom_system_levels.definition_id
      and d.owner_id = (select auth.uid())
  ));

alter table garden.layout_sites
  add column level_number integer,
  add column row_number integer,
  add column column_number integer;
update garden.layout_sites
set level_number = coalesce(level_number, 1),
    row_number = coalesce(row_number, grid_y),
    column_number = coalesce(column_number, grid_x)
where level_number is null or row_number is null or column_number is null;
alter table garden.layout_sites
  add constraint layout_sites_level_number_check check (level_number between 1 and 12),
  add constraint layout_sites_row_number_check check (row_number between 1 and 9),
  add constraint layout_sites_column_number_check check (column_number between 1 and 8);
-- A physical point may be reused on a different level. The prior unique index
-- intentionally had no level because the original system only had one level.
drop index garden.layout_sites_one_active_point;
create unique index layout_sites_one_active_point
  on garden.layout_sites(garden_id, level_number, grid_x, grid_y) where is_active;
create index layout_sites_system_level_row_column
  on garden.layout_sites(system_instance_id, level_number, row_number, column_number);

create or replace function public.garden_x_create_custom_system(
  p_request_id uuid,
  p_garden_id uuid,
  p_system_instance_id uuid,
  p_definition_id uuid,
  p_name text,
  p_levels jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_total integer := 0;
  v_position_number integer := 0;
  v_level jsonb;
  v_level_number integer := 0;
  v_rows integer;
  v_columns integer;
  v_row integer;
  v_column integer;
  v_position_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_request_id is null or p_garden_id is null or p_system_instance_id is null or p_definition_id is null then
    raise exception 'Ids are required';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'System name is required';
  end if;
  if jsonb_typeof(p_levels) <> 'array' or jsonb_array_length(p_levels) not between 1 and 12 then
    raise exception 'One to twelve levels are required';
  end if;

  select response into v_response
  from garden.command_receipts
  where owner_id = v_owner and request_id = p_request_id and command_name = 'garden_x_create_custom_system';
  if found then return v_response; end if;

  for v_level in select value from jsonb_array_elements(p_levels) loop
    v_level_number := v_level_number + 1;
    if jsonb_typeof(v_level) <> 'object'
      or coalesce(v_level->>'rows', '') !~ '^[0-9]+$'
      or coalesce(v_level->>'columns', '') !~ '^[0-9]+$' then
      raise exception 'Each level needs rows and columns';
    end if;
    v_rows := (v_level->>'rows')::integer;
    v_columns := (v_level->>'columns')::integer;
    if v_rows not between 1 and 9 or v_columns not between 1 and 8 then
      raise exception 'Rows must be 1–9 and columns must be 1–8';
    end if;
    v_total := v_total + v_rows * v_columns;
  end loop;
  if v_total > 36 then raise exception 'A custom system supports at most 36 positions'; end if;

  insert into garden.custom_system_definitions(id, owner_id, name, metadata)
  values (p_definition_id, v_owner, trim(p_name), jsonb_build_object('created_via', 'garden_x_v1_custom_system_builder'));

  insert into garden.gardens(
    id, owner_id, name, system_model, position_capacity, map_layout, kind, place, note, sort_order
  ) values (
    p_garden_id, v_owner, trim(p_name), 'Custom System', v_total, 'custom_grid', 'hydroponic', '',
    'Custom system layout', coalesce((select max(sort_order) + 1 from garden.gardens where owner_id = v_owner), 0)
  );

  insert into garden.system_instances(
    id, owner_id, garden_id, name, system_definition_key, legacy_system_model, status, metadata
  ) values (
    p_system_instance_id, v_owner, p_garden_id, trim(p_name), 'custom:' || p_definition_id::text,
    'Custom System', 'active', jsonb_build_object(
      'created_via', 'garden_x_v1_custom_system_builder',
      'baseline_bridge', 'garden_x_v1',
      'custom_definition_id', p_definition_id
    )
  );

  v_level_number := 0;
  for v_level in select value from jsonb_array_elements(p_levels) loop
    v_level_number := v_level_number + 1;
    v_rows := (v_level->>'rows')::integer;
    v_columns := (v_level->>'columns')::integer;
    insert into garden.custom_system_levels(definition_id, level_number, row_count, column_count)
    values (p_definition_id, v_level_number, v_rows, v_columns);
    for v_row in 1..v_rows loop
      for v_column in 1..v_columns loop
        v_position_number := v_position_number + 1;
        insert into garden.positions(garden_id, system_instance_id, position_number)
        values (p_garden_id, p_system_instance_id, v_position_number)
        returning id into v_position_id;
        insert into garden.layout_sites(
          garden_id, system_instance_id, position_id, site_kind, is_active,
          grid_x, grid_y, level_number, row_number, column_number
        ) values (
          p_garden_id, p_system_instance_id, v_position_id, 'grow', true,
          v_column, v_row, v_level_number, v_row, v_column
        );
      end loop;
    end loop;
  end loop;

  insert into garden.layout_events(owner_id, garden_id, operation, event_data)
  values (v_owner, p_garden_id, 'site_added', jsonb_build_object(
    'source', 'garden_x_v1_custom_system_builder', 'level_count', jsonb_array_length(p_levels), 'position_count', v_total
  ));

  v_response := jsonb_build_object(
    'garden_id', p_garden_id, 'system_instance_id', p_system_instance_id,
    'custom_definition_id', p_definition_id, 'position_count', v_total
  );
  insert into garden.command_receipts(owner_id, request_id, command_name, response)
  values (v_owner, p_request_id, 'garden_x_create_custom_system', v_response);
  return v_response;
end;
$$;

create or replace function public.garden_x_set_custom_system_photo(
  p_request_id uuid,
  p_definition_id uuid,
  p_photo_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_garden_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select response into v_response
  from garden.command_receipts
  where owner_id = v_owner and request_id = p_request_id and command_name = 'garden_x_set_custom_system_photo';
  if found then return v_response; end if;

  select s.garden_id into v_garden_id
  from garden.system_instances s
  where s.owner_id = v_owner
    and s.metadata->>'custom_definition_id' = p_definition_id::text
    and s.status = 'active';
  if v_garden_id is null then raise exception 'Custom system not found'; end if;
  if not exists (
    select 1 from garden.photos ph
    where ph.id = p_photo_id and ph.owner_id = v_owner and ph.garden_id = v_garden_id
      and ph.media_scope = 'garden_cover' and ph.upload_status = 'uploaded'
  ) then raise exception 'System photo not available'; end if;

  update garden.custom_system_definitions
  set photo_id = p_photo_id, updated_at = now()
  where id = p_definition_id and owner_id = v_owner;
  update garden.gardens set cover_photo_id = p_photo_id, updated_at = now()
  where id = v_garden_id and owner_id = v_owner;

  v_response := jsonb_build_object('custom_definition_id', p_definition_id, 'photo_id', p_photo_id);
  insert into garden.command_receipts(owner_id, request_id, command_name, response)
  values (v_owner, p_request_id, 'garden_x_set_custom_system_photo', v_response);
  return v_response;
end;
$$;

create or replace function public.garden_x_get_bootstrap()
returns jsonb
language sql stable security definer set search_path = '' as $$
with owner as (
  select public.garden_owner_id() as id
),
canonical_systems as (
  select s.*
  from garden.system_instances s, owner o
  where s.owner_id = o.id and s.status = 'active' and s.metadata->>'baseline_bridge' = 'garden_x_v1'
),
canonical_gardens as (
  select g.*, s.id as system_instance_id, s.name as system_instance_name,
         s.system_definition_key, s.legacy_system_model,
         nullif(s.metadata->>'custom_definition_id', '')::uuid as custom_definition_id
  from garden.gardens g join canonical_systems s on s.garden_id = g.id
),
plant_cycles as (
  select distinct on (gc.id)
    pi.id as plant_instance_id, pi.nickname, pi.reference_key, pi.common_name, pi.scientific_name, pi.cultivar,
    pi.status as plant_status, gc.id as grow_cycle_id, gc.state as cycle_state, gc.planted_on,
    gc.planted_on_precision, gc.harvest_readiness, p.id as position_id, p.position_number,
    p.system_instance_id, g.id as garden_id, g.name as garden_name, o.occupied_from, o.occupied_until
  from garden.plant_instances pi
  join garden.grow_cycles gc on gc.plant_instance_id = pi.id
  join garden.cycle_occupancies o on o.grow_cycle_id = gc.id
  join garden.positions p on p.id = o.position_id
  join canonical_gardens g on g.id = p.garden_id
  where pi.owner_id = (select id from owner)
  order by gc.id, (o.occupied_until is null) desc, o.occupied_until desc nulls first, o.created_at desc
),
plant_rows as (
  select pc.*, latest_photo.id as latest_photo_id, latest_photo.storage_path as latest_photo_storage_path,
    latest_photo.captured_at as latest_photo_captured_at, latest_photo.captured_at_precision as latest_photo_captured_at_precision
  from plant_cycles pc
  left join lateral (
    select ph.id, ph.storage_path, ph.captured_at, ph.captured_at_precision
    from garden.events e join garden.photos ph on ph.event_id = e.id and ph.upload_status = 'uploaded'
    where e.grow_cycle_id = pc.grow_cycle_id and e.invalidated_at is null and ph.media_scope = 'cycle_evidence'
    order by coalesce(ph.captured_at, e.occurred_at, ph.created_at) desc, ph.created_at desc limit 1
  ) latest_photo on true
),
event_rows as (
  select e.*, gc.plant_instance_id from garden.events e
  join garden.grow_cycles gc on gc.id = e.grow_cycle_id join plant_cycles pc on pc.grow_cycle_id = gc.id
  where e.owner_id = (select id from owner) and e.invalidated_at is null
),
photo_rows as (
  select ph.*, e.grow_cycle_id, gc.plant_instance_id
  from garden.photos ph join garden.events e on e.id = ph.event_id join garden.grow_cycles gc on gc.id = e.grow_cycle_id
  join plant_cycles pc on pc.grow_cycle_id = gc.id
  where ph.owner_id = (select id from owner) and ph.upload_status = 'uploaded' and e.invalidated_at is null
),
garden_cover_rows as (
  select ph.*, null::uuid as grow_cycle_id, null::uuid as plant_instance_id
  from garden.photos ph join canonical_gardens g on g.id = ph.garden_id
  where ph.owner_id = (select id from owner) and ph.upload_status = 'uploaded' and ph.media_scope = 'garden_cover'
),
all_photo_rows as (
  select * from photo_rows union all select * from garden_cover_rows
),
attention_rows as (
  select a.*, gc.plant_instance_id from garden.attention_items a
  join garden.grow_cycles gc on gc.id = a.grow_cycle_id join plant_cycles pc on pc.grow_cycle_id = gc.id
  where a.owner_id = (select id from owner) and a.status = 'open'
)
select jsonb_build_object(
  'gardens', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', g.name, 'system_instance_id', g.system_instance_id,
      'system_instance_name', g.system_instance_name, 'system_definition_key', g.system_definition_key,
      'legacy_system_model', g.legacy_system_model, 'custom_definition_id', g.custom_definition_id,
      'position_capacity', g.position_capacity, 'map_layout', g.map_layout, 'kind', g.kind, 'place', g.place,
      'note', g.note, 'sort_order', g.sort_order, 'archived_at', g.archived_at, 'cover_photo_id', g.cover_photo_id,
      'levels', coalesce((select jsonb_agg(jsonb_build_object('level_number', l.level_number, 'row_count', l.row_count, 'column_count', l.column_count) order by l.level_number)
        from garden.custom_system_levels l where l.definition_id = g.custom_definition_id), '[]'::jsonb),
      'positions', coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'position_number', p.position_number,
          'layout', case when ls.id is null then null else jsonb_build_object(
            'site_id', ls.id, 'site_kind', ls.site_kind, 'is_active', ls.is_active, 'grid_x', ls.grid_x,
            'grid_y', ls.grid_y, 'level_number', ls.level_number, 'row_number', ls.row_number,
            'column_number', ls.column_number, 'label', ls.label) end
        ) order by p.position_number)
        from garden.positions p left join garden.layout_sites ls on ls.position_id = p.id and ls.system_instance_id = g.system_instance_id
        where p.system_instance_id = g.system_instance_id
      ), '[]'::jsonb)
    ) order by g.sort_order, g.created_at, g.id) from canonical_gardens g
  ), '[]'::jsonb),
  'plants', coalesce((select jsonb_agg(jsonb_build_object(
    'id', p.plant_instance_id, 'nickname', p.nickname, 'reference_key', p.reference_key, 'common_name', p.common_name,
    'scientific_name', p.scientific_name, 'cultivar', p.cultivar, 'status', p.plant_status,
    'grow_cycle_id', p.grow_cycle_id, 'cycle_state', p.cycle_state, 'planted_on', p.planted_on,
    'planted_on_precision', p.planted_on_precision, 'harvest_readiness', p.harvest_readiness, 'garden_id', p.garden_id,
    'system_instance_id', p.system_instance_id, 'position_id', p.position_id, 'position_number', p.position_number,
    'occupied_from', p.occupied_from, 'occupied_until', p.occupied_until, 'latest_photo_id', p.latest_photo_id,
    'latest_photo_storage_path', p.latest_photo_storage_path, 'latest_photo_captured_at', p.latest_photo_captured_at,
    'latest_photo_captured_at_precision', p.latest_photo_captured_at_precision
  ) order by p.garden_name, p.position_number, p.planted_on nulls last) from plant_rows p), '[]'::jsonb),
  'events', coalesce((select jsonb_agg(jsonb_build_object(
    'id', e.id, 'plant_instance_id', e.plant_instance_id, 'grow_cycle_id', e.grow_cycle_id, 'event_type', e.event_type,
    'occurred_at', e.occurred_at, 'created_at', e.created_at, 'note', e.note, 'event_data', e.event_data, 'revision', e.revision
  ) order by e.occurred_at desc, e.created_at desc) from event_rows e), '[]'::jsonb),
  'photos', coalesce((select jsonb_agg(jsonb_build_object(
    'id', p.id, 'plant_instance_id', p.plant_instance_id, 'grow_cycle_id', p.grow_cycle_id, 'event_id', p.event_id,
    'storage_path', p.storage_path, 'original_filename', p.original_filename, 'content_type', p.content_type,
    'byte_size', p.byte_size, 'captured_at', p.captured_at, 'captured_at_precision', p.captured_at_precision,
    'width', p.width, 'height', p.height, 'media_scope', p.media_scope
  ) order by coalesce(p.captured_at, p.created_at) desc) from all_photo_rows p), '[]'::jsonb),
  'attention', coalesce((select jsonb_agg(jsonb_build_object(
    'id', a.id, 'plant_instance_id', a.plant_instance_id, 'grow_cycle_id', a.grow_cycle_id, 'garden_id', a.garden_id,
    'purpose', a.purpose, 'subject_key', a.subject_key, 'title', a.title, 'origin', a.origin, 'status', a.status,
    'due_on', a.due_on, 'next_review_on', a.next_review_on, 'created_at', a.created_at
  ) order by coalesce(a.due_on, a.next_review_on) nulls last, a.created_at) from attention_rows a), '[]'::jsonb)
);
$$;

revoke all on table garden.custom_system_definitions, garden.custom_system_levels from anon;
revoke all on function public.garden_x_create_custom_system(uuid, uuid, uuid, uuid, text, jsonb) from public;
revoke all on function public.garden_x_set_custom_system_photo(uuid, uuid, uuid) from public;
grant execute on function public.garden_x_create_custom_system(uuid, uuid, uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.garden_x_set_custom_system_photo(uuid, uuid, uuid) to authenticated;

commit;
