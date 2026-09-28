-- Keep the restored bootstrap dependency chain private to authenticated callers.
-- The remote project auto-exposes newly created functions unless anon is revoked explicitly.

revoke all on function public.garden_owner_id() from public, anon, authenticated;
revoke all on function public.garden_x_get_bootstrap_legacy() from public, anon, authenticated;
revoke all on function public.garden_x_get_bootstrap_b35_base() from public, anon, authenticated;
revoke all on function public.garden_x_get_bootstrap() from public, anon;
grant execute on function public.garden_x_get_bootstrap() to authenticated;

revoke all on function public.garden_x_get_invalidated_event_photos() from public, anon;
grant execute on function public.garden_x_get_invalidated_event_photos() to authenticated;

