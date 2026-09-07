-- Phase 12: candidates stay outside the domain history until a person confirms
-- them. The current event model has no unknown/approximate occurrence date;
-- those candidates remain reviewable and cannot be confirmed as events.
begin;

create table garden.import_batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_label text not null check (char_length(trim(source_label)) between 1 and 180),
  source_fingerprint text not null check (source_fingerprint ~ '^[a-f0-9]{64}$'),
  status text not null default 'reviewing' check (status in ('reviewing', 'completed')),
  created_at timestamptz not null default now(),
  unique (owner_id, source_fingerprint)
);

create table garden.import_candidates (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references garden.import_batches(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  candidate_key text not null check (char_length(trim(candidate_key)) between 1 and 120),
  candidate_type text not null check (candidate_type in ('observation', 'recommendation', 'conflict')),
  grow_cycle_id uuid references garden.grow_cycles(id) on delete restrict,
  occurred_on date,
  occurred_on_precision text not null default 'unknown' check (occurred_on_precision in ('exact', 'unknown')),
  note text not null check (char_length(trim(note)) between 1 and 1000),
  source_data jsonb not null default '{}'::jsonb,
  decision text not null default 'pending' check (decision in ('pending', 'confirmed', 'rejected')),
  decision_note text,
  confirmed_event_id uuid references garden.events(id) on delete restrict,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_id, candidate_key),
  check ((occurred_on is null and occurred_on_precision = 'unknown') or (occurred_on is not null and occurred_on_precision = 'exact')),
  check ((decision = 'pending' and confirmed_event_id is null and decided_at is null) or (decision = 'rejected' and confirmed_event_id is null and decided_at is not null) or (decision = 'confirmed' and confirmed_event_id is not null and decided_at is not null))
);
create index import_candidates_owner_pending on garden.import_candidates(owner_id, decision, created_at);
alter table garden.import_batches enable row level security;
alter table garden.import_candidates enable row level security;
create policy "owners read import batches" on garden.import_batches for select using ((select auth.uid()) = owner_id);
create policy "owners read import candidates" on garden.import_candidates for select using ((select auth.uid()) = owner_id);

create or replace function public.garden_create_import_batch(
  p_request_id uuid, p_source_label text, p_source_fingerprint text, p_candidates jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_batch_id uuid; v_payload jsonb; v_response jsonb; v_candidate jsonb; v_index integer := 0;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if char_length(trim(coalesce(p_source_label, ''))) not between 1 and 180 then raise exception 'Source label is required'; end if;
  if coalesce(p_source_fingerprint, '') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid source fingerprint'; end if;
  if jsonb_typeof(p_candidates) <> 'array' or jsonb_array_length(p_candidates) not between 1 and 50 then raise exception 'Import requires between 1 and 50 candidates'; end if;
  v_payload := jsonb_build_object('source_label', trim(p_source_label), 'source_fingerprint', p_source_fingerprint, 'candidates', p_candidates);
  v_response := garden.command_response(v_owner, p_request_id, 'create_import_batch', v_payload);
  if v_response is not null then return v_response; end if;
  select id into v_batch_id from garden.import_batches where owner_id = v_owner and source_fingerprint = p_source_fingerprint;
  if v_batch_id is not null then
    v_response := jsonb_build_object('batch_id', v_batch_id, 'created', false);
    perform garden.store_command_response(v_owner, p_request_id, 'create_import_batch', v_payload, v_response);
    return v_response;
  end if;
  insert into garden.import_batches(owner_id, source_label, source_fingerprint) values (v_owner, trim(p_source_label), p_source_fingerprint) returning id into v_batch_id;
  for v_candidate in select value from jsonb_array_elements(p_candidates) loop
    v_index := v_index + 1;
    if coalesce(v_candidate->>'candidate_type', '') not in ('observation', 'recommendation', 'conflict') then raise exception 'Invalid candidate type'; end if;
    if char_length(trim(coalesce(v_candidate->>'note', ''))) not between 1 and 1000 then raise exception 'Candidate note is required'; end if;
    if coalesce(v_candidate->>'occurred_on_precision', 'unknown') = 'exact' and nullif(v_candidate->>'occurred_on', '') is null then raise exception 'Exact candidate date is required'; end if;
    if coalesce(v_candidate->>'occurred_on_precision', 'unknown') not in ('exact', 'unknown') then raise exception 'Invalid candidate date precision'; end if;
    if nullif(v_candidate->>'grow_cycle_id', '') is not null and not exists (select 1 from garden.grow_cycles where id = (v_candidate->>'grow_cycle_id')::uuid and owner_id = v_owner) then raise exception 'Candidate cycle not found'; end if;
    insert into garden.import_candidates(batch_id, owner_id, candidate_key, candidate_type, grow_cycle_id, occurred_on, occurred_on_precision, note, source_data)
    values (v_batch_id, v_owner, coalesce(nullif(trim(v_candidate->>'candidate_key'), ''), v_index::text), v_candidate->>'candidate_type', nullif(v_candidate->>'grow_cycle_id', '')::uuid, nullif(v_candidate->>'occurred_on', '')::date, coalesce(v_candidate->>'occurred_on_precision', 'unknown'), trim(v_candidate->>'note'), coalesce(v_candidate->'source_data', '{}'::jsonb));
  end loop;
  v_response := jsonb_build_object('batch_id', v_batch_id, 'created', true);
  perform garden.store_command_response(v_owner, p_request_id, 'create_import_batch', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_review_import_candidate(p_request_id uuid, p_candidate_id uuid, p_decision text, p_decision_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := public.garden_owner_id(); v_candidate garden.import_candidates%rowtype; v_payload jsonb; v_response jsonb; v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_decision not in ('confirmed', 'rejected') then raise exception 'Invalid import decision'; end if;
  v_payload := jsonb_build_object('candidate_id', p_candidate_id, 'decision', p_decision, 'decision_note', nullif(trim(p_decision_note), ''));
  v_response := garden.command_response(v_owner, p_request_id, 'review_import_candidate', v_payload);
  if v_response is not null then return v_response; end if;
  select * into v_candidate from garden.import_candidates where id = p_candidate_id and owner_id = v_owner for update;
  if not found then raise exception 'Import candidate not found'; end if;
  if v_candidate.decision <> 'pending' then raise exception 'Import candidate was already decided'; end if;
  if p_decision = 'confirmed' then
    if v_candidate.candidate_type <> 'observation' then raise exception 'Only observation candidates can become a fact'; end if;
    if v_candidate.grow_cycle_id is null or v_candidate.occurred_on_precision <> 'exact' or v_candidate.occurred_on is null then raise exception 'A cycle and exact date are required before confirming this import'; end if;
    insert into garden.events(owner_id, garden_id, grow_cycle_id, event_type, occurred_at, note, event_data)
    select v_owner, p.garden_id, v_candidate.grow_cycle_id, 'observation', v_candidate.occurred_on::timestamptz, v_candidate.note,
      jsonb_build_object('source', 'confirmed_import', 'import_candidate_id', v_candidate.id, 'source_data', v_candidate.source_data)
    from garden.cycle_occupancies o join garden.positions p on p.id = o.position_id
    where o.grow_cycle_id = v_candidate.grow_cycle_id order by o.created_at limit 1 returning id into v_event_id;
    if v_event_id is null then raise exception 'Candidate cycle has no position history'; end if;
    update garden.import_candidates set decision = 'confirmed', decision_note = nullif(trim(p_decision_note), ''), confirmed_event_id = v_event_id, decided_at = now() where id = v_candidate.id;
  else
    update garden.import_candidates set decision = 'rejected', decision_note = nullif(trim(p_decision_note), ''), decided_at = now() where id = v_candidate.id;
  end if;
  if not exists (select 1 from garden.import_candidates where batch_id = v_candidate.batch_id and decision = 'pending') then update garden.import_batches set status = 'completed' where id = v_candidate.batch_id; end if;
  v_response := jsonb_build_object('candidate_id', v_candidate.id, 'decision', p_decision, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'review_import_candidate', v_payload, v_response);
  return v_response;
end;
$$;

create or replace function public.garden_get_import_candidates()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ic.id, 'batch_id', ic.batch_id, 'source_label', ib.source_label, 'candidate_key', ic.candidate_key,
    'candidate_type', ic.candidate_type, 'grow_cycle_id', ic.grow_cycle_id, 'occurred_on', ic.occurred_on,
    'occurred_on_precision', ic.occurred_on_precision, 'note', ic.note, 'source_data', ic.source_data,
    'decision', ic.decision, 'decision_note', ic.decision_note, 'confirmed_event_id', ic.confirmed_event_id,
    'created_at', ic.created_at, 'decided_at', ic.decided_at
  ) order by case ic.decision when 'pending' then 0 else 1 end, ic.created_at desc), '[]'::jsonb)
  from garden.import_candidates ic join garden.import_batches ib on ib.id = ic.batch_id
  where ic.owner_id = public.garden_owner_id()
$$;

revoke all on function public.garden_create_import_batch(uuid, text, text, jsonb) from public;
revoke all on function public.garden_review_import_candidate(uuid, uuid, text, text) from public;
revoke all on function public.garden_get_import_candidates() from public;
grant execute on function public.garden_create_import_batch(uuid, text, text, jsonb) to authenticated;
grant execute on function public.garden_review_import_candidate(uuid, uuid, text, text) to authenticated;
grant execute on function public.garden_get_import_candidates() to authenticated;
commit;
