-- Phase 12 follow-up: completing review metadata must never itself create a fact.
begin;

create or replace function public.garden_update_import_candidate(
  p_request_id uuid,
  p_candidate_id uuid,
  p_grow_cycle_id uuid,
  p_occurred_on date
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_candidate garden.import_candidates%rowtype;
  v_payload jsonb;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_grow_cycle_id is null or p_occurred_on is null then raise exception 'A cycle and exact date are required'; end if;

  v_payload := jsonb_build_object(
    'candidate_id', p_candidate_id,
    'grow_cycle_id', p_grow_cycle_id,
    'occurred_on', p_occurred_on
  );
  v_response := garden.command_response(v_owner, p_request_id, 'update_import_candidate', v_payload);
  if v_response is not null then return v_response; end if;

  select * into v_candidate
  from garden.import_candidates
  where id = p_candidate_id and owner_id = v_owner
  for update;
  if not found then raise exception 'Pending import candidate not found'; end if;
  if v_candidate.decision <> 'pending' then raise exception 'Import candidate was already decided'; end if;
  if v_candidate.candidate_type <> 'observation' then raise exception 'Only observation candidates can be completed'; end if;
  if not exists (
    select 1 from garden.grow_cycles
    where id = p_grow_cycle_id and owner_id = v_owner
  ) then raise exception 'Candidate cycle not found'; end if;

  update garden.import_candidates
  set grow_cycle_id = p_grow_cycle_id,
      occurred_on = p_occurred_on,
      occurred_on_precision = 'exact'
  where id = v_candidate.id;

  v_response := jsonb_build_object('candidate_id', v_candidate.id, 'updated', true);
  perform garden.store_command_response(v_owner, p_request_id, 'update_import_candidate', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_update_import_candidate(uuid, uuid, uuid, date) from public;
grant execute on function public.garden_update_import_candidate(uuid, uuid, uuid, date) to authenticated;
commit;
