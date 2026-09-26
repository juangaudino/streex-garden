-- Completes private seed lifecycle and curator research/review/publication
-- tracking. Public catalog publication still happens only through the
-- versioned Gardenpedia source repository and its publisher.
begin;

alter table garden.gardenpedia_requests
  drop constraint if exists gardenpedia_requests_status_check;
alter table garden.gardenpedia_requests
  add constraint gardenpedia_requests_status_check
  check (status in ('requested','researching','research_failed','proposal_ready','needs_revision','approved','publishing','declined','published'));

alter table garden.gardenpedia_proposals
  add column if not exists publication_status text not null default 'not_started'
    check (publication_status in ('not_started','bundle_ready','publishing','publication_failed','published')),
  add column if not exists publication_error text,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz;

create or replace function public.garden_seed_package_delete(p_package_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_rows integer;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  delete from garden.seed_packages where id=p_package_id and owner_id=v_owner;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Seed package not found'; end if;
  return jsonb_build_object('deleted',true,'id',p_package_id);
end;
$$;
revoke all on function public.garden_seed_package_delete(uuid) from public, anon;
grant execute on function public.garden_seed_package_delete(uuid) to authenticated;

create or replace function public.gardenpedia_curator_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('isCurator', garden.gardenpedia_is_curator());
$$;

create or replace function public.gardenpedia_my_requests()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_result jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'requestedText',r.requested_text,'status',r.status,'createdAt',r.created_at,
    'proposals',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'candidateIdentity',p.candidate_identity,'reviewStatus',p.review_status,
      'publicationStatus',p.publication_status,'publicationReference',p.publication_reference,
      'publicationVersion',p.publication_version,'publicationError',p.publication_error
    ) order by p.created_at desc) from garden.gardenpedia_proposals p where p.request_id=r.id),'[]'::jsonb)
  ) order by r.created_at desc),'[]'::jsonb) into v_result
  from garden.gardenpedia_requests r where r.owner_id=v_owner;
  return jsonb_build_object('requests',v_result);
end;
$$;

create or replace function public.gardenpedia_research_begin(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request garden.gardenpedia_requests%rowtype;
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode='42501'; end if;
  update garden.gardenpedia_requests set status='researching',updated_at=now()
    where id=p_request_id and status in ('requested','research_failed','needs_revision')
    returning * into v_request;
  if not found then raise exception 'Request is not available for research'; end if;
  return jsonb_build_object('id',v_request.id,'requestedText',v_request.requested_text,'createdAt',v_request.created_at);
end;
$$;

create or replace function public.gardenpedia_research_failed(p_request_id uuid,p_error text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode='42501'; end if;
  update garden.gardenpedia_requests set status='research_failed',updated_at=now()
    where id=p_request_id and status='researching';
  if not found then raise exception 'Request is not currently researching'; end if;
  return jsonb_build_object('requestId',p_request_id,'status','research_failed','error',left(coalesce(p_error,'research_failed'),240));
end;
$$;

create or replace function public.gardenpedia_curator_queue()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'requestedText',r.requested_text,'status',r.status,'createdAt',r.created_at,
    'proposals',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'contractName',p.contract_name,'contractVersion',p.contract_version,
      'candidateIdentity',p.candidate_identity,'proposedData',p.proposed_data,
      'evidence',p.evidence,'confidenceStatus',p.confidence_status,
      'reviewStatus',p.review_status,'publicationStatus',p.publication_status,
      'publicationReference',p.publication_reference,'publicationVersion',p.publication_version,
      'publicationError',p.publication_error,'reviewedAt',p.reviewed_at,'createdAt',p.created_at
    ) order by p.created_at desc) from garden.gardenpedia_proposals p where p.request_id=r.id),'[]'::jsonb)
  ) order by r.created_at),'[]'::jsonb) into v_result
  from garden.gardenpedia_requests r
  where r.status not in ('published','declined');
  return jsonb_build_object('requests',v_result);
end;
$$;

create or replace function public.gardenpedia_approve_proposal(p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_request_id uuid;
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode = '42501'; end if;
  update garden.gardenpedia_proposals set review_status='approved',publication_status='not_started',
    approved_by=v_owner,approved_at=now(),reviewed_by=v_owner,reviewed_at=now(),updated_at=now()
    where id=p_proposal_id and review_status='in_review' returning request_id into v_request_id;
  if v_request_id is null then raise exception 'Proposal is not awaiting review'; end if;
  update garden.gardenpedia_requests set status='approved',updated_at=now(),resolved_at=now() where id=v_request_id;
  return jsonb_build_object('proposalId',p_proposal_id,'requestId',v_request_id,'reviewStatus','approved','published',false);
end;
$$;

create or replace function public.gardenpedia_review_proposal(p_proposal_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request_id uuid; v_status text;
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode='42501'; end if;
  if p_decision not in ('reject','revise') then raise exception 'Invalid review decision'; end if;
  v_status := 'rejected';
  update garden.gardenpedia_proposals set review_status=v_status,publication_error=nullif(left(trim(coalesce(p_note,'')),1000),''),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
    where id=p_proposal_id and review_status='in_review' returning request_id into v_request_id;
  if v_request_id is null then raise exception 'Proposal is not awaiting review'; end if;
  update garden.gardenpedia_requests set status=case when p_decision='reject' then 'declined' else 'needs_revision' end,updated_at=now() where id=v_request_id;
  return jsonb_build_object('proposalId',p_proposal_id,'requestId',v_request_id,'reviewStatus',v_status);
end;
$$;

create or replace function public.gardenpedia_export_publication_bundle(p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_proposal garden.gardenpedia_proposals%rowtype; v_request garden.gardenpedia_requests%rowtype;
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode='42501'; end if;
  select * into v_proposal from garden.gardenpedia_proposals where id=p_proposal_id and review_status='approved';
  if not found then raise exception 'Only an approved proposal can be exported'; end if;
  select * into v_request from garden.gardenpedia_requests where id=v_proposal.request_id;
  update garden.gardenpedia_proposals set publication_status='bundle_ready',publication_error=null,updated_at=now()
    where id=p_proposal_id and publication_status in ('not_started','publication_failed','bundle_ready');
  return jsonb_build_object(
    'schemaVersion','gardenpedia_publication_bundle_v1',
    'requestId',v_request.id,'proposalId',v_proposal.id,'requestedText',v_request.requested_text,
    'contractName',v_proposal.contract_name,'contractVersion',v_proposal.contract_version,
    'candidateIdentity',v_proposal.candidate_identity,'proposedData',v_proposal.proposed_data,
    'evidence',v_proposal.evidence,'confidenceStatus',v_proposal.confidence_status,
    'approvedBy',v_proposal.approved_by,'approvedAt',v_proposal.approved_at
  );
end;
$$;

create or replace function public.gardenpedia_mark_publication_started(p_proposal_id uuid,p_reference text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request_id uuid; v_reference text := trim(coalesce(p_reference,''));
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode='42501'; end if;
  if v_reference !~ '^https://github\.com/juangaudino/streex-garden/pull/[0-9]+/?$' then raise exception 'A Gardenpedia publication pull request URL is required'; end if;
  update garden.gardenpedia_proposals set publication_status='publishing',publication_reference=v_reference,publication_error=null,updated_at=now()
    where id=p_proposal_id and review_status='approved' and publication_status in ('bundle_ready','publishing')
    returning request_id into v_request_id;
  if v_request_id is null then raise exception 'Proposal is not ready for publication'; end if;
  update garden.gardenpedia_requests set status='publishing',updated_at=now() where id=v_request_id;
  return jsonb_build_object('proposalId',p_proposal_id,'requestId',v_request_id,'status','publishing');
end;
$$;

create or replace function public.gardenpedia_mark_publication_failed(p_proposal_id uuid,p_error text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request_id uuid;
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode='42501'; end if;
  update garden.gardenpedia_proposals set publication_status='publication_failed',publication_error=left(coalesce(p_error,'validation_failed'),1000),updated_at=now()
    where id=p_proposal_id and review_status='approved' and publication_status <> 'published'
    returning request_id into v_request_id;
  if v_request_id is null then raise exception 'Proposal cannot be marked failed'; end if;
  update garden.gardenpedia_requests set status='approved',updated_at=now() where id=v_request_id;
  return jsonb_build_object('proposalId',p_proposal_id,'requestId',v_request_id,'status','publication_failed');
end;
$$;

create or replace function garden.gardenpedia_catalog_publication_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_proposal record;
begin
  for v_proposal in
    select p.id,p.request_id from garden.gardenpedia_proposals p
    where p.review_status='approved'
      and p.publication_status='publishing'
      and p.publication_reference is not null
      and coalesce(p.candidate_identity->>'id',p.proposed_data->'plant'->>'id')=new.library_plant_id
  loop
    update garden.gardenpedia_proposals set review_status='published',publication_status='published',
      publication_version=new.catalog_version,publication_error=null,published_at=now(),updated_at=now()
      where id=v_proposal.id;
    update garden.gardenpedia_requests set status='published',updated_at=now(),resolved_at=now()
      where id=v_proposal.request_id;
  end loop;
  return new;
end;
$$;

drop trigger if exists gardenpedia_catalog_publication_sync on garden.library_catalog_items;
create trigger gardenpedia_catalog_publication_sync
  after insert or update on garden.library_catalog_items
  for each row execute function garden.gardenpedia_catalog_publication_sync();

revoke all on function public.gardenpedia_curator_status() from public, anon;
revoke all on function public.gardenpedia_my_requests() from public, anon;
revoke all on function public.gardenpedia_research_begin(uuid) from public, anon;
revoke all on function public.gardenpedia_research_failed(uuid,text) from public, anon;
revoke all on function public.gardenpedia_curator_queue() from public, anon;
revoke all on function public.gardenpedia_review_proposal(uuid,text,text) from public, anon;
revoke all on function public.gardenpedia_export_publication_bundle(uuid) from public, anon;
revoke all on function public.gardenpedia_mark_publication_started(uuid,text) from public, anon;
revoke all on function public.gardenpedia_mark_publication_failed(uuid,text) from public, anon;
grant execute on function public.gardenpedia_curator_status() to authenticated;
grant execute on function public.gardenpedia_my_requests() to authenticated;
grant execute on function public.gardenpedia_research_begin(uuid) to authenticated;
grant execute on function public.gardenpedia_research_failed(uuid,text) to authenticated;
grant execute on function public.gardenpedia_curator_queue() to authenticated;
grant execute on function public.gardenpedia_review_proposal(uuid,text,text) to authenticated;
grant execute on function public.gardenpedia_export_publication_bundle(uuid) to authenticated;
grant execute on function public.gardenpedia_mark_publication_started(uuid,text) to authenticated;
grant execute on function public.gardenpedia_mark_publication_failed(uuid,text) to authenticated;
revoke all on function garden.gardenpedia_catalog_publication_sync() from public, anon, authenticated;

commit;
