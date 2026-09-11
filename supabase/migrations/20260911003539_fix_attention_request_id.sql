begin;

-- The deployed support_intervention_semantics version referenced the undeclared
-- v_request_id variable before storing the idempotent command receipt. Keep
-- the same owner-scoped contract and use the declared p_request_id instead.
create or replace function public.garden_create_attention_item(
  p_request_id uuid, p_garden_id uuid, p_grow_cycle_id uuid, p_purpose text,
  p_subject_key text default 'general', p_due_on date default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
  v_garden_id uuid;
  v_item garden.attention_items%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('garden_id', p_garden_id, 'grow_cycle_id', p_grow_cycle_id, 'purpose', p_purpose, 'subject_key', coalesce(nullif(trim(p_subject_key), ''), 'general'), 'due_on', p_due_on);
  v_response := garden.command_response(v_owner, p_request_id, 'create_attention_item', v_payload);
  if v_response is not null then return v_response; end if;
  if p_purpose not in ('evaluate_visual_review', 'evaluate_thinning', 'evaluate_pruning', 'evaluate_support', 'perform_thinning', 'perform_pruning', 'perform_support', 'perform_support_remove', 'perform_harvest', 'perform_water_change', 'perform_refill', 'perform_nutrients', 'perform_cleaning') then raise exception 'Invalid attention purpose'; end if;
  if char_length(coalesce(nullif(trim(p_subject_key), ''), 'general')) > 160 then raise exception 'Task subject is too long'; end if;
  v_garden_id := garden.attention_assert_subject(v_owner, p_garden_id, p_grow_cycle_id);
  select * into v_item from garden.attention_items
  where owner_id = v_owner and garden_id = v_garden_id and grow_cycle_id is not distinct from p_grow_cycle_id
    and purpose = p_purpose and subject_key = coalesce(nullif(trim(p_subject_key), ''), 'general') and status = 'open'
  for update;
  if found then
    v_response := jsonb_build_object('task_id', v_item.id, 'created', false);
    perform garden.store_command_response(v_owner, p_request_id, 'create_attention_item', v_payload, v_response);
    return v_response;
  end if;
  insert into garden.attention_items(owner_id, garden_id, grow_cycle_id, purpose, subject_key, title, origin, due_on)
  values (v_owner, v_garden_id, p_grow_cycle_id, p_purpose, coalesce(nullif(trim(p_subject_key), ''), 'general'), garden.attention_purpose_title(p_purpose), 'manual', p_due_on)
  returning * into v_item;
  insert into garden.attention_history(owner_id, attention_item_id, to_status, operation)
  values (v_owner, v_item.id, 'open', 'created');
  v_response := jsonb_build_object('task_id', v_item.id, 'created', true);
  perform garden.store_command_response(v_owner, p_request_id, 'create_attention_item', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_create_attention_item(uuid, uuid, uuid, text, text, date) from public;
grant execute on function public.garden_create_attention_item(uuid, uuid, uuid, text, text, date) to authenticated;

commit;
