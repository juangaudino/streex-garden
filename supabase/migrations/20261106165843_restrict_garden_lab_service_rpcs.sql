-- These functions accept an explicit owner ID and are called only by trusted
-- server gateways. Browser roles must not select another owner's data or write it.
revoke all on function public.garden_lab_service_get_machine_performance(uuid, uuid) from public, anon, authenticated;
revoke all on function public.garden_lab_service_get_machine_storage(uuid) from public, anon, authenticated;
revoke all on function public.garden_lab_service_get_seed_storage(uuid) from public, anon, authenticated;
revoke all on function public.garden_lab_service_save_machine(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.garden_lab_service_seed_operation(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.garden_lab_service_get_machine_performance(uuid, uuid) to service_role;
grant execute on function public.garden_lab_service_get_machine_storage(uuid) to service_role;
grant execute on function public.garden_lab_service_get_seed_storage(uuid) to service_role;
grant execute on function public.garden_lab_service_save_machine(uuid, jsonb) to service_role;
grant execute on function public.garden_lab_service_seed_operation(uuid, jsonb) to service_role;
