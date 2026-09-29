-- F4.4: the plant-scoped Ask Garden packet is derived from canonical owner data.
-- It is bounded, read-only, and does not create persistent plant intelligence.
create or replace function public.garden_get_ai_ask_plant_context(
  p_plant_instance_id uuid,
  p_grow_cycle_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_context jsonb;
  v_cycle_patch jsonb;
  v_event_ids uuid[];
  v_history jsonb;
  v_photos jsonb;
  v_historical_photos jsonb;
  v_measurements jsonb;
  v_meaningful_changes jsonb;
begin
  if v_owner_id is null then
    raise exception 'Authentication required';
  end if;
  if p_plant_instance_id is null or p_grow_cycle_id is null then
    raise exception 'Plant and grow cycle are required';
  end if;

  select jsonb_strip_nulls(jsonb_build_object(
    'id', gc.id,
    'plant_instance_id', pi.id,
    'planted_on', gc.planted_on,
    'planted_on_precision', gc.planted_on_precision,
    'origin_type', gc.origin_type,
    'state', gc.state,
    'harvest_readiness', gc.harvest_readiness,
    'plant', jsonb_strip_nulls(jsonb_build_object(
      'plant_instance_id', pi.id,
      'library_plant_id', pi.library_plant_id,
      'library_catalog_version', pi.library_catalog_version,
      'common_name', pi.common_name,
      'scientific_name', pi.scientific_name,
      'cultivar', pi.cultivar,
      'common_name_snapshot', pi.library_common_name_snapshot,
      'scientific_name_snapshot', pi.library_scientific_name_snapshot,
      'cultivar_snapshot', pi.library_cultivar_snapshot
    ))
  ))
  into v_cycle_patch
  from garden.grow_cycles gc
  join garden.plant_instances pi
    on pi.id = gc.plant_instance_id
   and pi.owner_id = v_owner_id
  where gc.id = p_grow_cycle_id
    and gc.owner_id = v_owner_id
    and gc.plant_instance_id = p_plant_instance_id;

  if v_cycle_patch is null then
    raise exception 'Plant context not found';
  end if;

  -- Keep identity/origin events and recent factual milestones, then cap the packet.
  select coalesce(array_agg(selected.id order by selected.occurred_at, selected.id), '{}'::uuid[])
  into v_event_ids
  from (
    select e.id, e.occurred_at
    from garden.events e
    where e.owner_id = v_owner_id
      and e.grow_cycle_id = p_grow_cycle_id
      and e.invalidated_at is null
    order by case e.event_type
      when 'cycle_started' then 0
      when 'planting' then 0
      when 'germination_observed' then 1
      when 'germination_confirmed' then 1
      when 'cycle_moved' then 1
      when 'harvest' then 1
      when 'observation' then 1
      when 'development_review' then 1
      when 'visual_review' then 1
      when 'measurement' then 1
      else 2
    end,
    e.occurred_at desc,
    e.id desc
    limit 12
  ) selected;

  v_context := garden.resolve_cycle_evidence(
    v_owner_id,
    p_grow_cycle_id,
    now(),
    v_event_ids,
    '{}'::uuid[]
  );

  v_context := jsonb_set(
    v_context,
    '{cycle}',
    coalesce(v_context->'cycle', '{}'::jsonb) || v_cycle_patch,
    true
  );

  select coalesce(jsonb_agg(item - 'photos' order by occurred_at, id), '[]'::jsonb)
  into v_history
  from (
    select item,
      nullif(item->>'occurred_at', '')::timestamptz as occurred_at,
      item->>'id' as id
    from jsonb_array_elements(coalesce(v_context->'history', '[]'::jsonb)) item
    where (item->>'id')::uuid = any(coalesce(v_event_ids, '{}'::uuid[]))
  ) selected;

  select coalesce(jsonb_agg(item order by captured_at desc nulls last, id), '[]'::jsonb)
  into v_photos
  from (
    select jsonb_set(
      jsonb_set(photo, '{media_body_included}', 'false'::jsonb, true),
      '{media_availability}',
      '"metadata_only"'::jsonb,
      true
    ) as item,
    nullif(photo->>'captured_at', '')::timestamptz as captured_at,
    photo->>'id' as id
    from jsonb_array_elements(coalesce(v_context->'history', '[]'::jsonb)) event_item
    cross join lateral jsonb_array_elements(coalesce(event_item->'photos', '[]'::jsonb)) photo
    where (event_item->>'id')::uuid = any(coalesce(v_event_ids, '{}'::uuid[]))
    order by captured_at desc nulls last, id
    limit 6
  ) selected;

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
    'provenance', ph.import_provenance,
    'media_body_included', false,
    'media_availability', 'metadata_only'
  ) order by coalesce(ph.captured_at, ph.created_at) desc, ph.id), '[]'::jsonb)
  into v_historical_photos
  from (
    select ph.*
    from garden.photos ph
    where ph.owner_id = v_owner_id
      and ph.event_id is null
      and ph.media_scope = 'cycle_evidence'
      and ph.import_provenance->>'grow_cycle_id' = p_grow_cycle_id::text
      and ph.upload_status = 'uploaded'
    order by coalesce(ph.captured_at, ph.created_at) desc, ph.id
    limit 6
  ) ph;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'occurred_at', e.occurred_at,
    'event_data', e.event_data
  ) order by e.occurred_at desc, e.id), '[]'::jsonb)
  into v_measurements
  from (
    select e.*
    from garden.events e
    where e.owner_id = v_owner_id
      and e.grow_cycle_id = p_grow_cycle_id
      and e.event_type = 'measurement'
      and e.invalidated_at is null
    order by e.occurred_at desc, e.id
    limit 6
  ) e;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'created_at', r.created_at,
    'language', r.usage_metadata->>'language',
    'proposal', r.proposal
  ) order by r.created_at desc, r.id), '[]'::jsonb)
  into v_meaningful_changes
  from (
    select r.*
    from garden.ai_requests r
    where r.owner_id = v_owner_id
      and r.request_type = 'meaningful_change'
      and r.status = 'completed'
      and r.proposal is not null
      and r.proposal->>'grow_cycle_id' = p_grow_cycle_id::text
    order by r.created_at desc, r.id
    limit 3
  ) r;

  return jsonb_build_object(
    'context_schema_version', 'garden_ai_ask_plant_context_v1',
    'scope_type', 'plant',
    'scope_id', p_plant_instance_id,
    'plant_instance_id', p_plant_instance_id,
    'grow_cycle_id', p_grow_cycle_id,
    'cycle', v_context->'cycle',
    'history', v_history,
    'photos', v_photos,
    'historical_photos', v_historical_photos,
    'measurements', v_measurements,
    'meaningful_changes', v_meaningful_changes,
    'uncertainty', jsonb_build_array(
      'Photo bodies are not automatically loaded for Ask Garden; photo metadata does not establish visual appearance.'
    )
  );
end;
$$;

revoke all on function public.garden_get_ai_ask_plant_context(uuid, uuid) from public, anon, service_role;
grant execute on function public.garden_get_ai_ask_plant_context(uuid, uuid) to authenticated;
