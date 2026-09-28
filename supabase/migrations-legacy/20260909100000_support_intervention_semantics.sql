begin;

create or replace function garden.attention_purpose_title(p_purpose text)
returns text language sql immutable security invoker set search_path = '' as $$
  select case p_purpose
    when 'evaluate_visual_review' then 'Revisar visualmente'
    when 'evaluate_thinning' then 'Evaluar aclareo'
    when 'evaluate_pruning' then 'Evaluar poda'
    when 'evaluate_support' then 'Evaluar soporte'
    when 'perform_thinning' then 'Realizar aclareo'
    when 'perform_pruning' then 'Realizar poda'
    when 'perform_support' then 'Instalar soporte'
    when 'perform_support_remove' then 'Retirar soporte'
    when 'perform_harvest' then 'Realizar cosecha'
    when 'perform_water_change' then 'Cambiar toda el agua'
    when 'perform_refill' then 'Rellenar agua'
    when 'perform_nutrients' then 'Añadir nutrientes'
    when 'perform_cleaning' then 'Limpiar el sistema'
  end
$$;

create or replace function public.garden_create_attention_item(
  p_request_id uuid, p_garden_id uuid, p_grow_cycle_id uuid, p_purpose text,
  p_subject_key text default 'general', p_due_on date default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id(); v_payload jsonb; v_response jsonb; v_garden_id uuid; v_item garden.attention_items%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('garden_id', p_garden_id, 'grow_cycle_id', p_grow_cycle_id, 'purpose', p_purpose, 'subject_key', coalesce(nullif(trim(p_subject_key), ''), 'general'), 'due_on', p_due_on);
  v_response := garden.command_response(v_owner, v_request_id, 'create_attention_item', v_payload); if v_response is not null then return v_response; end if;
  if p_purpose not in ('evaluate_visual_review', 'evaluate_thinning', 'evaluate_pruning', 'evaluate_support', 'perform_thinning', 'perform_pruning', 'perform_support', 'perform_support_remove', 'perform_harvest', 'perform_water_change', 'perform_refill', 'perform_nutrients', 'perform_cleaning') then raise exception 'Invalid attention purpose'; end if;
  if char_length(coalesce(nullif(trim(p_subject_key), ''), 'general')) > 160 then raise exception 'Task subject is too long'; end if;
  v_garden_id := garden.attention_assert_subject(v_owner, p_garden_id, p_grow_cycle_id);
  select * into v_item from garden.attention_items where owner_id = v_owner and garden_id = v_garden_id and grow_cycle_id is not distinct from p_grow_cycle_id and purpose = p_purpose and subject_key = coalesce(nullif(trim(p_subject_key), ''), 'general') and status = 'open' for update;
  if found then v_response := jsonb_build_object('task_id', v_item.id, 'created', false); perform garden.store_command_response(v_owner, p_request_id, 'create_attention_item', v_payload, v_response); return v_response; end if;
  insert into garden.attention_items(owner_id, garden_id, grow_cycle_id, purpose, subject_key, title, origin, due_on) values (v_owner, v_garden_id, p_grow_cycle_id, p_purpose, coalesce(nullif(trim(p_subject_key), ''), 'general'), garden.attention_purpose_title(p_purpose), 'manual', p_due_on) returning * into v_item;
  insert into garden.attention_history(owner_id, attention_item_id, to_status, operation) values (v_owner, v_item.id, 'open', 'created');
  v_response := jsonb_build_object('task_id', v_item.id, 'created', true); perform garden.store_command_response(v_owner, p_request_id, 'create_attention_item', v_payload, v_response); return v_response;
end;
$$;

create or replace function public.garden_complete_attention_item(
  p_request_id uuid, p_task_id uuid, p_note text default null, p_review_result text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id(); v_task garden.attention_items%rowtype; v_payload jsonb; v_response jsonb; v_event_type text; v_event_data jsonb; v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('task_id', p_task_id, 'note', nullif(trim(p_note), ''), 'review_result', p_review_result); v_response := garden.command_response(v_owner, p_request_id, 'complete_attention_item', v_payload); if v_response is not null then return v_response; end if;
  select * into v_task from garden.attention_items where id = p_task_id and owner_id = v_owner for update;
  if not found or v_task.status <> 'open' then raise exception 'Open attention item not found'; end if;
  if v_task.purpose = 'evaluate_visual_review' then
    if p_review_result not in ('reassuring', 'watch', 'action_required', 'insufficient_evidence') then raise exception 'A personal visual review result is required'; end if;
    v_event_type := 'visual_review'; v_event_data := jsonb_build_object('result', p_review_result, 'source', 'attention_task');
  elsif v_task.purpose like 'evaluate_%' then
    if p_review_result not in ('ready', 'not_yet', 'not_required', 'undetermined') then raise exception 'A development review result is required'; end if;
    v_event_type := 'development_review'; v_event_data := jsonb_build_object('result', p_review_result, 'purpose', v_task.purpose, 'source', 'attention_task');
  elsif v_task.purpose = 'perform_harvest' then
    v_event_type := 'harvest'; v_event_data := jsonb_build_object('source', 'attention_task');
  elsif v_task.purpose in ('perform_thinning', 'perform_pruning', 'perform_support', 'perform_support_remove') then
    v_event_type := 'intervention'; v_event_data := jsonb_build_object('class', case when v_task.purpose like '%support%' then 'support' else replace(v_task.purpose, 'perform_', '') end, 'operation', case when v_task.purpose = 'perform_support' then 'installed' when v_task.purpose = 'perform_support_remove' then 'removed' else null end, 'source', 'attention_task');
  else
    v_event_type := 'system_maintenance'; v_event_data := jsonb_build_object('class', replace(v_task.purpose, 'perform_', ''), 'source', 'attention_task');
  end if;
  insert into garden.events(owner_id, garden_id, grow_cycle_id, event_type, note, event_data) values (v_owner, v_task.garden_id, v_task.grow_cycle_id, v_event_type, nullif(trim(p_note), ''), v_event_data) returning id into v_event_id;
  update garden.attention_items set status = 'completed', completed_at = now(), completed_event_id = v_event_id, updated_at = now() where id = v_task.id;
  insert into garden.attention_history(owner_id, attention_item_id, from_status, to_status, operation, related_event_id) values (v_owner, v_task.id, 'open', 'completed', 'completed', v_event_id);
  v_response := jsonb_build_object('task_id', v_task.id, 'event_id', v_event_id); perform garden.store_command_response(v_owner, p_request_id, 'complete_attention_item', v_payload, v_response); return v_response;
end;
$$;

revoke all on function public.garden_create_attention_item(uuid, uuid, uuid, text, text, date) from public;
revoke all on function public.garden_complete_attention_item(uuid, uuid, text, text) from public;
grant execute on function public.garden_create_attention_item(uuid, uuid, uuid, text, text, date) to authenticated;
grant execute on function public.garden_complete_attention_item(uuid, uuid, text, text) to authenticated;
commit;
