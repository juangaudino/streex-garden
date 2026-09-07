-- Imported history can know a civil date without knowing a clock time. The
-- existing events table requires a timestamptz for ordering, so noon UTC is a
-- neutral technical anchor only; presentation reads the preserved civil date.
begin;

create or replace function public.garden_review_import_candidate(p_request_id uuid, p_candidate_id uuid, p_decision text, p_decision_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_candidate garden.import_candidates%rowtype; v_payload jsonb; v_response jsonb; v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_decision not in ('confirmed', 'rejected') then raise exception 'Invalid import decision'; end if;
  v_payload := jsonb_build_object('candidate_id', p_candidate_id, 'decision', p_decision, 'decision_note', nullif(trim(p_decision_note), ''));
  v_response := garden.command_response(v_owner, p_request_id, 'review_import_candidate', v_payload);
  if v_response is not null then return v_response; end if;
  select * into v_candidate from garden.import_candidates where id = p_candidate_id and owner_id = v_owner for update;
  if not found then raise exception 'Import candidate not found'; end if;
  if v_candidate.decision <> 'pending' then raise exception 'Import candidate was already decided'; end if;
  if p_decision = 'confirmed' then
    if v_candidate.candidate_type <> 'observation' then raise exception 'Only observation candidates can become a fact'; end if;
    if v_candidate.grow_cycle_id is null or v_candidate.occurred_on_precision <> 'exact' or v_candidate.occurred_on is null then raise exception 'A cycle and exact date are required before confirming this import'; end if;
    insert into garden.events(owner_id, garden_id, grow_cycle_id, event_type, occurred_at, note, event_data)
    select v_owner, p.garden_id, v_candidate.grow_cycle_id, 'observation',
      (v_candidate.occurred_on::timestamp + interval '12 hours') at time zone 'UTC',
      v_candidate.note,
      jsonb_build_object(
        'source', 'confirmed_import', 'import_candidate_id', v_candidate.id,
        'source_data', v_candidate.source_data, 'occurred_on', v_candidate.occurred_on,
        'occurred_at_precision', 'date'
      )
    from garden.cycle_occupancies o join garden.positions p on p.id = o.position_id
    where o.grow_cycle_id = v_candidate.grow_cycle_id order by o.created_at limit 1 returning id into v_event_id;
    if v_event_id is null then raise exception 'Candidate cycle has no position history'; end if;
    update garden.import_candidates set decision = 'confirmed', decision_note = nullif(trim(p_decision_note), ''), confirmed_event_id = v_event_id, decided_at = now() where id = v_candidate.id;
  else
    update garden.import_candidates set decision = 'rejected', decision_note = nullif(trim(p_decision_note), ''), decided_at = now() where id = v_candidate.id;
  end if;
  if not exists (select 1 from garden.import_candidates where batch_id = v_candidate.batch_id and decision = 'pending') then update garden.import_batches set status = 'completed' where id = v_candidate.batch_id; end if;
  v_response := jsonb_build_object('candidate_id', v_candidate.id, 'decision', p_decision, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'review_import_candidate', v_payload, v_response);
  return v_response;
end;
$$;

-- Repair existing confirmed imports without claiming that their technical
-- ordering timestamp was the observed clock time.
update garden.events e
set occurred_at = (ic.occurred_on::timestamp + interval '12 hours') at time zone 'UTC',
    event_data = coalesce(e.event_data, '{}'::jsonb) || jsonb_build_object(
      'occurred_on', ic.occurred_on,
      'occurred_at_precision', 'date'
    )
from garden.import_candidates ic
where ic.confirmed_event_id = e.id
  and ic.decision = 'confirmed'
  and ic.occurred_on is not null;

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
        'id', e.id, 'event_type', e.event_type, 'occurred_at', e.occurred_at,
        'occurred_at_precision', coalesce(e.event_data->>'occurred_at_precision', 'timestamp'),
        'occurred_on', e.event_data->>'occurred_on', 'note', e.note, 'revision', e.revision,
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

revoke all on function public.garden_review_import_candidate(uuid, uuid, text, text) from public;
revoke all on function public.garden_get_cycle(uuid) from public;
grant execute on function public.garden_review_import_candidate(uuid, uuid, text, text) to authenticated;
grant execute on function public.garden_get_cycle(uuid) to authenticated;
commit;
