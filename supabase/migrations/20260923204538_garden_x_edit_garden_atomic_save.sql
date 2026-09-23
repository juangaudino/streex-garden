-- Keep Garden metadata and its editable System Instance name distinct.
-- Add an exact-System-Instance owner-scoped command; keep the legacy RPC available.
begin;

create or replace function public.garden_x_update_garden_settings(
  p_request_id uuid,
  p_garden_id uuid,
  p_system_instance_id uuid,
  p_name text,
  p_kind text,
  p_place text,
  p_note text,
  p_system_name text,
  p_archived boolean default false
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_system_name text := nullif(trim(coalesce(p_system_name, '')), '');
  v_system_instance_id uuid;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  select response into v_response
  from garden.command_receipts
  where owner_id = v_owner
    and request_id = p_request_id
  and command_name = 'garden_x_update_garden_settings';
  if found then return v_response; end if;

  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Garden name is required';
  end if;

  select id into v_system_instance_id
  from garden.system_instances
  where id = p_system_instance_id
    and garden_id = p_garden_id
    and owner_id = v_owner
    and status = 'active'
  for update;
  if not found then raise exception 'Garden system not found'; end if;

  update garden.gardens
  set name = trim(p_name),
      kind = coalesce(nullif(trim(coalesce(p_kind, '')), ''), kind),
      place = coalesce(trim(p_place), ''),
      note = coalesce(trim(p_note), ''),
      archived_at = case when p_archived then coalesce(archived_at, now()) else null end,
      updated_at = now()
  where id = p_garden_id and owner_id = v_owner;
  if not found then raise exception 'Garden not found'; end if;

  if v_system_name is not null then
    update garden.system_instances
    set name = v_system_name, updated_at = now()
    where id = v_system_instance_id and owner_id = v_owner;
  end if;

  -- system_model, legacy_system_model, system_definition_key, capacity,
  -- cover selection, and geometry belong to separate canonical concepts.
  v_response := jsonb_build_object(
    'garden_id', p_garden_id,
    'updated', true,
    'system_name_updated', v_system_name is not null,
    'archived', p_archived
  );
  insert into garden.command_receipts(owner_id, request_id, command_name, response)
  values (v_owner, p_request_id, 'garden_x_update_garden_settings', v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_update_garden_settings(uuid, uuid, uuid, text, text, text, text, text, boolean) from public;
revoke execute on function public.garden_x_update_garden_settings(uuid, uuid, uuid, text, text, text, text, text, boolean) from anon;
grant execute on function public.garden_x_update_garden_settings(uuid, uuid, uuid, text, text, text, text, text, boolean) to authenticated;

commit;
