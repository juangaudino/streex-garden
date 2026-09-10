-- Ask Garden context must only reference canonical event columns that exist in
-- production. This changes a read-only projection; it never modifies events.
begin;

create or replace function public.garden_get_ai_ask_context()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := (select auth.uid());
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object(
    'context_schema_version', 'garden_ai_ask_context_v1',
    'control_v2', public.garden_get_control_v2(),
    'attention', public.garden_get_attention(),
    'harvest_history', public.garden_get_harvest_history(),
    'recent_changes', coalesce((
      select jsonb_agg(row_to_json(x) order by x.occurred_at desc)
      from (
        select e.id, e.grow_cycle_id, e.event_type, e.occurred_at, e.event_data
        from garden.events e
        where e.owner_id = v_owner and e.invalidated_at is null
        order by e.occurred_at desc
        limit 30
      ) x
    ), '[]'::jsonb),
    'open_incidents', coalesce((
      select jsonb_agg(row_to_json(x) order by x.occurred_at desc)
      from (
        select e.id, e.grow_cycle_id, e.occurred_at, e.event_data
        from garden.events e
        where e.owner_id = v_owner
          and e.event_type = 'incident_opened'
          and e.invalidated_at is null
          and not exists (
            select 1 from garden.events r
            where r.owner_id = v_owner
              and r.event_type = 'incident_resolved'
              and r.invalidated_at is null
              and r.event_data->>'incident_event_id' = e.id::text
          )
        order by e.occurred_at desc
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.garden_get_ai_ask_context() from public, anon, service_role;
grant execute on function public.garden_get_ai_ask_context() to authenticated;

commit;
