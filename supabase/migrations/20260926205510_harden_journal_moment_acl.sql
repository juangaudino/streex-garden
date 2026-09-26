-- Supabase default privileges can grant anon directly; keep this write command
-- available only to authenticated callers. Ownership is checked in the RPC.
begin;

revoke all on function public.garden_x_create_journal_moment(uuid, uuid, date, text, text, boolean)
  from public, anon;
grant execute on function public.garden_x_create_journal_moment(uuid, uuid, date, text, text, boolean)
  to authenticated;

commit;
