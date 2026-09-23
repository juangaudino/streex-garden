-- Share Story configuration and garden-level maintenance.
-- Canonical plant photos/events remain untouched. Share configuration is an
-- owner-scoped delivery concern and system maintenance is one garden event.
begin;

alter table garden.ai_requests drop constraint if exists ai_requests_request_type_check;
alter table garden.ai_requests add constraint ai_requests_request_type_check
  check (request_type in ('ai_check', 'ask_garden', 'identify', 'meaningful_change', 'garden_summary_global', 'garden_summary_local', 'share_caption'));

create or replace function public.garden_ai_start_request(
  p_request_key text,
  p_request_type text,
  p_evidence_refs jsonb,
  p_proposal_schema_version text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := (select auth.uid());
  v_row garden.ai_requests;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_request_key is null or length(trim(p_request_key)) < 16 or length(trim(p_request_key)) > 160 then raise exception 'Invalid request key'; end if;
  if p_request_type not in ('ai_check', 'ask_garden', 'identify', 'meaningful_change', 'garden_summary_global', 'garden_summary_local', 'share_caption') then raise exception 'Invalid request type'; end if;
  insert into garden.ai_requests(owner_id, request_key, request_type, evidence_refs, status, garden_ai_standard_version, context_schema_version, proposal_schema_version, prompt_version, provider_adapter_version)
  values (v_owner, trim(p_request_key), p_request_type, coalesce(p_evidence_refs, '[]'::jsonb), 'started', 'garden_ai_standard_v1', 'garden_ai_context_v1', coalesce(nullif(trim(p_proposal_schema_version), ''), 'garden_ai_ask_v1'), 'garden_ai_runtime_v4', 'openai_responses_v1')
  on conflict (owner_id, request_key) do nothing;
  select * into v_row from garden.ai_requests where owner_id = v_owner and request_key = trim(p_request_key);
  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'proposal', v_row.proposal, 'model_identifier', v_row.model_identifier);
end;
$$;

alter table garden.guest_plant_stories
  add column if not exists hero_photo_id uuid references garden.photos(id) on delete set null,
  add column if not exists caption_overrides jsonb not null default '{}'::jsonb;

alter table garden.guest_plant_stories
  drop constraint if exists guest_plant_stories_caption_overrides_object;
alter table garden.guest_plant_stories
  add constraint guest_plant_stories_caption_overrides_object
  check (jsonb_typeof(caption_overrides) = 'object');

create or replace function public.garden_create_guest_plant_story_v2(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_token_hash text,
  p_item_selection jsonb default '[]'::jsonb,
  p_hero_photo_id uuid default null,
  p_caption_overrides jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_story_id uuid;
  v_item jsonb;
  v_key text;
  v_value jsonb;
  v_photo_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(coalesce(p_caption_overrides, '{}'::jsonb)) <> 'object' then raise exception 'Caption overrides must be an object'; end if;

  v_response := public.garden_create_guest_plant_story(p_request_id, p_grow_cycle_id, p_token_hash, p_item_selection);
  v_story_id := nullif(v_response->>'story_id', '')::uuid;
  if v_story_id is null then return v_response; end if;

  if p_hero_photo_id is not null then
    if not exists (
      select 1 from jsonb_array_elements(coalesce(p_item_selection, '[]'::jsonb)) item
      where nullif(item->>'photo_id', '')::uuid = p_hero_photo_id
    ) then raise exception 'Hero photo must be part of the story selection'; end if;
    if not exists (
      select 1
      from garden.photos ph
      left join garden.events ev on ev.id = ph.event_id and ev.owner_id = v_owner
      where ph.id = p_hero_photo_id and ph.owner_id = v_owner and ph.upload_status = 'uploaded'
        and (ev.grow_cycle_id = p_grow_cycle_id or (ph.media_scope = 'cycle_evidence' and ph.import_provenance->>'grow_cycle_id' = p_grow_cycle_id::text))
    ) then raise exception 'Hero photo is not available for this cycle'; end if;
  end if;

  for v_key, v_value in select key, value from jsonb_each(coalesce(p_caption_overrides, '{}'::jsonb)) loop
    if jsonb_typeof(v_value) not in ('string', 'null') then raise exception 'Caption overrides must contain text or null'; end if;
    if v_value is not null and char_length(v_value #>> '{}') > 240 then raise exception 'Share caption is too long'; end if;
    v_photo_id := nullif(v_key, '')::uuid;
    if v_photo_id is not null and not exists (
      select 1 from jsonb_array_elements(coalesce(p_item_selection, '[]'::jsonb)) item
      where nullif(item->>'photo_id', '')::uuid = v_photo_id
    ) then raise exception 'Caption photo must be part of the story selection'; end if;
  end loop;

  update garden.guest_plant_stories
  set hero_photo_id = p_hero_photo_id,
      caption_overrides = coalesce(p_caption_overrides, '{}'::jsonb)
  where id = v_story_id and owner_id = v_owner;
  return v_response || jsonb_build_object('hero_photo_id', p_hero_photo_id);
end;
$$;

create or replace function public.garden_get_guest_plant_story_v2(p_token_hash text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_story garden.guest_plant_stories%rowtype;
  v_base jsonb;
begin
  -- Preserve the trusted resolver's existing authorization and selected-item
  -- filtering, then expose only explicit Share Story configuration.
  select s.* into v_story from garden.guest_plant_stories s where s.token_hash = p_token_hash and s.revoked_at is null;
  if not found then raise exception 'Guest story not found'; end if;
  v_base := public.garden_get_guest_plant_story(p_token_hash);
  return v_base || jsonb_build_object('hero_photo_id', v_story.hero_photo_id, 'caption_overrides', v_story.caption_overrides);
end;
$$;

create or replace function public.garden_x_record_system_maintenance(
  p_request_id uuid,
  p_garden_id uuid,
  p_action text,
  p_occurred_on date,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_event_id uuid;
  v_class text;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_action not in ('water_change', 'nutrients', 'water_and_nutrients') then raise exception 'Invalid system maintenance action'; end if;
  if p_occurred_on is null then raise exception 'Maintenance date is required'; end if;
  if not exists (select 1 from garden.gardens where id = p_garden_id and owner_id = v_owner and archived_at is null) then raise exception 'Garden not found'; end if;
  select response into v_response from garden.command_receipts where owner_id = v_owner and request_id = p_request_id and command_name = 'garden_x_record_system_maintenance';
  if found then return v_response; end if;
  v_class := case p_action when 'water_change' then 'water_change' when 'nutrients' then 'nutrients' else 'water_and_nutrients' end;
  insert into garden.events(owner_id, garden_id, grow_cycle_id, event_type, occurred_at, note, event_data)
  values (v_owner, p_garden_id, null, 'system_maintenance', p_occurred_on::timestamptz, nullif(trim(p_note), ''), jsonb_build_object('class', v_class, 'source', 'garden_detail', 'occurred_on', p_occurred_on, 'occurred_at_precision', 'date'))
  returning id into v_event_id;
  v_response := jsonb_build_object('event_id', v_event_id, 'garden_id', p_garden_id, 'action', p_action, 'occurred_on', p_occurred_on);
  insert into garden.command_receipts(owner_id, request_id, command_name, response) values (v_owner, p_request_id, 'garden_x_record_system_maintenance', v_response);
  return v_response;
end;
$$;

create or replace function public.garden_get_system_maintenance_events()
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'plant_instance_id', null,
    'grow_cycle_id', null,
    'garden_id', e.garden_id,
    'event_type', e.event_type,
    'occurred_at', e.occurred_at,
    'created_at', e.created_at,
    'note', e.note,
    'event_data', e.event_data,
    'revision', e.revision
  ) order by e.occurred_at desc, e.created_at desc), '[]'::jsonb)
  from garden.events e
  where e.owner_id = public.garden_owner_id()
    and e.grow_cycle_id is null
    and e.event_type = 'system_maintenance'
    and e.invalidated_at is null;
$$;

create or replace function public.garden_get_ai_garden_maintenance_context(p_grow_cycle_id uuid)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'garden_id', e.garden_id,
    'event_type', e.event_type,
    'occurred_at', e.occurred_at,
    'occurred_on', e.event_data->>'occurred_on',
    'class', e.event_data->>'class',
    'note', e.note,
    'provenance', 'recorded_system_maintenance'
  ) order by e.occurred_at desc, e.id desc), '[]'::jsonb)
  from garden.events e
  join garden.grow_cycles gc on gc.id = p_grow_cycle_id and gc.owner_id = public.garden_owner_id()
  where e.owner_id = public.garden_owner_id()
    and e.garden_id = (select p.garden_id from garden.cycle_occupancies o join garden.positions p on p.id = o.position_id where o.grow_cycle_id = gc.id and o.occupied_until is null order by o.created_at desc limit 1)
    and e.grow_cycle_id is null
    and e.event_type = 'system_maintenance'
    and e.invalidated_at is null;
$$;

revoke all on function public.garden_create_guest_plant_story_v2(uuid, uuid, text, jsonb, uuid, jsonb) from public, anon, service_role;
grant execute on function public.garden_create_guest_plant_story_v2(uuid, uuid, text, jsonb, uuid, jsonb) to authenticated;
revoke all on function public.garden_get_guest_plant_story_v2(text) from public, anon, authenticated;
grant execute on function public.garden_get_guest_plant_story_v2(text) to service_role;
revoke all on function public.garden_x_record_system_maintenance(uuid, uuid, text, date, text) from public, anon, service_role;
grant execute on function public.garden_x_record_system_maintenance(uuid, uuid, text, date, text) to authenticated;
revoke all on function public.garden_get_system_maintenance_events() from public, anon, service_role;
grant execute on function public.garden_get_system_maintenance_events() to authenticated;
revoke all on function public.garden_get_ai_garden_maintenance_context(uuid) from public, anon, service_role;
grant execute on function public.garden_get_ai_garden_maintenance_context(uuid) to authenticated;

create or replace function public.garden_get_garden_summary_context(
  p_scope_type text,
  p_garden_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_owner uuid := (select auth.uid());
  v_context jsonb;
  v_fingerprint_source jsonb;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_scope_type not in ('global', 'garden') then raise exception 'Invalid summary scope'; end if;
  if p_scope_type = 'garden' and (p_garden_id is null or not exists (select 1 from garden.gardens where id = p_garden_id and owner_id = v_owner and archived_at is null)) then raise exception 'Garden not found'; end if;

  -- Recency is evidence-specific: current active cycles/status and open
  -- attention remain in scope, canonical activity uses 21 days, B1 results
  -- 90 days, and AI Checks 60 days. This keeps the packet bounded without
  -- treating every evidence type as if it had the same shelf life.
  with scope_gardens as (
    select g.id, g.name
    from garden.gardens g
    where g.owner_id = v_owner and g.archived_at is null
      and (p_scope_type = 'global' or g.id = p_garden_id)
  ), scope_cycles as (
    select gc.id, gc.plant_instance_id, gc.state, gc.harvest_readiness, gc.planted_on, gc.planted_on_precision, g.id as garden_id, g.name as garden_name
    from garden.grow_cycles gc
    join garden.plant_instances pi on pi.id = gc.plant_instance_id and pi.owner_id = v_owner and pi.status = 'active'
    join garden.cycle_occupancies co on co.grow_cycle_id = gc.id and co.occupied_until is null
    join garden.positions p on p.id = co.position_id
    join scope_gardens g on g.id = p.garden_id
    where gc.owner_id = v_owner and gc.state = 'active'
  ), plant_rows as (
    select sc.plant_instance_id, sc.garden_id, sc.garden_name, pi.nickname, pi.common_name, pi.scientific_name, pi.cultivar, pi.status as instance_status,
      sc.id as grow_cycle_id, sc.planted_on, sc.planted_on_precision, sc.harvest_readiness,
      (select count(*)::int from garden.attention_items a where a.owner_id = v_owner and a.status = 'open' and a.grow_cycle_id = sc.id) as open_attention_count
    from scope_cycles sc join garden.plant_instances pi on pi.id = sc.plant_instance_id
  ), event_rows as (
    select e.id, e.grow_cycle_id, e.garden_id, e.event_type, e.occurred_at, e.note, e.event_data,
      coalesce(pr.nickname, pr.common_name, 'Plant') as plant_name
    from garden.events e
    join scope_cycles sc on sc.id = e.grow_cycle_id
    left join plant_rows pr on pr.grow_cycle_id = e.grow_cycle_id
    where e.owner_id = v_owner and e.invalidated_at is null and e.event_type <> 'photo' and e.occurred_at >= now() - interval '21 days'
    order by e.occurred_at desc, e.id desc
    limit 40
  ), maintenance_rows as (
    select e.id, e.garden_id, e.event_type, e.occurred_at, e.note, e.event_data
    from garden.events e
    where e.owner_id = v_owner and e.grow_cycle_id is null and e.event_type = 'system_maintenance' and e.invalidated_at is null
      and exists (select 1 from scope_gardens sg where sg.id = e.garden_id)
      and e.occurred_at >= now() - interval '21 days'
    order by e.occurred_at desc, e.id desc
    limit 20
  ), attention_rows as (
    select a.id, a.garden_id, a.grow_cycle_id, a.purpose, a.subject_key, a.title, a.origin, a.status, a.due_on, a.next_review_on, a.created_at, a.updated_at
    from garden.attention_items a
    where a.owner_id = v_owner and a.status = 'open'
      and (exists (select 1 from scope_gardens sg where sg.id = a.garden_id) or exists (select 1 from scope_cycles sc where sc.id = a.grow_cycle_id))
    order by coalesce(a.next_review_on, a.due_on) nulls last, a.created_at desc, a.id desc
    limit 40
  ), b1_rows as (
    select r.id, r.created_at, r.completed_at, r.proposal
    from garden.ai_requests r
    where r.owner_id = v_owner and r.request_type = 'meaningful_change' and r.status = 'completed' and r.proposal is not null
      and r.created_at >= now() - interval '90 days'
      and exists (
        select 1
        from scope_cycles sc
        where sc.plant_instance_id = case
          when r.proposal->>'plant_instance_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (r.proposal->>'plant_instance_id')::uuid
          else null
        end
      )
    order by r.created_at desc, r.id desc
    limit 24
  ), ai_rows as (
    select r.id, r.created_at, r.completed_at, r.proposal, r.evidence_refs
    from garden.ai_requests r
    where r.owner_id = v_owner and r.request_type = 'ai_check' and r.status = 'completed' and r.proposal is not null
      and r.created_at >= now() - interval '60 days'
      and exists (
        select 1
        from jsonb_array_elements(coalesce(r.evidence_refs, '[]'::jsonb)) ref
        join garden.photos ph on ph.id = case
          when ref->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (ref->>'id')::uuid
          else null
        end and ph.owner_id = v_owner
        join scope_cycles sc on sc.id = ph.grow_cycle_id
        where ref->>'kind' = 'photo'
      )
    order by r.created_at desc, r.id desc
    limit 24
  )
  select jsonb_build_object(
    'context_schema_version', 'garden_summary_context_v1',
    'scope_type', p_scope_type,
    'scope_id', case when p_scope_type = 'garden' then p_garden_id else null end,
    'gardens', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by id) from scope_gardens), '[]'::jsonb),
    'plants', coalesce((select jsonb_agg(jsonb_build_object('plant_instance_id', plant_instance_id, 'garden_id', garden_id, 'garden_name', garden_name, 'name', coalesce(nullif(trim(nickname),''), common_name), 'common_name', common_name, 'cultivar', cultivar, 'status', case when open_attention_count > 0 then 'watching' else 'steady' end, 'instance_state', instance_status, 'grow_cycle_id', grow_cycle_id, 'planted_on', planted_on, 'planted_on_precision', planted_on_precision, 'harvest_readiness', harvest_readiness, 'open_attention_count', open_attention_count) order by garden_id, plant_instance_id) from plant_rows), '[]'::jsonb),
    'open_attention', coalesce((select jsonb_agg(to_jsonb(attention_rows) order by coalesce(next_review_on, due_on) nulls last, created_at desc, id) from attention_rows), '[]'::jsonb),
    'recent_events', coalesce((select jsonb_agg(to_jsonb(event_rows) order by occurred_at desc, id desc) from event_rows), '[]'::jsonb),
    'garden_maintenance', coalesce((select jsonb_agg(to_jsonb(maintenance_rows) order by occurred_at desc, id desc) from maintenance_rows), '[]'::jsonb),
    'meaningful_changes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at, 'completed_at', completed_at, 'proposal', proposal) order by created_at desc, id desc) from b1_rows), '[]'::jsonb),
    'ai_checks', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at, 'completed_at', completed_at, 'proposal', proposal) order by created_at desc, id desc) from ai_rows), '[]'::jsonb)
  ) into v_context
  from scope_gardens limit 1;

  if v_context is null then
    v_context := jsonb_build_object('context_schema_version', 'garden_summary_context_v1', 'scope_type', p_scope_type, 'scope_id', case when p_scope_type = 'garden' then p_garden_id else null end, 'gardens', '[]'::jsonb, 'plants', '[]'::jsonb, 'open_attention', '[]'::jsonb, 'recent_events', '[]'::jsonb, 'garden_maintenance', '[]'::jsonb, 'meaningful_changes', '[]'::jsonb, 'ai_checks', '[]'::jsonb);
  end if;

  -- Keep technical completion/update timestamps out of the identity. The
  -- material fields below change only when the briefing evidence changes.
  v_fingerprint_source := jsonb_build_object(
    'scope_type', v_context->>'scope_type',
    'scope_id', v_context->>'scope_id',
    'gardens', v_context->'gardens',
    'plants', v_context->'plants',
    'open_attention', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'garden_id', garden_id, 'grow_cycle_id', grow_cycle_id,
      'purpose', purpose, 'subject_key', subject_key, 'title', title,
      'origin', origin, 'status', status, 'due_on', due_on,
      'next_review_on', next_review_on
    ) order by id) from attention_rows), '[]'::jsonb),
    'recent_events', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'grow_cycle_id', grow_cycle_id, 'garden_id', garden_id,
      'event_type', event_type, 'occurred_at', occurred_at, 'note', note,
      'event_data', event_data
    ) order by occurred_at desc, id desc) from event_rows), '[]'::jsonb),
    'garden_maintenance', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'garden_id', garden_id, 'event_type', event_type, 'occurred_at', occurred_at, 'note', note,
      'event_data', event_data, 'provenance', 'recorded_system_maintenance'
    ) order by occurred_at desc, id desc) from maintenance_rows), '[]'::jsonb),
    'meaningful_changes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'proposal', proposal) order by id) from b1_rows), '[]'::jsonb),
    'ai_checks', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'proposal', proposal, 'evidence_refs', evidence_refs) order by id) from ai_rows), '[]'::jsonb)
  );
  return v_context || jsonb_build_object('material_fingerprint', md5(v_fingerprint_source::text));
end;
$$;
revoke all on function public.garden_get_garden_summary_context(text, uuid) from public, anon, service_role;
grant execute on function public.garden_get_garden_summary_context(text, uuid) to authenticated;

commit;
