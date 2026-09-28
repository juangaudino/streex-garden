-- Authenticated owner-scoped adapter for AI runtime.
-- The internal resolver remains private; this function is the only narrow
-- authenticated bridge and never returns signed URLs or writes canonical data.
begin;

create or replace function public.garden_get_ai_cycle_context(
  p_grow_cycle_id uuid,
  p_photo_id uuid,
  p_compare_photo_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_context jsonb;
  v_selected_photo jsonb;
  v_compare_photo jsonb;
  v_note_event_ids uuid[];
  v_historical_photo_ids uuid[];
begin
  if v_owner_id is null or p_grow_cycle_id is null or p_photo_id is null then
    raise exception 'Authenticated owner, cycle, and photo are required';
  end if;

  if not exists (
    select 1 from garden.grow_cycles gc
    where gc.id = p_grow_cycle_id and gc.owner_id = v_owner_id
  ) then
    raise exception 'Grow cycle not found';
  end if;

  if not exists (
    select 1
    from garden.photos ph
    left join garden.events ev on ev.id = ph.event_id and ev.owner_id = v_owner_id
    where ph.id = p_photo_id
      and ph.owner_id = v_owner_id
      and ph.upload_status = 'uploaded'
      and (ev.grow_cycle_id = p_grow_cycle_id
        or (ph.media_scope = 'cycle_evidence' and ph.import_provenance->>'grow_cycle_id' = p_grow_cycle_id::text))
  ) then
    raise exception 'Selected photo is not part of this grow cycle';
  end if;

  if p_compare_photo_id is not null and not exists (
    select 1
    from garden.photos ph
    left join garden.events ev on ev.id = ph.event_id and ev.owner_id = v_owner_id
    where ph.id = p_compare_photo_id
      and ph.owner_id = v_owner_id
      and ph.upload_status = 'uploaded'
      and (ev.grow_cycle_id = p_grow_cycle_id
        or (ph.media_scope = 'cycle_evidence' and ph.import_provenance->>'grow_cycle_id' = p_grow_cycle_id::text))
  ) then
    raise exception 'Comparison photo is not part of this grow cycle';
  end if;

  select coalesce(array_agg(e.id order by e.occurred_at desc, e.id desc), '{}'::uuid[])
  into v_note_event_ids
  from (
    select e.id, e.occurred_at
    from garden.events e
    where e.owner_id = v_owner_id
      and e.grow_cycle_id = p_grow_cycle_id
      and e.invalidated_at is null
      and e.note is not null
    order by e.occurred_at desc, e.id desc
    limit 20
  ) e;

  select coalesce(array_agg(ph.id), '{}'::uuid[])
  into v_historical_photo_ids
  from garden.photos ph
  where ph.id in (p_photo_id, p_compare_photo_id)
    and ph.owner_id = v_owner_id
    and ph.upload_status = 'uploaded'
    and ph.event_id is null
    and ph.media_scope = 'cycle_evidence'
    and ph.import_provenance->>'grow_cycle_id' = p_grow_cycle_id::text;

  v_context := garden.resolve_cycle_evidence(
    v_owner_id,
    p_grow_cycle_id,
    now(),
    v_note_event_ids,
    v_historical_photo_ids
  );

  select jsonb_build_object(
    'id', ph.id,
    'storage_path', ph.storage_path,
    'original_filename', ph.original_filename,
    'content_type', ph.content_type,
    'byte_size', ph.byte_size,
    'checksum_sha256', ph.checksum_sha256,
    'captured_at', ph.captured_at,
    'captured_at_precision', ph.captured_at_precision,
    'upload_status', ph.upload_status,
    'provenance', case when ph.event_id is null then ph.import_provenance else jsonb_build_object('event_id', ph.event_id) end
  )
  into v_selected_photo
  from garden.photos ph
  where ph.id = p_photo_id and ph.owner_id = v_owner_id and ph.upload_status = 'uploaded';

  if p_compare_photo_id is not null then
    select jsonb_build_object(
      'id', ph.id,
      'storage_path', ph.storage_path,
      'original_filename', ph.original_filename,
      'content_type', ph.content_type,
      'byte_size', ph.byte_size,
      'checksum_sha256', ph.checksum_sha256,
      'captured_at', ph.captured_at,
      'captured_at_precision', ph.captured_at_precision,
      'upload_status', ph.upload_status,
      'provenance', case when ph.event_id is null then ph.import_provenance else jsonb_build_object('event_id', ph.event_id) end
    )
    into v_compare_photo
    from garden.photos ph
    where ph.id = p_compare_photo_id and ph.owner_id = v_owner_id and ph.upload_status = 'uploaded';
  end if;

  return v_context || jsonb_build_object(
    'selected_photo', v_selected_photo,
    'comparison_photo', v_compare_photo,
    'context_schema_version', 'garden_ai_context_v1'
  );
end;
$$;

revoke all on function public.garden_get_ai_cycle_context(uuid, uuid, uuid) from public, anon, service_role;
grant execute on function public.garden_get_ai_cycle_context(uuid, uuid, uuid) to authenticated;

commit;
