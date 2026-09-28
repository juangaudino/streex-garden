-- Explicit media scopes extend the existing originals table. Garden and Home
-- images have no fabricated grow-cycle event; existing evidence is preserved.
begin;

alter table garden.photos alter column event_id drop not null;
alter table garden.photos add column if not exists garden_id uuid references garden.gardens(id) on delete cascade;
alter table garden.photos add column if not exists media_scope text not null default 'cycle_evidence' check (media_scope in ('cycle_evidence', 'garden_cover', 'home_hero'));
update garden.photos ph set garden_id = e.garden_id from garden.events e where e.id = ph.event_id and ph.garden_id is null;
create index if not exists photos_owner_scope_created on garden.photos(owner_id, media_scope, created_at desc);
create index if not exists photos_garden_scope_created on garden.photos(garden_id, media_scope, created_at desc) where garden_id is not null;
alter table garden.owner_settings add column if not exists home_hero_photo_id uuid references garden.photos(id) on delete set null;

create or replace function public.garden_prepare_media_photo(p_request_id uuid, p_scope text, p_garden_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint, p_checksum_sha256 text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_photo_id uuid; v_path text; v_extension text; v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_scope not in ('garden_cover', 'home_hero') then raise exception 'Unsupported media scope'; end if;
  if p_scope = 'garden_cover' and (p_garden_id is null or not exists (select 1 from garden.gardens g where g.id = p_garden_id and g.owner_id = v_owner)) then raise exception 'Garden not found'; end if;
  if p_scope = 'home_hero' and p_garden_id is not null then raise exception 'Home media does not belong to one garden'; end if;
  if p_original_filename is null or p_content_type not in ('image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp') or p_byte_size is null or p_byte_size <= 0 or p_checksum_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Invalid photo metadata'; end if;
  v_payload := jsonb_build_object('scope', p_scope, 'garden_id', p_garden_id, 'filename', p_original_filename, 'checksum', p_checksum_sha256);
  v_response := garden.command_response(v_owner, p_request_id, 'prepare_media_photo', v_payload); if v_response is not null then return v_response; end if;
  v_extension := case p_content_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/heic' then 'heic' when 'image/heif' then 'heif' when 'image/webp' then 'webp' end;
  v_photo_id := gen_random_uuid(); v_path := v_owner::text || '/' || v_photo_id::text || '/original.' || v_extension;
  insert into garden.photos(id, owner_id, garden_id, media_scope, storage_path, original_filename, content_type, byte_size, checksum_sha256)
  values (v_photo_id, v_owner, p_garden_id, p_scope, v_path, p_original_filename, p_content_type, p_byte_size, p_checksum_sha256);
  v_response := jsonb_build_object('photo_id', v_photo_id, 'storage_path', v_path);
  perform garden.store_command_response(v_owner, p_request_id, 'prepare_media_photo', v_payload, v_response); return v_response;
end;
$$;

create or replace function public.garden_set_home_hero(p_request_id uuid, p_photo_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('photo_id', p_photo_id); v_response := garden.command_response(v_owner, p_request_id, 'set_home_hero', v_payload); if v_response is not null then return v_response; end if;
  if p_photo_id is not null and not exists (select 1 from garden.photos where id = p_photo_id and owner_id = v_owner and upload_status = 'uploaded' and media_scope = 'home_hero') then raise exception 'Home photo not available'; end if;
  insert into garden.owner_settings(owner_id, home_hero_photo_id) values (v_owner, p_photo_id) on conflict (owner_id) do update set home_hero_photo_id = excluded.home_hero_photo_id, updated_at = now();
  v_response := jsonb_build_object('home_hero_photo_id', p_photo_id); perform garden.store_command_response(v_owner, p_request_id, 'set_home_hero', v_payload, v_response); return v_response;
end;
$$;

create or replace function public.garden_set_garden_cover(p_request_id uuid, p_garden_id uuid, p_photo_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('garden_id', p_garden_id, 'photo_id', p_photo_id); v_response := garden.command_response(v_owner, p_request_id, 'set_garden_cover', v_payload); if v_response is not null then return v_response; end if;
  if not exists (select 1 from garden.gardens g where g.id = p_garden_id and g.owner_id = v_owner) then raise exception 'Garden not found'; end if;
  if p_photo_id is not null and not exists (select 1 from garden.photos ph left join garden.events e on e.id = ph.event_id where ph.id = p_photo_id and ph.owner_id = v_owner and ph.upload_status = 'uploaded' and (ph.garden_id = p_garden_id or (e.garden_id = p_garden_id and e.invalidated_at is null))) then raise exception 'Photo is not available for this garden'; end if;
  update garden.gardens set cover_photo_id = p_photo_id, updated_at = now() where id = p_garden_id and owner_id = v_owner;
  v_response := jsonb_build_object('garden_id', p_garden_id, 'cover_photo_id', p_photo_id); perform garden.store_command_response(v_owner, p_request_id, 'set_garden_cover', v_payload, v_response); return v_response;
end;
$$;

create or replace function public.garden_get_home_media()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('home_hero_photo', case when ph.id is null then null else jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename, 'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256, 'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status) end,
    'home_hero_choices', coalesce((select jsonb_agg(jsonb_build_object('id', hp.id, 'storage_path', hp.storage_path, 'original_filename', hp.original_filename, 'content_type', hp.content_type, 'byte_size', hp.byte_size, 'checksum_sha256', hp.checksum_sha256, 'captured_at', hp.captured_at, 'captured_at_precision', hp.captured_at_precision, 'upload_status', hp.upload_status) order by hp.created_at desc) from garden.photos hp where hp.owner_id = public.garden_owner_id() and hp.media_scope = 'home_hero' and hp.upload_status = 'uploaded'), '[]'::jsonb))
  from garden.owner_settings s left join garden.photos ph on ph.id = s.home_hero_photo_id and ph.owner_id = s.owner_id and ph.upload_status = 'uploaded' where s.owner_id = public.garden_owner_id()
$$;

create or replace function public.garden_get_garden_cover_photos(p_garden_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename, 'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256, 'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status, 'event_id', ph.event_id, 'event_type', coalesce(e.event_type, 'observation'), 'is_cover', ph.id = g.cover_photo_id) order by (ph.id = g.cover_photo_id) desc, ph.created_at desc), '[]'::jsonb)
  from garden.gardens g left join garden.photos ph on ph.owner_id = g.owner_id and ph.upload_status = 'uploaded' and ph.garden_id = g.id left join garden.events e on e.id = ph.event_id and e.invalidated_at is null
  where g.id = p_garden_id and g.owner_id = public.garden_owner_id()
$$;

revoke all on function public.garden_prepare_media_photo(uuid, text, uuid, text, text, bigint, text) from public;
revoke all on function public.garden_set_home_hero(uuid, uuid) from public;
revoke all on function public.garden_set_garden_cover(uuid, uuid, uuid) from public;
revoke all on function public.garden_get_home_media() from public;
grant execute on function public.garden_prepare_media_photo(uuid, text, uuid, text, text, bigint, text) to authenticated;
grant execute on function public.garden_set_home_hero(uuid, uuid) to authenticated;
grant execute on function public.garden_set_garden_cover(uuid, uuid, uuid) to authenticated;
grant execute on function public.garden_get_home_media() to authenticated;
grant execute on function public.garden_get_garden_cover_photos(uuid) to authenticated;
commit;
