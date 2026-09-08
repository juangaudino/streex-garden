-- GX-00 Phase 3: deterministic Control V2. This function projects facts that
-- are already canonical; it persists neither snapshots nor a second status.
begin;

create or replace function public.garden_get_control_v2(p_reference_date date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with reference_date as (
    select coalesce(p_reference_date, current_date) as value
  ), active_sites as (
    select g.id as garden_id, g.owner_id, g.name as garden_name,
      p.id as position_id, p.position_number,
      o.grow_cycle_id, gc.planted_on, gc.planted_on_precision, c.common_name as crop_name
    from garden.gardens g
    join garden.layout_sites s on s.garden_id = g.id and s.site_kind = 'grow' and s.is_active
    join garden.positions p on p.id = s.position_id
    left join garden.cycle_occupancies o on o.position_id = p.id
      and (o.occupied_from is null or o.occupied_from <= (select value from reference_date))
      and (o.occupied_until is null or o.occupied_until > (select value from reference_date))
    left join garden.grow_cycles gc on gc.id = o.grow_cycle_id
    left join garden.crops c on c.id = gc.crop_id
    where g.owner_id = public.garden_owner_id()
  ), fact_rows as (
    select s.*,
      case
        when s.planted_on is null then null
        when s.planted_on > (select value from reference_date) then null
        else (select value from reference_date) - s.planted_on
      end as age_days,
      last_thinning.event as last_thinning,
      thinning_review.event as thinning_review,
      readiness_review.event as readiness_review,
      visual_review.event as visual_review,
      unresolved_incident.event as unresolved_incident,
      post_review_change.event as post_review_change,
      germination.event as germination_event,
      plant_count.event as plant_count_event,
      pending_action.action as pending_action
    from active_sites s
    left join lateral (
      select jsonb_build_object('event_id', e.id, 'occurred_on', coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date), 'note', e.note, 'data', e.event_data) as event
      from garden.events e
      where e.grow_cycle_id = s.grow_cycle_id and e.invalidated_at is null and e.event_type = 'intervention'
        and e.event_data->>'class' = 'thinning'
        and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) <= (select value from reference_date)
      order by e.occurred_at desc, e.id desc limit 1
    ) last_thinning on s.grow_cycle_id is not null
    left join lateral (
      select jsonb_build_object('event_id', e.id, 'occurred_on', coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date), 'result', e.event_data->>'result', 'note', e.note, 'data', e.event_data) as event
      from garden.events e
      where e.grow_cycle_id = s.grow_cycle_id and e.invalidated_at is null and e.event_type = 'development_review'
        and e.event_data->>'purpose' = 'evaluate_thinning'
        and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) <= (select value from reference_date)
      order by e.occurred_at desc, e.id desc limit 1
    ) thinning_review on s.grow_cycle_id is not null
    left join lateral (
      select jsonb_build_object('event_id', e.id, 'occurred_on', coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date), 'value', e.event_data->>'readiness', 'note', e.note, 'data', e.event_data) as event
      from garden.events e
      where e.grow_cycle_id = s.grow_cycle_id and e.invalidated_at is null and e.event_type = 'readiness_review'
        and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) <= (select value from reference_date)
      order by e.occurred_at desc, e.id desc limit 1
    ) readiness_review on s.grow_cycle_id is not null
    left join lateral (
      select jsonb_build_object('event_id', e.id, 'occurred_on', coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date), 'result', e.event_data->>'result', 'note', e.note, 'data', e.event_data) as event
      from garden.events e
      where e.grow_cycle_id = s.grow_cycle_id and e.invalidated_at is null and e.event_type = 'visual_review'
        and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) <= (select value from reference_date)
      order by e.occurred_at desc, e.id desc limit 1
    ) visual_review on s.grow_cycle_id is not null
    left join lateral (
      select jsonb_build_object('event_id', e.id, 'occurred_on', coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date), 'severity', e.event_data->>'severity', 'note', e.note, 'data', e.event_data) as event
      from garden.events e
      where e.grow_cycle_id = s.grow_cycle_id and e.invalidated_at is null and e.event_type = 'incident_opened'
        and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) <= (select value from reference_date)
        and not exists (
          select 1 from garden.events resolution
          where resolution.grow_cycle_id = s.grow_cycle_id and resolution.invalidated_at is null
            and resolution.event_type = 'incident_resolved'
            and resolution.event_data->>'incident_event_id' = e.id::text
            and coalesce(nullif(resolution.event_data->>'occurred_on', '')::date, (resolution.occurred_at at time zone 'UTC')::date) <= (select value from reference_date)
        )
      order by case e.event_data->>'severity' when 'action_required' then 0 else 1 end, e.occurred_at desc, e.id desc limit 1
    ) unresolved_incident on s.grow_cycle_id is not null
    left join lateral (
      select jsonb_build_object('event_id', e.id, 'occurred_on', coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date), 'event_type', e.event_type, 'note', e.note) as event
      from garden.events e
      where e.grow_cycle_id = s.grow_cycle_id and e.invalidated_at is null
        and e.event_type in ('intervention', 'harvest', 'seeds_added', 'cycle_moved')
        and visual_review.event is not null
        and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) > (visual_review.event->>'occurred_on')::date
        and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) <= (select value from reference_date)
      order by e.occurred_at desc, e.id desc limit 1
    ) post_review_change on s.grow_cycle_id is not null
    left join lateral (
      select jsonb_build_object('event_id', e.id, 'occurred_on', coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date), 'count', e.event_data->>'count', 'note', e.note) as event
      from garden.events e
      where e.grow_cycle_id = s.grow_cycle_id and e.invalidated_at is null and e.event_type = 'germination_observed'
        and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) <= (select value from reference_date)
      order by e.occurred_at desc, e.id desc limit 1
    ) germination on s.grow_cycle_id is not null
    left join lateral (
      select jsonb_build_object('event_id', e.id, 'occurred_on', coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date), 'count', e.event_data->>'count', 'count_kind', e.event_data->>'count_kind', 'note', e.note) as event
      from garden.events e
      where e.grow_cycle_id = s.grow_cycle_id and e.invalidated_at is null and e.event_type = 'plant_count_observed'
        and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) <= (select value from reference_date)
      order by e.occurred_at desc, e.id desc limit 1
    ) plant_count on s.grow_cycle_id is not null
    left join lateral (
      select jsonb_build_object('task_id', a.id, 'purpose', a.purpose, 'title', a.title, 'due_on', a.due_on, 'next_review_on', a.next_review_on, 'origin', a.origin) as action
      from garden.attention_items a
      where a.owner_id = s.owner_id and a.grow_cycle_id = s.grow_cycle_id and a.status = 'open'
        and a.created_at::date <= (select value from reference_date)
      order by
        case when a.purpose like 'perform_%' then 0 else 1 end,
        case when coalesce(a.next_review_on, a.due_on) is not null and coalesce(a.next_review_on, a.due_on) <= (select value from reference_date) then 0 else 1 end,
        coalesce(a.next_review_on, a.due_on) nulls last, a.created_at, a.id
      limit 1
    ) pending_action on s.grow_cycle_id is not null
  ), projected_positions as (
    select f.garden_id, f.garden_name, f.position_id, f.position_number, f.grow_cycle_id,
      case
        when f.unresolved_incident->>'severity' = 'action_required' then 'action_required'
        when f.unresolved_incident->>'severity' = 'watch' then 'watch'
        when f.visual_review is null then 'insufficient_evidence'
        when f.visual_review->>'result' = 'reassuring' and f.post_review_change is not null then 'insufficient_evidence'
        else coalesce(f.visual_review->>'result', 'insufficient_evidence')
      end as state_kind,
      case
        when f.pending_action is not null and f.pending_action->>'purpose' = 'perform_thinning' then 'pending'
        when f.pending_action is not null and f.pending_action->>'purpose' = 'evaluate_thinning'
          and coalesce(nullif(f.pending_action->>'next_review_on', '')::date, nullif(f.pending_action->>'due_on', '')::date) <= (select value from reference_date) then 'evaluate_today'
        when f.pending_action is not null and f.pending_action->>'purpose' = 'evaluate_thinning'
          and coalesce(nullif(f.pending_action->>'next_review_on', '')::date, nullif(f.pending_action->>'due_on', '')::date) > (select value from reference_date) then 'scheduled'
        when f.pending_action is not null and f.pending_action->>'purpose' = 'evaluate_thinning' then 'evaluate'
        when f.thinning_review->>'result' = 'not_required' then 'not_required'
        else 'not_scheduled'
      end as thinning_kind,
      jsonb_build_object(
        'position', jsonb_build_object('id', f.position_id, 'number', f.position_number),
        'grow_cycle_id', f.grow_cycle_id,
        'plant', case when f.grow_cycle_id is null then null else jsonb_build_object('name', f.crop_name) end,
        'planting', case when f.grow_cycle_id is null then null else jsonb_build_object('date', f.planted_on, 'precision', f.planted_on_precision) end,
        'age', case when f.age_days is null then jsonb_build_object('days', null, 'status', case when f.planted_on is null then 'unknown' else 'outside_reference_date' end, 'precision', f.planted_on_precision) else jsonb_build_object('days', f.age_days, 'status', 'known', 'precision', f.planted_on_precision) end,
        'last_thinning', f.last_thinning,
        'next_thinning_evaluation', jsonb_build_object('kind',
          case
            when f.pending_action is not null and f.pending_action->>'purpose' = 'perform_thinning' then 'pending'
            when f.pending_action is not null and f.pending_action->>'purpose' = 'evaluate_thinning'
              and coalesce(nullif(f.pending_action->>'next_review_on', '')::date, nullif(f.pending_action->>'due_on', '')::date) <= (select value from reference_date) then 'evaluate_today'
            when f.pending_action is not null and f.pending_action->>'purpose' = 'evaluate_thinning'
              and coalesce(nullif(f.pending_action->>'next_review_on', '')::date, nullif(f.pending_action->>'due_on', '')::date) > (select value from reference_date) then 'scheduled'
            when f.pending_action is not null and f.pending_action->>'purpose' = 'evaluate_thinning' then 'evaluate'
            when f.thinning_review->>'result' = 'not_required' then 'not_required'
            else 'not_scheduled'
          end,
          'task', f.pending_action,
          'evidence', f.thinning_review
        ),
        'harvest_readiness', case
          when f.grow_cycle_id is null then null
          when f.readiness_review is null then jsonb_build_object('value', 'evaluate', 'reason', 'Sin evaluación registrada', 'evidence', null)
          when exists (
            select 1 from garden.events e
            where e.grow_cycle_id = f.grow_cycle_id and e.invalidated_at is null
              and e.event_type in ('intervention', 'harvest', 'seeds_added')
              and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) > (f.readiness_review->>'occurred_on')::date
              and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) <= (select value from reference_date)
          ) then jsonb_build_object('value', 'evaluate', 'reason', 'Cambios posteriores sin evaluar', 'evidence', f.readiness_review)
          else jsonb_build_object('value', f.readiness_review->>'value', 'reason', null, 'evidence', f.readiness_review)
        end,
        'current_state', case
          when f.grow_cycle_id is null then null
          when f.unresolved_incident is not null then jsonb_build_object('kind', f.unresolved_incident->>'severity', 'evidence', f.unresolved_incident, 'reason', 'Incidencia abierta')
          when f.visual_review is null then jsonb_build_object('kind', 'insufficient_evidence', 'evidence', null, 'reason', 'Sin evaluación registrada')
          when f.visual_review->>'result' = 'reassuring' and f.post_review_change is not null then jsonb_build_object('kind', 'insufficient_evidence', 'evidence', f.visual_review, 'reason', 'Cambios posteriores sin evaluar', 'change_after_evidence', f.post_review_change)
          else jsonb_build_object('kind', f.visual_review->>'result', 'evidence', f.visual_review, 'reason', null)
        end,
        'germination', case when f.grow_cycle_id is null then null when f.germination_event is null then jsonb_build_object('status', 'no_observation', 'evidence', null) else jsonb_build_object('status', 'confirmed', 'evidence', f.germination_event) end,
        'plant_count', f.plant_count_event,
        'action', f.pending_action
      ) as position
    from fact_rows f
  ), garden_views as (
    select p.garden_id, max(p.garden_name) as garden_name,
      jsonb_agg(p.position order by p.position_number) as positions,
      jsonb_strip_nulls(jsonb_build_object(
        'todo_bien', case when count(*) filter (where p.grow_cycle_id is not null and p.state_kind = 'reassuring') > 0 then jsonb_build_object('count', count(*) filter (where p.grow_cycle_id is not null and p.state_kind = 'reassuring'), 'positions', jsonb_agg(p.position_number order by p.position_number) filter (where p.grow_cycle_id is not null and p.state_kind = 'reassuring')) end,
        'pendiente_vigilar', case when count(*) filter (where p.grow_cycle_id is not null and (p.state_kind = 'watch' or p.thinning_kind in ('pending', 'evaluate_today', 'evaluate', 'scheduled'))) > 0 then jsonb_build_object('count', count(*) filter (where p.grow_cycle_id is not null and (p.state_kind = 'watch' or p.thinning_kind in ('pending', 'evaluate_today', 'evaluate', 'scheduled'))), 'positions', jsonb_agg(p.position_number order by p.position_number) filter (where p.grow_cycle_id is not null and (p.state_kind = 'watch' or p.thinning_kind in ('pending', 'evaluate_today', 'evaluate', 'scheduled')))) end,
        'requiere_atencion', case when count(*) filter (where p.grow_cycle_id is not null and p.state_kind = 'action_required') > 0 then jsonb_build_object('count', count(*) filter (where p.grow_cycle_id is not null and p.state_kind = 'action_required'), 'positions', jsonb_agg(p.position_number order by p.position_number) filter (where p.grow_cycle_id is not null and p.state_kind = 'action_required')) end,
        'sin_evaluacion_suficiente', case when count(*) filter (where p.grow_cycle_id is not null and p.state_kind = 'insufficient_evidence') > 0 then jsonb_build_object('count', count(*) filter (where p.grow_cycle_id is not null and p.state_kind = 'insufficient_evidence'), 'positions', jsonb_agg(p.position_number order by p.position_number) filter (where p.grow_cycle_id is not null and p.state_kind = 'insufficient_evidence')) end
      )) as summary,
      jsonb_build_object(
        'occupied_positions', count(*) filter (where p.grow_cycle_id is not null),
        'confirmed_positions', count(*) filter (where p.grow_cycle_id is not null and p.position->'germination'->>'status' = 'confirmed')
      ) as germination_coverage
    from projected_positions p
    group by p.garden_id
  )
  select jsonb_build_object(
    'reference_date', (select value from reference_date),
    'interpretation', 'Estado para esa fecha reconstruido utilizando la evidencia válida/corregida disponible actualmente.',
    'gardens', coalesce((select jsonb_agg(jsonb_build_object(
      'garden_id', gv.garden_id,
      'garden_name', gv.garden_name,
      'summary', gv.summary,
      'germination_coverage', gv.germination_coverage,
      'shared_actions', coalesce((select jsonb_agg(jsonb_build_object('task_id', a.id, 'purpose', a.purpose, 'title', a.title, 'due_on', a.due_on, 'next_review_on', a.next_review_on, 'origin', a.origin) order by coalesce(a.next_review_on, a.due_on) nulls last, a.created_at, a.id) from garden.attention_items a where a.owner_id = public.garden_owner_id() and a.garden_id = gv.garden_id and a.grow_cycle_id is null and a.status = 'open' and a.created_at::date <= (select value from reference_date)), '[]'::jsonb),
      'relevant_facts', coalesce((select jsonb_agg(jsonb_build_object('event_id', e.id, 'event_type', e.event_type, 'occurred_on', coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date), 'note', e.note) order by e.occurred_at desc, e.id desc) from (select e.* from garden.events e where e.garden_id = gv.garden_id and e.invalidated_at is null and e.event_type in ('harvest', 'intervention', 'system_maintenance') and coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) <= (select value from reference_date) order by e.occurred_at desc, e.id desc limit 5) e), '[]'::jsonb),
      'positions', gv.positions
    ) order by gv.garden_name) from garden_views gv), '[]'::jsonb),
    'positions', coalesce((select jsonb_agg(position order by garden_name, position_number) from projected_positions), '[]'::jsonb)
  );
$$;

-- Keep current clients functional while a deployment switches to the richer
-- parameterized projection. This compatibility RPC has the old array shape.
create or replace function public.garden_get_control_v2()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.garden_get_control_v2(current_date)->'positions', '[]'::jsonb)
$$;

revoke all on function public.garden_get_control_v2(date) from public;
revoke all on function public.garden_get_control_v2() from public;
grant execute on function public.garden_get_control_v2(date) to authenticated;
grant execute on function public.garden_get_control_v2() to authenticated;

commit;
