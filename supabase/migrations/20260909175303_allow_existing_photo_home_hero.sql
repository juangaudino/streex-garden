-- Allow an already-uploaded photo from any Garden X media scope to become
-- the explicit Home Hero cover. The original row and bytes remain unchanged.
create or replace function public.garden_set_home_hero(p_request_id uuid, p_photo_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('photo_id', p_photo_id);
  v_response := garden.command_response(v_owner, p_request_id, 'set_home_hero', v_payload);
  if v_response is not null then return v_response; end if;
  if p_photo_id is not null and not exists (
    select 1 from garden.photos
    where id = p_photo_id and owner_id = v_owner and upload_status = 'uploaded'
      and media_scope in ('home_hero', 'cycle_evidence', 'garden_cover', 'garden_general')
  ) then raise exception 'Home photo not available'; end if;
  insert into garden.owner_settings(owner_id, home_hero_photo_id)
  values (v_owner, p_photo_id)
  on conflict (owner_id) do update set home_hero_photo_id = excluded.home_hero_photo_id, updated_at = now();
  v_response := jsonb_build_object('home_hero_photo_id', p_photo_id);
  perform garden.store_command_response(v_owner, p_request_id, 'set_home_hero', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_set_home_hero(uuid, uuid) from public, anon;
grant execute on function public.garden_set_home_hero(uuid, uuid) to authenticated;
