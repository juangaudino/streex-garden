begin;

-- Keep audit rows explicit when the Ask Garden grounding/runtime contract changes.
create or replace function public.garden_ai_start_request(p_request_key text, p_request_type text, p_evidence_refs jsonb, p_proposal_schema_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := (select auth.uid()); v_row garden.ai_requests;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_request_key is null or length(trim(p_request_key)) < 16 or length(trim(p_request_key)) > 160 then raise exception 'Invalid request key'; end if;
  if p_request_type not in ('ai_check', 'ask_garden') then raise exception 'Invalid request type'; end if;
  insert into garden.ai_requests(owner_id, request_key, request_type, evidence_refs, status, garden_ai_standard_version, context_schema_version, proposal_schema_version, prompt_version, provider_adapter_version)
  values (v_owner, trim(p_request_key), p_request_type, coalesce(p_evidence_refs, '[]'::jsonb), 'started', 'garden_ai_standard_v1', 'garden_ai_context_v1', coalesce(nullif(trim(p_proposal_schema_version), ''), 'garden_ai_ask_v1'), 'garden_ai_runtime_v3', 'openai_responses_v1')
  on conflict (owner_id, request_key) do nothing;
  select * into v_row from garden.ai_requests where owner_id = v_owner and request_key = trim(p_request_key);
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'proposal', v_row.proposal, 'model_identifier', v_row.model_identifier);
end; $$;

revoke all on function public.garden_ai_start_request(text, text, jsonb, text) from public, anon, service_role;
grant execute on function public.garden_ai_start_request(text, text, jsonb, text) to authenticated;

commit;
