-- GX-00 precision semantics: preserve bounded historical knowledge without
-- pretending it is an exact observation or count.
begin;

alter table garden.events drop constraint if exists events_event_type_check;
alter table garden.events add constraint events_event_type_check check (event_type in (
  'observation', 'planting', 'harvest', 'action', 'cycle_started', 'cycle_ended', 'cycle_moved',
  'seeds_added', 'germination_observed', 'germination_confirmed', 'plant_count_observed',
  'visual_review', 'development_review', 'intervention', 'incident_opened', 'incident_resolved',
  'system_maintenance', 'measurement', 'readiness_review'
));

-- A confirmation-by event records knowledge of a cutoff date. Its technical
-- occurred_at is deliberately non-semantic; consumers must use confirmed_by.
-- Exact germination_observed events retain their existing meaning.

alter function public.garden_get_control_v2(date) rename to garden_get_control_v2_legacy;

create or replace function public.garden_get_control_v2(p_reference_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_reference date := coalesce(p_reference_date, current_date);
  v_payload jsonb := public.garden_get_control_v2_legacy(v_reference);
  v_positions jsonb := '[]'::jsonb;
  v_position jsonb;
  v_cycle uuid;
  v_germination jsonb;
  v_seed_count jsonb;
  v_updated jsonb;
  v_gardens jsonb := '[]'::jsonb;
  v_garden jsonb;
  v_garden_id uuid;
begin
  for v_position in select value from jsonb_array_elements(coalesce(v_payload->'positions', '[]'::jsonb)) loop
    v_cycle := nullif(v_position->>'grow_cycle_id', '')::uuid;
    v_germination := null;
    if v_cycle is not null then
      select jsonb_build_object(
        'event_id', e.id,
        'occurred_on', case when e.event_type = 'germination_observed' then coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) else null end,
        'confirmed_by', case when e.event_type = 'germination_confirmed' then nullif(e.event_data->>'confirmed_by', '')::date else null end,
        'confirmation_status', case when e.event_type = 'germination_confirmed' then 'confirmed' else null end,
        'note', e.note,
        'data', e.event_data
      ) into v_germination
      from garden.events e
      where e.grow_cycle_id = v_cycle and e.invalidated_at is null
        and ((e.event_type = 'germination_observed' and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) <= v_reference)
          or (e.event_type = 'germination_confirmed' and nullif(e.event_data->>'confirmed_by', '')::date <= v_reference))
      order by case when e.event_type = 'germination_observed' then 0 else 1 end, e.occurred_at desc, e.id desc limit 1;
      select jsonb_build_object(
        'count', case when e.event_data ? 'count' and e.event_data->>'count' ~ '^[0-9]+$' then (e.event_data->>'count')::integer else null end,
        'count_min', case when e.event_data ? 'count_min' and e.event_data->>'count_min' ~ '^[0-9]+$' then (e.event_data->>'count_min')::integer else null end,
        'count_precision', coalesce(e.event_data->>'count_precision', case when e.event_data ? 'count' then 'exact' else 'unknown' end),
        'event_id', e.id, 'occurred_on', coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date), 'note', e.note
      ) into v_seed_count
      from garden.events e
      where e.grow_cycle_id = v_cycle and e.invalidated_at is null and e.event_type = 'seeds_added'
        and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) <= v_reference
      order by e.occurred_at desc, e.id desc limit 1;
    end if;
    v_updated := jsonb_set(v_position, '{germination}', coalesce(jsonb_build_object('status', case when v_germination is null then 'no_observation' else 'confirmed' end, 'evidence', v_germination), '{}'::jsonb), true);
    v_updated := jsonb_set(v_updated, '{seed_count}', coalesce(v_seed_count, jsonb_build_object('count', null, 'count_min', null, 'count_precision', 'unknown')), true);
    v_positions := v_positions || jsonb_build_array(v_updated);
  end loop;
  v_payload := jsonb_set(v_payload, '{positions}', v_positions, true);
  for v_garden in select value from jsonb_array_elements(coalesce(v_payload->'gardens', '[]'::jsonb)) loop
    v_garden_id := nullif(v_garden->>'garden_id', '')::uuid;
    v_garden := jsonb_set(v_garden, '{positions}', coalesce((select jsonb_agg(p order by (p->'position'->>'number')::integer) from jsonb_array_elements(v_positions) p where (p->>'garden_id')::uuid = v_garden_id), '[]'::jsonb), true);
    v_gardens := v_gardens || jsonb_build_array(v_garden);
  end loop;
  return jsonb_set(v_payload, '{gardens}', v_gardens, true);
end;
$$;

revoke all on function public.garden_get_control_v2_legacy(date) from public;
revoke all on function public.garden_get_control_v2(date) from public;
grant execute on function public.garden_get_control_v2(date) to authenticated;

commit;
