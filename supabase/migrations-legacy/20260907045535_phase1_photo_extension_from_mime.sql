-- iPhone capture may provide a valid File without a filename extension.
-- Derive the storage suffix from its validated MIME type instead.
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
