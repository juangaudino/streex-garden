begin;

-- B2 stores global and garden-scoped briefings in the existing owner-scoped
-- AI audit table. It does not create a second summary store or mutate domain
-- facts, events, statuses, photos, or cycles.
alter table garden.ai_requests drop constraint if exists ai_requests_request_type_check;
alter table garden.ai_requests add constraint ai_requests_request_type_check
  check (request_type in (
    'ai_check', 'ask_garden', 'identify', 'meaningful_change',
    'garden_summary_global', 'garden_summary_local'
  ));

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
  if p_request_type not in ('ai_check', 'ask_garden', 'identify', 'meaningful_change', 'garden_summary_global', 'garden_summary_local') then raise exception 'Invalid request type'; end if;
  insert into garden.ai_requests(owner_id, request_key, request_type, evidence_refs, status, garden_ai_standard_version, context_schema_version, proposal_schema_version, prompt_version, provider_adapter_version)
  values (
    v_owner, trim(p_request_key), p_request_type, coalesce(p_evidence_refs, '[]'::jsonb), 'started',
    'garden_ai_standard_v1', 'garden_ai_context_v1',
    coalesce(nullif(trim(p_proposal_schema_version), ''), 'garden_ai_ask_v1'),
    'garden_ai_runtime_v4', 'openai_responses_v1'
  )
  on conflict (owner_id, request_key) do nothing;
  select * into v_row from garden.ai_requests where owner_id = v_owner and request_key = trim(p_request_key);
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'proposal', v_row.proposal, 'model_identifier', v_row.model_identifier);
end;
$$;

create or replace function public.garden_get_garden_summary_context(
  p_scope_type text,
  p_garden_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_owner uuid := (select auth.uid());
  v_context jsonb;
  v_fingerprint_source jsonb;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_scope_type not in ('global', 'garden') then raise exception 'Invalid summary scope'; end if;
  if p_scope_type = 'garden' and (p_garden_id is null or not exists (select 1 from garden.gardens where id = p_garden_id and owner_id = v_owner and archived_at is null)) then raise exception 'Garden not found'; end if;

  -- Recency is evidence-specific: current active cycles/status and open
  -- attention remain in scope, canonical activity uses 45 days, B1 results
  -- 90 days, and AI Checks 60 days. This keeps the packet bounded without
  -- treating every evidence type as if it had the same shelf life.
  with scope_gardens as (
    select g.id, g.name
    from garden.gardens g
    where g.owner_id = v_owner and g.archived_at is null
      and (p_scope_type = 'global' or g.id = p_garden_id)
  ), scope_cycles as (
    select gc.id, gc.plant_instance_id, gc.state, gc.harvest_readiness, gc.planted_on, gc.planted_on_precision, g.id as garden_id, g.name as garden_name
    from garden.grow_cycles gc
    join garden.plant_instances pi on pi.id = gc.plant_instance_id and pi.owner_id = v_owner and pi.status = 'active'
    join garden.cycle_occupancies co on co.grow_cycle_id = gc.id and co.occupied_until is null
    join garden.positions p on p.id = co.position_id
    join scope_gardens g on g.id = p.garden_id
    where gc.owner_id = v_owner and gc.state = 'active'
  ), plant_rows as (
    select sc.plant_instance_id, sc.garden_id, sc.garden_name, pi.nickname, pi.common_name, pi.scientific_name, pi.cultivar, pi.status as instance_status,
      sc.id as grow_cycle_id, sc.planted_on, sc.planted_on_precision, sc.harvest_readiness,
      (select count(*)::int from garden.attention_items a where a.owner_id = v_owner and a.status = 'open' and a.grow_cycle_id = sc.id) as open_attention_count
    from scope_cycles sc join garden.plant_instances pi on pi.id = sc.plant_instance_id
  ), event_rows as (
    select e.id, e.grow_cycle_id, e.garden_id, e.event_type, e.occurred_at, e.note, e.event_data,
      coalesce(pr.nickname, pr.common_name, 'Plant') as plant_name
    from garden.events e
    join scope_cycles sc on sc.id = e.grow_cycle_id
    left join plant_rows pr on pr.grow_cycle_id = e.grow_cycle_id
    where e.owner_id = v_owner and e.invalidated_at is null and e.event_type <> 'photo' and e.occurred_at >= now() - interval '45 days'
    order by e.occurred_at desc, e.id desc
    limit 40
  ), attention_rows as (
    select a.id, a.garden_id, a.grow_cycle_id, a.purpose, a.subject_key, a.title, a.origin, a.status, a.due_on, a.next_review_on, a.created_at, a.updated_at
    from garden.attention_items a
    where a.owner_id = v_owner and a.status = 'open'
      and (exists (select 1 from scope_gardens sg where sg.id = a.garden_id) or exists (select 1 from scope_cycles sc where sc.id = a.grow_cycle_id))
    order by coalesce(a.next_review_on, a.due_on) nulls last, a.created_at desc, a.id desc
    limit 40
  ), b1_rows as (
    select r.id, r.created_at, r.completed_at, r.proposal
    from garden.ai_requests r
    where r.owner_id = v_owner and r.request_type = 'meaningful_change' and r.status = 'completed' and r.proposal is not null
      and r.created_at >= now() - interval '90 days'
      and exists (
        select 1
        from scope_cycles sc
        where sc.plant_instance_id = case
          when r.proposal->>'plant_instance_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (r.proposal->>'plant_instance_id')::uuid
          else null
        end
      )
    order by r.created_at desc, r.id desc
    limit 24
  ), ai_rows as (
    select r.id, r.created_at, r.completed_at, r.proposal, r.evidence_refs
    from garden.ai_requests r
    where r.owner_id = v_owner and r.request_type = 'ai_check' and r.status = 'completed' and r.proposal is not null
      and r.created_at >= now() - interval '60 days'
      and exists (
        select 1
        from jsonb_array_elements(coalesce(r.evidence_refs, '[]'::jsonb)) ref
        join garden.photos ph on ph.id = case
          when ref->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (ref->>'id')::uuid
          else null
        end and ph.owner_id = v_owner
        join scope_cycles sc on sc.id = ph.grow_cycle_id
        where ref->>'kind' = 'photo'
      )
    order by r.created_at desc, r.id desc
    limit 24
  )
  select jsonb_build_object(
    'context_schema_version', 'garden_summary_context_v1',
    'scope_type', p_scope_type,
    'scope_id', case when p_scope_type = 'garden' then p_garden_id else null end,
    'gardens', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by id) from scope_gardens), '[]'::jsonb),
    'plants', coalesce((select jsonb_agg(jsonb_build_object('plant_instance_id', plant_instance_id, 'garden_id', garden_id, 'garden_name', garden_name, 'name', coalesce(nullif(trim(nickname),''), common_name), 'common_name', common_name, 'cultivar', cultivar, 'status', case when open_attention_count > 0 then 'watching' else 'steady' end, 'instance_state', instance_status, 'grow_cycle_id', grow_cycle_id, 'planted_on', planted_on, 'planted_on_precision', planted_on_precision, 'harvest_readiness', harvest_readiness, 'open_attention_count', open_attention_count) order by garden_id, plant_instance_id) from plant_rows), '[]'::jsonb),
    'open_attention', coalesce((select jsonb_agg(to_jsonb(attention_rows) order by coalesce(next_review_on, due_on) nulls last, created_at desc, id) from attention_rows), '[]'::jsonb),
    'recent_events', coalesce((select jsonb_agg(to_jsonb(event_rows) order by occurred_at desc, id desc) from event_rows), '[]'::jsonb),
    'meaningful_changes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at, 'completed_at', completed_at, 'proposal', proposal) order by created_at desc, id desc) from b1_rows), '[]'::jsonb),
    'ai_checks', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at, 'completed_at', completed_at, 'proposal', proposal) order by created_at desc, id desc) from ai_rows), '[]'::jsonb)
  ) into v_context
  from scope_gardens limit 1;

  if v_context is null then
    v_context := jsonb_build_object('context_schema_version', 'garden_summary_context_v1', 'scope_type', p_scope_type, 'scope_id', case when p_scope_type = 'garden' then p_garden_id else null end, 'gardens', '[]'::jsonb, 'plants', '[]'::jsonb, 'open_attention', '[]'::jsonb, 'recent_events', '[]'::jsonb, 'meaningful_changes', '[]'::jsonb, 'ai_checks', '[]'::jsonb);
  end if;

  -- Keep technical completion/update timestamps out of the identity. The
  -- material fields below change only when the briefing evidence changes.
  v_fingerprint_source := jsonb_build_object(
    'scope_type', v_context->>'scope_type',
    'scope_id', v_context->>'scope_id',
    'gardens', v_context->'gardens',
    'plants', v_context->'plants',
    'open_attention', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'garden_id', garden_id, 'grow_cycle_id', grow_cycle_id,
      'purpose', purpose, 'subject_key', subject_key, 'title', title,
      'origin', origin, 'status', status, 'due_on', due_on,
      'next_review_on', next_review_on
    ) order by id) from attention_rows), '[]'::jsonb),
    'recent_events', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'grow_cycle_id', grow_cycle_id, 'garden_id', garden_id,
      'event_type', event_type, 'occurred_at', occurred_at, 'note', note,
      'event_data', event_data
    ) order by occurred_at desc, id desc) from event_rows), '[]'::jsonb),
    'meaningful_changes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'proposal', proposal) order by id) from b1_rows), '[]'::jsonb),
    'ai_checks', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'proposal', proposal, 'evidence_refs', evidence_refs) order by id) from ai_rows), '[]'::jsonb)
  );
  return v_context || jsonb_build_object('material_fingerprint', md5(v_fingerprint_source::text));
end;
$$;

create or replace function public.garden_get_garden_summary_results()
returns setof jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id,
    'proposal', r.proposal,
    'created_at', r.created_at,
    'language', r.usage_metadata->>'language',
    'scope_type', r.evidence_refs->>'scope_type',
    'scope_id', nullif(r.evidence_refs->>'scope_id',''),
    'material_fingerprint', r.evidence_refs->>'material_fingerprint'
  )
  from garden.ai_requests r
  where r.owner_id = auth.uid()
    and r.request_type in ('garden_summary_global', 'garden_summary_local')
    and r.status = 'completed'
    and r.proposal is not null
  order by r.created_at desc;
$$;

revoke all on function public.garden_get_garden_summary_context(text, uuid) from public, anon, service_role;
revoke all on function public.garden_get_garden_summary_results() from public, anon, service_role;
grant execute on function public.garden_get_garden_summary_context(text, uuid) to authenticated;
grant execute on function public.garden_get_garden_summary_results() to authenticated;

commit;
