begin;

-- Gardenpedia V1 keeps public knowledge in the published catalog and exposes
-- private requests/inventory through owner-scoped authenticated RPCs. Curator
-- membership remains a canonical database role, not a client-side flag.

create or replace function public.gardenpedia_create_request(p_requested_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_text text := trim(coalesce(p_requested_text, ''));
  v_id uuid;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if char_length(v_text) < 2 or char_length(v_text) > 200 then
    raise exception 'Request must be 2-200 characters';
  end if;

  insert into garden.gardenpedia_requests(owner_id, requested_text, normalized_text)
  values (v_owner, v_text, lower(regexp_replace(v_text, '[^[:alnum:]]+', ' ', 'g')))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'requestedText', v_text, 'status', 'requested');
end;
$$;

create or replace function public.gardenpedia_my_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_result jsonb;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'requestedText', r.requested_text,
    'status', r.status,
    'createdAt', r.created_at,
    'proposals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'candidateIdentity', p.candidate_identity,
        'reviewStatus', p.review_status,
        'publicationStatus', p.publication_status,
        'publicationReference', p.publication_reference,
        'publicationVersion', p.publication_version,
        'publicationError', p.publication_error
      ) order by p.created_at desc)
      from garden.gardenpedia_proposals p
      where p.request_id = r.id
    ), '[]'::jsonb)
  ) order by r.created_at desc), '[]'::jsonb)
  into v_result
  from garden.gardenpedia_requests r
  where r.owner_id = v_owner;

  return jsonb_build_object('requests', v_result);
end;
$$;

create or replace function public.gardenpedia_curator_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('isCurator', garden.gardenpedia_is_curator());
$$;

create or replace function public.gardenpedia_curator_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not garden.gardenpedia_is_curator() then
    raise exception 'Curator authorization required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'ownerId', r.owner_id,
    'requestedText', r.requested_text,
    'status', r.status,
    'createdAt', r.created_at,
    'proposals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'contractName', p.contract_name,
        'contractVersion', p.contract_version,
        'candidateIdentity', p.candidate_identity,
        'proposedData', p.proposed_data,
        'evidence', p.evidence,
        'confidenceStatus', p.confidence_status,
        'reviewStatus', p.review_status,
        'publicationStatus', p.publication_status,
        'publicationReference', p.publication_reference,
        'publicationVersion', p.publication_version,
        'publicationError', p.publication_error,
        'reviewedAt', p.reviewed_at,
        'createdAt', p.created_at
      ) order by p.created_at desc)
      from garden.gardenpedia_proposals p
      where p.request_id = r.id
    ), '[]'::jsonb)
  ) order by r.created_at), '[]'::jsonb)
  into v_result
  from garden.gardenpedia_requests r
  where r.status not in ('published', 'declined');

  return jsonb_build_object('requests', v_result);
end;
$$;

create or replace function public.gardenpedia_get_my_plants()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_result jsonb;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', coalesce(nullif(trim(p.nickname), ''), p.common_name),
    'commonName', p.common_name,
    'scientificName', p.scientific_name,
    'cultivar', p.cultivar,
    'referenceKey', p.reference_key,
    'libraryPlantId', p.library_plant_id,
    'status', p.status,
    'gardenId', g.id,
    'gardenName', g.name,
    'cycleId', c.id,
    'cycleState', c.state,
    'plantedOn', c.planted_on,
    'positionNumber', position_info.position_number,
    'journalPath', '/plants/' || p.id::text
  ) order by g.sort_order, g.created_at, position_info.position_number nulls last, p.created_at, p.id), '[]'::jsonb)
  into v_result
  from garden.plant_instances p
  join garden.gardens g
    on g.id = p.garden_id
   and g.owner_id = v_owner
   and g.archived_at is null
  left join lateral (
    select c1.*
    from garden.grow_cycles c1
    where c1.plant_instance_id = p.id
      and c1.owner_id = v_owner
    order by case when c1.state = 'active' then 0 else 1 end, c1.created_at desc, c1.id
    limit 1
  ) c on true
  left join lateral (
    select pos.position_number
    from garden.cycle_occupancies co
    join garden.positions pos on pos.id = co.position_id
    where co.grow_cycle_id = c.id
    order by co.occupied_until is not null, co.occupied_from desc, co.created_at desc, pos.position_number
    limit 1
  ) position_info on true
  where p.owner_id = v_owner
    and p.status <> 'archived';

  return jsonb_build_object('plants', v_result);
end;
$$;

revoke all on function public.gardenpedia_create_request(text) from public, anon;
revoke all on function public.gardenpedia_my_requests() from public, anon;
revoke all on function public.gardenpedia_curator_status() from public, anon;
revoke all on function public.gardenpedia_curator_queue() from public, anon;
revoke all on function public.gardenpedia_get_my_plants() from public, anon;
grant execute on function public.gardenpedia_create_request(text) to authenticated;
grant execute on function public.gardenpedia_my_requests() to authenticated;
grant execute on function public.gardenpedia_curator_status() to authenticated;
grant execute on function public.gardenpedia_curator_queue() to authenticated;
grant execute on function public.gardenpedia_get_my_plants() to authenticated;

commit;
