-- Structured fact regression verification.
-- Run as one batch in the Supabase SQL Editor. Every write is rolled back.
-- The fixture exercises each supported fact path through the same RPC the app
-- uses and fails if a composite grow_cycles row is ever passed where a UUID is
-- expected.
begin;

create temp table record_cycle_fact_verification (
  fact_type text primary key,
  event_id uuid not null,
  cycle_id uuid not null,
  cycle_id_is_scalar boolean not null
) on commit drop;

do $$
declare
  v_owner uuid;
  v_garden_id uuid;
  v_position_id uuid;
  v_cycle_id uuid;
  v_incident_id uuid;
  v_response jsonb;
  v_event_count integer;
  v_fact_types text[] := array[
    'germination_observed',
    'plant_count_observed',
    'visual_review',
    'development_review',
    'readiness_review',
    'intervention',
    'incident_opened'
  ];
  v_fact_type text;
  v_event_id uuid;
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

  v_response := public.garden_create_garden(gen_random_uuid(), 'Validación temporal cycle fact', 'URUQ', 1);
  v_garden_id := (v_response ->> 'garden_id')::uuid;
  select id into v_position_id
  from garden.positions
  where garden_id = v_garden_id and position_number = 1;
  v_response := public.garden_start_cycle(gen_random_uuid(), v_position_id, 'Cultivo temporal cycle fact', date '2026-09-01', 'exact');
  v_cycle_id := (v_response ->> 'grow_cycle_id')::uuid;

  foreach v_fact_type in array v_fact_types loop
    v_response := case v_fact_type
      when 'germination_observed' then public.garden_record_cycle_fact(gen_random_uuid(), v_cycle_id, v_fact_type, date '2026-09-02', null, '{"count":1}'::jsonb)
      when 'plant_count_observed' then public.garden_record_cycle_fact(gen_random_uuid(), v_cycle_id, v_fact_type, date '2026-09-03', null, '{"count":1,"count_kind":"seedlings_visible"}'::jsonb)
      when 'visual_review' then public.garden_record_cycle_fact(gen_random_uuid(), v_cycle_id, v_fact_type, date '2026-09-04', null, '{"result":"reassuring"}'::jsonb)
      when 'development_review' then public.garden_record_cycle_fact(gen_random_uuid(), v_cycle_id, v_fact_type, date '2026-09-05', null, '{"purpose":"evaluate_thinning","result":"not_yet"}'::jsonb)
      when 'readiness_review' then public.garden_record_cycle_fact(gen_random_uuid(), v_cycle_id, v_fact_type, date '2026-09-06', null, '{"readiness":"evaluate"}'::jsonb)
      when 'intervention' then public.garden_record_cycle_fact(gen_random_uuid(), v_cycle_id, v_fact_type, date '2026-09-07', 'Se retiró la plántula más pequeña.', '{"class":"thinning","count_removed":1}'::jsonb)
      when 'incident_opened' then public.garden_record_cycle_fact(gen_random_uuid(), v_cycle_id, v_fact_type, date '2026-09-08', 'Incidencia temporal de validación.', '{"severity":"watch"}'::jsonb)
    end;
    v_event_id := (v_response ->> 'event_id')::uuid;
    if v_event_id is null then raise exception 'No event returned for %', v_fact_type; end if;
    if not exists (select 1 from garden.events e where e.id = v_event_id and e.grow_cycle_id = v_cycle_id) then
      raise exception 'Event % was not attached to the scalar cycle id for %', v_event_id, v_fact_type;
    end if;
    insert into record_cycle_fact_verification(fact_type, event_id, cycle_id, cycle_id_is_scalar)
    values (v_fact_type, v_event_id, v_cycle_id, true);
  end loop;

  select event_id into v_incident_id
  from record_cycle_fact_verification
  where fact_type = 'incident_opened';
  v_response := public.garden_record_cycle_fact(
    gen_random_uuid(), v_cycle_id, 'incident_resolved', date '2026-09-09',
    'Resolución temporal de validación.', jsonb_build_object('incident_event_id', v_incident_id)
  );
  v_event_id := (v_response ->> 'event_id')::uuid;
  if v_event_id is null or not exists (
    select 1 from garden.events e where e.id = v_event_id and e.grow_cycle_id = v_cycle_id and e.event_type = 'incident_resolved'
  ) then
    raise exception 'Incident resolution did not persist against the scalar cycle id';
  end if;
  insert into record_cycle_fact_verification(fact_type, event_id, cycle_id, cycle_id_is_scalar)
  values ('incident_resolved', v_event_id, v_cycle_id, true);

  select count(*) into v_event_count
  from garden.events
  where grow_cycle_id = v_cycle_id and invalidated_at is null;
  -- Starting the temporary cycle also creates its canonical cycle_started
  -- event, so the fixture contains 7 facts + incident resolution + that
  -- lifecycle event.
  if v_event_count <> 9 then raise exception 'Expected 9 temporary events, got %', v_event_count; end if;
end;
$$;

select * from record_cycle_fact_verification order by fact_type;
rollback;
