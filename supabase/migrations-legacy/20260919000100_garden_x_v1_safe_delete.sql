-- Garden X V1 — safe, owner-scoped deletion for timeline events and photos.
-- Events use the existing invalidation/audit model. Photos are physically removed
-- only through the owner-scoped RPC; Storage objects are removed by the client
-- after the SQL transaction returns the exact original path.
begin;

create or replace function public.garden_x_get_invalidated_event_photos()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ph.id,
    'plant_instance_id', gc.plant_instance_id,
    'grow_cycle_id', gc.id,
    'event_id', null,
    'storage_path', ph.storage_path,
    'original_filename', ph.original_filename,
    'content_type', ph.content_type,
    'byte_size', ph.byte_size,
    'captured_at', ph.captured_at,
    'captured_at_precision', ph.captured_at_precision,
    'width', ph.width,
    'height', ph.height,
    'media_scope', ph.media_scope,
    'provenance', 'historical_evidence'
  ) order by coalesce(ph.captured_at, ph.created_at) desc, ph.created_at desc), '[]'::jsonb)
  from garden.photos ph
  join garden.events e on e.id = ph.event_id
  join garden.grow_cycles gc on gc.id = e.grow_cycle_id
  join garden.plant_instances pi on pi.id = gc.plant_instance_id
  where ph.owner_id = public.garden_owner_id()
    and e.owner_id = public.garden_owner_id()
    and e.invalidated_at is not null
    and ph.upload_status = 'uploaded'
    and pi.owner_id = public.garden_owner_id()
$$;

create or replace function public.garden_x_delete_photo(
  p_request_id uuid,
  p_photo_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_photo garden.photos%rowtype;
  v_payload jsonb;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_photo_id is null then raise exception 'Photo id is required'; end if;

  v_payload := jsonb_build_object('photo_id', p_photo_id);
  v_response := garden.command_response(v_owner, p_request_id, 'delete_photo', v_payload);
  if v_response is not null then return v_response; end if;

  select * into v_photo
  from garden.photos
  where id = p_photo_id and owner_id = v_owner
  for update;
  if not found then raise exception 'Photo not found'; end if;

  -- Saved films keep a UUID array rather than an FK. Remove only this exact
  -- photo id so a deleted frame cannot remain as a stale film reference.
  update garden.saved_films
  set photo_ids = array_remove(photo_ids, p_photo_id)
  where owner_id = v_owner and p_photo_id = any(photo_ids);

  -- Guest story items intentionally cascade from a photo; cover/home references
  -- use SET NULL FKs. The event, when present, is never deleted here.
  delete from garden.photos where id = p_photo_id and owner_id = v_owner;

  v_response := jsonb_build_object(
    'photo_id', p_photo_id,
    'storage_path', v_photo.storage_path,
    'deleted', true,
    'event_preserved', v_photo.event_id is not null
  );
  perform garden.store_command_response(v_owner, p_request_id, 'delete_photo', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_get_invalidated_event_photos() from public;
grant execute on function public.garden_x_get_invalidated_event_photos() to authenticated;
revoke all on function public.garden_x_delete_photo(uuid, uuid) from public;
grant execute on function public.garden_x_delete_photo(uuid, uuid) to authenticated;

-- The app removes only paths returned by the delete RPC and the two exact
-- rendition siblings derived from that path. No owner-prefix delete is allowed.
drop policy if exists "owners delete their originals" on storage.objects;
create policy "owners delete their originals" on storage.objects
  for delete to authenticated using (
    bucket_id = 'garden-originals'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

commit;
