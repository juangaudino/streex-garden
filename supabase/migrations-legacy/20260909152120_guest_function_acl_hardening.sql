-- Harden the Guest RPC ACLs explicitly. Supabase projects may provision
-- explicit anon/authenticated grants when functions are created; revoking from
-- PUBLIC alone does not remove those grants.
begin;

revoke all on function public.garden_create_guest_plant_story(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.garden_get_guest_plant_stories(uuid) from public, anon, authenticated;
revoke all on function public.garden_revoke_guest_plant_story(uuid, uuid) from public, anon, authenticated;
revoke all on function public.garden_get_guest_plant_story(text) from public, anon, authenticated;

grant execute on function public.garden_create_guest_plant_story(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.garden_get_guest_plant_stories(uuid) to authenticated;
grant execute on function public.garden_revoke_guest_plant_story(uuid, uuid) to authenticated;
grant execute on function public.garden_get_guest_plant_story(text) to service_role;

commit;
