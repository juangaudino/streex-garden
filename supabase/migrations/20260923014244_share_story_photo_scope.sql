-- Share Story: accept uploaded cycle-evidence photos whose cycle is stored
-- directly on garden.photos, not only photos linked through an event.
create or replace function public.garden_create_guest_plant_story(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_token_hash text,
  p_item_selection jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_cycle garden.grow_cycles%rowtype;
  v_story_id uuid;
  v_payload jsonb;
  v_response jsonb;
  v_item jsonb;
  v_event_id uuid;
  v_photo_id uuid;
  v_include_note boolean;
  v_has_import_provenance boolean;
  v_valid boolean;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid guest token'; end if;
  if jsonb_typeof(coalesce(p_item_selection, '[]'::jsonb)) <> 'array' then raise exception 'Guest story selection must be an array'; end if;
  if jsonb_array_length(coalesce(p_item_selection, '[]'::jsonb)) > 500 then raise exception 'Guest story selection is too large'; end if;

  v_payload := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'token_hash', p_token_hash, 'item_selection', coalesce(p_item_selection, '[]'::jsonb));
  v_response := garden.command_response(v_owner, p_request_id, 'create_guest_plant_story', v_payload);
  if v_response is not null then return v_response; end if;

  select gc.* into v_cycle
  from garden.grow_cycles gc
  where gc.id = p_grow_cycle_id and gc.owner_id = v_owner;
  if not found then raise exception 'Grow cycle not found'; end if;

  if exists (select 1 from garden.guest_plant_stories where token_hash = p_token_hash) then
    raise exception 'Guest token already exists';
  end if;

  insert into garden.guest_plant_stories(owner_id, grow_cycle_id, token_hash)
  values (v_owner, p_grow_cycle_id, p_token_hash)
  returning id into v_story_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'garden' and table_name = 'photos' and column_name = 'import_provenance'
  ) into v_has_import_provenance;

  for v_item in select value from jsonb_array_elements(coalesce(p_item_selection, '[]'::jsonb)) loop
    v_event_id := nullif(v_item->>'event_id', '')::uuid;
    v_photo_id := nullif(v_item->>'photo_id', '')::uuid;
    v_include_note := coalesce((v_item->>'include_note')::boolean, false);
    if (v_event_id is null) = (v_photo_id is null) then raise exception 'Guest story item must reference one event or photo'; end if;

    if v_event_id is not null then
      if not exists (
        select 1 from garden.events e
        where e.id = v_event_id and e.owner_id = v_owner and e.grow_cycle_id = p_grow_cycle_id
          and e.invalidated_at is null and e.created_at <= now()
      ) then raise exception 'Guest story event is not available'; end if;
      if v_include_note then
        insert into garden.guest_plant_story_items(story_id, event_id, include_note)
        values (v_story_id, v_event_id, true);
      end if;
    else
      v_valid := false;
      select exists (
        select 1
        from garden.photos ph
        join garden.events e on e.id = ph.event_id
        where ph.id = v_photo_id and ph.owner_id = v_owner and ph.upload_status = 'uploaded'
          and e.owner_id = v_owner and e.grow_cycle_id = p_grow_cycle_id and e.invalidated_at is null
      ) into v_valid;
      if not v_valid then
        select exists (
          select 1
          from garden.photos ph
          where ph.id = v_photo_id and ph.owner_id = v_owner and ph.upload_status = 'uploaded'
            and ph.grow_cycle_id = p_grow_cycle_id
        ) into v_valid;
      end if;
      if not v_valid and v_has_import_provenance then
        execute $query$
          select exists (
            select 1 from garden.photos ph
            where ph.id = $1 and ph.owner_id = $2 and ph.upload_status = 'uploaded'
              and ph.event_id is null and ph.media_scope = 'cycle_evidence'
              and ph.import_provenance->>'grow_cycle_id' = $3
          )
        $query$ into v_valid using v_photo_id, v_owner, p_grow_cycle_id::text;
      end if;
      if not v_valid then raise exception 'Guest story photo is not available'; end if;
      insert into garden.guest_plant_story_items(story_id, photo_id)
      values (v_story_id, v_photo_id);
    end if;
  end loop;

  v_response := jsonb_build_object('story_id', v_story_id, 'created', true);
  perform garden.store_command_response(v_owner, p_request_id, 'create_guest_plant_story', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_create_guest_plant_story(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.garden_create_guest_plant_story(uuid, uuid, text, jsonb) to authenticated;
