-- Phase 20: physical systems are configurable without rewriting grow-cycle history.
begin;

alter table garden.gardens drop constraint if exists gardens_map_layout_check;
alter table garden.gardens drop constraint if exists gardens_position_capacity_check;
alter table garden.gardens add constraint garden_map_layout_supported
  check (map_layout in ('provisional_list', 'uruq_8_v1', 'uruq_12_v1', 'custom_grid'));
alter table garden.gardens add constraint garden_position_capacity_range
  check (position_capacity between 0 and 36);

create table garden.layout_sites (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references garden.gardens(id) on delete cascade,
  position_id uuid unique references garden.positions(id) on delete restrict,
  site_kind text not null check (site_kind in ('grow', 'utility')),
  is_active boolean not null default true,
  grid_x integer not null check (grid_x between 1 and 8),
  grid_y integer not null check (grid_y between 1 and 9),
  label text check (label is null or char_length(trim(label)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index layout_sites_one_active_point on garden.layout_sites(garden_id, grid_x, grid_y) where is_active;
create index layout_sites_garden on garden.layout_sites(garden_id, grid_y, grid_x);

create table garden.layout_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  garden_id uuid not null references garden.gardens(id) on delete cascade,
  layout_site_id uuid references garden.layout_sites(id) on delete set null,
  operation text not null check (operation in ('site_added', 'site_updated')),
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index layout_events_garden_created_at on garden.layout_events(garden_id, created_at desc);

alter table garden.layout_sites enable row level security;
alter table garden.layout_events enable row level security;
create policy "owners read their layout sites" on garden.layout_sites for select to authenticated using (
  exists (select 1 from garden.gardens g where g.id = garden_id and g.owner_id = (select auth.uid()))
);
create policy "owners read their layout events" on garden.layout_events for select to authenticated using (
  (select auth.uid()) = owner_id
);

-- Materialize the two confirmed URUQ layouts. Existing position ids and numbering stay unchanged.
insert into garden.layout_sites(garden_id, position_id, site_kind, grid_x, grid_y)
select p.garden_id, p.id, 'grow',
  case
    when g.position_capacity = 8 then case p.position_number
      when 1 then 2 when 2 then 6 when 3 then 1 when 4 then 4 when 5 then 7
      when 6 then 1 when 7 then 4 when 8 then 7 end
    when g.position_capacity = 12 then case p.position_number
      when 1 then 4 when 2 then 1 when 3 then 3 when 4 then 5 when 5 then 7
      when 6 then 2 when 7 then 4 when 8 then 6 when 9 then 1 when 10 then 3
      when 11 then 5 when 12 then 7 end
    else ((p.position_number - 1) % 4) * 2 + 1
  end,
  case
    when g.position_capacity = 8 then case when p.position_number <= 2 then 1 when p.position_number <= 5 then 2 else 3 end
    when g.position_capacity = 12 then case when p.position_number = 1 then 1 when p.position_number <= 5 then 2 when p.position_number <= 8 then 3 else 4 end
    else ((p.position_number - 1) / 4) + 1
  end
from garden.positions p
join garden.gardens g on g.id = p.garden_id
on conflict (position_id) do nothing;

update garden.gardens
set map_layout = case
  when system_model ilike 'uruq%' and position_capacity = 8 then 'uruq_8_v1'
  when system_model ilike 'uruq%' and position_capacity = 12 then 'uruq_12_v1'
  else 'custom_grid'
end;

create or replace function garden.refresh_position_capacity(p_garden_id uuid)
returns void language sql security definer set search_path = '' as $$
  update garden.gardens g
  set position_capacity = (
    select count(*)::integer from garden.layout_sites s
    where s.garden_id = g.id and s.site_kind = 'grow' and s.is_active and s.position_id is not null
  ), updated_at = now()
  where g.id = p_garden_id
$$;

create or replace function public.garden_create_garden(
  p_request_id uuid,
  p_name text,
  p_system_model text,
  p_position_capacity integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('name', trim(p_name), 'system_model', nullif(trim(p_system_model), ''), 'position_capacity', p_position_capacity);
  v_response jsonb;
  v_garden_id uuid;
  v_layout text;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'create_garden', v_payload);
  if v_response is not null then return v_response; end if;
  if p_position_capacity not between 1 and 36 then raise exception 'Position capacity must be from 1 to 36'; end if;
  if char_length(trim(p_name)) not between 1 and 80 then raise exception 'Garden name is required'; end if;
  v_layout := case
    when lower(trim(coalesce(p_system_model, ''))) = 'uruq' and p_position_capacity = 8 then 'uruq_8_v1'
    when lower(trim(coalesce(p_system_model, ''))) = 'uruq' and p_position_capacity = 12 then 'uruq_12_v1'
    else 'custom_grid'
  end;
  insert into garden.gardens(owner_id, name, system_model, position_capacity, map_layout)
  values (v_owner, trim(p_name), nullif(trim(p_system_model), ''), p_position_capacity, v_layout)
  returning id into v_garden_id;
  insert into garden.positions(garden_id, position_number)
  select v_garden_id, n from generate_series(1, p_position_capacity) as n;
  insert into garden.layout_sites(garden_id, position_id, site_kind, grid_x, grid_y)
  select v_garden_id, p.id, 'grow',
    case when v_layout = 'uruq_8_v1' then case p.position_number when 1 then 2 when 2 then 6 when 3 then 1 when 4 then 4 when 5 then 7 when 6 then 1 when 7 then 4 when 8 then 7 end
         when v_layout = 'uruq_12_v1' then case p.position_number when 1 then 4 when 2 then 1 when 3 then 3 when 4 then 5 when 5 then 7 when 6 then 2 when 7 then 4 when 8 then 6 when 9 then 1 when 10 then 3 when 11 then 5 when 12 then 7 end
         else ((p.position_number - 1) % 4) * 2 + 1 end,
    case when v_layout = 'uruq_8_v1' then case when p.position_number <= 2 then 1 when p.position_number <= 5 then 2 else 3 end
         when v_layout = 'uruq_12_v1' then case when p.position_number = 1 then 1 when p.position_number <= 5 then 2 when p.position_number <= 8 then 3 else 4 end
         else ((p.position_number - 1) / 4) + 1 end
  from garden.positions p where p.garden_id = v_garden_id;
  insert into garden.layout_events(owner_id, garden_id, operation, event_data)
  values (v_owner, v_garden_id, 'site_added', jsonb_build_object('source', 'garden_created', 'layout', v_layout));
  v_response := jsonb_build_object('garden_id', v_garden_id);
  perform garden.store_command_response(v_owner, p_request_id, 'create_garden', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_add_layout_site(
  p_request_id uuid,
  p_garden_id uuid,
  p_grid_x integer,
  p_grid_y integer,
  p_site_kind text,
  p_label text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id(); v_payload jsonb := jsonb_build_object('garden_id', p_garden_id, 'grid_x', p_grid_x, 'grid_y', p_grid_y, 'site_kind', p_site_kind, 'label', nullif(trim(p_label), ''));
  v_response jsonb; v_site_id uuid; v_position_id uuid; v_position_number integer;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'add_layout_site', v_payload);
  if v_response is not null then return v_response; end if;
  if p_site_kind not in ('grow', 'utility') then raise exception 'Invalid physical site type'; end if;
  if p_grid_x not between 1 and 8 or p_grid_y not between 1 and 9 then raise exception 'Invalid map coordinate'; end if;
  if char_length(trim(coalesce(p_label, ''))) > 80 then raise exception 'Label must have at most 80 characters'; end if;
  if not exists (select 1 from garden.gardens where id = p_garden_id and owner_id = v_owner for update) then raise exception 'Garden not found'; end if;
  if exists (select 1 from garden.layout_sites where garden_id = p_garden_id and grid_x = p_grid_x and grid_y = p_grid_y and is_active) then raise exception 'That point is already occupied on the map'; end if;
  if p_site_kind = 'grow' then
    select coalesce(max(position_number), 0) + 1 into v_position_number from garden.positions where garden_id = p_garden_id;
    if v_position_number > 36 then raise exception 'A garden can have at most 36 cultivation positions'; end if;
    insert into garden.positions(garden_id, position_number) values (p_garden_id, v_position_number) returning id into v_position_id;
  end if;
  insert into garden.layout_sites(garden_id, position_id, site_kind, grid_x, grid_y, label)
  values (p_garden_id, v_position_id, p_site_kind, p_grid_x, p_grid_y, nullif(trim(p_label), '')) returning id into v_site_id;
  perform garden.refresh_position_capacity(p_garden_id);
  insert into garden.layout_events(owner_id, garden_id, layout_site_id, operation, event_data)
  values (v_owner, p_garden_id, v_site_id, 'site_added', jsonb_build_object('site_kind', p_site_kind, 'grid_x', p_grid_x, 'grid_y', p_grid_y, 'position_number', v_position_number));
  v_response := jsonb_build_object('site_id', v_site_id, 'position_id', v_position_id, 'position_number', v_position_number);
  perform garden.store_command_response(v_owner, p_request_id, 'add_layout_site', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_update_layout_site(
  p_request_id uuid,
  p_site_id uuid,
  p_grid_x integer,
  p_grid_y integer,
  p_site_kind text,
  p_active boolean,
  p_label text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id(); v_payload jsonb := jsonb_build_object('site_id', p_site_id, 'grid_x', p_grid_x, 'grid_y', p_grid_y, 'site_kind', p_site_kind, 'active', p_active, 'label', nullif(trim(p_label), ''));
  v_response jsonb; v_site garden.layout_sites%rowtype; v_position_id uuid; v_position_number integer;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'update_layout_site', v_payload);
  if v_response is not null then return v_response; end if;
  if p_site_kind not in ('grow', 'utility') then raise exception 'Invalid physical site type'; end if;
  if p_grid_x not between 1 and 8 or p_grid_y not between 1 and 9 then raise exception 'Invalid map coordinate'; end if;
  if char_length(trim(coalesce(p_label, ''))) > 80 then raise exception 'Label must have at most 80 characters'; end if;
  select s.* into v_site from garden.layout_sites s join garden.gardens g on g.id = s.garden_id
  where s.id = p_site_id and g.owner_id = v_owner for update of s;
  if not found then raise exception 'Physical site not found'; end if;
  if (not p_active or p_site_kind = 'utility') and v_site.position_id is not null and exists (
    select 1 from garden.cycle_occupancies where position_id = v_site.position_id and occupied_until is null
  ) then raise exception 'Move or close the active grow cycle before changing this physical point'; end if;
  if p_active and exists (select 1 from garden.layout_sites s where s.garden_id = v_site.garden_id and s.id <> v_site.id and s.grid_x = p_grid_x and s.grid_y = p_grid_y and s.is_active) then
    raise exception 'That point is already occupied on the map';
  end if;
  v_position_id := v_site.position_id;
  if p_site_kind = 'grow' and v_position_id is null then
    select coalesce(max(position_number), 0) + 1 into v_position_number from garden.positions where garden_id = v_site.garden_id;
    if v_position_number > 36 then raise exception 'A garden can have at most 36 cultivation positions'; end if;
    insert into garden.positions(garden_id, position_number) values (v_site.garden_id, v_position_number) returning id into v_position_id;
  else
    select position_number into v_position_number from garden.positions where id = v_position_id;
  end if;
  update garden.layout_sites set position_id = v_position_id, site_kind = p_site_kind, is_active = p_active,
    grid_x = p_grid_x, grid_y = p_grid_y, label = nullif(trim(p_label), ''), updated_at = now() where id = v_site.id;
  perform garden.refresh_position_capacity(v_site.garden_id);
  insert into garden.layout_events(owner_id, garden_id, layout_site_id, operation, event_data)
  values (v_owner, v_site.garden_id, v_site.id, 'site_updated', jsonb_build_object('site_kind', p_site_kind, 'active', p_active, 'grid_x', p_grid_x, 'grid_y', p_grid_y, 'position_number', v_position_number));
  v_response := jsonb_build_object('site_id', v_site.id, 'position_id', v_position_id, 'position_number', v_position_number);
  perform garden.store_command_response(v_owner, p_request_id, 'update_layout_site', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_start_cycle(
  p_request_id uuid, p_position_id uuid, p_crop_name text, p_planted_on date, p_planted_on_precision text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id(); v_payload jsonb := jsonb_build_object('position_id', p_position_id, 'crop_name', trim(p_crop_name), 'planted_on', p_planted_on, 'planted_on_precision', p_planted_on_precision);
  v_response jsonb; v_crop_id uuid; v_cycle_id uuid; v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'start_cycle', v_payload);
  if v_response is not null then return v_response; end if;
  if char_length(trim(p_crop_name)) not between 1 and 100 then raise exception 'Crop name is required'; end if;
  if not exists (select 1 from garden.positions p join garden.gardens g on g.id = p.garden_id join garden.layout_sites s on s.position_id = p.id and s.site_kind = 'grow' and s.is_active where p.id = p_position_id and g.owner_id = v_owner) then raise exception 'Position is not available for cultivation'; end if;
  if exists (select 1 from garden.cycle_occupancies where position_id = p_position_id and occupied_until is null) then raise exception 'Position already has a current grow cycle'; end if;
  if (p_planted_on is null and p_planted_on_precision <> 'unknown') or (p_planted_on is not null and p_planted_on_precision not in ('exact', 'approximate')) then raise exception 'Invalid planted date precision'; end if;
  insert into garden.crops(owner_id, common_name) values (v_owner, trim(p_crop_name)) on conflict (owner_id, common_name) do update set common_name = excluded.common_name returning id into v_crop_id;
  insert into garden.grow_cycles(owner_id, crop_id, planted_on, planted_on_precision) values (v_owner, v_crop_id, p_planted_on, p_planted_on_precision) returning id into v_cycle_id;
  insert into garden.cycle_occupancies(position_id, grow_cycle_id, occupied_from) values (p_position_id, v_cycle_id, p_planted_on);
  insert into garden.events(owner_id, grow_cycle_id, event_type, note) values (v_owner, v_cycle_id, 'cycle_started', 'Ciclo iniciado') returning id into v_event_id;
  v_response := jsonb_build_object('grow_cycle_id', v_cycle_id, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'start_cycle', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_move_cycle(
  p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_target_position_id uuid, p_moved_on date
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id(); v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'target_position_id', p_target_position_id, 'moved_on', p_moved_on);
  v_response jsonb; v_cycle garden.grow_cycles%rowtype; v_source garden.cycle_occupancies%rowtype; v_source_garden uuid; v_target_garden uuid; v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'move_cycle', v_payload);
  if v_response is not null then return v_response; end if;
  if p_moved_on is null then raise exception 'Move date is required'; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'active' then raise exception 'Current grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before moving'; end if;
  select * into v_source from garden.cycle_occupancies where grow_cycle_id = p_grow_cycle_id and occupied_until is null for update;
  if not found then raise exception 'Current occupancy not found'; end if;
  select garden_id into v_source_garden from garden.positions where id = v_source.position_id;
  select p.garden_id into v_target_garden from garden.positions p join garden.gardens g on g.id = p.garden_id join garden.layout_sites s on s.position_id = p.id and s.site_kind = 'grow' and s.is_active where p.id = p_target_position_id and g.owner_id = v_owner;
  if v_target_garden is null then raise exception 'Target position is not available for cultivation'; end if;
  if v_target_garden <> v_source_garden then raise exception 'A cycle can only move within its garden'; end if;
  if p_target_position_id = v_source.position_id then raise exception 'Target position is already current'; end if;
  if exists (select 1 from garden.cycle_occupancies where position_id = p_target_position_id and occupied_until is null) then raise exception 'Target position already has a current grow cycle'; end if;
  if v_source.occupied_from is not null and p_moved_on < v_source.occupied_from then raise exception 'Move cannot precede occupancy'; end if;
  update garden.cycle_occupancies set occupied_until = p_moved_on where id = v_source.id;
  insert into garden.cycle_occupancies(position_id, grow_cycle_id, occupied_from) values (p_target_position_id, p_grow_cycle_id, p_moved_on);
  update garden.grow_cycles set revision = revision + 1, updated_at = now() where id = p_grow_cycle_id;
  insert into garden.events(owner_id, grow_cycle_id, event_type, note) values (v_owner, p_grow_cycle_id, 'cycle_moved', 'Ciclo trasladado') returning id into v_event_id;
  insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason) values (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'moved', jsonb_build_object('position_id', v_source.position_id), jsonb_build_object('position_id', p_target_position_id), 'movement');
  v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'move_cycle', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_get_garden(p_garden_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'id', g.id, 'name', g.name, 'system_model', g.system_model, 'position_capacity', g.position_capacity, 'map_layout', g.map_layout,
    'layout_sites', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'position_id', s.position_id, 'position_number', p.position_number, 'site_kind', s.site_kind, 'is_active', s.is_active, 'grid_x', s.grid_x, 'grid_y', s.grid_y, 'label', s.label) order by s.grid_y, s.grid_x, s.id) from garden.layout_sites s left join garden.positions p on p.id = s.position_id where s.garden_id = g.id), '[]'::jsonb),
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'position_number', p.position_number,
        'current_cycle', case when current_cycle.id is null then null else jsonb_build_object('id', current_cycle.id, 'crop_name', current_crop.common_name, 'planted_on', current_cycle.planted_on, 'planted_on_precision', current_cycle.planted_on_precision, 'harvest_readiness', current_cycle.harvest_readiness) end,
        'previous_cycles', coalesce(history.cycles, '[]'::jsonb)) order by p.position_number)
      from garden.positions p
      left join garden.cycle_occupancies current_occupancy on current_occupancy.position_id = p.id and current_occupancy.occupied_until is null
      left join garden.grow_cycles current_cycle on current_cycle.id = current_occupancy.grow_cycle_id and current_cycle.state = 'active'
      left join garden.crops current_crop on current_crop.id = current_cycle.crop_id
      left join lateral (select jsonb_agg(jsonb_build_object('id', historical_cycle.id, 'crop_name', historical_crop.common_name, 'planted_on', historical_cycle.planted_on, 'planted_on_precision', historical_cycle.planted_on_precision, 'harvest_readiness', historical_cycle.harvest_readiness, 'state', historical_cycle.state, 'last_occupied_on', historical.last_occupied_on) order by historical.last_occupied_on desc nulls last, historical_cycle.created_at desc) as cycles from (select o.grow_cycle_id, max(coalesce(o.occupied_until, o.occupied_from)) as last_occupied_on from garden.cycle_occupancies o where o.position_id = p.id and o.occupied_until is not null group by o.grow_cycle_id) historical join garden.grow_cycles historical_cycle on historical_cycle.id = historical.grow_cycle_id join garden.crops historical_crop on historical_crop.id = historical_cycle.crop_id) history on true
      where p.garden_id = g.id
    ), '[]'::jsonb)
  ) into v_result from garden.gardens g where g.id = p_garden_id and g.owner_id = public.garden_owner_id();
  if v_result is null then raise exception 'Garden not found'; end if;
  return v_result;
end;
$$;

create or replace function public.garden_start_maintenance_session(p_request_id uuid, p_garden_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_payload jsonb; v_response jsonb; v_session_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if coalesce(cardinality(p_garden_ids), 0) not between 1 and 2 then raise exception 'Select one or two gardens'; end if;
  if array_length(array(select distinct unnest(p_garden_ids)), 1) <> cardinality(p_garden_ids) then raise exception 'Garden selection contains duplicates'; end if;
  if (select count(*) from garden.gardens where owner_id = v_owner and id = any(p_garden_ids)) <> cardinality(p_garden_ids) then raise exception 'Garden not found'; end if;
  v_payload := jsonb_build_object('garden_ids', p_garden_ids); v_response := garden.command_response(v_owner, p_request_id, 'start_maintenance_session', v_payload);
  if v_response is not null then return v_response; end if;
  if exists (select 1 from garden.maintenance_sessions where owner_id = v_owner and state in ('in_progress', 'paused')) then raise exception 'Resume or abandon the existing maintenance session first'; end if;
  insert into garden.maintenance_sessions(owner_id) values (v_owner) returning id into v_session_id;
  insert into garden.maintenance_session_positions(session_id, garden_id, position_id, captured_grow_cycle_id, position_number, ordinal)
  select v_session_id, p.garden_id, p.id, current_cycle.grow_cycle_id, p.position_number, row_number() over (order by array_position(p_garden_ids, p.garden_id), p.position_number)::integer
  from garden.positions p join garden.layout_sites s on s.position_id = p.id and s.site_kind = 'grow' and s.is_active
  left join garden.cycle_occupancies current_cycle on current_cycle.position_id = p.id and current_cycle.occupied_until is null
  where p.garden_id = any(p_garden_ids);
  v_response := jsonb_build_object('session_id', v_session_id); perform garden.store_command_response(v_owner, p_request_id, 'start_maintenance_session', v_payload, v_response); return v_response;
end;
$$;

create or replace function public.garden_get_control_v2()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('garden_id', g.id, 'garden_name', g.name, 'position_id', p.id, 'position_number', p.position_number, 'grow_cycle_id', gc.id, 'crop_name', c.common_name, 'planted_on', gc.planted_on, 'harvest_readiness', gc.harvest_readiness, 'attention_count', (select count(*) from garden.attention_items a where a.owner_id = g.owner_id and a.status = 'open' and (a.garden_id = g.id or a.grow_cycle_id = gc.id))) order by g.name, p.position_number), '[]'::jsonb)
  from garden.gardens g join garden.positions p on p.garden_id = g.id join garden.layout_sites s on s.position_id = p.id and s.site_kind = 'grow' and s.is_active
  left join garden.cycle_occupancies o on o.position_id = p.id and o.occupied_until is null left join garden.grow_cycles gc on gc.id = o.grow_cycle_id and gc.state = 'active' left join garden.crops c on c.id = gc.crop_id
  where g.owner_id = public.garden_owner_id()
$$;

-- The operational export carries the map and its configuration history as well.
create or replace function public.garden_export_owner_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id();
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  return jsonb_build_object(
    'format_version', 'streex-garden-export/v1', 'exported_at', now(),
    'gardens', coalesce((select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', g.name, 'system_model', g.system_model, 'position_capacity', g.position_capacity, 'map_layout', g.map_layout, 'created_at', g.created_at, 'updated_at', g.updated_at,
      'positions', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'position_number', p.position_number, 'created_at', p.created_at) order by p.position_number) from garden.positions p where p.garden_id = g.id), '[]'::jsonb),
      'layout_sites', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'position_id', s.position_id, 'site_kind', s.site_kind, 'is_active', s.is_active, 'grid_x', s.grid_x, 'grid_y', s.grid_y, 'label', s.label, 'created_at', s.created_at, 'updated_at', s.updated_at) order by s.grid_y, s.grid_x, s.id) from garden.layout_sites s where s.garden_id = g.id), '[]'::jsonb)
    ) order by g.created_at) from garden.gardens g where g.owner_id = v_owner), '[]'::jsonb),
    'layout_events', coalesce((select jsonb_agg(jsonb_build_object('id', le.id, 'garden_id', le.garden_id, 'layout_site_id', le.layout_site_id, 'operation', le.operation, 'event_data', le.event_data, 'created_at', le.created_at) order by le.created_at, le.id) from garden.layout_events le where le.owner_id = v_owner), '[]'::jsonb),
    'crops', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'common_name', c.common_name, 'scientific_name', c.scientific_name, 'created_at', c.created_at) order by c.created_at) from garden.crops c where c.owner_id = v_owner), '[]'::jsonb),
    'grow_cycles', coalesce((select jsonb_agg(jsonb_build_object('id', gc.id, 'crop_id', gc.crop_id, 'planted_on', gc.planted_on, 'planted_on_precision', gc.planted_on_precision, 'state', gc.state, 'harvest_readiness', gc.harvest_readiness, 'revision', gc.revision, 'created_at', gc.created_at, 'updated_at', gc.updated_at, 'occupancies', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'position_id', o.position_id, 'occupied_from', o.occupied_from, 'occupied_until', o.occupied_until, 'created_at', o.created_at) order by o.created_at) from garden.cycle_occupancies o where o.grow_cycle_id = gc.id), '[]'::jsonb)) order by gc.created_at) from garden.grow_cycles gc where gc.owner_id = v_owner), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'garden_id', e.garden_id, 'grow_cycle_id', e.grow_cycle_id, 'event_type', e.event_type, 'occurred_at', e.occurred_at, 'note', e.note, 'event_data', e.event_data, 'revision', e.revision, 'invalidated_at', e.invalidated_at, 'invalidated_reason', e.invalidated_reason, 'created_at', e.created_at) order by e.occurred_at, e.id) from garden.events e where e.owner_id = v_owner), '[]'::jsonb),
    'cycle_revisions', coalesce((select jsonb_agg(jsonb_build_object('id', cr.id, 'grow_cycle_id', cr.grow_cycle_id, 'revision_number', cr.revision_number, 'operation', cr.operation, 'previous_values', cr.previous_values, 'next_values', cr.next_values, 'reason', cr.reason, 'created_at', cr.created_at) order by cr.created_at, cr.id) from garden.cycle_revisions cr where cr.owner_id = v_owner), '[]'::jsonb),
    'event_revisions', coalesce((select jsonb_agg(jsonb_build_object('id', er.id, 'event_id', er.event_id, 'revision_number', er.revision_number, 'operation', er.operation, 'previous_values', er.previous_values, 'next_values', er.next_values, 'reason', er.reason, 'created_at', er.created_at) order by er.created_at, er.id) from garden.event_revisions er where er.owner_id = v_owner), '[]'::jsonb),
    'attention_items', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'garden_id', a.garden_id, 'grow_cycle_id', a.grow_cycle_id, 'purpose', a.purpose, 'subject_key', a.subject_key, 'title', a.title, 'origin', a.origin, 'status', a.status, 'due_on', a.due_on, 'next_review_on', a.next_review_on, 'completed_event_id', a.completed_event_id, 'completed_at', a.completed_at, 'dismissed_at', a.dismissed_at, 'dismissed_reason', a.dismissed_reason, 'created_at', a.created_at, 'updated_at', a.updated_at) order by a.created_at, a.id) from garden.attention_items a where a.owner_id = v_owner), '[]'::jsonb),
    'attention_history', coalesce((select jsonb_agg(jsonb_build_object('id', ah.id, 'attention_item_id', ah.attention_item_id, 'from_status', ah.from_status, 'to_status', ah.to_status, 'operation', ah.operation, 'reason', ah.reason, 'related_event_id', ah.related_event_id, 'created_at', ah.created_at) order by ah.created_at, ah.id) from garden.attention_history ah where ah.owner_id = v_owner), '[]'::jsonb),
    'recurrence_rules', coalesce((select jsonb_agg(jsonb_build_object('id', rr.id, 'garden_id', rr.garden_id, 'grow_cycle_id', rr.grow_cycle_id, 'purpose', rr.purpose, 'schedule_type', rr.schedule_type, 'interval_days', rr.interval_days, 'anchor_on', rr.anchor_on, 'active', rr.active, 'paused_reason', rr.paused_reason, 'created_at', rr.created_at, 'updated_at', rr.updated_at) order by rr.created_at, rr.id) from garden.recurrence_rules rr where rr.owner_id = v_owner), '[]'::jsonb),
    'maintenance_sessions', coalesce((select jsonb_agg(jsonb_build_object('id', ms.id, 'state', ms.state, 'started_at', ms.started_at, 'completed_at', ms.completed_at, 'cursor_position', ms.cursor_position, 'positions', coalesce((select jsonb_agg(jsonb_build_object('id', msp.id, 'garden_id', msp.garden_id, 'position_id', msp.position_id, 'captured_grow_cycle_id', msp.captured_grow_cycle_id, 'position_number', msp.position_number, 'ordinal', msp.ordinal, 'progress', msp.progress, 'visual_review_event_id', msp.visual_review_event_id, 'progressed_at', msp.progressed_at) order by msp.ordinal) from garden.maintenance_session_positions msp where msp.session_id = ms.id), '[]'::jsonb)) order by ms.started_at, ms.id) from garden.maintenance_sessions ms where ms.owner_id = v_owner), '[]'::jsonb),
    'photo_manifest', coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'event_id', ph.event_id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename, 'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256, 'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status, 'width', ph.width, 'height', ph.height, 'created_at', ph.created_at) order by ph.created_at, ph.id) from garden.photos ph where ph.owner_id = v_owner), '[]'::jsonb)
  );
end;
$$;

revoke all on function garden.refresh_position_capacity(uuid) from public;
revoke all on function public.garden_create_garden(uuid, text, text, integer) from public;
revoke all on function public.garden_start_cycle(uuid, uuid, text, date, text) from public;
revoke all on function public.garden_move_cycle(uuid, uuid, integer, uuid, date) from public;
revoke all on function public.garden_get_garden(uuid) from public;
revoke all on function public.garden_start_maintenance_session(uuid, uuid[]) from public;
revoke all on function public.garden_get_control_v2() from public;
revoke all on function public.garden_export_owner_data() from public;
revoke all on function public.garden_add_layout_site(uuid, uuid, integer, integer, text, text) from public;
revoke all on function public.garden_update_layout_site(uuid, uuid, integer, integer, text, boolean, text) from public;
grant execute on function public.garden_create_garden(uuid, text, text, integer) to authenticated;
grant execute on function public.garden_start_cycle(uuid, uuid, text, date, text) to authenticated;
grant execute on function public.garden_move_cycle(uuid, uuid, integer, uuid, date) to authenticated;
grant execute on function public.garden_get_garden(uuid) to authenticated;
grant execute on function public.garden_start_maintenance_session(uuid, uuid[]) to authenticated;
grant execute on function public.garden_get_control_v2() to authenticated;
grant execute on function public.garden_export_owner_data() to authenticated;
grant execute on function public.garden_add_layout_site(uuid, uuid, integer, integer, text, text) to authenticated;
grant execute on function public.garden_update_layout_site(uuid, uuid, integer, integer, text, boolean, text) to authenticated;

commit;
