-- Guest Garden Story: a revocable, read-only view of one complete garden.
-- Plant Story remains a separate contract; this table never changes its rows.
begin;

create table garden.guest_garden_stories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  garden_id uuid not null references garden.gardens(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (revoked_at is null or revoked_at >= created_at)
);
create index guest_garden_stories_owner_garden on garden.guest_garden_stories(owner_id, garden_id, created_at desc);

alter table garden.guest_garden_stories enable row level security;
create policy "owners read their guest garden stories" on garden.guest_garden_stories
  for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.garden_create_guest_garden_story(
  p_request_id uuid,
  p_garden_id uuid,
  p_token_hash text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_story_id uuid;
  v_payload jsonb;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid guest token'; end if;
  v_payload := jsonb_build_object('garden_id', p_garden_id, 'token_hash', p_token_hash);
  v_response := garden.command_response(v_owner, p_request_id, 'create_guest_garden_story', v_payload);
  if v_response is not null then return v_response; end if;
  if not exists (select 1 from garden.gardens g where g.id = p_garden_id and g.owner_id = v_owner) then
    raise exception 'Garden not found';
  end if;
  if exists (select 1 from garden.guest_garden_stories where token_hash = p_token_hash) then
    raise exception 'Guest token already exists';
  end if;
  insert into garden.guest_garden_stories(owner_id, garden_id, token_hash)
  values (v_owner, p_garden_id, p_token_hash)
  returning id into v_story_id;
  v_response := jsonb_build_object('story_id', v_story_id, 'created', true);
  perform garden.store_command_response(v_owner, p_request_id, 'create_guest_garden_story', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_get_guest_garden_stories(p_garden_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'created_at', s.created_at, 'revoked_at', s.revoked_at, 'active', s.revoked_at is null
  ) order by s.created_at desc), '[]'::jsonb)
  from garden.guest_garden_stories s
  where s.garden_id = p_garden_id and s.owner_id = public.garden_owner_id()
$$;

create or replace function public.garden_revoke_guest_garden_story(p_request_id uuid, p_story_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('story_id', p_story_id);
  v_response := garden.command_response(v_owner, p_request_id, 'revoke_guest_garden_story', v_payload);
  if v_response is not null then return v_response; end if;
  update garden.guest_garden_stories set revoked_at = coalesce(revoked_at, now()) where id = p_story_id and owner_id = v_owner;
  if not found then raise exception 'Guest garden story not found'; end if;
  v_response := jsonb_build_object('story_id', p_story_id, 'revoked', true);
  perform garden.store_command_response(v_owner, p_request_id, 'revoke_guest_garden_story', v_payload, v_response);
  return v_response;
end;
$$;

-- Trusted server-side resolver. It returns private storage paths only to the
-- Edge Function, which exchanges them for short-lived signed URLs.
create or replace function public.garden_get_guest_garden_story(p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_story garden.guest_garden_stories%rowtype;
  v_garden jsonb;
  v_cycles jsonb;
  v_history jsonb;
  v_events jsonb;
  v_photos jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Guest garden story not found'; end if;
  select s.* into v_story from garden.guest_garden_stories s where s.token_hash = p_token_hash and s.revoked_at is null;
  if not found then raise exception 'Guest garden story not found'; end if;

  select jsonb_build_object('id', g.id, 'name', g.name, 'system_model', g.system_model)
    into v_garden from garden.gardens g where g.id = v_story.garden_id and g.owner_id = v_story.owner_id;
  if v_garden is null then raise exception 'Guest garden story not found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'grow_cycle_id', gc.id, 'crop_name', c.common_name, 'planted_on', gc.planted_on,
    'planted_on_precision', gc.planted_on_precision, 'state', gc.state,
    'position_number', p.position_number
  ) order by gc.planted_on nulls last, p.position_number), '[]'::jsonb)
  into v_cycles
  from garden.grow_cycles gc
  join garden.crops c on c.id = gc.crop_id
  join lateral (
    select o.position_id from garden.cycle_occupancies o
    where o.grow_cycle_id = gc.id order by (o.occupied_until is null) desc, o.occupied_from desc nulls last, o.created_at desc, o.id desc limit 1
  ) latest on true
  join garden.positions p on p.id = latest.position_id
  where gc.owner_id = v_story.owner_id and p.garden_id = v_story.garden_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'grow_cycle_id', e.grow_cycle_id, 'event_type', e.event_type,
    'occurred_at', e.occurred_at, 'occurred_at_precision', coalesce(e.event_data->>'occurred_at_precision', 'timestamp'),
    'occurred_on', e.event_data->>'occurred_on', 'note', e.note,
    'event_data', e.event_data, 'crop_name', c.common_name, 'position_number', p.position_number,
    'photo', case when ph.id is null then null else jsonb_build_object(
      'id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename,
      'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256,
      'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status
    ) end
  ) order by e.occurred_at desc, e.id desc), '[]'::jsonb)
  into v_events
  from garden.events e
  join garden.grow_cycles gc on gc.id = e.grow_cycle_id
  join garden.crops c on c.id = gc.crop_id
  left join lateral (
    select o.position_id from garden.cycle_occupancies o where o.grow_cycle_id = gc.id
    order by (o.occupied_until is null) desc, o.occupied_from desc nulls last, o.created_at desc, o.id desc limit 1
  ) latest on true
  left join garden.positions p on p.id = latest.position_id
  left join garden.photos ph on ph.event_id = e.id and ph.upload_status = 'uploaded'
  where e.owner_id = v_story.owner_id and p.garden_id = v_story.garden_id and e.invalidated_at is null and e.created_at <= v_story.created_at;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ph.id, 'event_type', 'photo_evidence', 'grow_cycle_id', ph.import_provenance->>'grow_cycle_id',
    'occurred_at', coalesce(ph.captured_at, ph.created_at), 'occurred_at_precision', ph.captured_at_precision,
    'occurred_on', case when ph.captured_at is null then null else ph.captured_at::date end,
    'note', null, 'event_data', '{}'::jsonb, 'crop_name', null, 'position_number', null,
    'photo', jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename,
      'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256,
      'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status)
  ) order by coalesce(ph.captured_at, ph.created_at) desc, ph.id desc), '[]'::jsonb)
  into v_photos
  from garden.photos ph
  where ph.owner_id = v_story.owner_id and ph.upload_status = 'uploaded' and ph.event_id is null
    and ph.media_scope in ('cycle_evidence', 'garden_general')
    and ph.import_provenance->>'garden_id' = v_story.garden_id::text;

  v_history := coalesce(v_events, '[]'::jsonb) || coalesce(v_photos, '[]'::jsonb);
  return jsonb_build_object('id', v_story.id, 'garden', v_garden, 'cycles', v_cycles, 'created_at', v_story.created_at, 'history', v_history);
end;
$$;

revoke all on function public.garden_create_guest_garden_story(uuid, uuid, text) from public;
revoke all on function public.garden_get_guest_garden_stories(uuid) from public;
revoke all on function public.garden_revoke_guest_garden_story(uuid, uuid) from public;
revoke all on function public.garden_get_guest_garden_story(text) from public;
grant execute on function public.garden_create_guest_garden_story(uuid, uuid, text) to authenticated;
grant execute on function public.garden_get_guest_garden_stories(uuid) to authenticated;
grant execute on function public.garden_revoke_guest_garden_story(uuid, uuid) to authenticated;
grant execute on function public.garden_get_guest_garden_story(text) to service_role;

commit;
