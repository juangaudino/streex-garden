-- Keep Guest Garden Story operations behind the authenticated owner boundary.
revoke all on function public.garden_create_guest_garden_story(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.garden_get_guest_garden_stories(uuid) from public, anon, authenticated;
revoke all on function public.garden_revoke_guest_garden_story(uuid, uuid) from public, anon, authenticated;
revoke all on function public.garden_get_guest_garden_story(text) from public, anon, authenticated;

grant execute on function public.garden_create_guest_garden_story(uuid, uuid, text) to authenticated;
grant execute on function public.garden_get_guest_garden_stories(uuid) to authenticated;
grant execute on function public.garden_revoke_guest_garden_story(uuid, uuid) to authenticated;
grant execute on function public.garden_get_guest_garden_story(text) to service_role;
