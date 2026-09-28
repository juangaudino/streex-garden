-- Owner-scoped audit bridge for the AI Edge Function. The garden schema stays
-- private; authenticated callers can only operate on their own request rows.
begin;

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
  if p_request_type not in ('ai_check', 'ask_garden') then raise exception 'Invalid request type'; end if;
  insert into garden.ai_requests(owner_id, request_key, request_type, evidence_refs, status, garden_ai_standard_version, context_schema_version, proposal_schema_version, prompt_version, provider_adapter_version)
  values (v_owner, trim(p_request_key), p_request_type, coalesce(p_evidence_refs, '[]'::jsonb), 'started', 'garden_ai_standard_v1', 'garden_ai_context_v1', coalesce(nullif(trim(p_proposal_schema_version), ''), 'garden_ai_ask_v1'), 'garden_ai_runtime_v1', 'openai_responses_v1')
  on conflict (owner_id, request_key) do nothing;
  select * into v_row from garden.ai_requests where owner_id = v_owner and request_key = trim(p_request_key);
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'proposal', v_row.proposal, 'model_identifier', v_row.model_identifier);
end;
$$;

create or replace function public.garden_ai_finish_request(
  p_request_id uuid,
  p_status text,
  p_proposal jsonb default null,
  p_model_identifier text default null,
  p_duration_ms integer default null,
  p_usage_metadata jsonb default '{}'::jsonb,
  p_error_code text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update garden.ai_requests
  set status = p_status,
      proposal = p_proposal,
      model_identifier = p_model_identifier,
      duration_ms = p_duration_ms,
      usage_metadata = coalesce(p_usage_metadata, '{}'::jsonb),
      error_code = p_error_code,
      completed_at = now()
  where id = p_request_id and owner_id = auth.uid();
end;
$$;

revoke all on function public.garden_ai_start_request(text, text, jsonb, text) from public, anon;
revoke all on function public.garden_ai_finish_request(uuid, text, jsonb, text, integer, jsonb, text) from public, anon;
grant execute on function public.garden_ai_start_request(text, text, jsonb, text) to authenticated;
grant execute on function public.garden_ai_finish_request(uuid, text, jsonb, text, integer, jsonb, text) to authenticated;

commit;
