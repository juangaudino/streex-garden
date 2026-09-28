-- The command validates auth.uid(), but it is an authenticated-only command.
-- Revoke the explicit anon grant left by the original function creation while
-- preserving the authenticated and service_role paths.
begin;

revoke execute on function public.garden_record_cycle_fact(uuid, uuid, text, date, text, jsonb) from anon;
revoke execute on function public.garden_record_cycle_fact(uuid, uuid, text, date, text, jsonb) from public;
grant execute on function public.garden_record_cycle_fact(uuid, uuid, text, date, text, jsonb) to authenticated;

commit;
