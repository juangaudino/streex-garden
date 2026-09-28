-- Accept canonical photos whose cycle is stored directly on garden.photos when
-- validating an explicitly selected Share Story hero.
begin;

create or replace function public.garden_create_guest_plant_story_v2(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_token_hash text,
  p_item_selection jsonb default '[]'::jsonb,
  p_hero_photo_id uuid default null,
  p_caption_overrides jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_story_id uuid;
  v_key text;
  v_value jsonb;
  v_photo_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(coalesce(p_caption_overrides, '{}'::jsonb)) <> 'object' then raise exception 'Caption overrides must be an object'; end if;

  v_response := public.garden_create_guest_plant_story(p_request_id, p_grow_cycle_id, p_token_hash, p_item_selection);
  v_story_id := nullif(v_response->>'story_id', '')::uuid;
  if v_story_id is null then return v_response; end if;

  if p_hero_photo_id is not null then
    if not exists (
      select 1 from jsonb_array_elements(coalesce(p_item_selection, '[]'::jsonb)) item
      where nullif(item->>'photo_id', '')::uuid = p_hero_photo_id
    ) then raise exception 'Hero photo must be part of the story selection'; end if;
    if not exists (
      select 1
      from garden.photos ph
      left join garden.events ev on ev.id = ph.event_id and ev.owner_id = v_owner
      where ph.id = p_hero_photo_id and ph.owner_id = v_owner and ph.upload_status = 'uploaded'
        and (ph.grow_cycle_id = p_grow_cycle_id or ev.grow_cycle_id = p_grow_cycle_id or (ph.media_scope = 'cycle_evidence' and ph.import_provenance->>'grow_cycle_id' = p_grow_cycle_id::text))
    ) then raise exception 'Hero photo is not available for this cycle'; end if;
  end if;

  for v_key, v_value in select key, value from jsonb_each(coalesce(p_caption_overrides, '{}'::jsonb)) loop
    if jsonb_typeof(v_value) not in ('string', 'null') then raise exception 'Caption overrides must contain text or null'; end if;
    if v_value is not null and char_length(v_value #>> '{}') > 240 then raise exception 'Share caption is too long'; end if;
    v_photo_id := nullif(v_key, '')::uuid;
    if v_photo_id is not null and not exists (
      select 1 from jsonb_array_elements(coalesce(p_item_selection, '[]'::jsonb)) item
      where nullif(item->>'photo_id', '')::uuid = v_photo_id
    ) then raise exception 'Caption photo must be part of the story selection'; end if;
  end loop;

  update garden.guest_plant_stories
  set hero_photo_id = p_hero_photo_id,
      caption_overrides = coalesce(p_caption_overrides, '{}'::jsonb)
  where id = v_story_id and owner_id = v_owner;
  return v_response || jsonb_build_object('hero_photo_id', p_hero_photo_id);
end;
$$;

revoke all on function public.garden_create_guest_plant_story_v2(uuid, uuid, text, jsonb, uuid, jsonb) from public, anon, service_role;
grant execute on function public.garden_create_guest_plant_story_v2(uuid, uuid, text, jsonb, uuid, jsonb) to authenticated;

commit;
