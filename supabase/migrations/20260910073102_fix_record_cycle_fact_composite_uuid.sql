-- Fix the structured fact command's composite-row to UUID coercion.
-- The previous implementation selected the whole grow_cycles row into a
-- %rowtype variable and then referenced it from a SQL predicate. Depending
-- on the PL/pgSQL expression context, that can pass the composite value where
-- a UUID is expected (invalid input syntax for type uuid: "(…)"). Keep the
-- command contract and validation unchanged, but carry the scalar cycle id
-- explicitly through the function.
begin;

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
  v_cycle_id uuid;
  v_garden_id uuid;
  v_event_id uuid;
  v_payload jsonb;
  v_response jsonb;
  v_data jsonb := coalesce(p_fact_data, '{}'::jsonb);
  v_result text;
  v_class text;
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

  select gc.id into v_cycle_id
  from garden.grow_cycles gc
  join garden.cycle_occupancies o on o.grow_cycle_id = gc.id and o.occupied_until is null
  join garden.positions p on p.id = o.position_id
  where gc.id = p_grow_cycle_id and gc.owner_id = v_owner and gc.state = 'active'
  for update of gc;
  if not found then raise exception 'Current grow cycle not found'; end if;

  select p.garden_id into v_garden_id
  from garden.cycle_occupancies o
  join garden.positions p on p.id = o.position_id
  where o.grow_cycle_id = v_cycle_id and o.occupied_until is null;

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
      where e.id = v_incident_id and e.owner_id = v_owner and e.grow_cycle_id = v_cycle_id
        and e.event_type = 'incident_opened' and e.invalidated_at is null
    ) then raise exception 'Open incident reference not found'; end if;
  end if;

  insert into garden.events(
    owner_id, garden_id, grow_cycle_id, event_type, occurred_at, note, event_data
  ) values (
    v_owner, v_garden_id, v_cycle_id, p_fact_type,
    (p_occurred_on::timestamp + interval '12 hours') at time zone 'UTC',
    nullif(trim(p_note), ''),
    jsonb_build_object(
      'source', 'direct_cycle_fact',
      'occurred_on', p_occurred_on,
      'occurred_at_precision', 'date'
    ) || v_data
  ) returning id into v_event_id;

  if p_fact_type = 'visual_review' and v_data->>'result' in ('watch', 'action_required') then
    perform garden.create_open_review_follow_up(v_owner, v_garden_id, v_cycle_id, 'visual_review', 'general');
  elsif p_fact_type = 'incident_opened' then
    perform garden.create_open_review_follow_up(v_owner, v_garden_id, v_cycle_id, 'incident', 'incident:' || v_event_id::text);
  end if;

  v_response := jsonb_build_object('event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'record_cycle_fact', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_record_cycle_fact(uuid, uuid, text, date, text, jsonb) from public;
grant execute on function public.garden_record_cycle_fact(uuid, uuid, text, date, text, jsonb) to authenticated;

commit;
