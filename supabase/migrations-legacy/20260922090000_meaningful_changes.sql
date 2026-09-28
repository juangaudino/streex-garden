begin;

-- B1 stores comparison proposals in the existing owner-scoped AI audit table.
-- No canonical plant, photo, event, or history row is changed.
alter table garden.ai_requests drop constraint if exists ai_requests_request_type_check;
alter table garden.ai_requests add constraint ai_requests_request_type_check
  check (request_type in ('ai_check', 'ask_garden', 'identify', 'meaningful_change'));

create or replace function public.garden_ai_start_request(
  p_request_key text,
  p_request_type text,
  p_evidence_refs jsonb,
  p_proposal_schema_version text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := (select auth.uid());
  v_row garden.ai_requests;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_request_key is null or length(trim(p_request_key)) < 16 or length(trim(p_request_key)) > 160 then raise exception 'Invalid request key'; end if;
  if p_request_type not in ('ai_check', 'ask_garden', 'identify', 'meaningful_change') then raise exception 'Invalid request type'; end if;
  insert into garden.ai_requests(owner_id, request_key, request_type, evidence_refs, status, garden_ai_standard_version, context_schema_version, proposal_schema_version, prompt_version, provider_adapter_version)
  values (v_owner, trim(p_request_key), p_request_type, coalesce(p_evidence_refs, '[]'::jsonb), 'started', 'garden_ai_standard_v1', 'garden_ai_context_v1', coalesce(nullif(trim(p_proposal_schema_version), ''), 'garden_ai_ask_v1'), 'garden_ai_runtime_v3', 'openai_responses_v1')
  on conflict (owner_id, request_key) do nothing;
  select * into v_row from garden.ai_requests where owner_id = v_owner and request_key = trim(p_request_key);
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'proposal', v_row.proposal, 'model_identifier', v_row.model_identifier);
end;
$$;

create or replace function public.garden_get_meaningful_change_results()
returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id,
    'proposal', r.proposal,
    'created_at', r.created_at,
    'language', r.usage_metadata->>'language'
  )
  from garden.ai_requests r
  where r.owner_id = auth.uid()
    and r.request_type = 'meaningful_change'
    and r.status = 'completed'
    and r.proposal is not null
  order by r.created_at desc;
$$;

revoke all on function public.garden_get_meaningful_change_results() from public, anon, service_role;
grant execute on function public.garden_get_meaningful_change_results() to authenticated;

-- Reuse the existing authorization/context resolver, but narrow history to the
-- interval represented by the two selected evidences before it reaches vision.
create or replace function public.garden_get_meaningful_change_context(
  p_grow_cycle_id uuid,
  p_before_photo_id uuid,
  p_after_photo_id uuid
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_context jsonb;
  v_before timestamptz;
  v_after timestamptz;
  v_history jsonb;
  v_ai_checks jsonb;
begin
  if p_before_photo_id is null or p_after_photo_id is null or p_before_photo_id = p_after_photo_id then
    raise exception 'Two distinct photos are required';
  end if;
  v_context := public.garden_get_ai_cycle_context(p_grow_cycle_id, p_before_photo_id, p_after_photo_id);
  v_before := nullif(v_context->'selected_photo'->>'captured_at', '')::timestamptz;
  v_after := nullif(v_context->'comparison_photo'->>'captured_at', '')::timestamptz;
  if v_before is null or v_after is null or v_after <= v_before then
    raise exception 'Photos do not have a valid chronological order';
  end if;
  select coalesce(jsonb_agg(item order by (item->>'occurred_at')::timestamptz), '[]'::jsonb)
    into v_history
    from jsonb_array_elements(coalesce(v_context->'history', '[]'::jsonb)) item
   where nullif(item->>'occurred_at', '')::timestamptz > v_before
     and nullif(item->>'occurred_at', '')::timestamptz <= v_after;
  select coalesce(jsonb_agg(jsonb_build_object(
    'created_at', r.created_at,
    'provenance', 'inferred',
    'proposal', r.proposal
  ) order by r.created_at), '[]'::jsonb)
    into v_ai_checks
    from garden.ai_requests r
   where r.owner_id = auth.uid()
     and r.request_type = 'ai_check'
     and r.status = 'completed'
     and r.created_at > v_before
     and r.created_at <= v_after
     and (
       r.evidence_refs @> jsonb_build_array(jsonb_build_object('kind', 'photo', 'id', p_before_photo_id::text))
       or r.evidence_refs @> jsonb_build_array(jsonb_build_object('kind', 'photo', 'id', p_after_photo_id::text))
     );
  return jsonb_set(
    jsonb_set(
      jsonb_set(v_context, '{history}', v_history, true),
      '{prior_ai_checks}',
      v_ai_checks,
      true
    ),
    '{comparison_window}',
    jsonb_build_object('before_captured_at', v_before, 'after_captured_at', v_after),
    true
  );
end;
$$;

revoke all on function public.garden_get_meaningful_change_context(uuid, uuid, uuid) from public, anon, service_role;
grant execute on function public.garden_get_meaningful_change_context(uuid, uuid, uuid) to authenticated;

commit;
