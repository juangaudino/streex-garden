-- Garden AI Foundation MVP: audit metadata, bounded idempotency, and proposal
-- retention. This table never stores canonical facts or raw provider content.
begin;

create table if not exists garden.ai_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null,
  request_type text not null check (request_type in ('ai_check', 'ask_garden')),
  status text not null default 'started' check (status in ('started', 'completed', 'failed', 'expired')),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  garden_ai_standard_version text not null default 'garden_ai_standard_v1',
  context_schema_version text not null default 'garden_ai_context_v1',
  proposal_schema_version text not null default 'garden_ai_check_v1',
  prompt_version text not null default 'unassigned',
  provider_adapter_version text not null default 'mock_v1',
  model_identifier text,
  proposal jsonb check (proposal is null or jsonb_typeof(proposal) = 'object'),
  proposal_decision text check (proposal_decision is null or proposal_decision in ('pending', 'dismissed', 'attention_created', 'fact_flow_opened')),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  usage_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(usage_metadata) = 'object'),
  estimated_cost_usd numeric(12, 6) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  proposal_expires_at timestamptz not null default (now() + interval '7 days'),
  audit_expires_at timestamptz not null default (now() + interval '90 days'),
  unique (owner_id, request_key)
);

comment on table garden.ai_requests is
  'Non-canonical Garden AI request metadata. Never store raw prompts, images, signed URLs, or model reasoning here.';
comment on column garden.ai_requests.evidence_refs is
  'Validated IDs and kinds only; storage paths and image bytes are intentionally excluded.';
comment on column garden.ai_requests.proposal is
  'Validated, non-canonical proposal payload retained only until proposal_expires_at.';
comment on column garden.ai_requests.proposal_expires_at is
  'Private proposal retention deadline; proposal payloads, when added, must be removed after this time.';
comment on column garden.ai_requests.audit_expires_at is
  'Bounded audit metadata retention deadline.';

alter table garden.ai_requests enable row level security;

drop policy if exists ai_requests_owner_select on garden.ai_requests;
create policy ai_requests_owner_select on garden.ai_requests
  for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists ai_requests_owner_insert on garden.ai_requests;
create policy ai_requests_owner_insert on garden.ai_requests
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists ai_requests_owner_update on garden.ai_requests;
create policy ai_requests_owner_update on garden.ai_requests
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create index if not exists ai_requests_owner_created_at on garden.ai_requests (owner_id, created_at desc);
create index if not exists ai_requests_expiry on garden.ai_requests (proposal_expires_at, audit_expires_at);

create or replace function garden.cleanup_expired_ai_requests()
returns integer
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  update garden.ai_requests
  set proposal = null,
      proposal_decision = null
  where proposal_expires_at <= now()
    and proposal is not null;

  delete from garden.ai_requests
  where audit_expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function garden.cleanup_expired_ai_requests() from public;
revoke all on function garden.cleanup_expired_ai_requests() from authenticated;
grant execute on function garden.cleanup_expired_ai_requests() to service_role;

revoke all on table garden.ai_requests from anon;
revoke all on table garden.ai_requests from authenticated;
grant select, insert, update on table garden.ai_requests to authenticated;
grant all on table garden.ai_requests to service_role;

commit;
