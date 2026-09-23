-- Persist the editable Garden system name alongside garden metadata.
begin;

create or replace function public.garden_x_update_garden_with_system(
  p_request_id uuid,
  p_garden_id uuid,
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
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  select response into v_response from garden.command_receipts
   where owner_id = v_owner and request_id = p_request_id
     and command_name = 'garden_x_update_garden_with_system';
  if found then return v_response; end if;

  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Garden name is required';
  end if;

  update garden.gardens
     set name = trim(p_name),
         system_model = coalesce(v_system_name, system_model),
         kind = coalesce(nullif(trim(coalesce(p_kind, '')), ''), kind),
         place = coalesce(trim(p_place), ''),
         note = coalesce(trim(p_note), ''),
         archived_at = case when p_archived then coalesce(archived_at, now()) else null end,
         updated_at = now()
   where id = p_garden_id and owner_id = v_owner;
  if not found then raise exception 'Garden not found'; end if;

  update garden.system_instances
     set name = coalesce(v_system_name, name),
         legacy_system_model = coalesce(v_system_name, legacy_system_model),
         updated_at = now()
   where garden_id = p_garden_id and owner_id = v_owner and status = 'active';
  if not found then raise exception 'Garden system not found'; end if;

  v_response := jsonb_build_object(
    'garden_id', p_garden_id,
    'updated', true,
    'system_name_updated', v_system_name is not null,
    'archived', p_archived
  );
  insert into garden.command_receipts(owner_id, request_id, command_name, response)
  values (v_owner, p_request_id, 'garden_x_update_garden_with_system', v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_update_garden_with_system(uuid, uuid, text, text, text, text, text, boolean) from public;
revoke execute on function public.garden_x_update_garden_with_system(uuid, uuid, text, text, text, text, text, boolean) from anon;
grant execute on function public.garden_x_update_garden_with_system(uuid, uuid, text, text, text, text, text, boolean) to authenticated;

commit;
