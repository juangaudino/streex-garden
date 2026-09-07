-- Phase 3 verification: uses an existing account with no gardens and rolls back
-- every write. Run as a single batch in the Supabase SQL Editor.
begin;

create temp table phase3_verification (
  id boolean primary key default true,
  replacement_atomic boolean not null,
  correction_audited boolean not null,
  invalidation_audited boolean not null,
  idempotency_rejects_changed_input boolean not null,
  successor_blocks_reopen boolean not null,
  historical_cycle_readable boolean not null
) on commit drop;

do $$
declare
  v_owner uuid;
  v_garden_id uuid;
  v_position_one uuid;
  v_position_two uuid;
  v_cycle_id uuid;
  v_successor_cycle_id uuid;
  v_observation_id uuid;
  v_same_response jsonb;
  v_response jsonb;
  v_idempotency_rejected boolean := false;
  v_reopen_blocked boolean := false;
begin
  select u.id into v_owner
  from auth.users u
  where not exists (select 1 from garden.gardens g where g.owner_id = u.id)
  order by u.created_at
  limit 1;
  if v_owner is null then
    raise exception 'No hay una cuenta existente sin jardines para la prueba temporal';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);

  v_response := public.garden_create_garden(gen_random_uuid(), 'Validación temporal Phase 3', 'URUQ', 2);
  v_garden_id := (v_response ->> 'garden_id')::uuid;
  select id into v_position_one from garden.positions where garden_id = v_garden_id and position_number = 1;
  select id into v_position_two from garden.positions where garden_id = v_garden_id and position_number = 2;

  -- Same request and payload replay the original result. Changing payload fails.
  v_same_response := public.garden_create_garden(
    (select request_id from garden.command_receipts where owner_id = v_owner and command_name = 'create_garden' order by created_at desc limit 1),
    'Validación temporal Phase 3', 'URUQ', 2
  );
  if (v_same_response ->> 'garden_id')::uuid <> v_garden_id then raise exception 'Idempotency did not replay the original result'; end if;
  begin
    perform public.garden_create_garden(
      (select request_id from garden.command_receipts where owner_id = v_owner and command_name = 'create_garden' order by created_at desc limit 1),
      'Entrada distinta', 'URUQ', 2
    );
  exception when sqlstate '22023' then
    v_idempotency_rejected := true;
  end;
  if not v_idempotency_rejected then raise exception 'Idempotency accepted changed input'; end if;

  v_response := public.garden_start_cycle(gen_random_uuid(), v_position_one, 'Cultivo de validación', date '2026-09-01', 'exact');
  v_cycle_id := (v_response ->> 'grow_cycle_id')::uuid;
  v_response := public.garden_create_observation(gen_random_uuid(), v_cycle_id, 'Observación temporal validada');
  v_observation_id := (v_response ->> 'event_id')::uuid;

  v_response := public.garden_correct_cycle_planting(gen_random_uuid(), v_cycle_id, 1, date '2026-09-02', 'exact', 'Fecha inicial corregida para validación');
  if (v_response ->> 'revision')::integer <> 2 then raise exception 'Correction did not increment revision'; end if;

  v_response := public.garden_move_cycle(gen_random_uuid(), v_cycle_id, 2, v_position_two, date '2026-09-03');
  if (v_response ->> 'revision')::integer <> 3 then raise exception 'Move did not increment revision'; end if;

  v_response := public.garden_replace_cycle(gen_random_uuid(), v_cycle_id, 3, 'Sucesor de validación', date '2026-09-04', 'exact');
  v_successor_cycle_id := (v_response ->> 'grow_cycle_id')::uuid;
  if not exists (select 1 from garden.grow_cycles where id = v_cycle_id and state = 'closed')
     or not exists (select 1 from garden.grow_cycles where id = v_successor_cycle_id and state = 'active')
     or not exists (select 1 from garden.cycle_occupancies where grow_cycle_id = v_successor_cycle_id and position_id = v_position_two and occupied_until is null) then
    raise exception 'Replacement was not atomic';
  end if;

  begin
    perform public.garden_reopen_cycle(gen_random_uuid(), v_cycle_id, 4, 'La prueba confirma que el sucesor bloquea la reapertura');
  exception when others then
    if position('successor' in sqlerrm) > 0 then v_reopen_blocked := true; else raise; end if;
  end;
  if not v_reopen_blocked then raise exception 'Reopen ignored an active successor'; end if;

  perform public.garden_invalidate_event(gen_random_uuid(), v_observation_id, 1, 'Invalidación temporal validada');
  if not exists (select 1 from garden.event_revisions where event_id = v_observation_id and operation = 'invalidated')
     or exists (select 1 from jsonb_array_elements(public.garden_get_cycle(v_cycle_id) -> 'history') item where (item ->> 'id')::uuid = v_observation_id) then
    raise exception 'Invalidation did not preserve audit or remove current projection';
  end if;

  if public.garden_get_cycle(v_cycle_id) is null then raise exception 'Closed historical cycle is not readable'; end if;

  insert into phase3_verification(replacement_atomic, correction_audited, invalidation_audited, idempotency_rejects_changed_input, successor_blocks_reopen, historical_cycle_readable)
  values (true, true, true, v_idempotency_rejected, v_reopen_blocked, true);
end;
$$;

select * from phase3_verification;
rollback;
