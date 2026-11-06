-- Regression: server gateways alone may execute owner-parameterized Lab RPCs.
do $$
declare
  signature text;
begin
  foreach signature in array array[
    'public.garden_lab_service_get_machine_performance(uuid,uuid)',
    'public.garden_lab_service_get_machine_storage(uuid)',
    'public.garden_lab_service_get_seed_storage(uuid)',
    'public.garden_lab_service_save_machine(uuid,jsonb)',
    'public.garden_lab_service_seed_operation(uuid,jsonb)'
  ] loop
    if has_function_privilege('anon', signature, 'execute')
      or has_function_privilege('authenticated', signature, 'execute')
      or not has_function_privilege('service_role', signature, 'execute') then
      raise exception 'Unexpected Lab RPC grants: %', signature;
    end if;
  end loop;
end;
$$;
