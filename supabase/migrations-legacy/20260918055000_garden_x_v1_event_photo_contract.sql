-- Garden X V1 — attach evidence to an already confirmed canonical event.
begin;

create or replace function public.garden_x_prepare_event_photo(
  p_photo_id uuid,
  p_event_id uuid,
  p_original_filename text,
  p_content_type text,
  p_byte_size bigint,
  p_captured_at timestamptz default null,
  p_captured_at_precision text default 'unknown',
  p_checksum_sha256 text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_existing garden.photos%rowtype;
  v_ext text;
  v_path text;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_photo_id is null then raise exception 'Photo id is required'; end if;
  if not exists(
    select 1 from garden.events e
    where e.id=p_event_id and e.owner_id=v_owner and e.invalidated_at is null
  ) then raise exception 'Event not found'; end if;
  if p_byte_size is null or p_byte_size <= 0 or p_byte_size > 52428800 then raise exception 'Invalid photo size'; end if;
  if p_captured_at_precision not in ('exact','approximate','unknown') then raise exception 'Invalid capture precision'; end if;
  if (p_captured_at is null and p_captured_at_precision <> 'unknown')
     or (p_captured_at is not null and p_captured_at_precision='unknown') then
    raise exception 'Capture date and precision do not match';
  end if;

  select * into v_existing from garden.photos where id=p_photo_id and owner_id=v_owner;
  if found then
    if v_existing.event_id <> p_event_id then raise exception 'Photo id already belongs to another event'; end if;
    return jsonb_build_object('photo_id',v_existing.id,'storage_path',v_existing.storage_path,'upload_status',v_existing.upload_status);
  end if;

  v_ext := case lower(p_content_type)
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/heic' then 'heic'
    when 'image/heif' then 'heif'
    when 'image/webp' then 'webp'
    else null
  end;
  if v_ext is null then raise exception 'Unsupported image type'; end if;

  v_path := v_owner::text || '/' || p_photo_id::text || '/original.' || v_ext;
  insert into garden.photos(
    id,owner_id,event_id,storage_path,original_filename,content_type,byte_size,
    captured_at,captured_at_precision,upload_status,checksum_sha256,media_scope
  ) values(
    p_photo_id,v_owner,p_event_id,v_path,
    coalesce(nullif(trim(p_original_filename),''),'garden-photo.'||v_ext),
    lower(p_content_type),p_byte_size,p_captured_at,p_captured_at_precision,
    'pending',nullif(trim(coalesce(p_checksum_sha256,'')),''),'cycle_evidence'
  );

  return jsonb_build_object('photo_id',p_photo_id,'storage_path',v_path,'upload_status','pending');
end;
$$;

revoke all on function public.garden_x_prepare_event_photo(uuid,uuid,text,text,bigint,timestamptz,text,text) from public;
grant execute on function public.garden_x_prepare_event_photo(uuid,uuid,text,text,bigint,timestamptz,text,text) to authenticated;

commit;
