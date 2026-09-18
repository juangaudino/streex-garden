-- Garden X V1 — history-safe garden deletion.
begin;
create or replace function public.garden_x_delete_garden(
  p_request_id uuid,
  p_garden_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid := public.garden_owner_id();
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not exists(select 1 from garden.gardens where id=p_garden_id and owner_id=v_owner and archived_at is not null)
    then raise exception 'Archive the garden before permanent deletion'; end if;
  if exists(
    select 1 from garden.positions p
    join garden.cycle_occupancies o on o.position_id=p.id
    where p.garden_id=p_garden_id
  ) then raise exception 'A garden with plant history cannot be permanently deleted; keep it archived'; end if;
  delete from garden.gardens where id=p_garden_id and owner_id=v_owner;
  return jsonb_build_object('garden_id',p_garden_id,'deleted',true);
end;
$$;
revoke execute on function public.garden_x_delete_garden(uuid,uuid) from anon;
grant execute on function public.garden_x_delete_garden(uuid,uuid) to authenticated;
commit;
