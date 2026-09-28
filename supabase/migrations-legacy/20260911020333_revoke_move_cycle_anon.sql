begin;
revoke execute on function public.garden_move_cycle(uuid, uuid, integer, uuid, date) from anon;
revoke execute on function public.garden_move_cycle(uuid, uuid, integer, uuid, date) from public;
grant execute on function public.garden_move_cycle(uuid, uuid, integer, uuid, date) to authenticated;
commit;
