-- Garden X V1 — explicit API grants.
-- Supabase default function privileges grant anon/service_role explicitly; owner RPCs must not be anonymous.
begin;
revoke execute on all functions in schema public from anon;
-- Restore only the Garden X owner API explicitly for authenticated users.
grant execute on function public.garden_x_get_bootstrap() to authenticated;
grant execute on function public.garden_x_get_systems(uuid) to authenticated;
grant execute on function public.garden_x_get_plant(uuid) to authenticated;
grant execute on function public.garden_x_create_plant(uuid,uuid,uuid,text,text,text,text,text,date,text) to authenticated;
grant execute on function public.garden_x_update_plant_identity(uuid,uuid,text,text,text,text,text) to authenticated;
grant execute on function public.garden_x_move_plant(uuid,uuid,uuid,date) to authenticated;
grant execute on function public.garden_x_prepare_event_photo(uuid,uuid,text,text,bigint,timestamptz,text,text) to authenticated;
grant execute on function public.garden_x_create_garden(uuid,uuid,uuid,text,text,text,text,text,text,integer) to authenticated;
grant execute on function public.garden_x_update_garden(uuid,uuid,text,text,text,text,boolean) to authenticated;
grant execute on function public.garden_x_reorder_gardens(uuid,uuid[]) to authenticated;
grant execute on function public.garden_x_delete_garden(uuid,uuid) to authenticated;
grant execute on function public.garden_x_replace_plant(uuid,uuid,uuid,text,text,text,text,text,date) to authenticated;
commit;
