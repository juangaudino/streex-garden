-- Restore the owner-scoped read RPC omitted from the canonical production baseline.
-- This is a read-only function definition; it does not modify photo rows.

create or replace function public.garden_x_get_invalidated_event_photos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ph.id,
    'plant_instance_id', gc.plant_instance_id,
    'grow_cycle_id', gc.id,
    'event_id', null,
    'storage_path', ph.storage_path,
    'original_filename', ph.original_filename,
    'content_type', ph.content_type,
    'byte_size', ph.byte_size,
    'captured_at', ph.captured_at,
    'captured_at_precision', ph.captured_at_precision,
    'width', ph.width,
    'height', ph.height,
    'media_scope', ph.media_scope,
    'provenance', 'historical_evidence'
  ) order by coalesce(ph.captured_at, ph.created_at) desc, ph.created_at desc), '[]'::jsonb)
  from garden.photos ph
  join garden.events e on e.id = ph.event_id
  join garden.grow_cycles gc on gc.id = e.grow_cycle_id
  join garden.plant_instances pi on pi.id = gc.plant_instance_id
  where ph.owner_id = public.garden_owner_id()
    and e.owner_id = public.garden_owner_id()
    and e.invalidated_at is not null
    and ph.upload_status = 'uploaded'
    and pi.owner_id = public.garden_owner_id()
$$;

revoke all on function public.garden_x_get_invalidated_event_photos() from public;
grant execute on function public.garden_x_get_invalidated_event_photos() to authenticated;

