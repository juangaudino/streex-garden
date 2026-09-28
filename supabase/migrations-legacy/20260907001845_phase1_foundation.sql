-- Streex Garden — Phase 1 foundation
-- Domain data is private. The browser can only use the carefully scoped
-- public RPC functions below, each of which validates the authenticated owner.

create schema if not exists garden;
revoke all on schema garden from public;

create table garden.gardens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  system_model text,
  position_capacity integer not null check (position_capacity between 1 and 36),
  map_layout text not null default 'provisional_list'
    check (map_layout = 'provisional_list'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table garden.positions (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references garden.gardens(id) on delete cascade,
  position_number integer not null check (position_number > 0),
  created_at timestamptz not null default now(),
  unique (garden_id, position_number)
);

create table garden.crops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  common_name text not null check (char_length(trim(common_name)) between 1 and 100),
  scientific_name text,
  created_at timestamptz not null default now(),
  unique (owner_id, common_name)
);

create table garden.grow_cycles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  crop_id uuid not null references garden.crops(id) on delete restrict,
  planted_on date,
  planted_on_precision text not null default 'unknown'
    check (planted_on_precision in ('exact', 'approximate', 'unknown')),
  state text not null default 'active'
    check (state in ('active', 'completed', 'archived')),
  harvest_readiness text not null default 'not_yet'
    check (harvest_readiness in ('not_yet', 'evaluate', 'ready', 'not_applicable')),
  created_at timestamptz not null default now(),
  check (
    (planted_on is null and planted_on_precision = 'unknown')
    or (planted_on is not null and planted_on_precision in ('exact', 'approximate'))
  )
);

create table garden.cycle_occupancies (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references garden.positions(id) on delete restrict,
  grow_cycle_id uuid not null references garden.grow_cycles(id) on delete restrict,
  occupied_from date,
  occupied_until date,
  created_at timestamptz not null default now(),
  check (occupied_until is null or occupied_from is null or occupied_until >= occupied_from)
);
create unique index cycle_occupancies_one_current_position
  on garden.cycle_occupancies(position_id) where occupied_until is null;
create unique index cycle_occupancies_one_current_cycle
  on garden.cycle_occupancies(grow_cycle_id) where occupied_until is null;

create table garden.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  grow_cycle_id uuid not null references garden.grow_cycles(id) on delete cascade,
  event_type text not null check (event_type in ('observation', 'planting', 'harvest', 'action')),
  occurred_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);
create index events_cycle_occurred_at on garden.events(grow_cycle_id, occurred_at desc);

create table garden.photos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references garden.events(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/heic', 'image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 52428800),
  captured_at timestamptz,
  captured_at_precision text not null default 'unknown'
    check (captured_at_precision in ('exact', 'approximate', 'unknown')),
  upload_status text not null default 'pending'
    check (upload_status in ('pending', 'uploaded', 'failed')),
  width integer check (width > 0),
  height integer check (height > 0),
  checksum_sha256 text,
  created_at timestamptz not null default now(),
  check (
    (captured_at is null and captured_at_precision = 'unknown')
    or (captured_at is not null and captured_at_precision in ('exact', 'approximate'))
  )
);

create table garden.command_receipts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  command_name text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, request_id, command_name)
);

alter table garden.gardens enable row level security;
alter table garden.positions enable row level security;
alter table garden.crops enable row level security;
alter table garden.grow_cycles enable row level security;
alter table garden.cycle_occupancies enable row level security;
alter table garden.events enable row level security;
alter table garden.photos enable row level security;
alter table garden.command_receipts enable row level security;

-- Defense in depth if direct access is ever granted later.
create policy "owners read their gardens" on garden.gardens for select using ((select auth.uid()) = owner_id);
create policy "owners read their crops" on garden.crops for select using ((select auth.uid()) = owner_id);
create policy "owners read their cycles" on garden.grow_cycles for select using ((select auth.uid()) = owner_id);
create policy "owners read their events" on garden.events for select using ((select auth.uid()) = owner_id);
create policy "owners read their photos" on garden.photos for select using ((select auth.uid()) = owner_id);
create policy "owners read their receipts" on garden.command_receipts for select using ((select auth.uid()) = owner_id);
create policy "owners read their positions" on garden.positions for select using (
  exists (select 1 from garden.gardens g where g.id = garden_id and g.owner_id = (select auth.uid()))
);
create policy "owners read their occupancies" on garden.cycle_occupancies for select using (
  exists (
    select 1 from garden.positions p join garden.gardens g on g.id = p.garden_id
    where p.id = position_id and g.owner_id = (select auth.uid())
  )
);

-- Private originals only. Files are namespaced by owner id: {owner}/{photo}/original.ext.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('garden-originals', 'garden-originals', false, 52428800,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "owners read their originals" on storage.objects for select to authenticated using (
  bucket_id = 'garden-originals' and (storage.foldername(name))[1] = (select auth.uid()::text)
);
create policy "owners upload their originals" on storage.objects for insert to authenticated with check (
  bucket_id = 'garden-originals' and (storage.foldername(name))[1] = (select auth.uid()::text)
);
create policy "owners update their originals" on storage.objects for update to authenticated using (
  bucket_id = 'garden-originals' and (storage.foldername(name))[1] = (select auth.uid()::text)
) with check (
  bucket_id = 'garden-originals' and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create or replace function public.garden_owner_id()
returns uuid language sql stable security invoker set search_path = '' as $$
  select auth.uid()
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
  v_response jsonb;
  v_garden_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select response into v_response from garden.command_receipts
    where owner_id = v_owner and request_id = p_request_id and command_name = 'create_garden';
  if found then return v_response; end if;
  if p_position_capacity not between 1 and 36 then raise exception 'Position capacity must be from 1 to 36'; end if;

  insert into garden.gardens (owner_id, name, system_model, position_capacity)
  values (v_owner, trim(p_name), nullif(trim(p_system_model), ''), p_position_capacity)
  returning id into v_garden_id;
  insert into garden.positions (garden_id, position_number)
  select v_garden_id, n from generate_series(1, p_position_capacity) as n;
  v_response := jsonb_build_object('garden_id', v_garden_id);
  insert into garden.command_receipts values (v_owner, p_request_id, 'create_garden', v_response);
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
  v_response jsonb;
  v_crop_id uuid;
  v_cycle_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select response into v_response from garden.command_receipts
    where owner_id = v_owner and request_id = p_request_id and command_name = 'start_cycle';
  if found then return v_response; end if;
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
  v_response := jsonb_build_object('grow_cycle_id', v_cycle_id);
  insert into garden.command_receipts values (v_owner, p_request_id, 'start_cycle', v_response);
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
  p_captured_at_precision text default 'unknown'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_event_id uuid;
  v_photo_id uuid;
  v_extension text;
  v_storage_path text;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select response into v_response from garden.command_receipts
    where owner_id = v_owner and request_id = p_request_id and command_name = 'create_observation';
  if found then return v_response; end if;
  if not exists (select 1 from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner and state = 'active') then
    raise exception 'Current grow cycle not found';
  end if;
  if coalesce(nullif(trim(p_note), ''), '') = '' and p_original_filename is null then
    raise exception 'An observation needs a note or a photo';
  end if;
  if p_original_filename is not null and (
    p_content_type is null or p_byte_size is null or p_byte_size <= 0
    or p_captured_at_precision not in ('exact', 'approximate', 'unknown')
    or (p_captured_at is null and p_captured_at_precision <> 'unknown')
    or (p_captured_at is not null and p_captured_at_precision = 'unknown')
  ) then raise exception 'Invalid photo metadata'; end if;

  insert into garden.events (owner_id, grow_cycle_id, event_type, note)
  values (v_owner, p_grow_cycle_id, 'observation', nullif(trim(p_note), '')) returning id into v_event_id;
  if p_original_filename is not null then
    v_extension := case p_content_type
      when 'image/jpeg' then 'jpg'
      when 'image/png' then 'png'
      when 'image/heic' then 'heic'
      when 'image/webp' then 'webp'
      else null
    end;
    if v_extension is null then raise exception 'Unsupported image type'; end if;
    v_photo_id := gen_random_uuid();
    v_storage_path := v_owner::text || '/' || v_photo_id::text || '/original.' || v_extension;
    insert into garden.photos (id, owner_id, event_id, storage_path, original_filename, content_type, byte_size, captured_at, captured_at_precision)
    values (v_photo_id, v_owner, v_event_id, v_storage_path, p_original_filename, p_content_type, p_byte_size, p_captured_at, p_captured_at_precision);
  end if;
  v_response := jsonb_strip_nulls(jsonb_build_object('event_id', v_event_id, 'photo_id', v_photo_id, 'storage_path', v_storage_path));
  insert into garden.command_receipts values (v_owner, p_request_id, 'create_observation', v_response);
  return v_response;
end;
$$;

create or replace function public.garden_mark_photo_uploaded(
  p_photo_id uuid,
  p_checksum_sha256 text,
  p_width integer default null,
  p_height integer default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id();
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  update garden.photos set upload_status = 'uploaded', checksum_sha256 = nullif(trim(p_checksum_sha256), ''),
    width = p_width, height = p_height
  where id = p_photo_id and owner_id = v_owner and upload_status in ('pending', 'uploaded');
  if not found then raise exception 'Photo not found'; end if;
end;
$$;

create or replace function public.garden_get_home()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'system_model', g.system_model,
    'position_capacity', g.position_capacity, 'map_layout', g.map_layout,
    'active_positions', coalesce(active.active_positions, 0)
  ) order by g.created_at), '[]'::jsonb)
  from garden.gardens g
  left join lateral (
    select count(*)::integer as active_positions from garden.positions p
    join garden.cycle_occupancies o on o.position_id = p.id and o.occupied_until is null
    where p.garden_id = g.id
  ) active on true
  where g.owner_id = public.garden_owner_id()
$$;

create or replace function public.garden_get_garden(p_garden_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'id', g.id, 'name', g.name, 'system_model', g.system_model,
    'position_capacity', g.position_capacity, 'map_layout', g.map_layout,
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'position_number', p.position_number,
        'current_cycle', case when gc.id is null then null else jsonb_build_object(
          'id', gc.id, 'crop_name', c.common_name, 'planted_on', gc.planted_on,
          'planted_on_precision', gc.planted_on_precision, 'harvest_readiness', gc.harvest_readiness
        ) end
      ) order by p.position_number)
      from garden.positions p
      left join garden.cycle_occupancies o on o.position_id = p.id and o.occupied_until is null
      left join garden.grow_cycles gc on gc.id = o.grow_cycle_id
      left join garden.crops c on c.id = gc.crop_id
      where p.garden_id = g.id
    ), '[]'::jsonb)
  ) into v_result
  from garden.gardens g where g.id = p_garden_id and g.owner_id = public.garden_owner_id();
  if v_result is null then raise exception 'Garden not found'; end if;
  return v_result;
end;
$$;

create or replace function public.garden_get_cycle(p_grow_cycle_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', gc.id, 'crop_name', c.common_name, 'planted_on', gc.planted_on,
    'planted_on_precision', gc.planted_on_precision, 'harvest_readiness', gc.harvest_readiness,
    'position', jsonb_build_object('id', p.id, 'position_number', p.position_number),
    'garden', jsonb_build_object('id', g.id, 'name', g.name),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'event_type', e.event_type, 'occurred_at', e.occurred_at, 'note', e.note,
        'photo', case when ph.id is null then null else jsonb_build_object(
          'id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename,
          'content_type', ph.content_type, 'byte_size', ph.byte_size,
          'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision,
          'upload_status', ph.upload_status
        ) end
      ) order by e.occurred_at desc)
      from garden.events e left join garden.photos ph on ph.event_id = e.id
      where e.grow_cycle_id = gc.id
    ), '[]'::jsonb)
  )
  from garden.grow_cycles gc
  join garden.crops c on c.id = gc.crop_id
  join garden.cycle_occupancies o on o.grow_cycle_id = gc.id and o.occupied_until is null
  join garden.positions p on p.id = o.position_id
  join garden.gardens g on g.id = p.garden_id
  where gc.id = p_grow_cycle_id and gc.owner_id = public.garden_owner_id()
$$;

revoke all on function public.garden_owner_id() from public;
revoke all on function public.garden_create_garden(uuid, text, text, integer) from public;
revoke all on function public.garden_start_cycle(uuid, uuid, text, date, text) from public;
revoke all on function public.garden_create_observation(uuid, uuid, text, text, text, bigint, timestamptz, text) from public;
revoke all on function public.garden_mark_photo_uploaded(uuid, text, integer, integer) from public;
revoke all on function public.garden_get_home() from public;
revoke all on function public.garden_get_garden(uuid) from public;
revoke all on function public.garden_get_cycle(uuid) from public;
grant usage on schema public to authenticated;
grant execute on function public.garden_create_garden(uuid, text, text, integer) to authenticated;
grant execute on function public.garden_start_cycle(uuid, uuid, text, date, text) to authenticated;
grant execute on function public.garden_create_observation(uuid, uuid, text, text, text, bigint, timestamptz, text) to authenticated;
grant execute on function public.garden_mark_photo_uploaded(uuid, text, integer, integer) to authenticated;
grant execute on function public.garden_get_home() to authenticated;
grant execute on function public.garden_get_garden(uuid) to authenticated;
grant execute on function public.garden_get_cycle(uuid) to authenticated;
