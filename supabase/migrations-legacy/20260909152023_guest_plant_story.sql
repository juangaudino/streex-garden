-- Guest Plant Story: a revocable, read-only snapshot of one grow cycle.
-- The public surface is an Edge Function. The database functions below keep
-- ownership checks and the exact event/note selection on the server.
begin;

create table garden.guest_plant_stories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  grow_cycle_id uuid not null references garden.grow_cycles(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= created_at)
);
create index guest_plant_stories_owner_cycle on garden.guest_plant_stories(owner_id, grow_cycle_id, created_at desc);

create table garden.guest_plant_story_items (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references garden.guest_plant_stories(id) on delete cascade,
  event_id uuid references garden.events(id) on delete cascade,
  photo_id uuid references garden.photos(id) on delete cascade,
  include_note boolean not null default false,
  check ((event_id is not null) <> (photo_id is not null))
);
create unique index guest_story_items_event on garden.guest_plant_story_items(story_id, event_id) where event_id is not null;
create unique index guest_story_items_photo on garden.guest_plant_story_items(story_id, photo_id) where photo_id is not null;

alter table garden.guest_plant_stories enable row level security;
alter table garden.guest_plant_story_items enable row level security;
create policy "owners read their guest stories" on garden.guest_plant_stories for select to authenticated using ((select auth.uid()) = owner_id);
create policy "owners read their guest story items" on garden.guest_plant_story_items for select to authenticated using (
  exists (select 1 from garden.guest_plant_stories s where s.id = story_id and s.owner_id = (select auth.uid()))
);

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

create or replace function public.garden_get_guest_plant_stories(p_grow_cycle_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'created_at', s.created_at, 'revoked_at', s.revoked_at,
    'active', s.revoked_at is null
  ) order by s.created_at desc), '[]'::jsonb)
  from garden.guest_plant_stories s
  where s.owner_id = public.garden_owner_id() and s.grow_cycle_id = p_grow_cycle_id
$$;

create or replace function public.garden_revoke_guest_plant_story(p_request_id uuid, p_story_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('story_id', p_story_id);
  v_response := garden.command_response(v_owner, p_request_id, 'revoke_guest_plant_story', v_payload);
  if v_response is not null then return v_response; end if;
  update garden.guest_plant_stories
  set revoked_at = coalesce(revoked_at, now())
  where id = p_story_id and owner_id = v_owner;
  if not found then raise exception 'Guest story not found'; end if;
  v_response := jsonb_build_object('story_id', p_story_id, 'revoked', true);
  perform garden.store_command_response(v_owner, p_request_id, 'revoke_guest_plant_story', v_payload, v_response);
  return v_response;
end;
$$;

-- This is intentionally callable only by the server-side Edge Function.
-- It returns storage paths to that trusted boundary, never directly to anon.
create or replace function public.garden_get_guest_plant_story(p_token_hash text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_story garden.guest_plant_stories%rowtype;
  v_cycle jsonb;
  v_history jsonb;
  v_event_history jsonb;
  v_photo_history jsonb := '[]'::jsonb;
  v_has_import_provenance boolean;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Guest story not found'; end if;
  select s.* into v_story from garden.guest_plant_stories s where s.token_hash = p_token_hash and s.revoked_at is null;
  if not found then raise exception 'Guest story not found'; end if;

  select jsonb_build_object(
    'id', gc.id, 'crop_name', c.common_name, 'planted_on', gc.planted_on,
    'planted_on_precision', gc.planted_on_precision, 'state', gc.state,
    'garden', jsonb_build_object('name', g.name),
    'position', jsonb_build_object('position_number', p.position_number)
  ) into v_cycle
  from garden.grow_cycles gc
  join garden.crops c on c.id = gc.crop_id
  join lateral (
    select o.position_id from garden.cycle_occupancies o
    where o.grow_cycle_id = gc.id
    order by (o.occupied_until is null) desc, o.occupied_from desc nulls last, o.created_at desc, o.id desc
    limit 1
  ) latest on true
  join garden.positions p on p.id = latest.position_id
  join garden.gardens g on g.id = p.garden_id
  where gc.id = v_story.grow_cycle_id and gc.owner_id = v_story.owner_id;
  if v_cycle is null then raise exception 'Guest story not found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'event_type', e.event_type, 'occurred_at', e.occurred_at,
    'occurred_at_precision', coalesce(e.event_data->>'occurred_at_precision', 'timestamp'),
    'occurred_on', e.event_data->>'occurred_on',
    'note', case when exists (select 1 from garden.guest_plant_story_items i where i.story_id = v_story.id and i.event_id = e.id and i.include_note) then e.note else null end,
    'photo', case when ph.id is null then null else jsonb_build_object(
      'id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename,
      'content_type', ph.content_type, 'byte_size', ph.byte_size,
      'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision,
      'upload_status', ph.upload_status
    ) end
  ) order by e.occurred_at desc, e.id desc), '[]'::jsonb) into v_event_history
  from garden.events e
  left join garden.photos ph on ph.event_id = e.id and ph.upload_status = 'uploaded'
  where e.owner_id = v_story.owner_id and e.grow_cycle_id = v_story.grow_cycle_id
    and e.invalidated_at is null and e.created_at <= v_story.created_at;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'garden' and table_name = 'photos' and column_name = 'import_provenance'
  ) into v_has_import_provenance;
  if v_has_import_provenance then
    execute $query$
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ph.id, 'event_type', 'photo_evidence',
        'occurred_at', coalesce(ph.captured_at, ph.created_at),
        'occurred_at_precision', ph.captured_at_precision,
        'occurred_on', case when ph.captured_at is null then null else ph.captured_at::date end,
        -- Imported photo notes are deliberately omitted until the owner
        -- explicitly selects them in the sharing UI.
        'note', null,
        'photo', jsonb_build_object(
          'id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename,
          'content_type', ph.content_type, 'byte_size', ph.byte_size,
          'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision,
          'upload_status', ph.upload_status
        )
      ) order by coalesce(ph.captured_at, ph.created_at) desc, ph.id desc), '[]'::jsonb)
      from garden.photos ph
      join garden.guest_plant_story_items i on i.story_id = $1 and i.photo_id = ph.id
      where ph.owner_id = $2 and ph.upload_status = 'uploaded' and ph.event_id is null
        and ph.media_scope = 'cycle_evidence'
        and ph.import_provenance->>'grow_cycle_id' = $3
    $query$ into v_photo_history using v_story.id, v_story.owner_id, v_story.grow_cycle_id::text;
  end if;

  v_history := coalesce(v_event_history, '[]'::jsonb) || coalesce(v_photo_history, '[]'::jsonb);
  return v_cycle || jsonb_build_object('created_at', v_story.created_at, 'history', v_history);
end;
$$;

revoke all on function public.garden_create_guest_plant_story(uuid, uuid, text, jsonb) from public;
revoke all on function public.garden_get_guest_plant_stories(uuid) from public;
revoke all on function public.garden_revoke_guest_plant_story(uuid, uuid) from public;
revoke all on function public.garden_get_guest_plant_story(text) from public;
grant execute on function public.garden_create_guest_plant_story(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.garden_get_guest_plant_stories(uuid) to authenticated;
grant execute on function public.garden_revoke_guest_plant_story(uuid, uuid) to authenticated;
grant execute on function public.garden_get_guest_plant_story(text) to service_role;

commit;
