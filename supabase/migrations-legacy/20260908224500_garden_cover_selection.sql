-- A Garden Cover is an explicit pointer to an existing, uploaded original.
-- It never changes the original, its event provenance, or selects a photo automatically.
begin;

alter table garden.gardens
  add column if not exists cover_photo_id uuid references garden.photos(id) on delete set null;
create index if not exists gardens_cover_photo_id on garden.gardens(cover_photo_id) where cover_photo_id is not null;

create or replace function public.garden_get_home()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'system_model', g.system_model,
    'position_capacity', g.position_capacity, 'map_layout', g.map_layout,
    'active_positions', coalesce(active.active_positions, 0),
    'cover_photo', case when cp.id is null then null else jsonb_build_object(
      'id', cp.id, 'storage_path', cp.storage_path, 'original_filename', cp.original_filename,
      'content_type', cp.content_type, 'byte_size', cp.byte_size, 'checksum_sha256', cp.checksum_sha256,
      'captured_at', cp.captured_at, 'captured_at_precision', cp.captured_at_precision, 'upload_status', cp.upload_status
    ) end
  ) order by g.created_at), '[]'::jsonb)
  from garden.gardens g
  left join garden.photos cp on cp.id = g.cover_photo_id and cp.owner_id = g.owner_id and cp.upload_status = 'uploaded'
  left join lateral (
    select count(*)::integer as active_positions from garden.positions p
    join garden.cycle_occupancies o on o.position_id = p.id and o.occupied_until is null
    where p.garden_id = g.id
  ) active on true
  where g.owner_id = public.garden_owner_id()
$$;

create or replace function public.garden_get_garden_cover_photos(p_garden_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename,
    'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256,
    'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status,
    'event_id', e.id, 'event_type', e.event_type, 'is_cover', ph.id = g.cover_photo_id
  ) order by (ph.id = g.cover_photo_id) desc, ph.captured_at desc nulls last, ph.created_at desc, ph.id), '[]'::jsonb)
  from garden.gardens g
  join garden.events e on e.garden_id = g.id and e.invalidated_at is null
  join garden.photos ph on ph.event_id = e.id and ph.owner_id = g.owner_id and ph.upload_status = 'uploaded'
  where g.id = p_garden_id and g.owner_id = public.garden_owner_id()
$$;

create or replace function public.garden_get_garden(p_garden_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'id', g.id, 'name', g.name, 'system_model', g.system_model, 'position_capacity', g.position_capacity, 'map_layout', g.map_layout,
    'layout_sites', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'position_id', s.position_id, 'position_number', p.position_number, 'site_kind', s.site_kind, 'is_active', s.is_active, 'grid_x', s.grid_x, 'grid_y', s.grid_y, 'label', s.label) order by s.grid_y, s.grid_x, s.id) from garden.layout_sites s left join garden.positions p on p.id = s.position_id where s.garden_id = g.id), '[]'::jsonb),
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'position_number', p.position_number,
        'current_cycle', case when current_cycle.id is null then null else jsonb_build_object('id', current_cycle.id, 'crop_name', current_crop.common_name, 'planted_on', current_cycle.planted_on, 'planted_on_precision', current_cycle.planted_on_precision, 'harvest_readiness', current_cycle.harvest_readiness,
          'photo', (select jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename, 'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256, 'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status) from garden.events e join garden.photos ph on ph.event_id = e.id and ph.upload_status = 'uploaded' where e.grow_cycle_id = current_cycle.id and e.invalidated_at is null order by coalesce(ph.captured_at, e.occurred_at) desc, ph.created_at desc limit 1)
        ) end,
        'previous_cycles', coalesce(history.cycles, '[]'::jsonb)) order by p.position_number)
      from garden.positions p
      left join garden.cycle_occupancies current_occupancy on current_occupancy.position_id = p.id and current_occupancy.occupied_until is null
      left join garden.grow_cycles current_cycle on current_cycle.id = current_occupancy.grow_cycle_id and current_cycle.state = 'active'
      left join garden.crops current_crop on current_crop.id = current_cycle.crop_id
      left join lateral (select jsonb_agg(jsonb_build_object('id', historical_cycle.id, 'crop_name', historical_crop.common_name, 'planted_on', historical_cycle.planted_on, 'planted_on_precision', historical_cycle.planted_on_precision, 'harvest_readiness', historical_cycle.harvest_readiness, 'state', historical_cycle.state, 'last_occupied_on', historical.last_occupied_on) order by historical.last_occupied_on desc nulls last, historical_cycle.created_at desc) as cycles from (select o.grow_cycle_id, max(coalesce(o.occupied_until, o.occupied_from)) as last_occupied_on from garden.cycle_occupancies o where o.position_id = p.id and o.occupied_until is not null group by o.grow_cycle_id) historical join garden.grow_cycles historical_cycle on historical_cycle.id = historical.grow_cycle_id join garden.crops historical_crop on historical_crop.id = historical_cycle.crop_id) history on true
      where p.garden_id = g.id
    ), '[]'::jsonb)
  ) into v_result from garden.gardens g where g.id = p_garden_id and g.owner_id = public.garden_owner_id();
  if v_result is null then raise exception 'Garden not found'; end if;
  return v_result;
end;
$$;

create or replace function public.garden_set_garden_cover(
  p_request_id uuid,
  p_garden_id uuid,
  p_photo_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id(); v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('garden_id', p_garden_id, 'photo_id', p_photo_id);
  v_response := garden.command_response(v_owner, p_request_id, 'set_garden_cover', v_payload);
  if v_response is not null then return v_response; end if;
  if not exists (select 1 from garden.gardens g where g.id = p_garden_id and g.owner_id = v_owner) then raise exception 'Garden not found'; end if;
  if p_photo_id is not null and not exists (
    select 1 from garden.photos ph join garden.events e on e.id = ph.event_id
    where ph.id = p_photo_id and ph.owner_id = v_owner and ph.upload_status = 'uploaded'
      and e.garden_id = p_garden_id and e.invalidated_at is null
  ) then raise exception 'Photo is not available for this garden'; end if;
  update garden.gardens set cover_photo_id = p_photo_id, updated_at = now() where id = p_garden_id and owner_id = v_owner;
  v_response := jsonb_build_object('garden_id', p_garden_id, 'cover_photo_id', p_photo_id);
  perform garden.store_command_response(v_owner, p_request_id, 'set_garden_cover', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_get_home() from public;
revoke all on function public.garden_get_garden(uuid) from public;
revoke all on function public.garden_get_garden_cover_photos(uuid) from public;
revoke all on function public.garden_set_garden_cover(uuid, uuid, uuid) from public;
grant execute on function public.garden_get_home() to authenticated;
grant execute on function public.garden_get_garden(uuid) to authenticated;
grant execute on function public.garden_get_garden_cover_photos(uuid) to authenticated;
grant execute on function public.garden_set_garden_cover(uuid, uuid, uuid) to authenticated;

commit;
