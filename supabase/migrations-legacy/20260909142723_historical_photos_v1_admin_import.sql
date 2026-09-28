-- Temporary, tightly scoped bridge for Historical Photos v1 import.
-- It is callable only by the service_role used by the temporary importer and
-- only for the approved destination owner/import version. Drop after import.
begin;

create or replace function public.garden_prepare_historical_photo_admin(
  p_owner_id uuid,
  p_scope text,
  p_garden_id uuid,
  p_import_version text,
  p_import_key text,
  p_storage_path text,
  p_original_filename text,
  p_content_type text,
  p_byte_size bigint,
  p_captured_at timestamptz,
  p_captured_at_precision text,
  p_checksum_sha256 text,
  p_import_provenance jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing garden.photos%rowtype;
  v_photo_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_owner_id <> '361520ad-09bf-4901-a391-871eeb704e37'::uuid then
    raise exception 'Historical import owner is not approved';
  end if;
  if p_import_version <> 'historical_photos_v1' then
    raise exception 'Historical import version is not approved';
  end if;
  if p_scope not in ('cycle_evidence', 'garden_general') then
    raise exception 'Unsupported historical photo scope';
  end if;
  if not exists (
    select 1 from garden.gardens g
    where g.id = p_garden_id and g.owner_id = p_owner_id
  ) then
    raise exception 'Garden not found for approved owner';
  end if;
  if p_import_key is null or p_import_key !~ '^hpv1:drive:[^[:space:]]+$' then
    raise exception 'Invalid historical import key';
  end if;
  if p_storage_path is null
     or p_storage_path !~ ('^' || p_owner_id::text || '/historical-photos-v1/garden-[12]/(cycle-evidence|garden-general)/[^/]+/original\.(jpeg|jpg|png|heic|webp)$')
     or position('..' in p_storage_path) > 0 then
    raise exception 'Invalid historical storage path';
  end if;
  if p_original_filename is null or char_length(trim(p_original_filename)) = 0 then
    raise exception 'Original filename is required';
  end if;
  if p_content_type not in ('image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp')
     or p_byte_size is null or p_byte_size <= 0 or p_byte_size > 31457280
     or p_checksum_sha256 is null or p_checksum_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid historical photo metadata';
  end if;
  if p_captured_at_precision not in ('exact', 'approximate', 'unknown')
     or (p_captured_at_precision = 'exact' and p_captured_at is null)
     or (p_captured_at_precision = 'unknown' and p_captured_at is not null) then
    raise exception 'Invalid historical capture precision';
  end if;
  if jsonb_typeof(coalesce(p_import_provenance, '{}'::jsonb)) <> 'object' then
    raise exception 'Historical provenance must be an object';
  end if;
  if p_scope = 'garden_general' and (
    nullif(p_import_provenance->>'grow_cycle_id', '') is not null
    or nullif(p_import_provenance->>'event_id', '') is not null
  ) then
    raise exception 'Garden-general photos cannot reference a cycle or event';
  end if;
  if p_scope = 'cycle_evidence' and not exists (
    select 1
    from garden.grow_cycles gc
    join garden.cycle_occupancies co on co.grow_cycle_id = gc.id
    join garden.positions pos on pos.id = co.position_id
    where gc.id = nullif(p_import_provenance->>'grow_cycle_id', '')::uuid
      and gc.owner_id = p_owner_id
      and pos.garden_id = p_garden_id
  ) then
    raise exception 'Cycle provenance does not belong to approved garden';
  end if;

  select * into v_existing
  from garden.photos
  where owner_id = p_owner_id
    and import_version = p_import_version
    and import_key = p_import_key
  limit 1;
  if found then
    if v_existing.storage_path <> p_storage_path
       or v_existing.checksum_sha256 is distinct from p_checksum_sha256
       or v_existing.byte_size <> p_byte_size
       or v_existing.media_scope <> p_scope then
      raise exception 'Import identity already exists with conflicting metadata';
    end if;
    return jsonb_build_object(
      'photo_id', v_existing.id,
      'storage_path', v_existing.storage_path,
      'upload_status', v_existing.upload_status,
      'created', false
    );
  end if;

  v_photo_id := gen_random_uuid();
  insert into garden.photos(
    id, owner_id, garden_id, media_scope, storage_path, original_filename,
    content_type, byte_size, captured_at, captured_at_precision,
    checksum_sha256, import_version, import_key, import_provenance
  ) values (
    v_photo_id, p_owner_id, p_garden_id, p_scope, p_storage_path, p_original_filename,
    p_content_type, p_byte_size, p_captured_at, p_captured_at_precision,
    p_checksum_sha256, p_import_version, p_import_key, p_import_provenance
  );
  return jsonb_build_object(
    'photo_id', v_photo_id,
    'storage_path', p_storage_path,
    'upload_status', 'pending',
    'created', true
  );
end;
$$;

create or replace function public.garden_mark_historical_photo_uploaded_admin(
  p_owner_id uuid,
  p_photo_id uuid,
  p_checksum_sha256 text,
  p_width integer default null,
  p_height integer default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photo garden.photos%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_owner_id <> '361520ad-09bf-4901-a391-871eeb704e37'::uuid then
    raise exception 'Historical import owner is not approved';
  end if;
  if p_checksum_sha256 is null or p_checksum_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid checksum';
  end if;
  select * into v_photo
  from garden.photos
  where id = p_photo_id
    and owner_id = p_owner_id
    and import_version = 'historical_photos_v1'
  for update;
  if not found then raise exception 'Historical photo not found'; end if;
  if v_photo.checksum_sha256 is distinct from p_checksum_sha256 then
    raise exception 'Historical checksum does not match prepared metadata';
  end if;
  if v_photo.upload_status = 'uploaded' then
    return jsonb_build_object('photo_id', v_photo.id, 'updated', false, 'upload_status', 'uploaded');
  end if;
  update garden.photos
  set upload_status = 'uploaded', width = p_width, height = p_height
  where id = v_photo.id;
  return jsonb_build_object('photo_id', v_photo.id, 'updated', true, 'upload_status', 'uploaded');
end;
$$;

revoke all on function public.garden_prepare_historical_photo_admin(uuid, text, uuid, text, text, text, text, text, bigint, timestamptz, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.garden_mark_historical_photo_uploaded_admin(uuid, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.garden_prepare_historical_photo_admin(uuid, text, uuid, text, text, text, text, text, bigint, timestamptz, text, text, jsonb) to service_role;
grant execute on function public.garden_mark_historical_photo_uploaded_admin(uuid, uuid, text, integer, integer) to service_role;

commit;
