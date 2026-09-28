-- Retrying the same original must be safe after an interrupted upload.
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
