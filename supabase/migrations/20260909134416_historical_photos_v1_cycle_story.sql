-- Include eventless historical cycle photos in Cycle Story through provenance.
-- Existing event-backed history remains unchanged; no synthetic events are made.
begin;

create or replace function public.garden_get_cycle(p_grow_cycle_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', gc.id, 'crop_name', c.common_name, 'planted_on', gc.planted_on,
    'planted_on_precision', gc.planted_on_precision, 'harvest_readiness', gc.harvest_readiness,
    'state', gc.state, 'revision', gc.revision,
    'position', jsonb_build_object('id', p.id, 'position_number', p.position_number),
    'garden', jsonb_build_object('id', g.id, 'name', g.name),
    'history', coalesce((
      select jsonb_agg(history_row.item order by history_row.sort_at desc nulls last, history_row.sort_id desc)
      from (
        select e.occurred_at as sort_at, e.id as sort_id, jsonb_build_object(
          'id', e.id, 'event_type', e.event_type, 'occurred_at', e.occurred_at,
          'occurred_at_precision', coalesce(e.event_data->>'occurred_at_precision', 'timestamp'),
          'occurred_on', e.event_data->>'occurred_on', 'note', e.note,
          'event_data', e.event_data, 'revision', e.revision,
          'photo', case when ph.id is null then null else jsonb_build_object(
            'id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename,
            'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256,
            'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision,
            'upload_status', ph.upload_status
          ) end
        ) as item
        from garden.events e
        left join garden.photos ph on ph.event_id = e.id
        where e.grow_cycle_id = gc.id and e.invalidated_at is null

        union all

        select coalesce(ph.captured_at, ph.created_at) as sort_at, ph.id as sort_id, jsonb_build_object(
          'id', ph.id,
          'event_type', 'photo_evidence',
          'occurred_at', ph.captured_at,
          'occurred_at_precision', ph.captured_at_precision,
          'occurred_on', case when ph.captured_at is null then null else ph.captured_at::date end,
          'note', nullif(ph.import_provenance->>'note', ''),
          'event_data', jsonb_build_object(
            'source', 'historical_photo',
            'import_version', ph.import_version,
            'import_key', ph.import_key,
            'import_provenance', ph.import_provenance
          ),
          'revision', 1,
          'photo', jsonb_build_object(
            'id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename,
            'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256,
            'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision,
            'upload_status', ph.upload_status
          )
        ) as item
        from garden.photos ph
        where ph.owner_id = gc.owner_id
          and ph.garden_id = g.id
          and ph.event_id is null
          and ph.media_scope = 'cycle_evidence'
          and ph.upload_status = 'uploaded'
          and ph.import_provenance->>'grow_cycle_id' = gc.id::text
      ) history_row
    ), '[]'::jsonb),
    'corrections', coalesce((
      select jsonb_agg(jsonb_build_object('id', cr.id, 'operation', cr.operation, 'revision', cr.revision_number, 'reason', cr.reason, 'created_at', cr.created_at) order by cr.created_at desc)
      from garden.cycle_revisions cr where cr.grow_cycle_id = gc.id
    ), '[]'::jsonb)
  )
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
  where gc.id = p_grow_cycle_id and gc.owner_id = public.garden_owner_id()
$function$;

revoke all on function public.garden_get_cycle(uuid) from public;
grant execute on function public.garden_get_cycle(uuid) to authenticated;

commit;
