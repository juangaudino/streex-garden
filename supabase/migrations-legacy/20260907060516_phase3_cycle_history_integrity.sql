-- Phase 3: cycle lifecycle, immutable correction history, and command idempotency.
-- Existing records remain readable; new structural changes are online, atomic commands.

begin;

alter table garden.grow_cycles drop constraint if exists grow_cycles_state_check;
update garden.grow_cycles set state = 'closed' where state in ('completed', 'archived');
alter table garden.grow_cycles add constraint grow_cycles_state_check check (state in ('active', 'closed'));
alter table garden.grow_cycles add column if not exists revision integer not null default 1 check (revision > 0);
alter table garden.grow_cycles add column if not exists updated_at timestamptz not null default now();

alter table garden.events drop constraint if exists events_event_type_check;
alter table garden.events add constraint events_event_type_check check (event_type in (
  'observation', 'planting', 'harvest', 'action', 'cycle_started', 'cycle_ended', 'cycle_moved',
  'visual_review', 'development_review', 'intervention', 'incident_opened', 'incident_resolved',
  'system_maintenance', 'measurement', 'readiness_review'
));
alter table garden.events add column if not exists revision integer not null default 1 check (revision > 0);
alter table garden.events add column if not exists invalidated_at timestamptz;
alter table garden.events add column if not exists invalidated_by uuid references auth.users(id);
alter table garden.events add column if not exists invalidated_reason text;
alter table garden.events add constraint events_invalidation_fields_check check (
  (invalidated_at is null and invalidated_by is null and invalidated_reason is null)
  or (invalidated_at is not null and invalidated_by is not null and char_length(trim(invalidated_reason)) between 1 and 500)
);

alter table garden.command_receipts add column if not exists request_payload jsonb;

create table if not exists garden.cycle_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  grow_cycle_id uuid not null references garden.grow_cycles(id) on delete restrict,
  revision_number integer not null check (revision_number > 1),
  operation text not null check (operation in ('planting_corrected', 'closed', 'replaced', 'moved', 'reopened')),
  previous_values jsonb not null,
  next_values jsonb not null,
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (grow_cycle_id, revision_number)
);

create table if not exists garden.event_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references garden.events(id) on delete restrict,
  revision_number integer not null check (revision_number > 1),
  operation text not null check (operation in ('invalidated')),
  previous_values jsonb not null,
  next_values jsonb not null,
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (event_id, revision_number)
);

create index if not exists cycle_revisions_cycle_created_at on garden.cycle_revisions(grow_cycle_id, created_at desc);
create index if not exists event_revisions_event_created_at on garden.event_revisions(event_id, created_at desc);
create index if not exists events_current_cycle_occurred_at on garden.events(grow_cycle_id, occurred_at desc) where invalidated_at is null;

alter table garden.cycle_revisions enable row level security;
alter table garden.event_revisions enable row level security;
create policy "owners read their cycle revisions" on garden.cycle_revisions for select using ((select auth.uid()) = owner_id);
create policy "owners read their event revisions" on garden.event_revisions for select using ((select auth.uid()) = owner_id);

-- Direct writes are never granted, but this trigger also protects future internal callers.
create or replace function garden.assert_occupancy_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
  v_garden_id uuid;
begin
  select g.owner_id, g.id into v_owner, v_garden_id
  from garden.positions p join garden.gardens g on g.id = p.garden_id
  where p.id = new.position_id;
  if v_owner is null then raise exception 'Position not found'; end if;
  if not exists (select 1 from garden.grow_cycles gc where gc.id = new.grow_cycle_id and gc.owner_id = v_owner) then
    raise exception 'Cycle and position must belong to the same owner';
  end if;
  if exists (
    select 1
    from garden.cycle_occupancies o
    join garden.positions other_position on other_position.id = o.position_id
    where o.grow_cycle_id = new.grow_cycle_id
      and o.id is distinct from new.id
      and other_position.garden_id <> v_garden_id
  ) then
    raise exception 'A cycle cannot move between gardens';
  end if;
  if new.occupied_from is not null and exists (
    select 1 from garden.cycle_occupancies o
    where o.position_id = new.position_id
      and o.id is distinct from new.id
      and o.occupied_from is not null
      and daterange(o.occupied_from, coalesce(o.occupied_until, 'infinity'::date), '[)')
          && daterange(new.occupied_from, coalesce(new.occupied_until, 'infinity'::date), '[)')
  ) then
    raise exception 'Known occupancy dates overlap';
  end if;
  return new;
end;
$$;

drop trigger if exists cycle_occupancies_assert_integrity on garden.cycle_occupancies;
create trigger cycle_occupancies_assert_integrity
before insert or update on garden.cycle_occupancies
for each row execute function garden.assert_occupancy_integrity();

-- Serializes same-owner command IDs and rejects reuse with another payload.
-- Old receipts have null payload because the old implementation did not retain it;
-- they remain replayable but cannot be compared retrospectively.
create or replace function garden.command_response(
  p_owner uuid,
  p_request_id uuid,
  p_command_name text,
  p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_response jsonb;
  v_payload jsonb;
begin
  perform pg_advisory_xact_lock(hashtext(p_owner::text), hashtext(p_request_id::text || ':' || p_command_name));
  select response, request_payload into v_response, v_payload
  from garden.command_receipts
  where owner_id = p_owner and request_id = p_request_id and command_name = p_command_name;
  if found then
    if v_payload is not null and v_payload is distinct from p_payload then
      raise exception 'Request id was already used with different input' using errcode = '22023';
    end if;
    return v_response;
  end if;
  return null;
end;
$$;

create or replace function garden.store_command_response(
  p_owner uuid,
  p_request_id uuid,
  p_command_name text,
  p_payload jsonb,
  p_response jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into garden.command_receipts(owner_id, request_id, command_name, request_payload, response)
  values (p_owner, p_request_id, p_command_name, p_payload, p_response)
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
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'create_garden', v_payload);
  if v_response is not null then return v_response; end if;
  if p_position_capacity not between 1 and 36 then raise exception 'Position capacity must be from 1 to 36'; end if;
  if char_length(trim(p_name)) not between 1 and 80 then raise exception 'Garden name is required'; end if;
  insert into garden.gardens (owner_id, name, system_model, position_capacity)
  values (v_owner, trim(p_name), nullif(trim(p_system_model), ''), p_position_capacity)
  returning id into v_garden_id;
  insert into garden.positions (garden_id, position_number)
  select v_garden_id, n from generate_series(1, p_position_capacity) as n;
  v_response := jsonb_build_object('garden_id', v_garden_id);
  perform garden.store_command_response(v_owner, p_request_id, 'create_garden', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_start_cycle(
  p_request_id uuid,
  p_position_id uuid,
  p_crop_name text,
  p_planted_on date,
  p_planted_on_precision text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('position_id', p_position_id, 'crop_name', trim(p_crop_name), 'planted_on', p_planted_on, 'planted_on_precision', p_planted_on_precision);
  v_response jsonb;
  v_crop_id uuid;
  v_cycle_id uuid;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'start_cycle', v_payload);
  if v_response is not null then return v_response; end if;
  if char_length(trim(p_crop_name)) not between 1 and 100 then raise exception 'Crop name is required'; end if;
  if not exists (
    select 1 from garden.positions p join garden.gardens g on g.id = p.garden_id
    where p.id = p_position_id and g.owner_id = v_owner
  ) then raise exception 'Position not found'; end if;
  if exists (select 1 from garden.cycle_occupancies where position_id = p_position_id and occupied_until is null) then
    raise exception 'Position already has a current grow cycle';
  end if;
  if (p_planted_on is null and p_planted_on_precision <> 'unknown')
    or (p_planted_on is not null and p_planted_on_precision not in ('exact', 'approximate')) then
    raise exception 'Invalid planted date precision';
  end if;
  insert into garden.crops (owner_id, common_name) values (v_owner, trim(p_crop_name))
  on conflict (owner_id, common_name) do update set common_name = excluded.common_name
  returning id into v_crop_id;
  insert into garden.grow_cycles (owner_id, crop_id, planted_on, planted_on_precision)
  values (v_owner, v_crop_id, p_planted_on, p_planted_on_precision) returning id into v_cycle_id;
  insert into garden.cycle_occupancies (position_id, grow_cycle_id, occupied_from)
  values (p_position_id, v_cycle_id, p_planted_on);
  insert into garden.events (owner_id, grow_cycle_id, event_type, note)
  values (v_owner, v_cycle_id, 'cycle_started', 'Ciclo iniciado') returning id into v_event_id;
  v_response := jsonb_build_object('grow_cycle_id', v_cycle_id, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'start_cycle', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_create_observation(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_note text,
  p_original_filename text default null,
  p_content_type text default null,
  p_byte_size bigint default null,
  p_captured_at timestamptz default null,
  p_captured_at_precision text default 'unknown',
  p_checksum_sha256 text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'note', nullif(trim(p_note), ''), 'original_filename', p_original_filename, 'content_type', p_content_type, 'byte_size', p_byte_size, 'captured_at', p_captured_at, 'captured_at_precision', p_captured_at_precision, 'checksum_sha256', p_checksum_sha256);
  v_response jsonb;
  v_event_id uuid;
  v_photo_id uuid;
  v_extension text;
  v_storage_path text;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'create_observation', v_payload);
  if v_response is not null then return v_response; end if;
  if not exists (select 1 from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner and state = 'active') then
    raise exception 'Current grow cycle not found';
  end if;
  if coalesce(nullif(trim(p_note), ''), '') = '' and p_original_filename is null then
    raise exception 'An observation needs a note or a photo';
  end if;
  if p_original_filename is not null and (
    p_content_type is null or p_byte_size is null or p_byte_size <= 0
    or p_checksum_sha256 is null or p_checksum_sha256 !~ '^[0-9a-f]{64}$'
    or p_captured_at_precision not in ('exact', 'approximate', 'unknown')
    or (p_captured_at is null and p_captured_at_precision <> 'unknown')
    or (p_captured_at is not null and p_captured_at_precision = 'unknown')
  ) then raise exception 'Invalid photo metadata'; end if;
  insert into garden.events (owner_id, grow_cycle_id, event_type, note)
  values (v_owner, p_grow_cycle_id, 'observation', nullif(trim(p_note), '')) returning id into v_event_id;
  if p_original_filename is not null then
    v_extension := case p_content_type
      when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/heic' then 'heic'
      when 'image/heif' then 'heif' when 'image/webp' then 'webp' else null end;
    if v_extension is null then raise exception 'Unsupported image type'; end if;
    v_photo_id := gen_random_uuid();
    v_storage_path := v_owner::text || '/' || v_photo_id::text || '/original.' || v_extension;
    insert into garden.photos (id, owner_id, event_id, storage_path, original_filename, content_type, byte_size, captured_at, captured_at_precision, checksum_sha256)
    values (v_photo_id, v_owner, v_event_id, v_storage_path, p_original_filename, p_content_type, p_byte_size, p_captured_at, p_captured_at_precision, p_checksum_sha256);
  end if;
  v_response := jsonb_strip_nulls(jsonb_build_object('event_id', v_event_id, 'photo_id', v_photo_id, 'storage_path', v_storage_path));
  perform garden.store_command_response(v_owner, p_request_id, 'create_observation', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_close_cycle(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_expected_revision integer,
  p_ended_on date,
  p_reason text,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'ended_on', p_ended_on, 'reason', p_reason, 'note', nullif(trim(p_note), ''));
  v_response jsonb;
  v_occupancy garden.cycle_occupancies%rowtype;
  v_cycle garden.grow_cycles%rowtype;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'close_cycle', v_payload);
  if v_response is not null then return v_response; end if;
  if p_reason is null or p_reason not in ('replacement', 'productive_end', 'failure', 'removal', 'other') then raise exception 'Invalid closure reason'; end if;
  if p_reason = 'other' and coalesce(nullif(trim(p_note), ''), '') = '' then raise exception 'Other closure reason requires a note'; end if;
  if p_ended_on is null then raise exception 'Closure date is required'; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'active' then raise exception 'Current grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before closing'; end if;
  select * into v_occupancy from garden.cycle_occupancies where grow_cycle_id = p_grow_cycle_id and occupied_until is null for update;
  if not found then raise exception 'Current occupancy not found'; end if;
  if v_occupancy.occupied_from is not null and p_ended_on < v_occupancy.occupied_from then raise exception 'Closure cannot precede occupancy'; end if;
  update garden.cycle_occupancies set occupied_until = p_ended_on where id = v_occupancy.id;
  update garden.grow_cycles set state = 'closed', revision = revision + 1, updated_at = now() where id = p_grow_cycle_id;
  insert into garden.events(owner_id, grow_cycle_id, event_type, note)
  values (v_owner, p_grow_cycle_id, 'cycle_ended', concat('Ciclo cerrado: ', p_reason, case when nullif(trim(p_note), '') is null then '' else ' — ' || trim(p_note) end)) returning id into v_event_id;
  insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
  values (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'closed', jsonb_build_object('state', v_cycle.state, 'occupied_until', v_occupancy.occupied_until), jsonb_build_object('state', 'closed', 'occupied_until', p_ended_on), p_reason);
  v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'close_cycle', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_replace_cycle(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_expected_revision integer,
  p_crop_name text,
  p_planted_on date,
  p_planted_on_precision text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'crop_name', trim(p_crop_name), 'planted_on', p_planted_on, 'planted_on_precision', p_planted_on_precision);
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_occupancy garden.cycle_occupancies%rowtype;
  v_crop_id uuid;
  v_new_cycle_id uuid;
  v_close_event_id uuid;
  v_start_event_id uuid;
  v_effective_end date := coalesce(p_planted_on, current_date);
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'replace_cycle', v_payload);
  if v_response is not null then return v_response; end if;
  if char_length(trim(p_crop_name)) not between 1 and 100 then raise exception 'Crop name is required'; end if;
  if (p_planted_on is null and p_planted_on_precision <> 'unknown') or (p_planted_on is not null and p_planted_on_precision not in ('exact', 'approximate')) then raise exception 'Invalid planted date precision'; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'active' then raise exception 'Current grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before replacing'; end if;
  select * into v_occupancy from garden.cycle_occupancies where grow_cycle_id = p_grow_cycle_id and occupied_until is null for update;
  if not found then raise exception 'Current occupancy not found'; end if;
  if v_occupancy.occupied_from is not null and v_effective_end < v_occupancy.occupied_from then raise exception 'Replacement cannot precede occupancy'; end if;
  update garden.cycle_occupancies set occupied_until = v_effective_end where id = v_occupancy.id;
  update garden.grow_cycles set state = 'closed', revision = revision + 1, updated_at = now() where id = p_grow_cycle_id;
  insert into garden.events(owner_id, grow_cycle_id, event_type, note) values (v_owner, p_grow_cycle_id, 'cycle_ended', 'Ciclo cerrado por reemplazo') returning id into v_close_event_id;
  insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
  values (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'replaced', jsonb_build_object('state', v_cycle.state, 'occupied_until', v_occupancy.occupied_until), jsonb_build_object('state', 'closed', 'occupied_until', v_effective_end), 'replacement');
  insert into garden.crops(owner_id, common_name) values (v_owner, trim(p_crop_name))
  on conflict (owner_id, common_name) do update set common_name = excluded.common_name returning id into v_crop_id;
  insert into garden.grow_cycles(owner_id, crop_id, planted_on, planted_on_precision) values (v_owner, v_crop_id, p_planted_on, p_planted_on_precision) returning id into v_new_cycle_id;
  insert into garden.cycle_occupancies(position_id, grow_cycle_id, occupied_from) values (v_occupancy.position_id, v_new_cycle_id, p_planted_on);
  insert into garden.events(owner_id, grow_cycle_id, event_type, note) values (v_owner, v_new_cycle_id, 'cycle_started', 'Ciclo iniciado por reemplazo') returning id into v_start_event_id;
  v_response := jsonb_build_object('previous_grow_cycle_id', p_grow_cycle_id, 'grow_cycle_id', v_new_cycle_id, 'closed_event_id', v_close_event_id, 'started_event_id', v_start_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'replace_cycle', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_move_cycle(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_expected_revision integer,
  p_target_position_id uuid,
  p_moved_on date
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'target_position_id', p_target_position_id, 'moved_on', p_moved_on);
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_source garden.cycle_occupancies%rowtype;
  v_source_garden uuid;
  v_target_garden uuid;
  v_event_id uuid;
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
  select p.garden_id into v_target_garden from garden.positions p join garden.gardens g on g.id = p.garden_id where p.id = p_target_position_id and g.owner_id = v_owner;
  if v_target_garden is null then raise exception 'Target position not found'; end if;
  if v_target_garden <> v_source_garden then raise exception 'A cycle can only move within its garden'; end if;
  if p_target_position_id = v_source.position_id then raise exception 'Target position is already current'; end if;
  if exists (select 1 from garden.cycle_occupancies where position_id = p_target_position_id and occupied_until is null) then raise exception 'Target position already has a current grow cycle'; end if;
  if v_source.occupied_from is not null and p_moved_on < v_source.occupied_from then raise exception 'Move cannot precede occupancy'; end if;
  update garden.cycle_occupancies set occupied_until = p_moved_on where id = v_source.id;
  insert into garden.cycle_occupancies(position_id, grow_cycle_id, occupied_from) values (p_target_position_id, p_grow_cycle_id, p_moved_on);
  update garden.grow_cycles set revision = revision + 1, updated_at = now() where id = p_grow_cycle_id;
  insert into garden.events(owner_id, grow_cycle_id, event_type, note) values (v_owner, p_grow_cycle_id, 'cycle_moved', 'Ciclo trasladado') returning id into v_event_id;
  insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
  values (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'moved', jsonb_build_object('position_id', v_source.position_id), jsonb_build_object('position_id', p_target_position_id), 'movement');
  v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'move_cycle', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_correct_cycle_planting(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_expected_revision integer,
  p_planted_on date,
  p_planted_on_precision text,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'planted_on', p_planted_on, 'planted_on_precision', p_planted_on_precision, 'reason', trim(p_reason));
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'correct_cycle_planting', v_payload);
  if v_response is not null then return v_response; end if;
  if char_length(trim(p_reason)) not between 1 and 500 then raise exception 'Correction reason is required'; end if;
  if (p_planted_on is null and p_planted_on_precision <> 'unknown') or (p_planted_on is not null and p_planted_on_precision not in ('exact', 'approximate')) then raise exception 'Invalid planted date precision'; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found then raise exception 'Grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before correcting'; end if;
  update garden.grow_cycles set planted_on = p_planted_on, planted_on_precision = p_planted_on_precision, revision = revision + 1, updated_at = now() where id = p_grow_cycle_id;
  insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
  values (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'planting_corrected', jsonb_build_object('planted_on', v_cycle.planted_on, 'planted_on_precision', v_cycle.planted_on_precision), jsonb_build_object('planted_on', p_planted_on, 'planted_on_precision', p_planted_on_precision), trim(p_reason));
  v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1);
  perform garden.store_command_response(v_owner, p_request_id, 'correct_cycle_planting', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_invalidate_event(
  p_request_id uuid,
  p_event_id uuid,
  p_expected_revision integer,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('event_id', p_event_id, 'expected_revision', p_expected_revision, 'reason', trim(p_reason));
  v_response jsonb;
  v_event garden.events%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'invalidate_event', v_payload);
  if v_response is not null then return v_response; end if;
  if char_length(trim(p_reason)) not between 1 and 500 then raise exception 'Invalidation reason is required'; end if;
  select * into v_event from garden.events where id = p_event_id and owner_id = v_owner for update;
  if not found or v_event.invalidated_at is not null then raise exception 'Current event not found'; end if;
  if v_event.revision <> p_expected_revision then raise exception 'Event changed; review it before invalidating'; end if;
  update garden.events set invalidated_at = now(), invalidated_by = v_owner, invalidated_reason = trim(p_reason), revision = revision + 1 where id = p_event_id;
  insert into garden.event_revisions(owner_id, event_id, revision_number, operation, previous_values, next_values, reason)
  values (v_owner, p_event_id, v_event.revision + 1, 'invalidated', jsonb_build_object('invalidated_at', v_event.invalidated_at, 'note', v_event.note, 'occurred_at', v_event.occurred_at), jsonb_build_object('invalidated_at', now()), trim(p_reason));
  v_response := jsonb_build_object('event_id', p_event_id, 'revision', v_event.revision + 1, 'invalidated', true);
  perform garden.store_command_response(v_owner, p_request_id, 'invalidate_event', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_reopen_cycle(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_expected_revision integer,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'reason', trim(p_reason));
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_occupancy garden.cycle_occupancies%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'reopen_cycle', v_payload);
  if v_response is not null then return v_response; end if;
  if char_length(trim(p_reason)) not between 1 and 500 then raise exception 'Reopen reason is required'; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'closed' then raise exception 'Closed grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before reopening'; end if;
  select * into v_occupancy from garden.cycle_occupancies
  where grow_cycle_id = p_grow_cycle_id
  order by occupied_from desc nulls last, created_at desc, id desc
  limit 1 for update;
  if not found then raise exception 'Previous occupancy not found'; end if;
  if exists (select 1 from garden.cycle_occupancies where position_id = v_occupancy.position_id and occupied_until is null) then
    raise exception 'Position has a successor and cannot be reopened';
  end if;
  update garden.cycle_occupancies set occupied_until = null where id = v_occupancy.id;
  update garden.grow_cycles set state = 'active', revision = revision + 1, updated_at = now() where id = p_grow_cycle_id;
  insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
  values (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'reopened', jsonb_build_object('state', v_cycle.state, 'occupied_until', v_occupancy.occupied_until), jsonb_build_object('state', 'active', 'occupied_until', null), trim(p_reason));
  v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1);
  perform garden.store_command_response(v_owner, p_request_id, 'reopen_cycle', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_get_cycle(p_grow_cycle_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', gc.id, 'crop_name', c.common_name, 'planted_on', gc.planted_on,
    'planted_on_precision', gc.planted_on_precision, 'harvest_readiness', gc.harvest_readiness,
    'state', gc.state, 'revision', gc.revision,
    'position', jsonb_build_object('id', p.id, 'position_number', p.position_number),
    'garden', jsonb_build_object('id', g.id, 'name', g.name),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'event_type', e.event_type, 'occurred_at', e.occurred_at, 'note', e.note, 'revision', e.revision,
        'photo', case when ph.id is null then null else jsonb_build_object(
          'id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename,
          'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256,
          'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision,
          'upload_status', ph.upload_status
        ) end
      ) order by e.occurred_at desc)
      from garden.events e left join garden.photos ph on ph.event_id = e.id
      where e.grow_cycle_id = gc.id and e.invalidated_at is null
    ), '[]'::jsonb),
    'corrections', coalesce((
      select jsonb_agg(jsonb_build_object('id', cr.id, 'operation', cr.operation, 'revision', cr.revision_number, 'reason', cr.reason, 'created_at', cr.created_at) order by cr.created_at desc)
      from garden.cycle_revisions cr where cr.grow_cycle_id = gc.id
    ), '[]'::jsonb)
  )
  from garden.grow_cycles gc
  join garden.crops c on c.id = gc.crop_id
  join lateral (
    select o.position_id from garden.cycle_occupancies o
    where o.grow_cycle_id = gc.id
    order by (o.occupied_until is null) desc, o.occupied_from desc nulls last, o.created_at desc, o.id desc
    limit 1
  ) latest on true
  join garden.positions p on p.id = latest.position_id
  join garden.gardens g on g.id = p.garden_id
  where gc.id = p_grow_cycle_id and gc.owner_id = public.garden_owner_id()
$$;

revoke all on function garden.assert_occupancy_integrity() from public;
revoke all on function garden.command_response(uuid, uuid, text, jsonb) from public;
revoke all on function garden.store_command_response(uuid, uuid, text, jsonb, jsonb) from public;
revoke all on function public.garden_create_garden(uuid, text, text, integer) from public;
revoke all on function public.garden_start_cycle(uuid, uuid, text, date, text) from public;
revoke all on function public.garden_create_observation(uuid, uuid, text, text, text, bigint, timestamptz, text, text) from public;
revoke all on function public.garden_close_cycle(uuid, uuid, integer, date, text, text) from public;
revoke all on function public.garden_replace_cycle(uuid, uuid, integer, text, date, text) from public;
revoke all on function public.garden_move_cycle(uuid, uuid, integer, uuid, date) from public;
revoke all on function public.garden_correct_cycle_planting(uuid, uuid, integer, date, text, text) from public;
revoke all on function public.garden_invalidate_event(uuid, uuid, integer, text) from public;
revoke all on function public.garden_reopen_cycle(uuid, uuid, integer, text) from public;
revoke all on function public.garden_get_cycle(uuid) from public;
grant execute on function public.garden_create_garden(uuid, text, text, integer) to authenticated;
grant execute on function public.garden_start_cycle(uuid, uuid, text, date, text) to authenticated;
grant execute on function public.garden_create_observation(uuid, uuid, text, text, text, bigint, timestamptz, text, text) to authenticated;
grant execute on function public.garden_close_cycle(uuid, uuid, integer, date, text, text) to authenticated;
grant execute on function public.garden_replace_cycle(uuid, uuid, integer, text, date, text) to authenticated;
grant execute on function public.garden_move_cycle(uuid, uuid, integer, uuid, date) to authenticated;
grant execute on function public.garden_correct_cycle_planting(uuid, uuid, integer, date, text, text) to authenticated;
grant execute on function public.garden_invalidate_event(uuid, uuid, integer, text) to authenticated;
grant execute on function public.garden_reopen_cycle(uuid, uuid, integer, text) to authenticated;
grant execute on function public.garden_get_cycle(uuid) to authenticated;

commit;
