begin;
create or replace function public.garden_x_get_saved_films()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',f.id,'plant_instance_id',f.plant_instance_id,'title',f.title,'photo_ids',f.photo_ids,'music',f.music,'created_at',f.created_at
 ) order by f.created_at desc),'[]'::jsonb)
 from garden.saved_films f where f.owner_id=public.garden_owner_id()
$$;
revoke all on function public.garden_x_get_saved_films() from public;
revoke execute on function public.garden_x_get_saved_films() from anon;
grant execute on function public.garden_x_get_saved_films() to authenticated;
commit;