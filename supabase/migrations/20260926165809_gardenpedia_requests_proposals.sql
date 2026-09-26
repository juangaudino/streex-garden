-- Private request/proposal workflow. Editorial approval is deliberately not
-- publication and no function in this migration writes to the public catalog.
begin;

create table garden.gardenpedia_curators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  granted_by text not null default 'initial_curator_bootstrap'
);
alter table garden.gardenpedia_curators enable row level security;
revoke all on garden.gardenpedia_curators from public, anon, authenticated;

-- User Zero's three verified Garden X login accounts all belong to Juan.
-- A client cannot insert or update this private allowlist.
insert into garden.gardenpedia_curators(user_id) select id from auth.users
where id in (
  '5446a2aa-da54-468c-941b-f7c9c4792135'::uuid,
  '978a5bef-32c1-4a03-a10a-8b471b103373'::uuid,
  '361520ad-09bf-4901-a391-871eeb704e37'::uuid
)
on conflict (user_id) do nothing;

create or replace function garden.gardenpedia_is_curator()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from garden.gardenpedia_curators c where c.user_id = auth.uid()
  );
$$;
revoke all on function garden.gardenpedia_is_curator() from public, anon;
grant execute on function garden.gardenpedia_is_curator() to authenticated;

create table garden.gardenpedia_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  requested_text text not null check (char_length(trim(requested_text)) between 2 and 200),
  normalized_text text not null check (char_length(trim(normalized_text)) between 2 and 200),
  status text not null default 'requested' check (status in ('requested','researching','proposal_ready','approved','declined','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index gardenpedia_requests_owner_created_idx
  on garden.gardenpedia_requests(owner_id, created_at desc);
alter table garden.gardenpedia_requests enable row level security;
create policy "request owners and curators read requests" on garden.gardenpedia_requests
  for select to authenticated using ((select auth.uid()) = owner_id or (select garden.gardenpedia_is_curator()));
revoke all on garden.gardenpedia_requests from public, anon, authenticated;

create table garden.gardenpedia_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references garden.gardenpedia_requests(id) on delete cascade,
  contract_name text not null,
  contract_version text not null,
  candidate_identity jsonb not null default '{}'::jsonb check (jsonb_typeof(candidate_identity) = 'object'),
  proposed_data jsonb not null default '{}'::jsonb check (jsonb_typeof(proposed_data) = 'object'),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  confidence_status jsonb not null default '{}'::jsonb check (jsonb_typeof(confidence_status) = 'object'),
  review_status text not null default 'in_review' check (review_status in ('draft','in_review','approved','rejected','published')),
  created_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  publication_version text,
  publication_reference text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((review_status = 'published') = (published_at is not null))
);
create index gardenpedia_proposals_request_created_idx
  on garden.gardenpedia_proposals(request_id, created_at desc);
alter table garden.gardenpedia_proposals enable row level security;
create policy "request owners and curators read proposals" on garden.gardenpedia_proposals
  for select to authenticated using (
    (select garden.gardenpedia_is_curator())
    or exists (select 1 from garden.gardenpedia_requests r
      where r.id = garden.gardenpedia_proposals.request_id and r.owner_id = (select auth.uid()))
  );
revoke all on garden.gardenpedia_proposals from public, anon, authenticated;

create or replace function public.gardenpedia_create_request(p_requested_text text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_text text := trim(coalesce(p_requested_text,'')); v_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if char_length(v_text) < 2 or char_length(v_text) > 200 then raise exception 'Request must be 2-200 characters'; end if;
  insert into garden.gardenpedia_requests(owner_id,requested_text,normalized_text)
  values(v_owner,v_text,lower(regexp_replace(v_text,'[^[:alnum:]]+',' ','g')))
  returning id into v_id;
  return jsonb_build_object('id',v_id,'requestedText',v_text,'status','requested');
end;
$$;

create or replace function public.gardenpedia_my_requests()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_result jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'requestedText',r.requested_text,'status',r.status,'createdAt',r.created_at)
    order by r.created_at desc),'[]'::jsonb) into v_result
  from garden.gardenpedia_requests r where r.owner_id=v_owner;
  return jsonb_build_object('requests',v_result);
end;
$$;

create or replace function public.gardenpedia_curator_queue()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_result jsonb;
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'ownerId',r.owner_id,'requestedText',r.requested_text,'status',r.status,'createdAt',r.created_at,
    'proposals',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'contractName',p.contract_name,'contractVersion',p.contract_version,'candidateIdentity',p.candidate_identity,'proposedData',p.proposed_data,'evidence',p.evidence,'confidenceStatus',p.confidence_status,'reviewStatus',p.review_status,'createdAt',p.created_at) order by p.created_at desc) from garden.gardenpedia_proposals p where p.request_id=r.id),'[]'::jsonb))
    order by r.created_at),'[]'::jsonb) into v_result
  from garden.gardenpedia_requests r where r.status in ('requested','researching','proposal_ready','approved');
  return jsonb_build_object('requests',v_result);
end;
$$;

create or replace function public.gardenpedia_submit_proposal(
  p_request_id uuid, p_contract_name text, p_contract_version text,
  p_candidate_identity jsonb, p_proposed_data jsonb, p_evidence jsonb, p_confidence_status jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_id uuid;
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode = '42501'; end if;
  if not exists(select 1 from garden.gardenpedia_requests where id=p_request_id) then raise exception 'Request not found'; end if;
  if nullif(trim(coalesce(p_contract_name,'')),'') is null or nullif(trim(coalesce(p_contract_version,'')),'') is null then raise exception 'Contract name and version are required'; end if;
  if jsonb_typeof(coalesce(p_candidate_identity,'{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_proposed_data,'{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_evidence,'[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_confidence_status,'{}'::jsonb)) <> 'object' then raise exception 'Invalid proposal structure'; end if;
  insert into garden.gardenpedia_proposals(request_id,contract_name,contract_version,candidate_identity,proposed_data,evidence,confidence_status,created_by)
  values(p_request_id,trim(p_contract_name),trim(p_contract_version),coalesce(p_candidate_identity,'{}'::jsonb),coalesce(p_proposed_data,'{}'::jsonb),coalesce(p_evidence,'[]'::jsonb),coalesce(p_confidence_status,'{}'::jsonb),v_owner)
  returning id into v_id;
  update garden.gardenpedia_requests set status='proposal_ready',updated_at=now() where id=p_request_id;
  return jsonb_build_object('id',v_id,'reviewStatus','in_review');
end;
$$;

create or replace function public.gardenpedia_approve_proposal(p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_request_id uuid; v_status text;
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode = '42501'; end if;
  update garden.gardenpedia_proposals set review_status='approved',reviewed_by=v_owner,reviewed_at=now(),updated_at=now()
    where id=p_proposal_id and review_status='in_review' returning request_id,review_status into v_request_id,v_status;
  if v_request_id is null then raise exception 'Proposal is not awaiting review'; end if;
  update garden.gardenpedia_requests set status='approved',updated_at=now(),resolved_at=now() where id=v_request_id;
  -- Editorial approval intentionally does not publish or sync catalog data.
  return jsonb_build_object('proposalId',p_proposal_id,'requestId',v_request_id,'reviewStatus',v_status,'published',false);
end;
$$;

revoke all on function public.gardenpedia_create_request(text) from public, anon;
revoke all on function public.gardenpedia_my_requests() from public, anon;
revoke all on function public.gardenpedia_curator_queue() from public, anon;
revoke all on function public.gardenpedia_submit_proposal(uuid,text,text,jsonb,jsonb,jsonb,jsonb) from public, anon;
revoke all on function public.gardenpedia_approve_proposal(uuid) from public, anon;
grant execute on function public.gardenpedia_create_request(text) to authenticated;
grant execute on function public.gardenpedia_my_requests() to authenticated;
grant execute on function public.gardenpedia_curator_queue() to authenticated;
grant execute on function public.gardenpedia_submit_proposal(uuid,text,text,jsonb,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.gardenpedia_approve_proposal(uuid) to authenticated;

commit;
