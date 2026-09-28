begin;
create or replace function public.garden_x_get_historical_photos()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',ph.id,'plant_instance_id',gc.plant_instance_id,'grow_cycle_id',gc.id,'event_id',null,
   'storage_path',ph.storage_path,'original_filename',ph.original_filename,'content_type',ph.content_type,
   'byte_size',ph.byte_size,'captured_at',ph.captured_at,'captured_at_precision',ph.captured_at_precision,
   'width',ph.width,'height',ph.height,'media_scope',ph.media_scope
 ) order by coalesce(ph.captured_at,ph.created_at) desc),'[]'::jsonb)
 from garden.photos ph
 join garden.grow_cycles gc on gc.id=(ph.import_provenance->>'grow_cycle_id')::uuid
 join garden.plant_instances pi on pi.id=gc.plant_instance_id
 where ph.owner_id=public.garden_owner_id()
   and pi.owner_id=public.garden_owner_id()
   and ph.event_id is null
   and ph.media_scope='cycle_evidence'
   and ph.upload_status='uploaded'
   and ph.import_provenance ? 'grow_cycle_id'
$$;
revoke all on function public.garden_x_get_historical_photos() from public;
revoke execute on function public.garden_x_get_historical_photos() from anon;
grant execute on function public.garden_x_get_historical_photos() to authenticated;
commit;