-- GX-00 Phase 2: structured, dated facts remain events. They are deliberately
-- narrow commands rather than a free-form status table or a rules engine.
begin;

alter table garden.events drop constraint if exists events_event_type_check;
alter table garden.events add constraint events_event_type_check check (event_type in (
  'observation', 'planting', 'harvest', 'action', 'cycle_started', 'cycle_ended', 'cycle_moved',
  'seeds_added', 'germination_observed', 'plant_count_observed',
  'visual_review', 'development_review', 'intervention', 'incident_opened', 'incident_resolved',
  'system_maintenance', 'measurement', 'readiness_review'
));

create index if not exists events_cycle_fact_projection
  on garden.events(grow_cycle_id, occurred_at desc, id desc)
  where invalidated_at is null and grow_cycle_id is not null;

create or replace function garden.create_open_review_follow_up(
  p_owner_id uuid,
  p_garden_id uuid,
  p_grow_cycle_id uuid,
  p_origin text,
  p_subject_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_task_id uuid;
begin
  select id into v_task_id
  from garden.attention_items
  where owner_id = p_owner_id
    and garden_id = p_garden_id
    and grow_cycle_id = p_grow_cycle_id
    and purpose = 'evaluate_visual_review'
    and subject_key = p_subject_key
    and status = 'open'
  limit 1;

  if v_task_id is null then
    insert into garden.attention_items(
      owner_id, garden_id, grow_cycle_id, purpose, subject_key, title, origin
    ) values (
      p_owner_id, p_garden_id, p_grow_cycle_id,
      'evaluate_visual_review', p_subject_key, 'Revisar visualmente', p_origin
    ) returning id into v_task_id;
    insert into garden.attention_history(owner_id, attention_item_id, to_status, operation)
    values (p_owner_id, v_task_id, 'open', 'created');
  end if;
end;
$$;

create or replace function public.garden_record_cycle_fact(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_fact_type text,
  p_occurred_on date,
  p_note text default null,
  p_fact_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_cycle garden.grow_cycles%rowtype;
  v_garden_id uuid;
  v_event_id uuid;
  v_payload jsonb;
  v_response jsonb;
  v_data jsonb := coalesce(p_fact_data, '{}'::jsonb);
  v_result text;
  v_class text;
  v_count integer;
  v_incident_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_fact_type not in (
    'germination_observed', 'plant_count_observed', 'visual_review',
    'development_review', 'readiness_review', 'intervention',
    'incident_opened', 'incident_resolved'
  ) then raise exception 'Unsupported cycle fact'; end if;
  if p_occurred_on is null then raise exception 'Fact date is required'; end if;
  if jsonb_typeof(v_data) <> 'object' then raise exception 'Fact data must be an object'; end if;
  if char_length(coalesce(trim(p_note), '')) > 1000 then raise exception 'Fact note is too long'; end if;

  v_payload := jsonb_build_object(
    'grow_cycle_id', p_grow_cycle_id,
    'fact_type', p_fact_type,
    'occurred_on', p_occurred_on,
    'note', nullif(trim(p_note), ''),
    'fact_data', v_data
  );
  v_response := garden.command_response(v_owner, p_request_id, 'record_cycle_fact', v_payload);
  if v_response is not null then return v_response; end if;

  select gc.*, p.garden_id into v_cycle, v_garden_id
  from garden.grow_cycles gc
  join garden.cycle_occupancies o on o.grow_cycle_id = gc.id and o.occupied_until is null
  join garden.positions p on p.id = o.position_id
  where gc.id = p_grow_cycle_id and gc.owner_id = v_owner and gc.state = 'active'
  for update of gc;
  if not found then raise exception 'Current grow cycle not found'; end if;

  if p_fact_type = 'germination_observed' then
    if v_data ? 'count' then
      if (v_data->>'count') !~ '^[0-9]+$' then raise exception 'Germination count must be a non-negative integer'; end if;
    end if;
  elsif p_fact_type = 'plant_count_observed' then
    if (v_data->>'count') !~ '^[0-9]+$' then raise exception 'Plant count must be a non-negative integer'; end if;
    if coalesce(v_data->>'count_kind', '') not in ('seedlings_visible', 'plants_kept') then raise exception 'Plant count kind is required'; end if;
  elsif p_fact_type = 'visual_review' then
    v_result := v_data->>'result';
    if v_result not in ('reassuring', 'watch', 'action_required', 'insufficient_evidence') then raise exception 'Invalid visual review result'; end if;
    if v_result = 'action_required' and nullif(trim(p_note), '') is null then raise exception 'Action-required visual review needs a note'; end if;
  elsif p_fact_type = 'development_review' then
    if coalesce(v_data->>'purpose', '') not in ('evaluate_thinning', 'evaluate_pruning', 'evaluate_support', 'other') then raise exception 'Invalid development review purpose'; end if;
    if coalesce(v_data->>'result', '') not in ('ready', 'not_yet', 'not_required', 'undetermined') then raise exception 'Invalid development review result'; end if;
    if v_data->>'purpose' = 'other' and nullif(trim(p_note), '') is null then raise exception 'Other development review needs a note'; end if;
  elsif p_fact_type = 'readiness_review' then
    if coalesce(v_data->>'readiness', '') not in ('not_yet', 'evaluate', 'ready', 'not_applicable') then raise exception 'Invalid harvest readiness'; end if;
  elsif p_fact_type = 'intervention' then
    v_class := v_data->>'class';
    if v_class not in ('thinning', 'pruning', 'support', 'other') then raise exception 'Invalid intervention class'; end if;
    if v_class = 'other' and nullif(trim(p_note), '') is null then raise exception 'Other intervention needs a note'; end if;
    if v_data ? 'count_retained' and (v_data->>'count_retained') !~ '^[0-9]+$' then raise exception 'Retained count must be a non-negative integer'; end if;
    if v_data ? 'count_removed' and (v_data->>'count_removed') !~ '^[0-9]+$' then raise exception 'Removed count must be a non-negative integer'; end if;
  elsif p_fact_type = 'incident_opened' then
    if coalesce(v_data->>'severity', '') not in ('watch', 'action_required') then raise exception 'Incident severity is required'; end if;
    if nullif(trim(p_note), '') is null then raise exception 'Incident needs a description'; end if;
  elsif p_fact_type = 'incident_resolved' then
    if nullif(v_data->>'incident_event_id', '') is null then raise exception 'Incident reference is required'; end if;
    v_incident_id := (v_data->>'incident_event_id')::uuid;
    if not exists (
      select 1 from garden.events e
      where e.id = v_incident_id and e.owner_id = v_owner and e.grow_cycle_id = p_grow_cycle_id
        and e.event_type = 'incident_opened' and e.invalidated_at is null
    ) then raise exception 'Open incident reference not found'; end if;
  end if;

  insert into garden.events(
    owner_id, garden_id, grow_cycle_id, event_type, occurred_at, note, event_data
  ) values (
    v_owner, v_garden_id, p_grow_cycle_id, p_fact_type,
    (p_occurred_on::timestamp + interval '12 hours') at time zone 'UTC',
    nullif(trim(p_note), ''),
    jsonb_build_object(
      'source', 'direct_cycle_fact',
      'occurred_on', p_occurred_on,
      'occurred_at_precision', 'date'
    ) || v_data
  ) returning id into v_event_id;

  if p_fact_type = 'visual_review' and v_data->>'result' in ('watch', 'action_required') then
    perform garden.create_open_review_follow_up(v_owner, v_garden_id, p_grow_cycle_id, 'visual_review', 'general');
  elsif p_fact_type = 'incident_opened' then
    perform garden.create_open_review_follow_up(v_owner, v_garden_id, p_grow_cycle_id, 'incident', 'incident:' || v_event_id::text);
  end if;

  v_response := jsonb_build_object('event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'record_cycle_fact', v_payload, v_response);
  return v_response;
end;
$$;

-- Preserve the exact structured evidence in the existing history API. This is
-- a read-only presentation extension; raw events remain the canonical record.
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
        'occurred_on', e.event_data->>'occurred_on', 'note', e.note,
        'event_data', e.event_data, 'revision', e.revision,
        'photo', case when ph.id is null then null else jsonb_build_object(
          'id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename,
          'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256,
          'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision,
          'upload_status', ph.upload_status
        ) end
      ) order by e.occurred_at desc, e.id desc)
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

revoke all on function garden.create_open_review_follow_up(uuid, uuid, uuid, text, text) from public;
revoke all on function public.garden_record_cycle_fact(uuid, uuid, text, date, text, jsonb) from public;
revoke all on function public.garden_get_cycle(uuid) from public;
grant execute on function public.garden_record_cycle_fact(uuid, uuid, text, date, text, jsonb) to authenticated;
grant execute on function public.garden_get_cycle(uuid) to authenticated;

commit;
