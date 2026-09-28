begin;

alter table garden.grow_cycles add column if not exists cover_photo_id uuid references garden.photos(id) on delete set null;
create index if not exists grow_cycles_cover_photo_id on garden.grow_cycles(cover_photo_id) where cover_photo_id is not null;

create or replace function public.garden_set_cycle_cover(p_request_id uuid, p_grow_cycle_id uuid, p_photo_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'photo_id', p_photo_id);
  v_response := garden.command_response(v_owner, p_request_id, 'set_cycle_cover', v_payload);
  if v_response is not null then return v_response; end if;
  if not exists (select 1 from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner) then raise exception 'Grow cycle not found'; end if;
  if p_photo_id is not null and not exists (
    select 1 from garden.photos ph left join garden.events e on e.id = ph.event_id
    where ph.id = p_photo_id and ph.owner_id = v_owner and ph.upload_status = 'uploaded'
      and (e.grow_cycle_id = p_grow_cycle_id or ph.import_provenance->>'grow_cycle_id' = p_grow_cycle_id::text)
      and (e.id is null or e.invalidated_at is null)
  ) then raise exception 'Photo is not available for this cycle'; end if;
  update garden.grow_cycles set cover_photo_id = p_photo_id, updated_at = now() where id = p_grow_cycle_id and owner_id = v_owner;
  v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'cover_photo_id', p_photo_id);
  perform garden.store_command_response(v_owner, p_request_id, 'set_cycle_cover', v_payload, v_response);
  return v_response;
end;
$$;

alter function public.garden_get_cycle(uuid) rename to garden_get_cycle_legacy;
create or replace function public.garden_get_cycle(p_grow_cycle_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_set(
    public.garden_get_cycle_legacy(p_grow_cycle_id),
    '{cover_photo}',
    coalesce((select jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename, 'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256, 'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status) from garden.grow_cycles gc join garden.photos ph on ph.id = gc.cover_photo_id and ph.upload_status = 'uploaded' where gc.id = p_grow_cycle_id and gc.owner_id = public.garden_owner_id()), 'null'::jsonb), true
  )
$$;

revoke all on function public.garden_set_cycle_cover(uuid, uuid, uuid) from public;
grant execute on function public.garden_set_cycle_cover(uuid, uuid, uuid) to authenticated;
revoke all on function public.garden_get_cycle(uuid) from public;
grant execute on function public.garden_get_cycle(uuid) to authenticated;

commit;
