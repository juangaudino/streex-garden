-- AI Evidence / Context foundation.
-- This resolver is intentionally internal: it resolves structured, valid
-- Garden X evidence after a caller has authorized an owner and cycle. It does
-- not call a model, create proposals, sign URLs, or write canonical facts.
begin;

create or replace function garden.resolve_cycle_evidence(
  p_owner_id uuid,
  p_grow_cycle_id uuid,
  p_as_of timestamptz default now(),
  p_note_event_ids uuid[] default '{}'::uuid[],
  p_historical_photo_ids uuid[] default '{}'::uuid[]
) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_cycle jsonb;
  v_history jsonb := '[]'::jsonb;
  v_historical_photos jsonb := '[]'::jsonb;
  v_has_import_provenance boolean;
begin
  if p_owner_id is null or p_grow_cycle_id is null or p_as_of is null then
    raise exception 'Owner, grow cycle, and evidence time are required';
  end if;

  select jsonb_build_object(
    'id', gc.id,
    'plant', jsonb_strip_nulls(jsonb_build_object('common_name', c.common_name, 'scientific_name', c.scientific_name)),
    'planted_on', gc.planted_on,
    'planted_on_precision', gc.planted_on_precision,
    'harvest_readiness', gc.harvest_readiness,
    'state', gc.state,
    'garden', jsonb_build_object('id', g.id, 'name', g.name),
    'position', jsonb_build_object('id', p.id, 'position_number', p.position_number)
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
  where gc.id = p_grow_cycle_id and gc.owner_id = p_owner_id;
  if v_cycle is null then raise exception 'Grow cycle not found'; end if;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', e.id,
    'event_type', e.event_type,
    'occurred_at', e.occurred_at,
    'occurred_at_precision', coalesce(e.event_data->>'occurred_at_precision', 'timestamp'),
    'occurred_on', e.event_data->>'occurred_on',
    'fact', jsonb_strip_nulls(jsonb_build_object(
      'class', e.event_data->>'class',
      'operation', e.event_data->>'operation',
      'purpose', e.event_data->>'purpose',
      'severity', e.event_data->>'severity',
      'result', e.event_data->>'result',
      'readiness', e.event_data->>'readiness',
      'resolution', e.event_data->>'resolution',
      'count', e.event_data->'count',
      'count_kind', e.event_data->>'count_kind',
      'confirmed_by', e.event_data->>'confirmed_by'
    )),
    -- Notes are evidence chosen by the caller, never inferred from a model.
    'note', case when e.id = any(coalesce(p_note_event_ids, '{}'::uuid[])) then e.note else null end,
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ph.id,
        'storage_path', ph.storage_path,
        'original_filename', ph.original_filename,
        'content_type', ph.content_type,
        'byte_size', ph.byte_size,
        'checksum_sha256', ph.checksum_sha256,
        'captured_at', ph.captured_at,
        'captured_at_precision', ph.captured_at_precision,
        'upload_status', ph.upload_status,
        'provenance', jsonb_build_object('event_id', e.id, 'event_type', e.event_type)
      ) order by ph.captured_at desc nulls last, ph.id desc)
      from garden.photos ph
      where ph.event_id = e.id and ph.owner_id = p_owner_id and ph.upload_status = 'uploaded'
    ), '[]'::jsonb)
  )) order by e.occurred_at desc, e.id desc), '[]'::jsonb) into v_history
  from garden.events e
  where e.owner_id = p_owner_id and e.grow_cycle_id = p_grow_cycle_id
    and e.invalidated_at is null and e.created_at <= p_as_of;

  -- Historical Photos remains optional until its independent migration exists.
  -- This context resolver does not depend on it or modify its data.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'garden' and table_name = 'photos' and column_name = 'import_provenance'
  ) into v_has_import_provenance;
  if v_has_import_provenance and cardinality(coalesce(p_historical_photo_ids, '{}'::uuid[])) > 0 then
    execute $query$
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ph.id,
        'storage_path', ph.storage_path,
        'original_filename', ph.original_filename,
        'content_type', ph.content_type,
        'byte_size', ph.byte_size,
        'checksum_sha256', ph.checksum_sha256,
        'captured_at', ph.captured_at,
        'captured_at_precision', ph.captured_at_precision,
        'upload_status', ph.upload_status,
        'provenance', ph.import_provenance
      ) order by coalesce(ph.captured_at, ph.created_at) desc, ph.id desc), '[]'::jsonb)
      from garden.photos ph
      where ph.id = any($1) and ph.owner_id = $2 and ph.upload_status = 'uploaded'
        and ph.event_id is null and ph.media_scope = 'cycle_evidence'
        and ph.import_provenance->>'grow_cycle_id' = $3
    $query$ into v_historical_photos using p_historical_photo_ids, p_owner_id, p_grow_cycle_id::text;
  end if;

  return jsonb_build_object(
    'cycle', v_cycle,
    'history', v_history,
    'historical_photos', v_historical_photos,
    'as_of', p_as_of
  );
end;
$$;

-- Guest Plant Story is a human delivery adapter over the internal context. Its
-- existing public output contract is preserved; signing URLs remains in its
-- Edge Function, not in garden.resolve_cycle_evidence.
create or replace function public.garden_get_guest_plant_story(p_token_hash text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_story garden.guest_plant_stories%rowtype;
  v_context jsonb;
  v_note_event_ids uuid[];
  v_historical_photo_ids uuid[];
  v_event_history jsonb := '[]'::jsonb;
  v_photo_history jsonb := '[]'::jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Guest story not found'; end if;
  select s.* into v_story from garden.guest_plant_stories s where s.token_hash = p_token_hash and s.revoked_at is null;
  if not found then raise exception 'Guest story not found'; end if;

  select coalesce(array_agg(i.event_id) filter (where i.include_note and i.event_id is not null), '{}'::uuid[]),
         coalesce(array_agg(i.photo_id) filter (where i.photo_id is not null), '{}'::uuid[])
  into v_note_event_ids, v_historical_photo_ids
  from garden.guest_plant_story_items i where i.story_id = v_story.id;
  v_context := garden.resolve_cycle_evidence(v_story.owner_id, v_story.grow_cycle_id, v_story.created_at, v_note_event_ids, v_historical_photo_ids);

  -- Preserve Guest's existing one-history-item-per-event-photo behavior while
  -- the internal context can represent an event with multiple photos.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', event->>'id',
    'event_type', event->>'event_type',
    'occurred_at', event->>'occurred_at',
    'occurred_at_precision', event->>'occurred_at_precision',
    'occurred_on', event->>'occurred_on',
    'note', event->'note',
    'photo', photo
  ) order by event->>'occurred_at' desc, event->>'id' desc, photo->>'id' desc), '[]'::jsonb)
  into v_event_history
  from jsonb_array_elements(v_context->'history') event
  left join lateral jsonb_array_elements(coalesce(event->'photos', '[]'::jsonb)) photo on true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', photo->>'id',
    'event_type', 'photo_evidence',
    'occurred_at', coalesce(photo->>'captured_at', v_story.created_at::text),
    'occurred_at_precision', coalesce(photo->>'captured_at_precision', 'unknown'),
    'occurred_on', case when photo->>'captured_at' is null then null else (photo->>'captured_at')::timestamptz::date::text end,
    'note', null,
    'photo', photo
  ) order by coalesce(photo->>'captured_at', v_story.created_at::text) desc, photo->>'id' desc), '[]'::jsonb)
  into v_photo_history
  from jsonb_array_elements(v_context->'historical_photos') photo;

  -- Keep the existing Guest Plant Story shape. The richer plant identity stays
  -- inside the internal resolver for future authenticated consumers.
  return jsonb_build_object(
    'id', v_context->'cycle'->>'id',
    'crop_name', v_context->'cycle'->'plant'->>'common_name',
    'planted_on', v_context->'cycle'->'planted_on',
    'planted_on_precision', v_context->'cycle'->'planted_on_precision',
    'harvest_readiness', v_context->'cycle'->'harvest_readiness',
    'state', v_context->'cycle'->'state',
    'garden', v_context->'cycle'->'garden',
    'position', v_context->'cycle'->'position',
    'created_at', v_story.created_at,
    'history', v_event_history || v_photo_history
  );
end;
$$;

revoke all on function garden.resolve_cycle_evidence(uuid, uuid, timestamptz, uuid[], uuid[]) from public;
revoke all on function public.garden_get_guest_plant_story(text) from public;
grant execute on function public.garden_get_guest_plant_story(text) to service_role;

commit;
