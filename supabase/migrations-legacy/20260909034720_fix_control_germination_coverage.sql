-- Fix GX-00 compatibility projection: nested Garden positions must resolve
-- germination_confirmed evidence and refresh garden-level coverage.
begin;

create or replace function public.garden_get_control_v2(p_reference_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_reference date := coalesce(p_reference_date, current_date);
  v_payload jsonb := public.garden_get_control_v2_legacy(v_reference);
  v_gardens jsonb := '[]'::jsonb;
  v_garden jsonb;
  v_positions jsonb;
  v_position jsonb;
  v_updated jsonb;
  v_cycle uuid;
  v_evidence jsonb;
  v_confirmed integer;
begin
  for v_garden in select value from jsonb_array_elements(coalesce(v_payload->'gardens', '[]'::jsonb)) loop
    v_positions := '[]'::jsonb;
    v_confirmed := 0;
    for v_position in select value from jsonb_array_elements(coalesce(v_garden->'positions', '[]'::jsonb)) loop
      v_cycle := nullif(v_position->>'grow_cycle_id', '')::uuid;
      v_evidence := null;
      if v_cycle is not null then
        select jsonb_build_object(
          'event_id', e.id,
          'occurred_on', case when e.event_type = 'germination_observed' then coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) else null end,
          'confirmed_by', case when e.event_type = 'germination_confirmed' then nullif(e.event_data->>'confirmed_by', '')::date else null end,
          'confirmation_status', case when e.event_type = 'germination_confirmed' then 'confirmed' else null end,
          'note', e.note,
          'data', e.event_data
        ) into v_evidence
        from garden.events e
        where e.grow_cycle_id = v_cycle and e.invalidated_at is null
          and ((e.event_type = 'germination_observed' and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) <= v_reference)
            or (e.event_type = 'germination_confirmed' and nullif(e.event_data->>'confirmed_by', '')::date <= v_reference))
        order by case when e.event_type = 'germination_observed' then 0 else 1 end, e.occurred_at desc, e.id desc
        limit 1;
      end if;
      v_updated := jsonb_set(v_position, '{germination}', jsonb_build_object('status', case when v_evidence is null then 'no_observation' else 'confirmed' end, 'evidence', v_evidence), true);
      if v_evidence is not null then v_confirmed := v_confirmed + 1; end if;
      v_positions := v_positions || jsonb_build_array(v_updated);
    end loop;
    v_garden := jsonb_set(v_garden, '{positions}', v_positions, true);
    v_garden := jsonb_set(v_garden, '{germination_coverage,confirmed_positions}', to_jsonb(v_confirmed), true);
    v_gardens := v_gardens || jsonb_build_array(v_garden);
  end loop;
  return jsonb_set(v_payload, '{gardens}', v_gardens, true);
end;
$$;

revoke all on function public.garden_get_control_v2(date) from public;
grant execute on function public.garden_get_control_v2(date) to authenticated;

commit;
