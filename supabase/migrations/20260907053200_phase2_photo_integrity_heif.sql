-- Preserve the original HEIF content type and bind every new pending upload to
-- a SHA-256 digest before Storage receives bytes. This lets recovery prove it
-- is completing the same original rather than another same-sized file.
alter table garden.photos drop constraint if exists photos_content_type_check;
alter table garden.photos add constraint photos_content_type_check
  check (content_type in ('image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'));
alter table garden.photos drop constraint if exists photos_checksum_sha256_check;
alter table garden.photos add constraint photos_checksum_sha256_check
  check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$');

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
where id = 'garden-originals';

drop function if exists public.garden_create_observation(uuid, uuid, text, text, text, bigint, timestamptz, text);
create function public.garden_create_observation(
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
    or p_checksum_sha256 is null or p_checksum_sha256 !~ '^[0-9a-f]{64}$'
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
      when 'image/heif' then 'heif'
      when 'image/webp' then 'webp'
      else null
    end;
    if v_extension is null then raise exception 'Unsupported image type'; end if;
    v_photo_id := gen_random_uuid();
    v_storage_path := v_owner::text || '/' || v_photo_id::text || '/original.' || v_extension;
    insert into garden.photos (id, owner_id, event_id, storage_path, original_filename, content_type, byte_size, captured_at, captured_at_precision, checksum_sha256)
    values (v_photo_id, v_owner, v_event_id, v_storage_path, p_original_filename, p_content_type, p_byte_size, p_captured_at, p_captured_at_precision, p_checksum_sha256);
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
declare
  v_owner uuid := public.garden_owner_id();
  v_expected_checksum text;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select checksum_sha256 into v_expected_checksum from garden.photos
    where id = p_photo_id and owner_id = v_owner and upload_status in ('pending', 'uploaded');
  if not found then raise exception 'Photo not found'; end if;
  if v_expected_checksum is null or p_checksum_sha256 is null or p_checksum_sha256 <> v_expected_checksum then
    raise exception 'Photo integrity check failed';
  end if;
  update garden.photos set upload_status = 'uploaded', width = p_width, height = p_height
  where id = p_photo_id and owner_id = v_owner;
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
          'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256,
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

revoke all on function public.garden_create_observation(uuid, uuid, text, text, text, bigint, timestamptz, text, text) from public;
grant execute on function public.garden_create_observation(uuid, uuid, text, text, text, bigint, timestamptz, text, text) to authenticated;
revoke all on function public.garden_mark_photo_uploaded(uuid, text, integer, integer) from public;
grant execute on function public.garden_mark_photo_uploaded(uuid, text, integer, integer) to authenticated;
revoke all on function public.garden_get_cycle(uuid) from public;
grant execute on function public.garden_get_cycle(uuid) to authenticated;
