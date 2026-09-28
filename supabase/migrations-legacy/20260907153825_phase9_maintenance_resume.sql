-- Exposes only the owner's resumable maintenance session.
create or replace function public.garden_get_open_maintenance_session()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', s.id, 'state', s.state, 'started_at', s.started_at)
  from garden.maintenance_sessions s
  where s.owner_id = public.garden_owner_id() and s.state in ('in_progress', 'paused')
  order by s.started_at desc limit 1
$$;
revoke all on function public.garden_get_open_maintenance_session() from public;
grant execute on function public.garden_get_open_maintenance_session() to authenticated;
