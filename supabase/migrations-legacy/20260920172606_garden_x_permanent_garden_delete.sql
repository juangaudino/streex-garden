-- Garden X permanent garden deletion. The SQL portion is atomic; Storage is
-- handled through an exact-path cleanup queue because it cannot join the SQL
-- transaction.
begin;

create table if not exists garden.storage_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  garden_id uuid not null,
  bucket text not null,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending','cleaned','failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  cleaned_at timestamptz,
  unique (bucket, storage_path)
);

revoke all on table garden.storage_cleanup_queue from public, anon, authenticated;

create or replace function public.garden_x_delete_garden(
  p_request_id uuid,
  p_garden_id uuid
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_garden garden.gardens%rowtype;
  v_system_ids uuid[] := '{}';
  v_position_ids uuid[] := '{}';
  v_cycle_ids uuid[] := '{}';
  v_plant_ids uuid[] := '{}';
  v_event_ids uuid[] := '{}';
  v_photo_ids uuid[] := '{}';
  v_session_ids uuid[] := '{}';
  v_batch_ids uuid[] := '{}';
  v_definition_ids uuid[] := '{}';
  v_storage_count integer := 0;
  v_storage_paths jsonb := '[]'::jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_request_id is null or p_garden_id is null then raise exception 'Garden and request are required'; end if;

  select response into v_response
  from garden.command_receipts
  where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_delete_garden';
  if found then return v_response; end if;

  select * into v_garden
  from garden.gardens
  where id=p_garden_id and owner_id=v_owner
  for update;
  if not found then raise exception 'Garden not found'; end if;

  select coalesce(array_agg(id), '{}') into v_system_ids
  from garden.system_instances where garden_id=p_garden_id and owner_id=v_owner;
  select coalesce(array_agg(id), '{}') into v_position_ids
  from garden.positions where garden_id=p_garden_id;
  select coalesce(array_agg(id), '{}') into v_cycle_ids
  from garden.grow_cycles gc
  where gc.owner_id=v_owner and exists (
    select 1 from garden.cycle_occupancies co where co.grow_cycle_id=gc.id and co.position_id=any(v_position_ids)
  );
  select coalesce(array_agg(id), '{}') into v_plant_ids
  from garden.plant_instances pi
  where pi.owner_id=v_owner and exists (select 1 from garden.grow_cycles gc where gc.plant_instance_id=pi.id and gc.id=any(v_cycle_ids));
  select coalesce(array_agg(id), '{}') into v_event_ids
  from garden.events where owner_id=v_owner and garden_id=p_garden_id;
  select coalesce(array_agg(id), '{}') into v_photo_ids
  from garden.photos where owner_id=v_owner and garden_id=p_garden_id;
  select coalesce(array_agg(distinct session_id), '{}') into v_session_ids
  from garden.maintenance_session_positions where garden_id=p_garden_id;
  select coalesce(array_agg(distinct batch_id), '{}') into v_batch_ids
  from garden.import_candidates
  where owner_id=v_owner and (grow_cycle_id=any(v_cycle_ids) or confirmed_event_id=any(v_event_ids));
  select coalesce(array_agg(id), '{}') into v_definition_ids
  from garden.custom_system_definitions
  where owner_id=v_owner and id in (
    select nullif(si.metadata->>'custom_definition_id','')::uuid
    from garden.system_instances si where si.id=any(v_system_ids)
  );

  -- Queue exact originals and known immutable derivatives before deleting rows.
  insert into garden.storage_cleanup_queue(owner_id,garden_id,bucket,storage_path)
  select v_owner,p_garden_id,'garden-originals',path
  from (
    select storage_path as path from garden.photos where id=any(v_photo_ids)
    union
    select regexp_replace(storage_path, '/[^/]+$', '') || '/display.jpg' from garden.photos where id=any(v_photo_ids)
    union
    select regexp_replace(storage_path, '/[^/]+$', '') || '/preview.jpg' from garden.photos where id=any(v_photo_ids)
  ) paths
  where path is not null and path <> ''
  on conflict (bucket,storage_path) do nothing;
  get diagnostics v_storage_count = row_count;
  select coalesce(jsonb_agg(storage_path order by storage_path), '[]'::jsonb)
    into v_storage_paths
  from garden.storage_cleanup_queue
  where owner_id=v_owner and garden_id=p_garden_id and status='pending';

  delete from garden.attention_history
  where attention_item_id in (select id from garden.attention_items where garden_id=p_garden_id)
     or related_event_id=any(v_event_ids);
  delete from garden.event_revisions where event_id=any(v_event_ids);
  delete from garden.maintenance_session_positions where garden_id=p_garden_id or session_id=any(v_session_ids);
  delete from garden.attention_items where garden_id=p_garden_id or grow_cycle_id=any(v_cycle_ids);
  delete from garden.import_candidates where batch_id=any(v_batch_ids) or grow_cycle_id=any(v_cycle_ids) or confirmed_event_id=any(v_event_ids);
  delete from garden.import_batches where id=any(v_batch_ids);
  delete from garden.guest_plant_story_items where event_id=any(v_event_ids) or photo_id=any(v_photo_ids) or story_id in (select id from garden.guest_plant_stories where grow_cycle_id=any(v_cycle_ids));
  delete from garden.guest_plant_stories where grow_cycle_id=any(v_cycle_ids);
  delete from garden.recurrence_rules where garden_id=p_garden_id or grow_cycle_id=any(v_cycle_ids);
  delete from garden.cycle_occupancies where position_id=any(v_position_ids) or grow_cycle_id=any(v_cycle_ids);
  delete from garden.cycle_revisions where grow_cycle_id=any(v_cycle_ids);
  delete from garden.events where id=any(v_event_ids) or garden_id=p_garden_id;
  delete from garden.photos where id=any(v_photo_ids) or garden_id=p_garden_id;
  delete from garden.saved_films where plant_instance_id=any(v_plant_ids);
  delete from garden.grow_cycles where id=any(v_cycle_ids);
  delete from garden.plant_instances where id=any(v_plant_ids);
  delete from garden.layout_events where garden_id=p_garden_id;
  delete from garden.layout_sites where garden_id=p_garden_id or system_instance_id=any(v_system_ids);
  delete from garden.custom_system_levels where definition_id=any(v_definition_ids);
  delete from garden.positions where id=any(v_position_ids) or garden_id=p_garden_id;
  delete from garden.system_instances where id=any(v_system_ids) or garden_id=p_garden_id;
  delete from garden.custom_system_definitions where id=any(v_definition_ids);
  delete from garden.maintenance_sessions where id=any(v_session_ids);
  delete from garden.owner_change_log where garden_id=p_garden_id or grow_cycle_id=any(v_cycle_ids);
  delete from garden.gardens where id=p_garden_id and owner_id=v_owner;

  v_response := jsonb_build_object(
    'garden_id', p_garden_id,
    'deleted', true,
    'storage_cleanup_pending', v_storage_count > 0,
    'storage_path_count', v_storage_count,
    'storage_paths', v_storage_paths
  );
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_delete_garden',v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_delete_garden(uuid,uuid) from public;
grant execute on function public.garden_x_delete_garden(uuid,uuid) to authenticated;

commit;
