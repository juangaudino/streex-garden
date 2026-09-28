-- Include imported cycle evidence in Guest Garden Story even when provenance
-- identifies the Grow Cycle but does not carry a denormalized garden_id.
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
    select o.position_id from garden.cycle_occupancies o where o.grow_cycle_id = e.grow_cycle_id
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
    and (
      ph.import_provenance->>'garden_id' = v_story.garden_id::text
      or exists (
        select 1
        from garden.grow_cycles photo_cycle
        join garden.cycle_occupancies photo_occupancy on photo_occupancy.grow_cycle_id = photo_cycle.id
        join garden.positions photo_position on photo_position.id = photo_occupancy.position_id
        where photo_cycle.owner_id = v_story.owner_id
          and photo_position.garden_id = v_story.garden_id
          and ph.import_provenance->>'grow_cycle_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and photo_cycle.id = (ph.import_provenance->>'grow_cycle_id')::uuid
      )
    );

  v_history := coalesce(v_events, '[]'::jsonb) || coalesce(v_photos, '[]'::jsonb);
  return jsonb_build_object('id', v_story.id, 'garden', v_garden, 'cycles', v_cycles, 'created_at', v_story.created_at, 'history', v_history);
end;
$$;

revoke all on function public.garden_get_guest_garden_story(text) from public;
grant execute on function public.garden_get_guest_garden_story(text) to service_role;
