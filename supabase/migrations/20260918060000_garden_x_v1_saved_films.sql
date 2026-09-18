-- Garden X V1 — saved Growth Film configurations.
-- A saved film is a presentation artifact, not a botanical history event.
begin;
create table if not exists garden.saved_films (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  plant_instance_id uuid not null references garden.plant_instances(id) on delete cascade,
  title text not null check(char_length(trim(title)) between 1 and 120),
  photo_ids uuid[] not null default '{}',
  music text not null default 'none',
  created_at timestamptz not null default now()
);
create index if not exists saved_films_owner_plant on garden.saved_films(owner_id,plant_instance_id,created_at desc);
alter table garden.saved_films enable row level security;
drop policy if exists "owners read their saved films" on garden.saved_films;
create policy "owners read their saved films" on garden.saved_films for select to authenticated using((select auth.uid())=owner_id);

create or replace function public.garden_x_save_film(
  p_request_id uuid,p_film_id uuid,p_plant_instance_id uuid,p_title text,p_photo_ids uuid[],p_music text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=public.garden_owner_id(); v_response jsonb;
begin
 if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
 select response into v_response from garden.command_receipts where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_save_film';
 if found then return v_response; end if;
 if not exists(select 1 from garden.plant_instances where id=p_plant_instance_id and owner_id=v_owner) then raise exception 'Plant not found'; end if;
 if exists(select 1 from unnest(coalesce(p_photo_ids,'{}'::uuid[])) x(id) left join garden.photos ph on ph.id=x.id and ph.owner_id=v_owner where ph.id is null)
   then raise exception 'Film contains unavailable evidence'; end if;
 insert into garden.saved_films(id,owner_id,plant_instance_id,title,photo_ids,music)
 values(p_film_id,v_owner,p_plant_instance_id,trim(p_title),coalesce(p_photo_ids,'{}'::uuid[]),coalesce(nullif(trim(p_music),''),'none'));
 v_response:=jsonb_build_object('film_id',p_film_id,'saved',true);
 insert into garden.command_receipts(owner_id,request_id,command_name,response) values(v_owner,p_request_id,'garden_x_save_film',v_response);
 return v_response;
end $$;
revoke all on function public.garden_x_save_film(uuid,uuid,uuid,text,uuid[],text) from public;
revoke execute on function public.garden_x_save_film(uuid,uuid,uuid,text,uuid[],text) from anon;
grant execute on function public.garden_x_save_film(uuid,uuid,uuid,text,uuid[],text) to authenticated;
commit;
