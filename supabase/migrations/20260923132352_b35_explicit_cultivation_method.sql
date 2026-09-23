-- B3.5: persist only explicitly known cultivation method on the concrete system.
-- NULL/missing metadata intentionally means unknown; do not infer from plant history.
begin;

create or replace function public.garden_x_set_cultivation_method(
  p_request_id uuid,
  p_garden_id uuid,
  p_cultivation_method text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_system_id uuid;
  v_method text := nullif(trim(coalesce(p_cultivation_method, '')), '');
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_request_id is null or p_garden_id is null then raise exception 'Ids are required'; end if;
  if v_method is not null and v_method not in ('hydroponic', 'soil', 'container') then
    raise exception 'Invalid cultivation method';
  end if;

  select response into v_response from garden.command_receipts
  where owner_id = v_owner and request_id = p_request_id
    and command_name = 'garden_x_set_cultivation_method';
  if found then return v_response; end if;

  select s.id into v_system_id
  from garden.system_instances s
  where s.garden_id = p_garden_id and s.owner_id = v_owner and s.status = 'active'
  for update;
  if not found then raise exception 'Garden system not found'; end if;

  update garden.system_instances
  set metadata = case
        when v_method is null then metadata - 'cultivation_method'
        else jsonb_set(coalesce(metadata, '{}'::jsonb), '{cultivation_method}', to_jsonb(v_method), true)
      end,
      updated_at = now()
  where id = v_system_id and owner_id = v_owner;

  v_response := jsonb_build_object(
    'garden_id', p_garden_id,
    'cultivation_method', v_method,
    'updated', true
  );
  insert into garden.command_receipts(owner_id, request_id, command_name, response)
  values (v_owner, p_request_id, 'garden_x_set_cultivation_method', v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_set_cultivation_method(uuid, uuid, text) from public;
revoke execute on function public.garden_x_set_cultivation_method(uuid, uuid, text) from anon;
grant execute on function public.garden_x_set_cultivation_method(uuid, uuid, text) to authenticated;

-- Preserve the existing bootstrap projection and add the typed configuration from
-- the owner-scoped concrete System Instance metadata.
alter function public.garden_x_get_bootstrap() rename to garden_x_get_bootstrap_b35_base;
create or replace function public.garden_x_get_bootstrap()
returns jsonb
language sql stable security definer set search_path = '' as $$
with base as (
  select public.garden_x_get_bootstrap_b35_base() as value
), gardens as (
  select coalesce(jsonb_agg(
    item || jsonb_strip_nulls(jsonb_build_object(
      'cultivation_method', case
        when s.metadata->>'cultivation_method' in ('hydroponic', 'soil', 'container')
          then s.metadata->>'cultivation_method'
        else null
      end
    )) order by entries.ordinality
  ), '[]'::jsonb) as value
  from base
  cross join lateral jsonb_array_elements(base.value->'gardens') with ordinality as entries(item, ordinality)
  left join garden.system_instances s
    on s.id = nullif(item->>'system_instance_id', '')::uuid
   and s.owner_id = public.garden_owner_id()
)
select jsonb_set(base.value, '{gardens}', gardens.value, true)
from base cross join gardens;
$$;

revoke all on function public.garden_x_get_bootstrap_b35_base() from public;
revoke all on function public.garden_x_get_bootstrap() from public;
grant execute on function public.garden_x_get_bootstrap() to authenticated;

commit;
