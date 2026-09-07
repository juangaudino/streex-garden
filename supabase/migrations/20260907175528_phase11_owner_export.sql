-- Phase 11: owner-scoped operational export. It contains records and an
-- original-photo manifest, never credentials, signed URLs, or another owner.
begin;

create or replace function public.garden_export_owner_data()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id();
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  return jsonb_build_object(
    'format_version', 'streex-garden-export/v1',
    'exported_at', now(),
    'gardens', coalesce((select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', g.name, 'system_model', g.system_model,
      'position_capacity', g.position_capacity, 'map_layout', g.map_layout,
      'created_at', g.created_at, 'updated_at', g.updated_at,
      'positions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'position_number', p.position_number, 'created_at', p.created_at
      ) order by p.position_number) from garden.positions p where p.garden_id = g.id), '[]'::jsonb)
    ) order by g.created_at) from garden.gardens g where g.owner_id = v_owner), '[]'::jsonb),
    'crops', coalesce((select jsonb_agg(jsonb_build_object(
      'id', c.id, 'common_name', c.common_name, 'scientific_name', c.scientific_name, 'created_at', c.created_at
    ) order by c.created_at) from garden.crops c where c.owner_id = v_owner), '[]'::jsonb),
    'grow_cycles', coalesce((select jsonb_agg(jsonb_build_object(
      'id', gc.id, 'crop_id', gc.crop_id, 'planted_on', gc.planted_on,
      'planted_on_precision', gc.planted_on_precision, 'state', gc.state,
      'harvest_readiness', gc.harvest_readiness, 'revision', gc.revision,
      'created_at', gc.created_at, 'updated_at', gc.updated_at,
      'occupancies', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'position_id', o.position_id, 'occupied_from', o.occupied_from,
        'occupied_until', o.occupied_until, 'created_at', o.created_at
      ) order by o.created_at) from garden.cycle_occupancies o where o.grow_cycle_id = gc.id), '[]'::jsonb)
    ) order by gc.created_at) from garden.grow_cycles gc where gc.owner_id = v_owner), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object(
      'id', e.id, 'garden_id', e.garden_id, 'grow_cycle_id', e.grow_cycle_id,
      'event_type', e.event_type, 'occurred_at', e.occurred_at, 'note', e.note,
      'event_data', e.event_data, 'revision', e.revision, 'invalidated_at', e.invalidated_at,
      'invalidated_reason', e.invalidated_reason, 'created_at', e.created_at
    ) order by e.occurred_at, e.id) from garden.events e where e.owner_id = v_owner), '[]'::jsonb),
    'cycle_revisions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', cr.id, 'grow_cycle_id', cr.grow_cycle_id, 'revision_number', cr.revision_number,
      'operation', cr.operation, 'previous_values', cr.previous_values, 'next_values', cr.next_values,
      'reason', cr.reason, 'created_at', cr.created_at
    ) order by cr.created_at, cr.id) from garden.cycle_revisions cr where cr.owner_id = v_owner), '[]'::jsonb),
    'event_revisions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', er.id, 'event_id', er.event_id, 'revision_number', er.revision_number,
      'operation', er.operation, 'previous_values', er.previous_values, 'next_values', er.next_values,
      'reason', er.reason, 'created_at', er.created_at
    ) order by er.created_at, er.id) from garden.event_revisions er where er.owner_id = v_owner), '[]'::jsonb),
    'attention_items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'garden_id', a.garden_id, 'grow_cycle_id', a.grow_cycle_id,
      'purpose', a.purpose, 'subject_key', a.subject_key, 'title', a.title,
      'origin', a.origin, 'status', a.status, 'due_on', a.due_on,
      'next_review_on', a.next_review_on, 'completed_event_id', a.completed_event_id,
      'completed_at', a.completed_at, 'dismissed_at', a.dismissed_at,
      'dismissed_reason', a.dismissed_reason, 'created_at', a.created_at, 'updated_at', a.updated_at
    ) order by a.created_at, a.id) from garden.attention_items a where a.owner_id = v_owner), '[]'::jsonb),
    'attention_history', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ah.id, 'attention_item_id', ah.attention_item_id, 'from_status', ah.from_status,
      'to_status', ah.to_status, 'operation', ah.operation, 'reason', ah.reason,
      'related_event_id', ah.related_event_id, 'created_at', ah.created_at
    ) order by ah.created_at, ah.id) from garden.attention_history ah where ah.owner_id = v_owner), '[]'::jsonb),
    'recurrence_rules', coalesce((select jsonb_agg(jsonb_build_object(
      'id', rr.id, 'garden_id', rr.garden_id, 'grow_cycle_id', rr.grow_cycle_id,
      'purpose', rr.purpose, 'schedule_type', rr.schedule_type, 'interval_days', rr.interval_days,
      'anchor_on', rr.anchor_on, 'active', rr.active, 'paused_reason', rr.paused_reason,
      'created_at', rr.created_at, 'updated_at', rr.updated_at
    ) order by rr.created_at, rr.id) from garden.recurrence_rules rr where rr.owner_id = v_owner), '[]'::jsonb),
    'maintenance_sessions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ms.id, 'state', ms.state, 'started_at', ms.started_at,
      'completed_at', ms.completed_at, 'cursor_position', ms.cursor_position,
      'positions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', msp.id, 'garden_id', msp.garden_id, 'position_id', msp.position_id,
        'captured_grow_cycle_id', msp.captured_grow_cycle_id, 'position_number', msp.position_number,
        'ordinal', msp.ordinal, 'progress', msp.progress, 'visual_review_event_id', msp.visual_review_event_id,
        'progressed_at', msp.progressed_at
      ) order by msp.ordinal) from garden.maintenance_session_positions msp where msp.session_id = ms.id), '[]'::jsonb)
    ) order by ms.started_at, ms.id) from garden.maintenance_sessions ms where ms.owner_id = v_owner), '[]'::jsonb),
    'photo_manifest', coalesce((select jsonb_agg(jsonb_build_object(
      'id', ph.id, 'event_id', ph.event_id, 'storage_path', ph.storage_path,
      'original_filename', ph.original_filename, 'content_type', ph.content_type,
      'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256,
      'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision,
      'upload_status', ph.upload_status, 'width', ph.width, 'height', ph.height, 'created_at', ph.created_at
    ) order by ph.created_at, ph.id) from garden.photos ph where ph.owner_id = v_owner), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.garden_export_owner_data() from public;
grant execute on function public.garden_export_owner_data() to authenticated;

commit;
