-- A closed cycle can have multiple historical positions. Select its latest known
-- occupancy deterministically, including when a validation transaction shares one timestamp.
begin;

create or replace function public.garden_reopen_cycle(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_expected_revision integer,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'reason', trim(p_reason));
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_occupancy garden.cycle_occupancies%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'reopen_cycle', v_payload);
  if v_response is not null then return v_response; end if;
  if char_length(trim(p_reason)) not between 1 and 500 then raise exception 'Reopen reason is required'; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'closed' then raise exception 'Closed grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before reopening'; end if;
  select * into v_occupancy from garden.cycle_occupancies
  where grow_cycle_id = p_grow_cycle_id
  order by occupied_from desc nulls last, created_at desc, id desc
  limit 1 for update;
  if not found then raise exception 'Previous occupancy not found'; end if;
  if exists (select 1 from garden.cycle_occupancies where position_id = v_occupancy.position_id and occupied_until is null) then
    raise exception 'Position has a successor and cannot be reopened';
  end if;
  update garden.cycle_occupancies set occupied_until = null where id = v_occupancy.id;
  update garden.grow_cycles set state = 'active', revision = revision + 1, updated_at = now() where id = p_grow_cycle_id;
  insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
  values (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'reopened', jsonb_build_object('state', v_cycle.state, 'occupied_until', v_occupancy.occupied_until), jsonb_build_object('state', 'active', 'occupied_until', null), trim(p_reason));
  v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1);
  perform garden.store_command_response(v_owner, p_request_id, 'reopen_cycle', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_get_cycle(p_grow_cycle_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', gc.id, 'crop_name', c.common_name, 'planted_on', gc.planted_on,
    'planted_on_precision', gc.planted_on_precision, 'harvest_readiness', gc.harvest_readiness,
    'state', gc.state, 'revision', gc.revision,
    'position', jsonb_build_object('id', p.id, 'position_number', p.position_number),
    'garden', jsonb_build_object('id', g.id, 'name', g.name),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'event_type', e.event_type, 'occurred_at', e.occurred_at, 'note', e.note, 'revision', e.revision,
        'photo', case when ph.id is null then null else jsonb_build_object(
          'id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename,
          'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256,
          'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision,
          'upload_status', ph.upload_status
        ) end
      ) order by e.occurred_at desc)
      from garden.events e left join garden.photos ph on ph.event_id = e.id
      where e.grow_cycle_id = gc.id and e.invalidated_at is null
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
$$;

revoke all on function public.garden_reopen_cycle(uuid, uuid, integer, text) from public;
revoke all on function public.garden_get_cycle(uuid) from public;
grant execute on function public.garden_reopen_cycle(uuid, uuid, integer, text) to authenticated;
grant execute on function public.garden_get_cycle(uuid) to authenticated;

commit;
