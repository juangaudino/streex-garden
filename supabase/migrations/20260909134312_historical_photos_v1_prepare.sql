-- Historical Photos v1: prepare eventless photo evidence with explicit provenance.
-- Bytes are uploaded separately to the private Storage bucket and confirmed by
-- garden_mark_photo_uploaded. This function never creates cycles or events.
begin;

create or replace function public.garden_prepare_historical_photo(
  p_request_id uuid,
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
  v_owner uuid := public.garden_owner_id();
  v_existing garden.photos%rowtype;
  v_photo_id uuid;
  v_payload jsonb;
  v_response jsonb;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_scope not in ('cycle_evidence', 'garden_general') then
    raise exception 'Unsupported historical photo scope';
  end if;
  if p_garden_id is null or not exists (
    select 1 from garden.gardens g where g.id = p_garden_id and g.owner_id = v_owner
  ) then
    raise exception 'Garden not found';
  end if;
  if p_import_version is null or char_length(trim(p_import_version)) not between 1 and 80 then
    raise exception 'Invalid import version';
  end if;
  if p_import_key is null or char_length(trim(p_import_key)) not between 1 and 240 then
    raise exception 'Invalid import key';
  end if;
  if p_storage_path is null or left(p_storage_path, char_length(v_owner::text) + 1) <> v_owner::text || '/' or position('..' in p_storage_path) > 0 then
    raise exception 'Invalid storage path';
  end if;
  if p_original_filename is null or char_length(trim(p_original_filename)) = 0 then
    raise exception 'Original filename is required';
  end if;
  if p_content_type not in ('image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp')
    or p_byte_size is null or p_byte_size <= 0 or p_byte_size > 31457280
    or p_checksum_sha256 is null or p_checksum_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid photo metadata';
  end if;
  if p_captured_at_precision not in ('exact', 'approximate', 'unknown') then
    raise exception 'Invalid capture precision';
  end if;
  if p_captured_at_precision = 'exact' and p_captured_at is null then
    raise exception 'Exact capture time requires captured_at';
  end if;
  if jsonb_typeof(coalesce(p_import_provenance, '{}'::jsonb)) <> 'object' then
    raise exception 'Photo provenance must be an object';
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
      and gc.owner_id = v_owner
      and pos.garden_id = p_garden_id
  ) then
    raise exception 'Cycle provenance does not belong to this garden';
  end if;

  v_payload := jsonb_build_object('scope', p_scope, 'garden_id', p_garden_id, 'import_version', p_import_version, 'import_key', p_import_key, 'storage_path', p_storage_path, 'checksum', p_checksum_sha256);
  v_response := garden.command_response(v_owner, p_request_id, 'prepare_historical_photo', v_payload);
  if v_response is not null then
    return v_response;
  end if;

  select * into v_existing
  from garden.photos
  where owner_id = v_owner and import_version = p_import_version and import_key = p_import_key
  limit 1;
  if found then
    if v_existing.storage_path <> p_storage_path
      or v_existing.checksum_sha256 is distinct from p_checksum_sha256
      or v_existing.byte_size <> p_byte_size
      or v_existing.media_scope <> p_scope then
      raise exception 'Import identity already exists with conflicting metadata';
    end if;
    v_response := jsonb_build_object('photo_id', v_existing.id, 'storage_path', v_existing.storage_path, 'upload_status', v_existing.upload_status, 'created', false);
    perform garden.store_command_response(v_owner, p_request_id, 'prepare_historical_photo', v_payload, v_response);
    return v_response;
  end if;

  v_photo_id := gen_random_uuid();
  insert into garden.photos(
    id, owner_id, garden_id, media_scope, storage_path, original_filename,
    content_type, byte_size, captured_at, captured_at_precision,
    checksum_sha256, import_version, import_key, import_provenance
  ) values (
    v_photo_id, v_owner, p_garden_id, p_scope, p_storage_path, p_original_filename,
    p_content_type, p_byte_size, p_captured_at, p_captured_at_precision,
    p_checksum_sha256, p_import_version, p_import_key, p_import_provenance
  );
  v_response := jsonb_build_object('photo_id', v_photo_id, 'storage_path', p_storage_path, 'upload_status', 'pending', 'created', true);
  perform garden.store_command_response(v_owner, p_request_id, 'prepare_historical_photo', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_prepare_historical_photo(uuid, text, uuid, text, text, text, text, text, bigint, timestamptz, text, text, jsonb) from public;
grant execute on function public.garden_prepare_historical_photo(uuid, text, uuid, text, text, text, text, text, bigint, timestamptz, text, text, jsonb) to authenticated;

commit;
