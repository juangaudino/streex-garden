-- Origin is a human-confirmed cycle fact. Keep corrections auditable and owner-scoped.
begin;

alter table garden.cycle_revisions
  drop constraint if exists cycle_revisions_operation_check;

alter table garden.cycle_revisions
  add constraint cycle_revisions_operation_check
  check (operation in ('planting_corrected', 'closed', 'replaced', 'moved', 'reopened', 'origin_corrected'))
  not valid;

alter table garden.cycle_revisions
  validate constraint cycle_revisions_operation_check;

create or replace function public.garden_correct_cycle_origin(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_expected_revision integer,
  p_origin_type text,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object(
    'grow_cycle_id', p_grow_cycle_id,
    'expected_revision', p_expected_revision,
    'origin_type', p_origin_type,
    'reason', trim(coalesce(p_reason, ''))
  );
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;

  v_response := garden.command_response(v_owner, p_request_id, 'correct_cycle_origin', v_payload);
  if v_response is not null then return v_response; end if;

  if p_origin_type is null or p_origin_type not in ('seed', 'bare_root', 'cutting', 'seedling', 'transplant') then
    raise exception 'Invalid plant origin';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'Origin correction reason is required';
  end if;

  select * into v_cycle
  from garden.grow_cycles
  where id = p_grow_cycle_id and owner_id = v_owner
  for update;
  if not found then raise exception 'Grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then
    raise exception 'Cycle changed; review it before correcting';
  end if;

  if v_cycle.origin_type = p_origin_type then
    v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision, 'unchanged', true);
    perform garden.store_command_response(v_owner, p_request_id, 'correct_cycle_origin', v_payload, v_response);
    return v_response;
  end if;

  update garden.grow_cycles
  set origin_type = p_origin_type,
      revision = revision + 1,
      updated_at = now()
  where id = p_grow_cycle_id;

  insert into garden.cycle_revisions(
    owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason
  ) values (
    v_owner,
    p_grow_cycle_id,
    v_cycle.revision + 1,
    'origin_corrected',
    jsonb_build_object('origin_type', v_cycle.origin_type),
    jsonb_build_object('origin_type', p_origin_type),
    trim(p_reason)
  );

  v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1);
  perform garden.store_command_response(v_owner, p_request_id, 'correct_cycle_origin', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_correct_cycle_origin(uuid, uuid, integer, text, text) from public, anon;
grant execute on function public.garden_correct_cycle_origin(uuid, uuid, integer, text, text) to authenticated;

commit;
