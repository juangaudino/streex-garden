-- Garden X Production canonical schema baseline.
--
-- This file represents schema only. It intentionally excludes Auth, Storage,
-- Supabase-managed schemas, migration metadata, and application rows.
-- garden_lab is temporary legacy compatibility state; its restored rows are
-- intentionally not part of this baseline.
--
-- PostgreSQL database dump
--

\restrict M3r0BjXnhdIizWaT84KvdCAfpBEG6B4Zbn4TTjEJwoKdQz8bnvAYcjdfPoaKRIy

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: garden; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA garden;


--
-- Name: garden_lab; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA garden_lab;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: assert_event_subject_integrity(); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.assert_event_subject_integrity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_garden_id uuid;
  v_owner_id uuid;
begin
  if new.grow_cycle_id is not null then
    select p.garden_id, gc.owner_id into v_garden_id, v_owner_id
    from garden.grow_cycles gc
    join garden.cycle_occupancies o on o.grow_cycle_id = gc.id
    join garden.positions p on p.id = o.position_id
    where gc.id = new.grow_cycle_id
    order by (o.occupied_until is null) desc, o.created_at desc
    limit 1;
    if v_garden_id is null or v_owner_id <> new.owner_id then raise exception 'Cycle subject not found'; end if;
    if new.garden_id is null then new.garden_id := v_garden_id;
    elsif new.garden_id <> v_garden_id then raise exception 'Cycle and garden subjects do not match'; end if;
  else
    select owner_id into v_owner_id from garden.gardens where id = new.garden_id;
    if v_owner_id is null or v_owner_id <> new.owner_id then raise exception 'Garden subject not found'; end if;
  end if;
  return new;
end;
$$;


--
-- Name: assert_occupancy_integrity(); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.assert_occupancy_integrity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid;
  v_closing_open_occupancy boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_closing_open_occupancy := old.occupied_until is null and new.occupied_until is not null;
  end if;

  select g.owner_id into v_owner
  from garden.positions p join garden.gardens g on g.id = p.garden_id
  where p.id = new.position_id;
  if v_owner is null then raise exception 'Position not found'; end if;
  if not exists (
    select 1 from garden.grow_cycles gc
    where gc.id = new.grow_cycle_id and gc.owner_id = v_owner
  ) then
    raise exception 'Cycle and position must belong to the same owner';
  end if;

  if new.occupied_from is not null and not v_closing_open_occupancy and exists (
    select 1
    from garden.cycle_occupancies o
    where o.position_id = new.position_id
      and o.id is distinct from new.id
      and o.occupied_from is not null
      and o.occupied_until is not null
      and new.occupied_until is not null
      and daterange(o.occupied_from, o.occupied_until, '[)')
          && daterange(new.occupied_from, new.occupied_until, '[)')
  ) then
    raise exception 'Known occupancy dates overlap';
  end if;

  return new;
end;
$$;


--
-- Name: attention_assert_subject(uuid, uuid, uuid); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.attention_assert_subject(p_owner uuid, p_garden_id uuid, p_grow_cycle_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_garden_id uuid;
begin
  if p_grow_cycle_id is not null then
    select p.garden_id into v_garden_id
    from garden.grow_cycles gc join garden.cycle_occupancies o on o.grow_cycle_id = gc.id
    join garden.positions p on p.id = o.position_id
    where gc.id = p_grow_cycle_id and gc.owner_id = p_owner and gc.state = 'active'
    order by o.created_at limit 1;
    if v_garden_id is null then raise exception 'Current grow cycle not found'; end if;
    if p_garden_id is not null and p_garden_id <> v_garden_id then raise exception 'Task subject does not match garden'; end if;
    return v_garden_id;
  end if;
  if p_garden_id is null or not exists (select 1 from garden.gardens where id = p_garden_id and owner_id = p_owner) then
    raise exception 'Garden subject not found';
  end if;
  return p_garden_id;
end;
$$;


--
-- Name: attention_purpose_title(text); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.attention_purpose_title(p_purpose text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select case p_purpose
    when 'evaluate_visual_review' then 'Revisar visualmente'
    when 'evaluate_thinning' then 'Evaluar aclareo'
    when 'evaluate_pruning' then 'Evaluar poda'
    when 'evaluate_support' then 'Evaluar soporte'
    when 'perform_thinning' then 'Realizar aclareo'
    when 'perform_pruning' then 'Realizar poda'
    when 'perform_support' then 'Instalar soporte'
    when 'perform_support_remove' then 'Retirar soporte'
    when 'perform_harvest' then 'Realizar cosecha'
    when 'perform_water_change' then 'Cambiar toda el agua'
    when 'perform_refill' then 'Rellenar agua'
    when 'perform_nutrients' then 'Añadir nutrientes'
    when 'perform_cleaning' then 'Limpiar el sistema'
  end
$$;


--
-- Name: cleanup_expired_ai_requests(); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.cleanup_expired_ai_requests() RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_deleted integer;
begin
  update garden.ai_requests
  set proposal = null,
      proposal_decision = null
  where proposal_expires_at <= now()
    and proposal is not null;

  delete from garden.ai_requests
  where audit_expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;


--
-- Name: command_response(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.command_response(p_owner uuid, p_request_id uuid, p_command_name text, p_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_response jsonb;
  v_payload jsonb;
begin
  perform pg_advisory_xact_lock(hashtext(p_owner::text), hashtext(p_request_id::text || ':' || p_command_name));
  select response, request_payload into v_response, v_payload
  from garden.command_receipts
  where owner_id = p_owner and request_id = p_request_id and command_name = p_command_name;
  if found then
    if v_payload is not null and v_payload is distinct from p_payload then
      raise exception 'Request id was already used with different input' using errcode = '22023';
    end if;
    return v_response;
  end if;
  return null;
end;
$$;


--
-- Name: create_open_review_follow_up(uuid, uuid, uuid, text, text); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.create_open_review_follow_up(p_owner_id uuid, p_garden_id uuid, p_grow_cycle_id uuid, p_origin text, p_subject_key text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_task_id uuid;
begin
  select id into v_task_id
  from garden.attention_items
  where owner_id = p_owner_id
    and garden_id = p_garden_id
    and grow_cycle_id = p_grow_cycle_id
    and purpose = 'evaluate_visual_review'
    and subject_key = p_subject_key
    and status = 'open'
  limit 1;

  if v_task_id is null then
    insert into garden.attention_items(
      owner_id, garden_id, grow_cycle_id, purpose, subject_key, title, origin
    ) values (
      p_owner_id, p_garden_id, p_grow_cycle_id,
      'evaluate_visual_review', p_subject_key, 'Revisar visualmente', p_origin
    ) returning id into v_task_id;
    insert into garden.attention_history(owner_id, attention_item_id, to_status, operation)
    values (p_owner_id, v_task_id, 'open', 'created');
  end if;
end;
$$;


--
-- Name: dismiss_open_attention_for_closed_cycle(); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.dismiss_open_attention_for_closed_cycle() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if old.state = 'active' and new.state = 'closed' then
    with dismissed as (
      update garden.attention_items
      set status = 'dismissed',
          dismissed_at = now(),
          dismissed_reason = 'Ciclo cerrado',
          updated_at = now()
      where owner_id = new.owner_id
        and grow_cycle_id = new.id
        and status = 'open'
      returning id, owner_id
    )
    insert into garden.attention_history(
      owner_id, attention_item_id, from_status, to_status, operation, reason
    )
    select owner_id, id, 'open', 'dismissed', 'dismissed', 'Ciclo cerrado'
    from dismissed;
  end if;
  return new;
end;
$$;


--
-- Name: gardenpedia_catalog_publication_sync(); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.gardenpedia_catalog_publication_sync() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_proposal record;
begin
  for v_proposal in
    select p.id,p.request_id from garden.gardenpedia_proposals p
    where p.review_status='approved'
      and p.publication_status='publishing'
      and p.publication_reference is not null
      and coalesce(p.candidate_identity->>'id',p.proposed_data->'plant'->>'id')=new.library_plant_id
  loop
    update garden.gardenpedia_proposals set review_status='published',publication_status='published',
      publication_version=new.catalog_version,publication_error=null,published_at=now(),updated_at=now()
      where id=v_proposal.id;
    update garden.gardenpedia_requests set status='published',updated_at=now(),resolved_at=now()
      where id=v_proposal.request_id;
  end loop;
  return new;
end;
$$;


--
-- Name: gardenpedia_is_curator(); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.gardenpedia_is_curator() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select auth.uid() is not null and exists (
    select 1 from garden.gardenpedia_curators c where c.user_id = auth.uid()
  );
$$;


--
-- Name: log_attention_change(); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.log_attention_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into garden.owner_change_log(owner_id, change_kind, garden_id, grow_cycle_id, source_id, occurred_at, summary)
    values (new.owner_id, 'attention', new.garden_id, new.grow_cycle_id, new.id, now(), 'Atención actualizada');
  elsif new.status is distinct from old.status or new.due_on is distinct from old.due_on or new.next_review_on is distinct from old.next_review_on then
    insert into garden.owner_change_log(owner_id, change_kind, garden_id, grow_cycle_id, source_id, occurred_at, summary)
    values (new.owner_id, 'attention', new.garden_id, new.grow_cycle_id, new.id, now(),
      case new.status when 'open' then 'Atención actualizada' when 'completed' then 'Atención completada' else 'Atención descartada' end);
  end if;
  return new;
end;
$$;


--
-- Name: log_cycle_correction_change(); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.log_cycle_correction_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_garden_id uuid;
begin
  select p.garden_id into v_garden_id
  from garden.cycle_occupancies o join garden.positions p on p.id = o.position_id
  where o.grow_cycle_id = new.grow_cycle_id
  order by o.created_at
  limit 1;
  insert into garden.owner_change_log(owner_id, change_kind, garden_id, grow_cycle_id, source_id, occurred_at, summary)
  values (new.owner_id, 'correction', v_garden_id, new.grow_cycle_id, new.id, new.created_at, 'Corrección de ciclo registrada');
  return new;
end;
$$;


--
-- Name: log_event_change(); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.log_event_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into garden.owner_change_log(owner_id, change_kind, garden_id, grow_cycle_id, source_id, occurred_at, summary)
  values (
    new.owner_id, 'event', new.garden_id, new.grow_cycle_id, new.id, new.occurred_at,
    case new.event_type
      when 'harvest' then 'Cosecha registrada'
      when 'cycle_started' then 'Ciclo iniciado'
      when 'cycle_ended' then 'Ciclo cerrado'
      when 'observation' then 'Observación registrada'
      when 'system_maintenance' then 'Mantenimiento registrado'
      when 'visual_review' then 'Revisión visual registrada'
      when 'development_review' then 'Revisión de desarrollo registrada'
      else 'Acción registrada'
    end
  );
  return new;
end;
$$;


--
-- Name: log_event_correction_change(); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.log_event_correction_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_cycle_id uuid; v_garden_id uuid;
begin
  select e.grow_cycle_id into v_cycle_id from garden.events e where e.id = new.event_id;
  select p.garden_id into v_garden_id
  from garden.cycle_occupancies o join garden.positions p on p.id = o.position_id
  where o.grow_cycle_id = v_cycle_id order by o.created_at limit 1;
  insert into garden.owner_change_log(owner_id, change_kind, garden_id, grow_cycle_id, source_id, occurred_at, summary)
  values (new.owner_id, 'correction', v_garden_id, v_cycle_id, new.id, new.created_at, 'Corrección de registro aplicada');
  return new;
end;
$$;


--
-- Name: refresh_position_capacity(uuid); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.refresh_position_capacity(p_garden_id uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  update garden.gardens g
  set position_capacity = (
    select count(*)::integer from garden.layout_sites s
    where s.garden_id = g.id and s.site_kind = 'grow' and s.is_active and s.position_id is not null
  ), updated_at = now()
  where g.id = p_garden_id
$$;


--
-- Name: resolve_cycle_evidence(uuid, uuid, timestamp with time zone, uuid[], uuid[]); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.resolve_cycle_evidence(p_owner_id uuid, p_grow_cycle_id uuid, p_as_of timestamp with time zone DEFAULT now(), p_note_event_ids uuid[] DEFAULT '{}'::uuid[], p_historical_photo_ids uuid[] DEFAULT '{}'::uuid[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $_$
declare
  v_cycle jsonb;
  v_history jsonb := '[]'::jsonb;
  v_historical_photos jsonb := '[]'::jsonb;
  v_has_import_provenance boolean;
begin
  if p_owner_id is null or p_grow_cycle_id is null or p_as_of is null then
    raise exception 'Owner, grow cycle, and evidence time are required';
  end if;

  select jsonb_build_object(
    'id', gc.id,
    'plant', jsonb_strip_nulls(jsonb_build_object('common_name', c.common_name, 'scientific_name', c.scientific_name)),
    'planted_on', gc.planted_on,
    'planted_on_precision', gc.planted_on_precision,
    'harvest_readiness', gc.harvest_readiness,
    'state', gc.state,
    'garden', jsonb_build_object('id', g.id, 'name', g.name),
    'position', jsonb_build_object('id', p.id, 'position_number', p.position_number)
  ) into v_cycle
  from garden.grow_cycles gc
  join garden.crops c on c.id = gc.crop_id
  join lateral (
    select o.position_id from garden.cycle_occupancies o
    where o.grow_cycle_id = gc.id
    order by (o.occupied_until is null) desc, o.occupied_from desc nulls last, o.created_at desc, o.id desc
    limit 1
  ) latest on true
  join garden.positions p on p.id = latest.position_id
  join garden.gardens g on g.id = p.garden_id
  where gc.id = p_grow_cycle_id and gc.owner_id = p_owner_id;
  if v_cycle is null then raise exception 'Grow cycle not found'; end if;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', e.id,
    'event_type', e.event_type,
    'occurred_at', e.occurred_at,
    'occurred_at_precision', coalesce(e.event_data->>'occurred_at_precision', 'timestamp'),
    'occurred_on', e.event_data->>'occurred_on',
    'fact', jsonb_strip_nulls(jsonb_build_object(
      'class', e.event_data->>'class',
      'operation', e.event_data->>'operation',
      'purpose', e.event_data->>'purpose',
      'severity', e.event_data->>'severity',
      'result', e.event_data->>'result',
      'readiness', e.event_data->>'readiness',
      'resolution', e.event_data->>'resolution',
      'count', e.event_data->'count',
      'count_kind', e.event_data->>'count_kind',
      'confirmed_by', e.event_data->>'confirmed_by'
    )),
    -- Notes are evidence chosen by the caller, never inferred from a model.
    'note', case when e.id = any(coalesce(p_note_event_ids, '{}'::uuid[])) then e.note else null end,
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ph.id,
        'storage_path', ph.storage_path,
        'original_filename', ph.original_filename,
        'content_type', ph.content_type,
        'byte_size', ph.byte_size,
        'checksum_sha256', ph.checksum_sha256,
        'captured_at', ph.captured_at,
        'captured_at_precision', ph.captured_at_precision,
        'upload_status', ph.upload_status,
        'provenance', jsonb_build_object('event_id', e.id, 'event_type', e.event_type)
      ) order by ph.captured_at desc nulls last, ph.id desc)
      from garden.photos ph
      where ph.event_id = e.id and ph.owner_id = p_owner_id and ph.upload_status = 'uploaded'
    ), '[]'::jsonb)
  )) order by e.occurred_at desc, e.id desc), '[]'::jsonb) into v_history
  from garden.events e
  where e.owner_id = p_owner_id and e.grow_cycle_id = p_grow_cycle_id
    and e.invalidated_at is null and e.created_at <= p_as_of;

  -- Historical Photos remains optional until its independent migration exists.
  -- This context resolver does not depend on it or modify its data.
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'garden' and table_name = 'photos' and column_name = 'import_provenance'
  ) into v_has_import_provenance;
  if v_has_import_provenance and cardinality(coalesce(p_historical_photo_ids, '{}'::uuid[])) > 0 then
    execute $query$
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ph.id,
        'storage_path', ph.storage_path,
        'original_filename', ph.original_filename,
        'content_type', ph.content_type,
        'byte_size', ph.byte_size,
        'checksum_sha256', ph.checksum_sha256,
        'captured_at', ph.captured_at,
        'captured_at_precision', ph.captured_at_precision,
        'upload_status', ph.upload_status,
        'provenance', ph.import_provenance
      ) order by coalesce(ph.captured_at, ph.created_at) desc, ph.id desc), '[]'::jsonb)
      from garden.photos ph
      where ph.id = any($1) and ph.owner_id = $2 and ph.upload_status = 'uploaded'
        and ph.event_id is null and ph.media_scope = 'cycle_evidence'
        and ph.import_provenance->>'grow_cycle_id' = $3
    $query$ into v_historical_photos using p_historical_photo_ids, p_owner_id, p_grow_cycle_id::text;
  end if;

  return jsonb_build_object(
    'cycle', v_cycle,
    'history', v_history,
    'historical_photos', v_historical_photos,
    'as_of', p_as_of
  );
end;
$_$;


--
-- Name: store_command_response(uuid, uuid, text, jsonb, jsonb); Type: FUNCTION; Schema: garden; Owner: -
--

CREATE FUNCTION garden.store_command_response(p_owner uuid, p_request_id uuid, p_command_name text, p_payload jsonb, p_response jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  insert into garden.command_receipts(owner_id, request_id, command_name, request_payload, response)
  values (p_owner, p_request_id, p_command_name, p_payload, p_response)
$$;


--
-- Name: garden_ack_home_snapshot(uuid, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_ack_home_snapshot(p_visit_id uuid, p_snapshot_cursor bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_owner uuid := public.garden_owner_id(); v_visit garden.home_visits%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_visit from garden.home_visits
  where id = p_visit_id and owner_id = v_owner for update;
  if not found then raise exception 'Home visit not found'; end if;
  if p_snapshot_cursor <> v_visit.snapshot_cursor then raise exception 'Home snapshot changed; refresh before acknowledging'; end if;
  update garden.owner_home_state
  set last_shown_cursor = greatest(last_shown_cursor, p_snapshot_cursor),
      last_shown_at = greatest(coalesce(last_shown_at, '-infinity'::timestamptz), v_visit.snapshot_at),
      updated_at = now()
  where owner_id = v_owner;
  update garden.home_visits set acknowledged_at = now() where id = v_visit.id;
end;
$$;


--
-- Name: garden_add_layout_site(uuid, uuid, integer, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_add_layout_site(p_request_id uuid, p_garden_id uuid, p_grid_x integer, p_grid_y integer, p_site_kind text, p_label text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id(); v_payload jsonb := jsonb_build_object('garden_id', p_garden_id, 'grid_x', p_grid_x, 'grid_y', p_grid_y, 'site_kind', p_site_kind, 'label', nullif(trim(p_label), ''));
  v_response jsonb; v_site_id uuid; v_position_id uuid; v_position_number integer;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'add_layout_site', v_payload);
  if v_response is not null then return v_response; end if;
  if p_site_kind not in ('grow', 'utility') then raise exception 'Invalid physical site type'; end if;
  if p_grid_x not between 1 and 8 or p_grid_y not between 1 and 9 then raise exception 'Invalid map coordinate'; end if;
  if char_length(trim(coalesce(p_label, ''))) > 80 then raise exception 'Label must have at most 80 characters'; end if;
  if not exists (select 1 from garden.gardens where id = p_garden_id and owner_id = v_owner for update) then raise exception 'Garden not found'; end if;
  if exists (select 1 from garden.layout_sites where garden_id = p_garden_id and grid_x = p_grid_x and grid_y = p_grid_y and is_active) then raise exception 'That point is already occupied on the map'; end if;
  if p_site_kind = 'grow' then
    select coalesce(max(position_number), 0) + 1 into v_position_number from garden.positions where garden_id = p_garden_id;
    if v_position_number > 36 then raise exception 'A garden can have at most 36 cultivation positions'; end if;
    insert into garden.positions(garden_id, position_number) values (p_garden_id, v_position_number) returning id into v_position_id;
  end if;
  insert into garden.layout_sites(garden_id, position_id, site_kind, grid_x, grid_y, label)
  values (p_garden_id, v_position_id, p_site_kind, p_grid_x, p_grid_y, nullif(trim(p_label), '')) returning id into v_site_id;
  perform garden.refresh_position_capacity(p_garden_id);
  insert into garden.layout_events(owner_id, garden_id, layout_site_id, operation, event_data)
  values (v_owner, p_garden_id, v_site_id, 'site_added', jsonb_build_object('site_kind', p_site_kind, 'grid_x', p_grid_x, 'grid_y', p_grid_y, 'position_number', v_position_number));
  v_response := jsonb_build_object('site_id', v_site_id, 'position_id', v_position_id, 'position_number', v_position_number);
  perform garden.store_command_response(v_owner, p_request_id, 'add_layout_site', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_ai_finish_request(uuid, text, jsonb, text, integer, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_ai_finish_request(p_request_id uuid, p_status text, p_proposal jsonb DEFAULT NULL::jsonb, p_model_identifier text DEFAULT NULL::text, p_duration_ms integer DEFAULT NULL::integer, p_usage_metadata jsonb DEFAULT '{}'::jsonb, p_error_code text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update garden.ai_requests
  set status = p_status,
      proposal = p_proposal,
      model_identifier = p_model_identifier,
      duration_ms = p_duration_ms,
      usage_metadata = coalesce(p_usage_metadata, '{}'::jsonb),
      error_code = p_error_code,
      completed_at = now()
  where id = p_request_id and owner_id = auth.uid();
end;
$$;


--
-- Name: garden_ai_record_cost(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_ai_record_cost(p_request_id uuid, p_estimated_cost_usd numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_estimated_cost_usd is null or p_estimated_cost_usd < 0 then
    raise exception 'Invalid estimated cost';
  end if;

  update garden.ai_requests
  set estimated_cost_usd = round(p_estimated_cost_usd, 6)
  where id = p_request_id
    and owner_id = auth.uid();
end;
$$;


--
-- Name: garden_ai_start_request(text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_ai_start_request(p_request_key text, p_request_type text, p_evidence_refs jsonb, p_proposal_schema_version text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: garden_close_cycle(uuid, uuid, integer, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_close_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_ended_on date, p_reason text, p_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'ended_on', p_ended_on, 'reason', p_reason, 'note', nullif(trim(p_note), ''));
  v_response jsonb;
  v_occupancy garden.cycle_occupancies%rowtype;
  v_cycle garden.grow_cycles%rowtype;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'close_cycle', v_payload);
  if v_response is not null then return v_response; end if;
  if p_reason is null or p_reason not in ('replacement', 'productive_end', 'failure', 'removal', 'other') then raise exception 'Invalid closure reason'; end if;
  if p_reason = 'other' and coalesce(nullif(trim(p_note), ''), '') = '' then raise exception 'Other closure reason requires a note'; end if;
  if p_ended_on is null then raise exception 'Closure date is required'; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'active' then raise exception 'Current grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before closing'; end if;
  select * into v_occupancy from garden.cycle_occupancies where grow_cycle_id = p_grow_cycle_id and occupied_until is null for update;
  if not found then raise exception 'Current occupancy not found'; end if;
  if v_occupancy.occupied_from is not null and p_ended_on < v_occupancy.occupied_from then raise exception 'Closure cannot precede occupancy'; end if;
  update garden.cycle_occupancies set occupied_until = p_ended_on where id = v_occupancy.id;
  update garden.grow_cycles set state = 'closed', revision = revision + 1, updated_at = now() where id = p_grow_cycle_id;
  insert into garden.events(owner_id, grow_cycle_id, event_type, note)
  values (v_owner, p_grow_cycle_id, 'cycle_ended', concat('Ciclo cerrado: ', p_reason, case when nullif(trim(p_note), '') is null then '' else ' — ' || trim(p_note) end)) returning id into v_event_id;
  insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
  values (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'closed', jsonb_build_object('state', v_cycle.state, 'occupied_until', v_occupancy.occupied_until), jsonb_build_object('state', 'closed', 'occupied_until', p_ended_on), p_reason);
  v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'close_cycle', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_complete_attention_item(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_complete_attention_item(p_request_id uuid, p_task_id uuid, p_note text DEFAULT NULL::text, p_review_result text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id(); v_task garden.attention_items%rowtype; v_payload jsonb; v_response jsonb; v_event_type text; v_event_data jsonb; v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('task_id', p_task_id, 'note', nullif(trim(p_note), ''), 'review_result', p_review_result); v_response := garden.command_response(v_owner, p_request_id, 'complete_attention_item', v_payload); if v_response is not null then return v_response; end if;
  select * into v_task from garden.attention_items where id = p_task_id and owner_id = v_owner for update;
  if not found or v_task.status <> 'open' then raise exception 'Open attention item not found'; end if;
  if v_task.purpose = 'evaluate_visual_review' then
    if p_review_result not in ('reassuring', 'watch', 'action_required', 'insufficient_evidence') then raise exception 'A personal visual review result is required'; end if;
    v_event_type := 'visual_review'; v_event_data := jsonb_build_object('result', p_review_result, 'source', 'attention_task');
  elsif v_task.purpose like 'evaluate_%' then
    if p_review_result not in ('ready', 'not_yet', 'not_required', 'undetermined') then raise exception 'A development review result is required'; end if;
    v_event_type := 'development_review'; v_event_data := jsonb_build_object('result', p_review_result, 'purpose', v_task.purpose, 'source', 'attention_task');
  elsif v_task.purpose = 'perform_harvest' then
    v_event_type := 'harvest'; v_event_data := jsonb_build_object('source', 'attention_task');
  elsif v_task.purpose in ('perform_thinning', 'perform_pruning', 'perform_support', 'perform_support_remove') then
    v_event_type := 'intervention'; v_event_data := jsonb_build_object('class', case when v_task.purpose like '%support%' then 'support' else replace(v_task.purpose, 'perform_', '') end, 'operation', case when v_task.purpose = 'perform_support' then 'installed' when v_task.purpose = 'perform_support_remove' then 'removed' else null end, 'source', 'attention_task');
  else
    v_event_type := 'system_maintenance'; v_event_data := jsonb_build_object('class', replace(v_task.purpose, 'perform_', ''), 'source', 'attention_task');
  end if;
  insert into garden.events(owner_id, garden_id, grow_cycle_id, event_type, note, event_data) values (v_owner, v_task.garden_id, v_task.grow_cycle_id, v_event_type, nullif(trim(p_note), ''), v_event_data) returning id into v_event_id;
  update garden.attention_items set status = 'completed', completed_at = now(), completed_event_id = v_event_id, updated_at = now() where id = v_task.id;
  insert into garden.attention_history(owner_id, attention_item_id, from_status, to_status, operation, related_event_id) values (v_owner, v_task.id, 'open', 'completed', 'completed', v_event_id);
  v_response := jsonb_build_object('task_id', v_task.id, 'event_id', v_event_id); perform garden.store_command_response(v_owner, p_request_id, 'complete_attention_item', v_payload, v_response); return v_response;
end;
$$;


--
-- Name: garden_correct_cycle_origin(uuid, uuid, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_correct_cycle_origin(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_origin_type text, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object(
    'grow_cycle_id', p_grow_cycle_id,
    'expected_revision', p_expected_revision,
    'origin_type', p_origin_type,
    'reason', trim(coalesce(p_reason, ''))
  );
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;

  v_response := garden.command_response(v_owner, p_request_id, 'correct_cycle_origin', v_payload);
  if v_response is not null then return v_response; end if;

  if p_origin_type is null or p_origin_type not in ('seed', 'bare_root', 'cutting', 'seedling', 'transplant') then
    raise exception 'Invalid plant origin';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'Origin correction reason is required';
  end if;

  select * into v_cycle
  from garden.grow_cycles
  where id = p_grow_cycle_id and owner_id = v_owner
  for update;
  if not found then raise exception 'Grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then
    raise exception 'Cycle changed; review it before correcting';
  end if;

  if v_cycle.origin_type = p_origin_type then
    v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision, 'unchanged', true);
    perform garden.store_command_response(v_owner, p_request_id, 'correct_cycle_origin', v_payload, v_response);
    return v_response;
  end if;

  update garden.grow_cycles
  set origin_type = p_origin_type,
      revision = revision + 1,
      updated_at = now()
  where id = p_grow_cycle_id;

  insert into garden.cycle_revisions(
    owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason
  ) values (
    v_owner,
    p_grow_cycle_id,
    v_cycle.revision + 1,
    'origin_corrected',
    jsonb_build_object('origin_type', v_cycle.origin_type),
    jsonb_build_object('origin_type', p_origin_type),
    trim(p_reason)
  );

  v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1);
  perform garden.store_command_response(v_owner, p_request_id, 'correct_cycle_origin', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_correct_cycle_planting(uuid, uuid, integer, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_correct_cycle_planting(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_planted_on date, p_planted_on_precision text, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'planted_on', p_planted_on, 'planted_on_precision', p_planted_on_precision, 'reason', trim(p_reason));
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'correct_cycle_planting', v_payload);
  if v_response is not null then return v_response; end if;
  if char_length(trim(p_reason)) not between 1 and 500 then raise exception 'Correction reason is required'; end if;
  if (p_planted_on is null and p_planted_on_precision <> 'unknown') or (p_planted_on is not null and p_planted_on_precision not in ('exact', 'approximate')) then raise exception 'Invalid planted date precision'; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found then raise exception 'Grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before correcting'; end if;
  update garden.grow_cycles set planted_on = p_planted_on, planted_on_precision = p_planted_on_precision, revision = revision + 1, updated_at = now() where id = p_grow_cycle_id;
  insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
  values (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'planting_corrected', jsonb_build_object('planted_on', v_cycle.planted_on, 'planted_on_precision', v_cycle.planted_on_precision), jsonb_build_object('planted_on', p_planted_on, 'planted_on_precision', p_planted_on_precision), trim(p_reason));
  v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1);
  perform garden.store_command_response(v_owner, p_request_id, 'correct_cycle_planting', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_create_attention_item(uuid, uuid, uuid, text, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_create_attention_item(p_request_id uuid, p_garden_id uuid, p_grow_cycle_id uuid, p_purpose text, p_subject_key text DEFAULT 'general'::text, p_due_on date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
  v_garden_id uuid;
  v_item garden.attention_items%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('garden_id', p_garden_id, 'grow_cycle_id', p_grow_cycle_id, 'purpose', p_purpose, 'subject_key', coalesce(nullif(trim(p_subject_key), ''), 'general'), 'due_on', p_due_on);
  v_response := garden.command_response(v_owner, p_request_id, 'create_attention_item', v_payload);
  if v_response is not null then return v_response; end if;
  if p_purpose not in ('evaluate_visual_review', 'evaluate_thinning', 'evaluate_pruning', 'evaluate_support', 'perform_thinning', 'perform_pruning', 'perform_support', 'perform_support_remove', 'perform_harvest', 'perform_water_change', 'perform_refill', 'perform_nutrients', 'perform_cleaning') then raise exception 'Invalid attention purpose'; end if;
  if char_length(coalesce(nullif(trim(p_subject_key), ''), 'general')) > 160 then raise exception 'Task subject is too long'; end if;
  v_garden_id := garden.attention_assert_subject(v_owner, p_garden_id, p_grow_cycle_id);
  select * into v_item from garden.attention_items
  where owner_id = v_owner and garden_id = v_garden_id and grow_cycle_id is not distinct from p_grow_cycle_id
    and purpose = p_purpose and subject_key = coalesce(nullif(trim(p_subject_key), ''), 'general') and status = 'open'
  for update;
  if found then
    v_response := jsonb_build_object('task_id', v_item.id, 'created', false);
    perform garden.store_command_response(v_owner, p_request_id, 'create_attention_item', v_payload, v_response);
    return v_response;
  end if;
  insert into garden.attention_items(owner_id, garden_id, grow_cycle_id, purpose, subject_key, title, origin, due_on)
  values (v_owner, v_garden_id, p_grow_cycle_id, p_purpose, coalesce(nullif(trim(p_subject_key), ''), 'general'), garden.attention_purpose_title(p_purpose), 'manual', p_due_on)
  returning * into v_item;
  insert into garden.attention_history(owner_id, attention_item_id, to_status, operation)
  values (v_owner, v_item.id, 'open', 'created');
  v_response := jsonb_build_object('task_id', v_item.id, 'created', true);
  perform garden.store_command_response(v_owner, p_request_id, 'create_attention_item', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_create_garden(uuid, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_create_garden(p_request_id uuid, p_name text, p_system_model text, p_position_capacity integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('name', trim(p_name), 'system_model', nullif(trim(p_system_model), ''), 'position_capacity', p_position_capacity);
  v_response jsonb;
  v_garden_id uuid;
  v_layout text;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'create_garden', v_payload);
  if v_response is not null then return v_response; end if;
  if p_position_capacity not between 1 and 36 then raise exception 'Position capacity must be from 1 to 36'; end if;
  if char_length(trim(p_name)) not between 1 and 80 then raise exception 'Garden name is required'; end if;
  v_layout := case
    when lower(trim(coalesce(p_system_model, ''))) = 'uruq' and p_position_capacity = 8 then 'uruq_8_v1'
    when lower(trim(coalesce(p_system_model, ''))) = 'uruq' and p_position_capacity = 12 then 'uruq_12_v1'
    else 'custom_grid'
  end;
  insert into garden.gardens(owner_id, name, system_model, position_capacity, map_layout)
  values (v_owner, trim(p_name), nullif(trim(p_system_model), ''), p_position_capacity, v_layout)
  returning id into v_garden_id;
  insert into garden.positions(garden_id, position_number)
  select v_garden_id, n from generate_series(1, p_position_capacity) as n;
  insert into garden.layout_sites(garden_id, position_id, site_kind, grid_x, grid_y)
  select v_garden_id, p.id, 'grow',
    case when v_layout = 'uruq_8_v1' then case p.position_number when 1 then 2 when 2 then 6 when 3 then 1 when 4 then 4 when 5 then 7 when 6 then 1 when 7 then 4 when 8 then 7 end
         when v_layout = 'uruq_12_v1' then case p.position_number when 1 then 4 when 2 then 1 when 3 then 3 when 4 then 5 when 5 then 7 when 6 then 2 when 7 then 4 when 8 then 6 when 9 then 1 when 10 then 3 when 11 then 5 when 12 then 7 end
         else ((p.position_number - 1) % 4) * 2 + 1 end,
    case when v_layout = 'uruq_8_v1' then case when p.position_number <= 2 then 1 when p.position_number <= 5 then 2 else 3 end
         when v_layout = 'uruq_12_v1' then case when p.position_number = 1 then 1 when p.position_number <= 5 then 2 when p.position_number <= 8 then 3 else 4 end
         else ((p.position_number - 1) / 4) + 1 end
  from garden.positions p where p.garden_id = v_garden_id;
  insert into garden.layout_events(owner_id, garden_id, operation, event_data)
  values (v_owner, v_garden_id, 'site_added', jsonb_build_object('source', 'garden_created', 'layout', v_layout));
  v_response := jsonb_build_object('garden_id', v_garden_id);
  perform garden.store_command_response(v_owner, p_request_id, 'create_garden', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_create_guest_garden_story(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_create_guest_garden_story(p_request_id uuid, p_garden_id uuid, p_token_hash text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_owner uuid := public.garden_owner_id();
  v_story_id uuid;
  v_payload jsonb;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid guest token'; end if;
  v_payload := jsonb_build_object('garden_id', p_garden_id, 'token_hash', p_token_hash);
  v_response := garden.command_response(v_owner, p_request_id, 'create_guest_garden_story', v_payload);
  if v_response is not null then return v_response; end if;
  if not exists (select 1 from garden.gardens g where g.id = p_garden_id and g.owner_id = v_owner) then
    raise exception 'Garden not found';
  end if;
  if exists (select 1 from garden.guest_garden_stories where token_hash = p_token_hash) then
    raise exception 'Guest token already exists';
  end if;
  insert into garden.guest_garden_stories(owner_id, garden_id, token_hash)
  values (v_owner, p_garden_id, p_token_hash)
  returning id into v_story_id;
  v_response := jsonb_build_object('story_id', v_story_id, 'created', true);
  perform garden.store_command_response(v_owner, p_request_id, 'create_guest_garden_story', v_payload, v_response);
  return v_response;
end;
$_$;


--
-- Name: garden_create_guest_plant_story(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_create_guest_plant_story(p_request_id uuid, p_grow_cycle_id uuid, p_token_hash text, p_item_selection jsonb DEFAULT '[]'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_owner uuid := public.garden_owner_id();
  v_cycle garden.grow_cycles%rowtype;
  v_story_id uuid;
  v_payload jsonb;
  v_response jsonb;
  v_item jsonb;
  v_event_id uuid;
  v_photo_id uuid;
  v_include_note boolean;
  v_has_import_provenance boolean;
  v_valid boolean;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid guest token'; end if;
  if jsonb_typeof(coalesce(p_item_selection, '[]'::jsonb)) <> 'array' then raise exception 'Guest story selection must be an array'; end if;
  if jsonb_array_length(coalesce(p_item_selection, '[]'::jsonb)) > 500 then raise exception 'Guest story selection is too large'; end if;

  v_payload := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'token_hash', p_token_hash, 'item_selection', coalesce(p_item_selection, '[]'::jsonb));
  v_response := garden.command_response(v_owner, p_request_id, 'create_guest_plant_story', v_payload);
  if v_response is not null then return v_response; end if;

  select gc.* into v_cycle
  from garden.grow_cycles gc
  where gc.id = p_grow_cycle_id and gc.owner_id = v_owner;
  if not found then raise exception 'Grow cycle not found'; end if;

  if exists (select 1 from garden.guest_plant_stories where token_hash = p_token_hash) then
    raise exception 'Guest token already exists';
  end if;

  insert into garden.guest_plant_stories(owner_id, grow_cycle_id, token_hash)
  values (v_owner, p_grow_cycle_id, p_token_hash)
  returning id into v_story_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'garden' and table_name = 'photos' and column_name = 'import_provenance'
  ) into v_has_import_provenance;

  for v_item in select value from jsonb_array_elements(coalesce(p_item_selection, '[]'::jsonb)) loop
    v_event_id := nullif(v_item->>'event_id', '')::uuid;
    v_photo_id := nullif(v_item->>'photo_id', '')::uuid;
    v_include_note := coalesce((v_item->>'include_note')::boolean, false);
    if (v_event_id is null) = (v_photo_id is null) then raise exception 'Guest story item must reference one event or photo'; end if;

    if v_event_id is not null then
      if not exists (
        select 1 from garden.events e
        where e.id = v_event_id and e.owner_id = v_owner and e.grow_cycle_id = p_grow_cycle_id
          and e.invalidated_at is null and e.created_at <= now()
      ) then raise exception 'Guest story event is not available'; end if;
      if v_include_note then
        insert into garden.guest_plant_story_items(story_id, event_id, include_note)
        values (v_story_id, v_event_id, true);
      end if;
    else
      v_valid := false;
      select exists (
        select 1
        from garden.photos ph
        join garden.events e on e.id = ph.event_id
        where ph.id = v_photo_id and ph.owner_id = v_owner and ph.upload_status = 'uploaded'
          and e.owner_id = v_owner and e.grow_cycle_id = p_grow_cycle_id and e.invalidated_at is null
      ) into v_valid;
      if not v_valid then
        select exists (
          select 1
          from garden.photos ph
          where ph.id = v_photo_id and ph.owner_id = v_owner and ph.upload_status = 'uploaded'
            and ph.grow_cycle_id = p_grow_cycle_id
        ) into v_valid;
      end if;
      if not v_valid and v_has_import_provenance then
        execute $query$
          select exists (
            select 1 from garden.photos ph
            where ph.id = $1 and ph.owner_id = $2 and ph.upload_status = 'uploaded'
              and ph.event_id is null and ph.media_scope = 'cycle_evidence'
              and ph.import_provenance->>'grow_cycle_id' = $3
          )
        $query$ into v_valid using v_photo_id, v_owner, p_grow_cycle_id::text;
      end if;
      if not v_valid then raise exception 'Guest story photo is not available'; end if;
      insert into garden.guest_plant_story_items(story_id, photo_id)
      values (v_story_id, v_photo_id);
    end if;
  end loop;

  v_response := jsonb_build_object('story_id', v_story_id, 'created', true);
  perform garden.store_command_response(v_owner, p_request_id, 'create_guest_plant_story', v_payload, v_response);
  return v_response;
end;
$_$;


--
-- Name: garden_create_guest_plant_story_v2(uuid, uuid, text, jsonb, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_create_guest_plant_story_v2(p_request_id uuid, p_grow_cycle_id uuid, p_token_hash text, p_item_selection jsonb DEFAULT '[]'::jsonb, p_hero_photo_id uuid DEFAULT NULL::uuid, p_caption_overrides jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_story_id uuid;
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
        and (ph.grow_cycle_id = p_grow_cycle_id or ev.grow_cycle_id = p_grow_cycle_id or (ph.media_scope = 'cycle_evidence' and ph.import_provenance->>'grow_cycle_id' = p_grow_cycle_id::text))
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


--
-- Name: garden_create_import_batch(uuid, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_create_import_batch(p_request_id uuid, p_source_label text, p_source_fingerprint text, p_candidates jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare v_owner uuid := public.garden_owner_id(); v_batch_id uuid; v_payload jsonb; v_response jsonb; v_candidate jsonb; v_index integer := 0;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if char_length(trim(coalesce(p_source_label, ''))) not between 1 and 180 then raise exception 'Source label is required'; end if;
  if coalesce(p_source_fingerprint, '') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid source fingerprint'; end if;
  if jsonb_typeof(p_candidates) <> 'array' or jsonb_array_length(p_candidates) not between 1 and 50 then raise exception 'Import requires between 1 and 50 candidates'; end if;
  v_payload := jsonb_build_object('source_label', trim(p_source_label), 'source_fingerprint', p_source_fingerprint, 'candidates', p_candidates);
  v_response := garden.command_response(v_owner, p_request_id, 'create_import_batch', v_payload);
  if v_response is not null then return v_response; end if;
  select id into v_batch_id from garden.import_batches where owner_id = v_owner and source_fingerprint = p_source_fingerprint;
  if v_batch_id is not null then
    v_response := jsonb_build_object('batch_id', v_batch_id, 'created', false);
    perform garden.store_command_response(v_owner, p_request_id, 'create_import_batch', v_payload, v_response);
    return v_response;
  end if;
  insert into garden.import_batches(owner_id, source_label, source_fingerprint) values (v_owner, trim(p_source_label), p_source_fingerprint) returning id into v_batch_id;
  for v_candidate in select value from jsonb_array_elements(p_candidates) loop
    v_index := v_index + 1;
    if coalesce(v_candidate->>'candidate_type', '') not in ('observation', 'recommendation', 'conflict') then raise exception 'Invalid candidate type'; end if;
    if char_length(trim(coalesce(v_candidate->>'note', ''))) not between 1 and 1000 then raise exception 'Candidate note is required'; end if;
    if coalesce(v_candidate->>'occurred_on_precision', 'unknown') = 'exact' and nullif(v_candidate->>'occurred_on', '') is null then raise exception 'Exact candidate date is required'; end if;
    if coalesce(v_candidate->>'occurred_on_precision', 'unknown') not in ('exact', 'unknown') then raise exception 'Invalid candidate date precision'; end if;
    if nullif(v_candidate->>'grow_cycle_id', '') is not null and not exists (select 1 from garden.grow_cycles where id = (v_candidate->>'grow_cycle_id')::uuid and owner_id = v_owner) then raise exception 'Candidate cycle not found'; end if;
    insert into garden.import_candidates(batch_id, owner_id, candidate_key, candidate_type, grow_cycle_id, occurred_on, occurred_on_precision, note, source_data)
    values (v_batch_id, v_owner, coalesce(nullif(trim(v_candidate->>'candidate_key'), ''), v_index::text), v_candidate->>'candidate_type', nullif(v_candidate->>'grow_cycle_id', '')::uuid, nullif(v_candidate->>'occurred_on', '')::date, coalesce(v_candidate->>'occurred_on_precision', 'unknown'), trim(v_candidate->>'note'), coalesce(v_candidate->'source_data', '{}'::jsonb));
  end loop;
  v_response := jsonb_build_object('batch_id', v_batch_id, 'created', true);
  perform garden.store_command_response(v_owner, p_request_id, 'create_import_batch', v_payload, v_response);
  return v_response;
end;
$_$;


--
-- Name: garden_create_observation(uuid, uuid, text, text, text, bigint, timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_create_observation(p_request_id uuid, p_grow_cycle_id uuid, p_note text, p_original_filename text DEFAULT NULL::text, p_content_type text DEFAULT NULL::text, p_byte_size bigint DEFAULT NULL::bigint, p_captured_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_captured_at_precision text DEFAULT 'unknown'::text, p_checksum_sha256 text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'note', nullif(trim(p_note), ''), 'original_filename', p_original_filename, 'content_type', p_content_type, 'byte_size', p_byte_size, 'captured_at', p_captured_at, 'captured_at_precision', p_captured_at_precision, 'checksum_sha256', p_checksum_sha256);
  v_response jsonb;
  v_event_id uuid;
  v_photo_id uuid;
  v_extension text;
  v_storage_path text;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'create_observation', v_payload);
  if v_response is not null then return v_response; end if;
  if not exists (select 1 from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner and state = 'active') then
    raise exception 'Current grow cycle not found';
  end if;
  if coalesce(nullif(trim(p_note), ''), '') = '' and p_original_filename is null then
    raise exception 'An observation needs a note or a photo';
  end if;
  if p_original_filename is not null and (
    p_content_type is null or p_byte_size is null or p_byte_size <= 0
    or p_checksum_sha256 is null or p_checksum_sha256 !~ '^[0-9a-f]{64}$'
    or p_captured_at_precision not in ('exact', 'approximate', 'unknown')
    or (p_captured_at is null and p_captured_at_precision <> 'unknown')
    or (p_captured_at is not null and p_captured_at_precision = 'unknown')
  ) then raise exception 'Invalid photo metadata'; end if;
  insert into garden.events (owner_id, grow_cycle_id, event_type, note)
  values (v_owner, p_grow_cycle_id, 'observation', nullif(trim(p_note), '')) returning id into v_event_id;
  if p_original_filename is not null then
    v_extension := case p_content_type
      when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/heic' then 'heic'
      when 'image/heif' then 'heif' when 'image/webp' then 'webp' else null end;
    if v_extension is null then raise exception 'Unsupported image type'; end if;
    v_photo_id := gen_random_uuid();
    v_storage_path := v_owner::text || '/' || v_photo_id::text || '/original.' || v_extension;
    insert into garden.photos (id, owner_id, event_id, storage_path, original_filename, content_type, byte_size, captured_at, captured_at_precision, checksum_sha256)
    values (v_photo_id, v_owner, v_event_id, v_storage_path, p_original_filename, p_content_type, p_byte_size, p_captured_at, p_captured_at_precision, p_checksum_sha256);
  end if;
  v_response := jsonb_strip_nulls(jsonb_build_object('event_id', v_event_id, 'photo_id', v_photo_id, 'storage_path', v_storage_path));
  perform garden.store_command_response(v_owner, p_request_id, 'create_observation', v_payload, v_response);
  return v_response;
end;
$_$;


--
-- Name: garden_defer_attention_item(uuid, uuid, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_defer_attention_item(p_request_id uuid, p_task_id uuid, p_next_review_on date, p_reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_owner uuid := public.garden_owner_id(); v_task garden.attention_items%rowtype; v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_next_review_on is null then raise exception 'Next review date is required'; end if;
  v_payload := jsonb_build_object('task_id', p_task_id, 'next_review_on', p_next_review_on, 'reason', nullif(trim(p_reason), ''));
  v_response := garden.command_response(v_owner, p_request_id, 'defer_attention_item', v_payload);
  if v_response is not null then return; end if;
  select * into v_task from garden.attention_items where id = p_task_id and owner_id = v_owner for update;
  if not found or v_task.status <> 'open' then raise exception 'Open attention item not found'; end if;
  update garden.attention_items set next_review_on = p_next_review_on, updated_at = now() where id = v_task.id;
  insert into garden.attention_history(owner_id, attention_item_id, from_status, to_status, operation, reason)
  values (v_owner, v_task.id, 'open', 'open', 'deferred', nullif(trim(p_reason), ''));
  perform garden.store_command_response(v_owner, p_request_id, 'defer_attention_item', v_payload, '{}'::jsonb);
end;
$$;


--
-- Name: garden_dismiss_attention_item(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_dismiss_attention_item(p_request_id uuid, p_task_id uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_owner uuid := public.garden_owner_id(); v_task garden.attention_items%rowtype; v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 1 and 500 then raise exception 'Dismissal reason is required'; end if;
  v_payload := jsonb_build_object('task_id', p_task_id, 'reason', trim(p_reason));
  v_response := garden.command_response(v_owner, p_request_id, 'dismiss_attention_item', v_payload);
  if v_response is not null then return; end if;
  select * into v_task from garden.attention_items where id = p_task_id and owner_id = v_owner for update;
  if not found or v_task.status <> 'open' then raise exception 'Open attention item not found'; end if;
  update garden.attention_items set status = 'dismissed', dismissed_at = now(), dismissed_reason = trim(p_reason), updated_at = now() where id = v_task.id;
  insert into garden.attention_history(owner_id, attention_item_id, from_status, to_status, operation, reason)
  values (v_owner, v_task.id, 'open', 'dismissed', 'dismissed', trim(p_reason));
  perform garden.store_command_response(v_owner, p_request_id, 'dismiss_attention_item', v_payload, '{}'::jsonb);
end;
$$;


--
-- Name: garden_export_owner_data(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_export_owner_data() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_owner uuid := public.garden_owner_id();
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  return jsonb_build_object(
    'format_version', 'streex-garden-export/v1', 'exported_at', now(),
    'gardens', coalesce((select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', g.name, 'system_model', g.system_model, 'position_capacity', g.position_capacity, 'map_layout', g.map_layout, 'created_at', g.created_at, 'updated_at', g.updated_at,
      'positions', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'position_number', p.position_number, 'created_at', p.created_at) order by p.position_number) from garden.positions p where p.garden_id = g.id), '[]'::jsonb),
      'layout_sites', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'position_id', s.position_id, 'site_kind', s.site_kind, 'is_active', s.is_active, 'grid_x', s.grid_x, 'grid_y', s.grid_y, 'label', s.label, 'created_at', s.created_at, 'updated_at', s.updated_at) order by s.grid_y, s.grid_x, s.id) from garden.layout_sites s where s.garden_id = g.id), '[]'::jsonb)
    ) order by g.created_at) from garden.gardens g where g.owner_id = v_owner), '[]'::jsonb),
    'layout_events', coalesce((select jsonb_agg(jsonb_build_object('id', le.id, 'garden_id', le.garden_id, 'layout_site_id', le.layout_site_id, 'operation', le.operation, 'event_data', le.event_data, 'created_at', le.created_at) order by le.created_at, le.id) from garden.layout_events le where le.owner_id = v_owner), '[]'::jsonb),
    'crops', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'common_name', c.common_name, 'scientific_name', c.scientific_name, 'created_at', c.created_at) order by c.created_at) from garden.crops c where c.owner_id = v_owner), '[]'::jsonb),
    'grow_cycles', coalesce((select jsonb_agg(jsonb_build_object('id', gc.id, 'crop_id', gc.crop_id, 'planted_on', gc.planted_on, 'planted_on_precision', gc.planted_on_precision, 'state', gc.state, 'harvest_readiness', gc.harvest_readiness, 'revision', gc.revision, 'created_at', gc.created_at, 'updated_at', gc.updated_at, 'occupancies', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'position_id', o.position_id, 'occupied_from', o.occupied_from, 'occupied_until', o.occupied_until, 'created_at', o.created_at) order by o.created_at) from garden.cycle_occupancies o where o.grow_cycle_id = gc.id), '[]'::jsonb)) order by gc.created_at) from garden.grow_cycles gc where gc.owner_id = v_owner), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'garden_id', e.garden_id, 'grow_cycle_id', e.grow_cycle_id, 'event_type', e.event_type, 'occurred_at', e.occurred_at, 'note', e.note, 'event_data', e.event_data, 'revision', e.revision, 'invalidated_at', e.invalidated_at, 'invalidated_reason', e.invalidated_reason, 'created_at', e.created_at) order by e.occurred_at, e.id) from garden.events e where e.owner_id = v_owner), '[]'::jsonb),
    'cycle_revisions', coalesce((select jsonb_agg(jsonb_build_object('id', cr.id, 'grow_cycle_id', cr.grow_cycle_id, 'revision_number', cr.revision_number, 'operation', cr.operation, 'previous_values', cr.previous_values, 'next_values', cr.next_values, 'reason', cr.reason, 'created_at', cr.created_at) order by cr.created_at, cr.id) from garden.cycle_revisions cr where cr.owner_id = v_owner), '[]'::jsonb),
    'event_revisions', coalesce((select jsonb_agg(jsonb_build_object('id', er.id, 'event_id', er.event_id, 'revision_number', er.revision_number, 'operation', er.operation, 'previous_values', er.previous_values, 'next_values', er.next_values, 'reason', er.reason, 'created_at', er.created_at) order by er.created_at, er.id) from garden.event_revisions er where er.owner_id = v_owner), '[]'::jsonb),
    'attention_items', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'garden_id', a.garden_id, 'grow_cycle_id', a.grow_cycle_id, 'purpose', a.purpose, 'subject_key', a.subject_key, 'title', a.title, 'origin', a.origin, 'status', a.status, 'due_on', a.due_on, 'next_review_on', a.next_review_on, 'completed_event_id', a.completed_event_id, 'completed_at', a.completed_at, 'dismissed_at', a.dismissed_at, 'dismissed_reason', a.dismissed_reason, 'created_at', a.created_at, 'updated_at', a.updated_at) order by a.created_at, a.id) from garden.attention_items a where a.owner_id = v_owner), '[]'::jsonb),
    'attention_history', coalesce((select jsonb_agg(jsonb_build_object('id', ah.id, 'attention_item_id', ah.attention_item_id, 'from_status', ah.from_status, 'to_status', ah.to_status, 'operation', ah.operation, 'reason', ah.reason, 'related_event_id', ah.related_event_id, 'created_at', ah.created_at) order by ah.created_at, ah.id) from garden.attention_history ah where ah.owner_id = v_owner), '[]'::jsonb),
    'recurrence_rules', coalesce((select jsonb_agg(jsonb_build_object('id', rr.id, 'garden_id', rr.garden_id, 'grow_cycle_id', rr.grow_cycle_id, 'purpose', rr.purpose, 'schedule_type', rr.schedule_type, 'interval_days', rr.interval_days, 'anchor_on', rr.anchor_on, 'active', rr.active, 'paused_reason', rr.paused_reason, 'created_at', rr.created_at, 'updated_at', rr.updated_at) order by rr.created_at, rr.id) from garden.recurrence_rules rr where rr.owner_id = v_owner), '[]'::jsonb),
    'maintenance_sessions', coalesce((select jsonb_agg(jsonb_build_object('id', ms.id, 'state', ms.state, 'started_at', ms.started_at, 'completed_at', ms.completed_at, 'cursor_position', ms.cursor_position, 'positions', coalesce((select jsonb_agg(jsonb_build_object('id', msp.id, 'garden_id', msp.garden_id, 'position_id', msp.position_id, 'captured_grow_cycle_id', msp.captured_grow_cycle_id, 'position_number', msp.position_number, 'ordinal', msp.ordinal, 'progress', msp.progress, 'visual_review_event_id', msp.visual_review_event_id, 'progressed_at', msp.progressed_at) order by msp.ordinal) from garden.maintenance_session_positions msp where msp.session_id = ms.id), '[]'::jsonb)) order by ms.started_at, ms.id) from garden.maintenance_sessions ms where ms.owner_id = v_owner), '[]'::jsonb),
    'photo_manifest', coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'event_id', ph.event_id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename, 'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256, 'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status, 'width', ph.width, 'height', ph.height, 'created_at', ph.created_at) order by ph.created_at, ph.id) from garden.photos ph where ph.owner_id = v_owner), '[]'::jsonb)
  );
end;
$$;


--
-- Name: garden_get_ai_ask_context(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_ai_ask_context() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: garden_get_ai_draft_cycle_context(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_ai_draft_cycle_context(p_grow_cycle_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_owner uuid := (select auth.uid()); v_context jsonb;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from garden.grow_cycles where id=p_grow_cycle_id and owner_id=v_owner) then raise exception 'Grow cycle not found'; end if;
  v_context := garden.resolve_cycle_evidence(v_owner, p_grow_cycle_id, now(), '{}'::uuid[], '{}'::uuid[]);
  return v_context || jsonb_build_object('context_schema_version', 'garden_ai_context_v1', 'selected_photo', jsonb_build_object('id','ephemeral-photo','source','pending_observation'));
end; $$;


--
-- Name: garden_get_ai_garden_maintenance_context(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_ai_garden_maintenance_context(p_grow_cycle_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: garden_get_attention(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_attention() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'garden_id', a.garden_id,
    'garden_name', g.name,
    'grow_cycle_id', a.grow_cycle_id,
    'position_id', context.position_id,
    'position_number', context.position_number,
    'crop_name', context.crop_name,
    'purpose', a.purpose,
    'subject_key', a.subject_key,
    'title', a.title,
    'origin', a.origin,
    'due_on', a.due_on,
    'next_review_on', a.next_review_on,
    'created_at', a.created_at
  ) order by
    case when a.due_on is not null and a.due_on < current_date then 0
         when a.due_on = current_date or a.next_review_on <= current_date then 1
         when a.due_on is null then 2 else 3 end,
    a.due_on nulls last, a.created_at, a.id), '[]'::jsonb)
  from garden.attention_items a
  join garden.gardens g on g.id = a.garden_id
  left join lateral (
    select o.position_id, p.position_number, c.common_name as crop_name
    from garden.grow_cycles gc
    join garden.cycle_occupancies o
      on o.grow_cycle_id = gc.id and o.occupied_until is null
    join garden.positions p on p.id = o.position_id
    join garden.crops c on c.id = gc.crop_id
    where gc.id = a.grow_cycle_id
      and gc.owner_id = a.owner_id
      and gc.state = 'active'
    limit 1
  ) context on a.grow_cycle_id is not null
  where a.owner_id = public.garden_owner_id()
    and a.status = 'open';
$$;


--
-- Name: garden_get_control_v2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_control_v2() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(public.garden_get_control_v2(current_date)->'positions', '[]'::jsonb)
$$;


--
-- Name: garden_get_control_v2(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_control_v2(p_reference_date date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
  for v_garden in
    select value from jsonb_array_elements(coalesce(v_payload->'gardens', '[]'::jsonb))
  loop
    v_positions := '[]'::jsonb;
    v_confirmed := 0;

    for v_position in
      select value from jsonb_array_elements(coalesce(v_garden->'positions', '[]'::jsonb))
    loop
      v_cycle := nullif(v_position->>'grow_cycle_id', '')::uuid;
      v_evidence := null;

      if v_cycle is not null then
        select jsonb_build_object(
          'event_id', e.id,
          'occurred_on',
            case
              when e.event_type = 'germination_observed'
              then coalesce(
                nullif(e.event_data->>'occurred_on', '')::date,
                (e.occurred_at at time zone 'UTC')::date
              )
              else null
            end,
          'confirmed_by',
            case
              when e.event_type = 'germination_confirmed'
              then nullif(e.event_data->>'confirmed_by', '')::date
              else null
            end,
          'confirmation_status',
            case
              when e.event_type = 'germination_confirmed'
              then 'confirmed'
              else null
            end,
          'note', e.note,
          'data', e.event_data
        )
        into v_evidence
        from garden.events e
        where e.grow_cycle_id = v_cycle
          and e.invalidated_at is null
          and (
            (
              e.event_type = 'germination_observed'
              and coalesce(
                nullif(e.event_data->>'occurred_on', '')::date,
                (e.occurred_at at time zone 'UTC')::date
              ) <= v_reference
            )
            or
            (
              e.event_type = 'germination_confirmed'
              and nullif(e.event_data->>'confirmed_by', '')::date <= v_reference
            )
          )
        order by
          case when e.event_type = 'germination_observed' then 0 else 1 end,
          e.occurred_at desc,
          e.id desc
        limit 1;
      end if;

      v_updated := jsonb_set(
        v_position,
        '{germination}',
        jsonb_build_object(
          'status',
          case when v_evidence is null then 'no_observation' else 'confirmed' end,
          'evidence', v_evidence
        ),
        true
      );

      if v_evidence is not null then
        v_confirmed := v_confirmed + 1;
      end if;

      v_positions := v_positions || jsonb_build_array(v_updated);
    end loop;

    v_garden := jsonb_set(v_garden, '{positions}', v_positions, true);
    v_garden := jsonb_set(
      v_garden,
      '{germination_coverage,confirmed_positions}',
      to_jsonb(v_confirmed),
      true
    );

    v_gardens := v_gardens || jsonb_build_array(v_garden);
  end loop;

  return jsonb_set(v_payload, '{gardens}', v_gardens, true);
end;
$$;


--
-- Name: garden_get_cycle(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_cycle(p_grow_cycle_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_set(public.garden_get_cycle_legacy(p_grow_cycle_id), '{cover_photo}', coalesce((select jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename, 'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256, 'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status) from garden.grow_cycles gc join garden.photos ph on ph.id = gc.cover_photo_id and ph.upload_status = 'uploaded' where gc.id = p_grow_cycle_id and gc.owner_id = public.garden_owner_id()), 'null'::jsonb), true)
$$;


--
-- Name: garden_get_garden(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_garden(p_garden_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'id', g.id, 'name', g.name, 'system_model', g.system_model, 'position_capacity', g.position_capacity, 'map_layout', g.map_layout,
    'layout_sites', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'position_id', s.position_id, 'position_number', p.position_number, 'site_kind', s.site_kind, 'is_active', s.is_active, 'grid_x', s.grid_x, 'grid_y', s.grid_y, 'label', s.label) order by s.grid_y, s.grid_x, s.id) from garden.layout_sites s left join garden.positions p on p.id = s.position_id where s.garden_id = g.id), '[]'::jsonb),
    'positions', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'position_number', p.position_number,
        'current_cycle', case when current_cycle.id is null then null else jsonb_build_object('id', current_cycle.id, 'crop_name', current_crop.common_name, 'planted_on', current_cycle.planted_on, 'planted_on_precision', current_cycle.planted_on_precision, 'harvest_readiness', current_cycle.harvest_readiness,
          'photo', (select jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename, 'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256, 'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status) from garden.events e join garden.photos ph on ph.event_id = e.id and ph.upload_status = 'uploaded' where e.grow_cycle_id = current_cycle.id and e.invalidated_at is null order by coalesce(ph.captured_at, e.occurred_at) desc, ph.created_at desc limit 1)
        ) end,
        'previous_cycles', coalesce(history.cycles, '[]'::jsonb)) order by p.position_number)
      from garden.positions p
      left join garden.cycle_occupancies current_occupancy on current_occupancy.position_id = p.id and current_occupancy.occupied_until is null
      left join garden.grow_cycles current_cycle on current_cycle.id = current_occupancy.grow_cycle_id and current_cycle.state = 'active'
      left join garden.crops current_crop on current_crop.id = current_cycle.crop_id
      left join lateral (select jsonb_agg(jsonb_build_object('id', historical_cycle.id, 'crop_name', historical_crop.common_name, 'planted_on', historical_cycle.planted_on, 'planted_on_precision', historical_cycle.planted_on_precision, 'harvest_readiness', historical_cycle.harvest_readiness, 'state', historical_cycle.state, 'last_occupied_on', historical.last_occupied_on) order by historical.last_occupied_on desc nulls last, historical_cycle.created_at desc) as cycles from (select o.grow_cycle_id, max(coalesce(o.occupied_until, o.occupied_from)) as last_occupied_on from garden.cycle_occupancies o where o.position_id = p.id and o.occupied_until is not null group by o.grow_cycle_id) historical join garden.grow_cycles historical_cycle on historical_cycle.id = historical.grow_cycle_id join garden.crops historical_crop on historical_crop.id = historical_cycle.crop_id) history on true
      where p.garden_id = g.id
    ), '[]'::jsonb)
  ) into v_result from garden.gardens g where g.id = p_garden_id and g.owner_id = public.garden_owner_id();
  if v_result is null then raise exception 'Garden not found'; end if;
  return v_result;
end;
$$;


--
-- Name: garden_get_garden_cover_photos(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_garden_cover_photos(p_garden_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename, 'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256, 'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status, 'event_id', ph.event_id, 'event_type', coalesce(e.event_type, 'observation'), 'is_cover', ph.id = g.cover_photo_id) order by (ph.id = g.cover_photo_id) desc, ph.created_at desc), '[]'::jsonb)
  from garden.gardens g left join garden.photos ph on ph.owner_id = g.owner_id and ph.upload_status = 'uploaded' and ph.garden_id = g.id left join garden.events e on e.id = ph.event_id and e.invalidated_at is null
  where g.id = p_garden_id and g.owner_id = public.garden_owner_id()
$$;


--
-- Name: garden_get_garden_summary_context(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_garden_summary_context(p_scope_type text, p_garden_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: garden_get_garden_summary_results(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_garden_summary_results() RETURNS SETOF jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_build_object(
    'id', r.id,
    'proposal', r.proposal,
    'created_at', r.created_at,
    'language', r.usage_metadata->>'language',
    'scope_type', r.evidence_refs->>'scope_type',
    'scope_id', nullif(r.evidence_refs->>'scope_id',''),
    'material_fingerprint', r.evidence_refs->>'material_fingerprint'
  )
  from garden.ai_requests r
  where r.owner_id = auth.uid()
    and r.request_type in ('garden_summary_global', 'garden_summary_local')
    and r.status = 'completed'
    and r.proposal is not null
  order by r.created_at desc;
$$;


--
-- Name: garden_get_guest_garden_stories(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_guest_garden_stories(p_garden_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'created_at', s.created_at, 'revoked_at', s.revoked_at, 'active', s.revoked_at is null
  ) order by s.created_at desc), '[]'::jsonb)
  from garden.guest_garden_stories s
  where s.garden_id = p_garden_id and s.owner_id = public.garden_owner_id()
$$;


--
-- Name: garden_get_guest_garden_story(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_guest_garden_story(p_token_hash text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_story garden.guest_garden_stories%rowtype;
  v_garden jsonb;
  v_cycles jsonb;
  v_history jsonb;
  v_events jsonb;
  v_photos jsonb;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Guest garden story not found'; end if;
  select s.* into v_story from garden.guest_garden_stories s where s.token_hash = p_token_hash and s.revoked_at is null;
  if not found then raise exception 'Guest garden story not found'; end if;

  select jsonb_build_object('id', g.id, 'name', g.name, 'system_model', g.system_model)
    into v_garden from garden.gardens g where g.id = v_story.garden_id and g.owner_id = v_story.owner_id;
  if v_garden is null then raise exception 'Guest garden story not found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'grow_cycle_id', gc.id, 'crop_name', c.common_name, 'planted_on', gc.planted_on,
    'planted_on_precision', gc.planted_on_precision, 'state', gc.state,
    'position_number', p.position_number
  ) order by gc.planted_on nulls last, p.position_number), '[]'::jsonb)
  into v_cycles
  from garden.grow_cycles gc
  join garden.crops c on c.id = gc.crop_id
  join lateral (
    select o.position_id from garden.cycle_occupancies o
    where o.grow_cycle_id = gc.id order by (o.occupied_until is null) desc, o.occupied_from desc nulls last, o.created_at desc, o.id desc limit 1
  ) latest on true
  join garden.positions p on p.id = latest.position_id
  where gc.owner_id = v_story.owner_id and p.garden_id = v_story.garden_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'grow_cycle_id', e.grow_cycle_id, 'event_type', e.event_type,
    'occurred_at', e.occurred_at, 'occurred_at_precision', coalesce(e.event_data->>'occurred_at_precision', 'timestamp'),
    'occurred_on', e.event_data->>'occurred_on', 'note', e.note,
    'event_data', e.event_data, 'crop_name', c.common_name, 'position_number', p.position_number,
    'photo', case when ph.id is null then null else jsonb_build_object(
      'id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename,
      'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256,
      'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status
    ) end
  ) order by e.occurred_at desc, e.id desc), '[]'::jsonb)
  into v_events
  from garden.events e
  join garden.grow_cycles gc on gc.id = e.grow_cycle_id
  join garden.crops c on c.id = gc.crop_id
  left join lateral (
    select o.position_id from garden.cycle_occupancies o where o.grow_cycle_id = e.grow_cycle_id
    order by (o.occupied_until is null) desc, o.occupied_from desc nulls last, o.created_at desc, o.id desc limit 1
  ) latest on true
  left join garden.positions p on p.id = latest.position_id
  left join garden.photos ph on ph.event_id = e.id and ph.upload_status = 'uploaded'
  where e.owner_id = v_story.owner_id and p.garden_id = v_story.garden_id and e.invalidated_at is null and e.created_at <= v_story.created_at;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ph.id, 'event_type', 'photo_evidence', 'grow_cycle_id', ph.import_provenance->>'grow_cycle_id',
    'occurred_at', coalesce(ph.captured_at, ph.created_at), 'occurred_at_precision', ph.captured_at_precision,
    'occurred_on', case when ph.captured_at is null then null else ph.captured_at::date end,
    'note', null, 'event_data', '{}'::jsonb, 'crop_name', null, 'position_number', null,
    'photo', jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename,
      'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256,
      'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status)
  ) order by coalesce(ph.captured_at, ph.created_at) desc, ph.id desc), '[]'::jsonb)
  into v_photos
  from garden.photos ph
  where ph.owner_id = v_story.owner_id and ph.upload_status = 'uploaded' and ph.event_id is null
    and ph.media_scope in ('cycle_evidence', 'garden_general')
    and (
      ph.import_provenance->>'garden_id' = v_story.garden_id::text
      or exists (
        select 1
        from garden.grow_cycles photo_cycle
        join garden.cycle_occupancies photo_occupancy on photo_occupancy.grow_cycle_id = photo_cycle.id
        join garden.positions photo_position on photo_position.id = photo_occupancy.position_id
        where photo_cycle.owner_id = v_story.owner_id
          and photo_position.garden_id = v_story.garden_id
          and ph.import_provenance->>'grow_cycle_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and photo_cycle.id = (ph.import_provenance->>'grow_cycle_id')::uuid
      )
    );

  v_history := coalesce(v_events, '[]'::jsonb) || coalesce(v_photos, '[]'::jsonb);
  return jsonb_build_object('id', v_story.id, 'garden', v_garden, 'cycles', v_cycles, 'created_at', v_story.created_at, 'history', v_history);
end;
$_$;


--
-- Name: garden_get_guest_plant_stories(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_guest_plant_stories(p_grow_cycle_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'created_at', s.created_at, 'revoked_at', s.revoked_at,
    'active', s.revoked_at is null
  ) order by s.created_at desc), '[]'::jsonb)
  from garden.guest_plant_stories s
  where s.owner_id = public.garden_owner_id() and s.grow_cycle_id = p_grow_cycle_id
$$;


--
-- Name: garden_get_guest_plant_story_v2(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_guest_plant_story_v2(p_token_hash text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: garden_get_harvest_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_harvest_history() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  with harvests as (
    select
      e.id as event_id,
      e.grow_cycle_id,
      e.note,
      e.occurred_at,
      coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date) as occurred_on,
      g.id as garden_id,
      g.name as garden_name,
      p.id as position_id,
      p.position_number,
      c.common_name as crop_name
    from garden.events e
    join garden.grow_cycles gc on gc.id = e.grow_cycle_id
    join garden.crops c on c.id = gc.crop_id
    join garden.gardens g on g.owner_id = e.owner_id
    left join lateral (
      select o.position_id
      from garden.cycle_occupancies o
      where o.grow_cycle_id = e.grow_cycle_id
      order by
        case when o.occupied_from is not null and o.occupied_from <= coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date)
          and (o.occupied_until is null or o.occupied_until > coalesce(nullif(e.event_data->>'occurred_on', '')::date, (e.occurred_at at time zone 'UTC')::date)) then 0 else 1 end,
        (o.occupied_until is null) desc,
        o.occupied_from desc nulls last,
        o.created_at desc,
        o.id desc
      limit 1
    ) occupancy on true
    left join garden.positions p on p.id = occupancy.position_id
    where e.owner_id = public.garden_owner_id()
      and e.event_type = 'harvest'
      and e.invalidated_at is null
      and g.id = e.garden_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', event_id,
    'grow_cycle_id', grow_cycle_id,
    'garden_id', garden_id,
    'garden_name', garden_name,
    'position_id', position_id,
    'position_number', position_number,
    'crop_name', crop_name,
    'occurred_on', occurred_on,
    'occurred_at', occurred_at,
    'note', note
  ) order by occurred_on desc, occurred_at desc, event_id desc), '[]'::jsonb)
  from (select * from harvests order by occurred_on desc, occurred_at desc, event_id desc limit 200) bounded;
$$;


--
-- Name: garden_get_home(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_home() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'name', g.name, 'system_model', g.system_model,
    'position_capacity', g.position_capacity, 'map_layout', g.map_layout,
    'active_positions', coalesce(active.active_positions, 0),
    'cover_photo', case when cp.id is null then null else jsonb_build_object(
      'id', cp.id, 'storage_path', cp.storage_path, 'original_filename', cp.original_filename,
      'content_type', cp.content_type, 'byte_size', cp.byte_size, 'checksum_sha256', cp.checksum_sha256,
      'captured_at', cp.captured_at, 'captured_at_precision', cp.captured_at_precision, 'upload_status', cp.upload_status
    ) end
  ) order by g.created_at), '[]'::jsonb)
  from garden.gardens g
  left join garden.photos cp on cp.id = g.cover_photo_id and cp.owner_id = g.owner_id and cp.upload_status = 'uploaded'
  left join lateral (
    select count(*)::integer as active_positions from garden.positions p
    join garden.cycle_occupancies o on o.position_id = p.id and o.occupied_until is null
    where p.garden_id = g.id
  ) active on true
  where g.owner_id = public.garden_owner_id()
$$;


--
-- Name: garden_get_home_dashboard(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_home_dashboard(p_visit_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id(); v_settings garden.owner_settings%rowtype;
  v_state garden.owner_home_state%rowtype; v_visit garden.home_visits%rowtype;
  v_cursor bigint; v_now timestamptz := now(); v_is_first_visit boolean;
  v_gardens jsonb; v_changes jsonb; v_attention jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  insert into garden.owner_settings(owner_id) values (v_owner) on conflict (owner_id) do nothing;
  insert into garden.owner_home_state(owner_id) values (v_owner) on conflict (owner_id) do nothing;
  select * into v_settings from garden.owner_settings where owner_id = v_owner for update;
  select * into v_state from garden.owner_home_state where owner_id = v_owner for update;
  select * into v_visit from garden.home_visits where owner_id = v_owner
    and last_gardens_access_at >= v_now - make_interval(mins => v_settings.since_last_time_visit_gap_minutes)
  order by last_gardens_access_at desc limit 1 for update;
  if not found then
    insert into garden.home_visits(id, owner_id, base_cursor, base_shown_at, snapshot_cursor, snapshot_at, opened_at, last_gardens_access_at, visit_gap_minutes, config_version)
    values (gen_random_uuid(), v_owner, v_state.last_shown_cursor, v_state.last_shown_at, v_state.last_shown_cursor, v_now, v_now, v_now, v_settings.since_last_time_visit_gap_minutes, v_settings.config_version)
    returning * into v_visit;
  else
    update garden.home_visits set last_gardens_access_at = v_now where id = v_visit.id returning * into v_visit;
  end if;
  select coalesce(max(cursor), 0) into v_cursor from garden.owner_change_log where owner_id = v_owner;
  update garden.home_visits set snapshot_cursor = v_cursor, snapshot_at = v_now where id = v_visit.id returning * into v_visit;
  v_is_first_visit := v_visit.base_shown_at is null;
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'system_model', g.system_model, 'position_capacity', g.position_capacity, 'map_layout', g.map_layout, 'active_positions', coalesce(active.active_positions, 0)) order by g.created_at), '[]'::jsonb) into v_gardens
  from garden.gardens g left join lateral (select count(*)::integer as active_positions from garden.positions p join garden.cycle_occupancies o on o.position_id = p.id and o.occupied_until is null where p.garden_id = g.id) active on true where g.owner_id = v_owner;
  select coalesce(jsonb_agg(jsonb_build_object('cursor', l.cursor, 'kind', l.change_kind, 'garden_id', l.garden_id, 'grow_cycle_id', l.grow_cycle_id, 'occurred_at', l.occurred_at, 'committed_at', l.committed_at, 'summary', l.summary) order by l.cursor desc), '[]'::jsonb) into v_changes
  from garden.owner_change_log l where l.owner_id = v_owner and not v_is_first_visit and l.cursor > v_visit.base_cursor and l.cursor <= v_visit.snapshot_cursor;
  select public.garden_get_attention() into v_attention;
  return jsonb_build_object('visit', jsonb_build_object('id', v_visit.id, 'base_cursor', v_visit.base_cursor, 'snapshot_cursor', v_visit.snapshot_cursor, 'snapshot_at', v_visit.snapshot_at, 'first_visit', v_is_first_visit, 'visit_gap_minutes', v_visit.visit_gap_minutes), 'gardens', v_gardens, 'since_last_time', jsonb_build_object('changes', v_changes), 'attention', jsonb_build_object('items', v_attention));
end;
$$;


--
-- Name: garden_get_home_media(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_home_media() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_build_object(
    'home_headline', coalesce(nullif(trim(s.home_headline), ''), 'Tu jardín, vivo.'),
    'home_hero_photo', case when ph.id is null then null else jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename, 'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256, 'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status) end,
    'home_hero_choices', coalesce((select jsonb_agg(jsonb_build_object('id', choices.id, 'storage_path', choices.storage_path, 'original_filename', choices.original_filename, 'content_type', choices.content_type, 'byte_size', choices.byte_size, 'checksum_sha256', choices.checksum_sha256, 'captured_at', choices.captured_at, 'captured_at_precision', choices.captured_at_precision, 'upload_status', choices.upload_status) order by choices.created_at desc) from garden.photos choices where choices.owner_id = public.garden_owner_id() and choices.upload_status = 'uploaded' and choices.media_scope in ('home_hero','garden_cover','garden_general','cycle_evidence')), '[]'::jsonb)
  )
  from garden.owner_settings s left join garden.photos ph on ph.id = s.home_hero_photo_id and ph.owner_id = s.owner_id and ph.upload_status = 'uploaded'
  where s.owner_id = public.garden_owner_id();
$$;


--
-- Name: garden_get_import_candidates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_import_candidates() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ic.id, 'batch_id', ic.batch_id, 'source_label', ib.source_label, 'candidate_key', ic.candidate_key,
    'candidate_type', ic.candidate_type, 'grow_cycle_id', ic.grow_cycle_id, 'occurred_on', ic.occurred_on,
    'occurred_on_precision', ic.occurred_on_precision, 'note', ic.note, 'source_data', ic.source_data,
    'decision', ic.decision, 'decision_note', ic.decision_note, 'confirmed_event_id', ic.confirmed_event_id,
    'created_at', ic.created_at, 'decided_at', ic.decided_at
  ) order by case ic.decision when 'pending' then 0 else 1 end, ic.created_at desc), '[]'::jsonb)
  from garden.import_candidates ic join garden.import_batches ib on ib.id = ic.batch_id
  where ic.owner_id = public.garden_owner_id()
$$;


--
-- Name: garden_get_maintenance_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_maintenance_session(p_session_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_build_object(
    'id', s.id, 'state', s.state, 'started_at', s.started_at, 'cursor_position', s.cursor_position,
    'positions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', sp.id, 'garden_id', sp.garden_id, 'garden_name', g.name, 'position_id', sp.position_id,
      'position_number', sp.position_number, 'captured_grow_cycle_id', sp.captured_grow_cycle_id,
      'current_grow_cycle_id', current_cycle.grow_cycle_id, 'crop_name', c.common_name,
      'progress', sp.progress, 'inspected_at', sp.inspected_at,
      'inspection_source', sp.inspection_source,
      'health_confirmed', exists (
        select 1 from garden.events health_event
        where health_event.id = sp.visual_review_event_id and health_event.invalidated_at is null
      ),
      'ordinal', sp.ordinal
    ) order by sp.ordinal) from garden.maintenance_session_positions sp
      join garden.gardens g on g.id = sp.garden_id
      left join garden.cycle_occupancies current_cycle on current_cycle.position_id = sp.position_id and current_cycle.occupied_until is null
      left join garden.grow_cycles gc on gc.id = current_cycle.grow_cycle_id
      left join garden.crops c on c.id = gc.crop_id where sp.session_id = s.id), '[]'::jsonb)
  ) from garden.maintenance_sessions s where s.id = p_session_id and s.owner_id = public.garden_owner_id()
$$;


--
-- Name: garden_get_meaningful_change_results(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_meaningful_change_results() RETURNS SETOF jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_build_object(
    'id', r.id,
    'proposal', r.proposal,
    'created_at', r.created_at,
    'language', r.usage_metadata->>'language'
  )
  from garden.ai_requests r
  where r.owner_id = auth.uid()
    and r.request_type = 'meaningful_change'
    and r.status = 'completed'
    and r.proposal is not null
  order by r.created_at desc;
$$;


--
-- Name: garden_get_open_maintenance_session(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_open_maintenance_session() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_build_object('id', s.id, 'state', s.state, 'started_at', s.started_at)
  from garden.maintenance_sessions s
  where s.owner_id = public.garden_owner_id() and s.state in ('in_progress', 'paused')
  order by s.started_at desc limit 1
$$;


--
-- Name: garden_get_system_maintenance_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_get_system_maintenance_events() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: garden_invalidate_event(uuid, uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_invalidate_event(p_request_id uuid, p_event_id uuid, p_expected_revision integer, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('event_id', p_event_id, 'expected_revision', p_expected_revision, 'reason', trim(p_reason));
  v_response jsonb;
  v_event garden.events%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'invalidate_event', v_payload);
  if v_response is not null then return v_response; end if;
  if char_length(trim(p_reason)) not between 1 and 500 then raise exception 'Invalidation reason is required'; end if;
  select * into v_event from garden.events where id = p_event_id and owner_id = v_owner for update;
  if not found or v_event.invalidated_at is not null then raise exception 'Current event not found'; end if;
  if v_event.revision <> p_expected_revision then raise exception 'Event changed; review it before invalidating'; end if;
  update garden.events set invalidated_at = now(), invalidated_by = v_owner, invalidated_reason = trim(p_reason), revision = revision + 1 where id = p_event_id;
  insert into garden.event_revisions(owner_id, event_id, revision_number, operation, previous_values, next_values, reason)
  values (v_owner, p_event_id, v_event.revision + 1, 'invalidated', jsonb_build_object('invalidated_at', v_event.invalidated_at, 'note', v_event.note, 'occurred_at', v_event.occurred_at), jsonb_build_object('invalidated_at', now()), trim(p_reason));
  v_response := jsonb_build_object('event_id', p_event_id, 'revision', v_event.revision + 1, 'invalidated', true);
  perform garden.store_command_response(v_owner, p_request_id, 'invalidate_event', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_lab_service_get_machine_performance(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_lab_service_get_machine_performance(p_owner uuid, p_garden_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
with target as (
 select g.id,g.name,g.system_model,g.position_capacity
 from garden.gardens g where g.id=p_garden_id and g.owner_id=p_owner
), cycles as (
 select distinct gc.id,gc.state,gc.planted_on,min(o.occupied_from)::date occupied_from,max(o.occupied_until)::date occupied_until
 from target t join garden.positions p on p.garden_id=t.id
 join garden.cycle_occupancies o on o.position_id=p.id
 join garden.grow_cycles gc on gc.id=o.grow_cycle_id and gc.owner_id=p_owner
 group by gc.id,gc.state,gc.planted_on
), facts as (
 select distinct e.id,e.event_type,e.occurred_at
 from garden.events e join cycles c on c.id=e.grow_cycle_id
 where e.owner_id=p_owner and e.invalidated_at is null
)
select case when t.id is null then null else jsonb_build_object(
 'garden',jsonb_build_object('id',t.id,'name',t.name,'system_model',t.system_model,'position_capacity',t.position_capacity),
 'evidence',jsonb_build_object(
  'active_cycles',(select count(*) from cycles where state='active'),
  'completed_cycles',(select count(*) from cycles where state='closed'),
  'germination_events',(select count(*) from facts where event_type in ('germination_observed','germination_confirmed')),
  'harvest_events',(select count(*) from facts where event_type='harvest'),
  'incident_events',(select count(*) from facts where event_type='incident_opened'),
  'first_cycle_on',(select min(coalesce(planted_on,occupied_from)) from cycles),
  'last_fact_at',(select max(occurred_at) from facts)
 ),
 'source','garden_x_canonical_read_only'
) end from (select 1) seed left join target t on true
$$;


--
-- Name: garden_lab_service_get_machine_storage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_lab_service_get_machine_storage(p_owner uuid) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_build_object('instances',coalesce((select jsonb_agg(m.state order by m.machine_key) from garden_lab.machine_state m where m.owner_id=p_owner),'[]'::jsonb));
$$;


--
-- Name: garden_lab_service_get_seed_storage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_lab_service_get_seed_storage(p_owner uuid) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select jsonb_build_object(
    'seedUserState', coalesce((select jsonb_object_agg(s.seed_key, jsonb_build_object('packageStatus',s.package_status,'quantityLevel',s.quantity_level,'storageLocation',s.storage_location,'purchaseDate',s.purchase_date,'purchaseYear',s.legacy_purchase_year,'legacyPurchaseYear',s.legacy_purchase_year,'lastGerminationTestAt',s.germination_test_date,'lastGerminationResultPct',s.germination_result_pct,'notes',s.notes,'archived',s.archived)) from garden_lab.seed_personal_state s where s.owner_id=p_owner), '{}'::jsonb),
    'customSeeds', coalesce((select jsonb_agg(jsonb_build_object('id',c.seed_key,'packetName',c.packet_name,'brand',c.brand,'aliases','[]'::jsonb,'createdInLab',true) order by c.created_at) from garden_lab.custom_seeds c where c.owner_id=p_owner), '[]'::jsonb),
    'importCompleted', exists(select 1 from garden_lab.seed_personal_state s where s.owner_id=p_owner) or exists(select 1 from garden_lab.custom_seeds c where c.owner_id=p_owner)
  );
$$;


--
-- Name: garden_lab_service_save_machine(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_lab_service_save_machine(p_owner uuid, p_instance jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$ begin
 if nullif(p_instance->>'id','') is null then raise exception 'invalid machine'; end if;
 insert into garden_lab.machine_state(owner_id,machine_key,state,updated_at) values(p_owner,p_instance->>'id',p_instance,now()) on conflict(owner_id,machine_key) do update set state=excluded.state,updated_at=now();
 return jsonb_build_object('ok',true,'instance',p_instance);
end $$;


--
-- Name: garden_lab_service_seed_operation(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_lab_service_seed_operation(p_owner uuid, p_payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare k text; v jsonb; s jsonb;
begin
 if p_payload->>'operation'='delete-custom' then
  delete from garden_lab.seed_personal_state where owner_id=p_owner and seed_key=p_payload->>'seedKey';
  delete from garden_lab.custom_seeds where owner_id=p_owner and seed_key=p_payload->>'seedKey';
 else
  if p_payload->>'operation'='import' then
   for k,v in select key,value from jsonb_each(coalesce(p_payload->'seedUserState','{}'::jsonb)) loop
    insert into garden_lab.seed_personal_state(owner_id,seed_key,package_status,quantity_level,storage_location,purchase_date,legacy_purchase_year,germination_test_date,germination_result_pct,notes,archived,updated_at)
    values(p_owner,k,case when v->>'packageStatus' in ('opened','unopened','unknown') then v->>'packageStatus' else 'unknown' end,case when v->>'quantityLevel' in ('full','high','medium','low','almost_empty','unknown') then v->>'quantityLevel' else 'unknown' end,nullif(v->>'storageLocation',''),case when v->>'purchaseDate' ~ '^\d{4}-\d{2}-\d{2}$' then (v->>'purchaseDate')::date end,coalesce(nullif(v->>'legacyPurchaseYear','')::int,nullif(v->>'purchaseYear','')::int),case when v->>'lastGerminationTestAt' ~ '^\d{4}-\d{2}-\d{2}$' then (v->>'lastGerminationTestAt')::date end,case when (v->>'lastGerminationResultPct') ~ '^\d+$' and (v->>'lastGerminationResultPct')::int between 0 and 100 then (v->>'lastGerminationResultPct')::int end,nullif(v->>'notes',''),coalesce((v->>'archived')::boolean,false),now())
    on conflict(owner_id,seed_key) do update set package_status=excluded.package_status,quantity_level=excluded.quantity_level,storage_location=excluded.storage_location,purchase_date=excluded.purchase_date,legacy_purchase_year=excluded.legacy_purchase_year,germination_test_date=excluded.germination_test_date,germination_result_pct=excluded.germination_result_pct,notes=excluded.notes,archived=excluded.archived,updated_at=now();
   end loop;
   for s in select value from jsonb_array_elements(coalesce(p_payload->'customSeeds','[]'::jsonb)) loop
    if nullif(s->>'id','') is not null and nullif(btrim(s->>'packetName'),'') is not null then
     insert into garden_lab.custom_seeds(owner_id,seed_key,packet_name,brand,updated_at) values(p_owner,s->>'id',btrim(s->>'packetName'),nullif(s->>'brand',''),now()) on conflict(owner_id,seed_key) do update set packet_name=excluded.packet_name,brand=excluded.brand,updated_at=now();
    end if;
   end loop;
  else
   k:=p_payload->>'seedKey'; v:=p_payload->'state';
   if k is not null and v is not null then
    insert into garden_lab.seed_personal_state(owner_id,seed_key,package_status,quantity_level,storage_location,purchase_date,legacy_purchase_year,germination_test_date,germination_result_pct,notes,archived,updated_at)
    values(p_owner,k,case when v->>'packageStatus' in ('opened','unopened','unknown') then v->>'packageStatus' else 'unknown' end,case when v->>'quantityLevel' in ('full','high','medium','low','almost_empty','unknown') then v->>'quantityLevel' else 'unknown' end,nullif(v->>'storageLocation',''),case when v->>'purchaseDate' ~ '^\d{4}-\d{2}-\d{2}$' then (v->>'purchaseDate')::date end,coalesce(nullif(v->>'legacyPurchaseYear','')::int,nullif(v->>'purchaseYear','')::int),case when v->>'lastGerminationTestAt' ~ '^\d{4}-\d{2}-\d{2}$' then (v->>'lastGerminationTestAt')::date end,case when (v->>'lastGerminationResultPct') ~ '^\d+$' and (v->>'lastGerminationResultPct')::int between 0 and 100 then (v->>'lastGerminationResultPct')::int end,nullif(v->>'notes',''),coalesce((v->>'archived')::boolean,false),now())
    on conflict(owner_id,seed_key) do update set package_status=excluded.package_status,quantity_level=excluded.quantity_level,storage_location=excluded.storage_location,purchase_date=excluded.purchase_date,legacy_purchase_year=excluded.legacy_purchase_year,germination_test_date=excluded.germination_test_date,germination_result_pct=excluded.germination_result_pct,notes=excluded.notes,archived=excluded.archived,updated_at=now();
   end if;
  end if;
 end if;
 return jsonb_build_object('ok',true);
end $_$;


--
-- Name: garden_mark_maintenance_position_inspected(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_mark_maintenance_position_inspected(p_request_id uuid, p_session_position_id uuid, p_inspection_source text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
  v_position garden.maintenance_session_positions%rowtype;
  v_session garden.maintenance_sessions%rowtype;
  v_inspected_at timestamptz := now();
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_inspection_source not in ('observation', 'fact', 'manual') then raise exception 'Invalid inspection source'; end if;
  v_payload := jsonb_build_object('session_position_id', p_session_position_id, 'inspection_source', p_inspection_source);
  v_response := garden.command_response(v_owner, p_request_id, 'mark_maintenance_position_inspected', v_payload);
  if v_response is not null then return v_response; end if;
  select sp.* into v_position
  from garden.maintenance_session_positions sp
  join garden.maintenance_sessions s on s.id = sp.session_id
  where sp.id = p_session_position_id and s.owner_id = v_owner
  for update of sp;
  if not found then raise exception 'Open maintenance position not found'; end if;
  select * into v_session from garden.maintenance_sessions where id = v_position.session_id and owner_id = v_owner for update;
  if v_session.state not in ('in_progress', 'paused') then raise exception 'Open maintenance session not found'; end if;
  if v_position.progress = 'reviewed' then
    v_response := jsonb_build_object('session_id', v_session.id, 'already_inspected', true);
    perform garden.store_command_response(v_owner, p_request_id, 'mark_maintenance_position_inspected', v_payload, v_response);
    return v_response;
  end if;
  if v_position.progress = 'skipped' then raise exception 'Skipped maintenance position cannot be marked inspected'; end if;
  if v_position.captured_grow_cycle_id is null then raise exception 'Empty positions cannot be marked inspected'; end if;
  if not exists (
    select 1 from garden.cycle_occupancies
    where position_id = v_position.position_id
      and grow_cycle_id = v_position.captured_grow_cycle_id
      and occupied_until is null
  ) then raise exception 'Occupant changed; review the new cycle explicitly'; end if;
  update garden.maintenance_session_positions
  set progress = 'reviewed', inspected_at = v_inspected_at, inspection_source = p_inspection_source, progressed_at = v_inspected_at
  where id = v_position.id;
  update garden.maintenance_sessions set state = 'in_progress', cursor_position = greatest(cursor_position, v_position.ordinal) where id = v_session.id;
  v_response := jsonb_build_object('session_id', v_session.id, 'session_position_id', v_position.id, 'already_inspected', false);
  perform garden.store_command_response(v_owner, p_request_id, 'mark_maintenance_position_inspected', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_mark_photo_uploaded(uuid, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_mark_photo_uploaded(p_photo_id uuid, p_checksum_sha256 text, p_width integer DEFAULT NULL::integer, p_height integer DEFAULT NULL::integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_expected_checksum text;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select checksum_sha256 into v_expected_checksum from garden.photos
    where id = p_photo_id and owner_id = v_owner and upload_status in ('pending', 'uploaded');
  if not found then raise exception 'Photo not found'; end if;
  if v_expected_checksum is null or p_checksum_sha256 is null or p_checksum_sha256 <> v_expected_checksum then
    raise exception 'Photo integrity check failed';
  end if;
  update garden.photos set upload_status = 'uploaded', width = p_width, height = p_height
  where id = p_photo_id and owner_id = v_owner;
end;
$$;


--
-- Name: garden_move_cycle(uuid, uuid, integer, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_move_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_target_position_id uuid, p_moved_on date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'target_position_id', p_target_position_id, 'moved_on', p_moved_on);
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_target_cycle garden.grow_cycles%rowtype;
  v_source garden.cycle_occupancies%rowtype;
  v_target garden.cycle_occupancies%rowtype;
  v_source_garden uuid;
  v_target_garden uuid;
  v_event_id uuid;
  v_target_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'move_cycle', v_payload);
  if v_response is not null then return v_response; end if;
  if p_moved_on is null then raise exception 'Move date is required'; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'active' then raise exception 'Current grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before moving'; end if;
  select * into v_source from garden.cycle_occupancies where grow_cycle_id = p_grow_cycle_id and occupied_until is null for update;
  if not found then raise exception 'Current occupancy not found'; end if;
  select garden_id into v_source_garden from garden.positions where id = v_source.position_id;
  select p.garden_id into v_target_garden
    from garden.positions p
    join garden.gardens g on g.id = p.garden_id
    join garden.layout_sites s on s.position_id = p.id and s.site_kind = 'grow' and s.is_active
   where p.id = p_target_position_id and g.owner_id = v_owner;
  if v_target_garden is null then raise exception 'Target position is not available for cultivation'; end if;
  if v_target_garden <> v_source_garden then raise exception 'A cycle can only move within its garden'; end if;
  if p_target_position_id = v_source.position_id then raise exception 'Target position is already current'; end if;
  if v_source.occupied_from is not null and p_moved_on < v_source.occupied_from then raise exception 'Move cannot precede occupancy'; end if;

  select * into v_target from garden.cycle_occupancies where position_id = p_target_position_id and occupied_until is null for update;
  if found then
    select * into v_target_cycle from garden.grow_cycles where id = v_target.grow_cycle_id and owner_id = v_owner for update;
    if not found or v_target_cycle.state <> 'active' then raise exception 'Target position has no movable current grow cycle'; end if;
    if v_target_cycle.id = v_cycle.id then raise exception 'Target position is already current'; end if;

    update garden.cycle_occupancies set occupied_until = p_moved_on where id in (v_source.id, v_target.id);
    insert into garden.cycle_occupancies(position_id, grow_cycle_id, occupied_from)
      values (p_target_position_id, p_grow_cycle_id, p_moved_on), (v_source.position_id, v_target_cycle.id, p_moved_on);

    update garden.grow_cycles set revision = revision + 1, updated_at = now() where id in (v_cycle.id, v_target_cycle.id);
    insert into garden.events(owner_id, grow_cycle_id, event_type, note)
      values (v_owner, p_grow_cycle_id, 'cycle_moved', 'Ciclo trasladado e intercambiado de posición') returning id into v_event_id;
    insert into garden.events(owner_id, grow_cycle_id, event_type, note)
      values (v_owner, v_target_cycle.id, 'cycle_moved', 'Ciclo trasladado e intercambiado de posición') returning id into v_target_event_id;
    insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
      values
        (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'moved', jsonb_build_object('position_id', v_source.position_id), jsonb_build_object('position_id', p_target_position_id), 'movement_swap'),
        (v_owner, v_target_cycle.id, v_target_cycle.revision + 1, 'moved', jsonb_build_object('position_id', p_target_position_id), jsonb_build_object('position_id', v_source.position_id), 'movement_swap');
    v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1, 'event_id', v_event_id, 'swapped', true, 'swapped_grow_cycle_id', v_target_cycle.id, 'swapped_event_id', v_target_event_id);
  else
    insert into garden.cycle_occupancies(position_id, grow_cycle_id, occupied_from)
      values (p_target_position_id, p_grow_cycle_id, p_moved_on);
    update garden.cycle_occupancies set occupied_until = p_moved_on where id = v_source.id;
    update garden.grow_cycles set revision = revision + 1, updated_at = now() where id = p_grow_cycle_id;
    insert into garden.events(owner_id, grow_cycle_id, event_type, note)
      values (v_owner, p_grow_cycle_id, 'cycle_moved', 'Ciclo trasladado') returning id into v_event_id;
    insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
      values (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'moved', jsonb_build_object('position_id', v_source.position_id), jsonb_build_object('position_id', p_target_position_id), 'movement');
    v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1, 'event_id', v_event_id, 'swapped', false);
  end if;
  perform garden.store_command_response(v_owner, p_request_id, 'move_cycle', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_prepare_media_photo(uuid, text, uuid, text, text, bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_prepare_media_photo(p_request_id uuid, p_scope text, p_garden_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint, p_checksum_sha256 text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare v_owner uuid := public.garden_owner_id(); v_photo_id uuid; v_path text; v_extension text; v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_scope not in ('garden_cover', 'home_hero') then raise exception 'Unsupported media scope'; end if;
  if p_scope = 'garden_cover' and (p_garden_id is null or not exists (select 1 from garden.gardens g where g.id = p_garden_id and g.owner_id = v_owner)) then raise exception 'Garden not found'; end if;
  if p_scope = 'home_hero' and p_garden_id is not null then raise exception 'Home media does not belong to one garden'; end if;
  if p_original_filename is null or p_content_type not in ('image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp') or p_byte_size is null or p_byte_size <= 0 or p_checksum_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Invalid photo metadata'; end if;
  v_payload := jsonb_build_object('scope', p_scope, 'garden_id', p_garden_id, 'filename', p_original_filename, 'checksum', p_checksum_sha256);
  v_response := garden.command_response(v_owner, p_request_id, 'prepare_media_photo', v_payload); if v_response is not null then return v_response; end if;
  v_extension := case p_content_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/heic' then 'heic' when 'image/heif' then 'heif' when 'image/webp' then 'webp' end;
  v_photo_id := gen_random_uuid(); v_path := v_owner::text || '/' || v_photo_id::text || '/original.' || v_extension;
  insert into garden.photos(id, owner_id, garden_id, media_scope, storage_path, original_filename, content_type, byte_size, checksum_sha256)
  values (v_photo_id, v_owner, p_garden_id, p_scope, v_path, p_original_filename, p_content_type, p_byte_size, p_checksum_sha256);
  v_response := jsonb_build_object('photo_id', v_photo_id, 'storage_path', v_path);
  perform garden.store_command_response(v_owner, p_request_id, 'prepare_media_photo', v_payload, v_response); return v_response;
end;
$_$;


--
-- Name: garden_progress_maintenance_position(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_progress_maintenance_position(p_request_id uuid, p_session_position_id uuid, p_progress text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
  v_position garden.maintenance_session_positions%rowtype;
  v_session garden.maintenance_sessions%rowtype;
  v_event_id uuid;
  v_progressed_at timestamptz := now();
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_progress not in ('reviewed', 'skipped') then raise exception 'Invalid maintenance progress'; end if;
  v_payload := jsonb_build_object('session_position_id', p_session_position_id, 'progress', p_progress);
  v_response := garden.command_response(v_owner, p_request_id, 'progress_maintenance_position', v_payload);
  if v_response is not null then return v_response; end if;
  select sp.* into v_position
  from garden.maintenance_session_positions sp
  join garden.maintenance_sessions s on s.id = sp.session_id
  where sp.id = p_session_position_id and s.owner_id = v_owner
  for update of sp;
  if not found then raise exception 'Open maintenance position not found'; end if;
  select * into v_session from garden.maintenance_sessions where id = v_position.session_id and owner_id = v_owner for update;
  if v_session.state not in ('in_progress', 'paused') then raise exception 'Open maintenance position not found'; end if;
  if v_position.progress <> 'not_reviewed' then raise exception 'Maintenance position already progressed'; end if;
  if p_progress = 'reviewed' then
    if v_position.captured_grow_cycle_id is null then raise exception 'Empty positions can only be skipped'; end if;
    if not exists (select 1 from garden.cycle_occupancies where position_id = v_position.position_id and grow_cycle_id = v_position.captured_grow_cycle_id and occupied_until is null) then raise exception 'Occupant changed; review the new cycle explicitly'; end if;
    insert into garden.events(owner_id, garden_id, grow_cycle_id, event_type, note, event_data)
    values (v_owner, v_position.garden_id, v_position.captured_grow_cycle_id, 'visual_review', 'Se ve bien', jsonb_build_object('result', 'reassuring', 'source', 'maintenance_session', 'session_id', v_session.id)) returning id into v_event_id;
  end if;
  update garden.maintenance_session_positions
  set progress = p_progress,
      visual_review_event_id = v_event_id,
      inspected_at = case when p_progress = 'reviewed' then v_progressed_at else null end,
      inspection_source = case when p_progress = 'reviewed' then 'healthy_review' else null end,
      progressed_at = v_progressed_at
  where id = v_position.id;
  update garden.maintenance_sessions set state = 'in_progress', cursor_position = greatest(cursor_position, v_position.ordinal) where id = v_session.id;
  v_response := jsonb_build_object('session_id', v_session.id, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'progress_maintenance_position', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_record_cycle_fact(uuid, uuid, text, date, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_record_cycle_fact(p_request_id uuid, p_grow_cycle_id uuid, p_fact_type text, p_occurred_on date, p_note text DEFAULT NULL::text, p_fact_data jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_owner uuid := public.garden_owner_id();
  v_cycle_id uuid;
  v_garden_id uuid;
  v_event_id uuid;
  v_payload jsonb;
  v_response jsonb;
  v_data jsonb := coalesce(p_fact_data, '{}'::jsonb);
  v_result text;
  v_class text;
  v_incident_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_fact_type not in (
    'germination_observed', 'plant_count_observed', 'visual_review',
    'development_review', 'readiness_review', 'intervention',
    'incident_opened', 'incident_resolved'
  ) then raise exception 'Unsupported cycle fact'; end if;
  if p_occurred_on is null then raise exception 'Fact date is required'; end if;
  if jsonb_typeof(v_data) <> 'object' then raise exception 'Fact data must be an object'; end if;
  if char_length(coalesce(trim(p_note), '')) > 1000 then raise exception 'Fact note is too long'; end if;

  v_payload := jsonb_build_object(
    'grow_cycle_id', p_grow_cycle_id,
    'fact_type', p_fact_type,
    'occurred_on', p_occurred_on,
    'note', nullif(trim(p_note), ''),
    'fact_data', v_data
  );
  v_response := garden.command_response(v_owner, p_request_id, 'record_cycle_fact', v_payload);
  if v_response is not null then return v_response; end if;

  select gc.id into v_cycle_id
  from garden.grow_cycles gc
  join garden.cycle_occupancies o on o.grow_cycle_id = gc.id and o.occupied_until is null
  join garden.positions p on p.id = o.position_id
  where gc.id = p_grow_cycle_id and gc.owner_id = v_owner and gc.state = 'active'
  for update of gc;
  if not found then raise exception 'Current grow cycle not found'; end if;

  select p.garden_id into v_garden_id
  from garden.cycle_occupancies o
  join garden.positions p on p.id = o.position_id
  where o.grow_cycle_id = v_cycle_id and o.occupied_until is null;

  if p_fact_type = 'germination_observed' then
    if v_data ? 'count' then
      if (v_data->>'count') !~ '^[0-9]+$' then raise exception 'Germination count must be a non-negative integer'; end if;
    end if;
  elsif p_fact_type = 'plant_count_observed' then
    if (v_data->>'count') !~ '^[0-9]+$' then raise exception 'Plant count must be a non-negative integer'; end if;
    if coalesce(v_data->>'count_kind', '') not in ('seedlings_visible', 'plants_kept') then raise exception 'Plant count kind is required'; end if;
  elsif p_fact_type = 'visual_review' then
    v_result := v_data->>'result';
    if v_result not in ('reassuring', 'watch', 'action_required', 'insufficient_evidence') then raise exception 'Invalid visual review result'; end if;
    if v_result = 'action_required' and nullif(trim(p_note), '') is null then raise exception 'Action-required visual review needs a note'; end if;
  elsif p_fact_type = 'development_review' then
    if coalesce(v_data->>'purpose', '') not in ('evaluate_thinning', 'evaluate_pruning', 'evaluate_support', 'other') then raise exception 'Invalid development review purpose'; end if;
    if coalesce(v_data->>'result', '') not in ('ready', 'not_yet', 'not_required', 'undetermined') then raise exception 'Invalid development review result'; end if;
    if v_data->>'purpose' = 'other' and nullif(trim(p_note), '') is null then raise exception 'Other development review needs a note'; end if;
  elsif p_fact_type = 'readiness_review' then
    if coalesce(v_data->>'readiness', '') not in ('not_yet', 'evaluate', 'ready', 'not_applicable') then raise exception 'Invalid harvest readiness'; end if;
  elsif p_fact_type = 'intervention' then
    v_class := v_data->>'class';
    if v_class not in ('thinning', 'pruning', 'support', 'other') then raise exception 'Invalid intervention class'; end if;
    if v_class = 'other' and nullif(trim(p_note), '') is null then raise exception 'Other intervention needs a note'; end if;
    if v_data ? 'count_retained' and (v_data->>'count_retained') !~ '^[0-9]+$' then raise exception 'Retained count must be a non-negative integer'; end if;
    if v_data ? 'count_removed' and (v_data->>'count_removed') !~ '^[0-9]+$' then raise exception 'Removed count must be a non-negative integer'; end if;
  elsif p_fact_type = 'incident_opened' then
    if coalesce(v_data->>'severity', '') not in ('watch', 'action_required') then raise exception 'Incident severity is required'; end if;
    if nullif(trim(p_note), '') is null then raise exception 'Incident needs a description'; end if;
  elsif p_fact_type = 'incident_resolved' then
    if nullif(v_data->>'incident_event_id', '') is null then raise exception 'Incident reference is required'; end if;
    v_incident_id := (v_data->>'incident_event_id')::uuid;
    if not exists (
      select 1 from garden.events e
      where e.id = v_incident_id and e.owner_id = v_owner and e.grow_cycle_id = v_cycle_id
        and e.event_type = 'incident_opened' and e.invalidated_at is null
    ) then raise exception 'Open incident reference not found'; end if;
  end if;

  insert into garden.events(
    owner_id, garden_id, grow_cycle_id, event_type, occurred_at, note, event_data
  ) values (
    v_owner, v_garden_id, v_cycle_id, p_fact_type,
    (p_occurred_on::timestamp + interval '12 hours') at time zone 'UTC',
    nullif(trim(p_note), ''),
    jsonb_build_object(
      'source', 'direct_cycle_fact',
      'occurred_on', p_occurred_on,
      'occurred_at_precision', 'date'
    ) || v_data
  ) returning id into v_event_id;

  if p_fact_type = 'visual_review' and v_data->>'result' in ('watch', 'action_required') then
    perform garden.create_open_review_follow_up(v_owner, v_garden_id, v_cycle_id, 'visual_review', 'general');
  elsif p_fact_type = 'incident_opened' then
    perform garden.create_open_review_follow_up(v_owner, v_garden_id, v_cycle_id, 'incident', 'incident:' || v_event_id::text);
  end if;

  v_response := jsonb_build_object('event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'record_cycle_fact', v_payload, v_response);
  return v_response;
end;
$_$;


--
-- Name: garden_record_harvest(uuid, uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'note', nullif(trim(p_note), ''));
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'record_harvest', v_payload);
  if v_response is not null then return v_response; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'active' then raise exception 'Current grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before recording harvest'; end if;
  insert into garden.events(owner_id, grow_cycle_id, event_type, note)
  values (v_owner, p_grow_cycle_id, 'harvest', nullif(trim(p_note), '')) returning id into v_event_id;
  v_response := jsonb_build_object('event_id', v_event_id, 'grow_cycle_id', p_grow_cycle_id);
  perform garden.store_command_response(v_owner, p_request_id, 'record_harvest', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_record_harvest(uuid, uuid, integer, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_occurred_on date, p_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object(
    'grow_cycle_id', p_grow_cycle_id,
    'expected_revision', p_expected_revision,
    'occurred_on', p_occurred_on,
    'note', nullif(trim(p_note), '')
  );
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'record_harvest', v_payload);
  if v_response is not null then return v_response; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'active' then raise exception 'Current grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before recording harvest'; end if;
  insert into garden.events(owner_id, grow_cycle_id, event_type, occurred_at, event_data, note)
  values (
    v_owner,
    p_grow_cycle_id,
    'harvest',
    ((p_occurred_on::timestamp + interval '12 hours') at time zone 'UTC'),
    jsonb_build_object('source', 'garden_x', 'occurred_on', p_occurred_on, 'occurred_at_precision', 'date'),
    nullif(trim(p_note), '')
  ) returning id into v_event_id;
  v_response := jsonb_build_object('event_id', v_event_id, 'grow_cycle_id', p_grow_cycle_id);
  perform garden.store_command_response(v_owner, p_request_id, 'record_harvest', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_reopen_cycle(uuid, uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_reopen_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'reason', trim(p_reason));
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_occupancy garden.cycle_occupancies%rowtype;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'reopen_cycle', v_payload);
  if v_response is not null then return v_response; end if;
  if char_length(trim(p_reason)) not between 1 and 500 then raise exception 'Reopen reason is required'; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'closed' then raise exception 'Closed grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before reopening'; end if;
  select * into v_occupancy from garden.cycle_occupancies
  where grow_cycle_id = p_grow_cycle_id
  order by occupied_from desc nulls last, created_at desc, id desc
  limit 1 for update;
  if not found then raise exception 'Previous occupancy not found'; end if;
  if exists (select 1 from garden.cycle_occupancies where position_id = v_occupancy.position_id and occupied_until is null) then
    raise exception 'Position has a successor and cannot be reopened';
  end if;
  update garden.cycle_occupancies set occupied_until = null where id = v_occupancy.id;
  update garden.grow_cycles set state = 'active', revision = revision + 1, updated_at = now() where id = p_grow_cycle_id;
  insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
  values (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'reopened', jsonb_build_object('state', v_cycle.state, 'occupied_until', v_occupancy.occupied_until), jsonb_build_object('state', 'active', 'occupied_until', null), trim(p_reason));
  v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'revision', v_cycle.revision + 1);
  perform garden.store_command_response(v_owner, p_request_id, 'reopen_cycle', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_replace_cycle(uuid, uuid, integer, text, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_replace_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_crop_name text, p_planted_on date, p_planted_on_precision text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'expected_revision', p_expected_revision, 'crop_name', trim(p_crop_name), 'planted_on', p_planted_on, 'planted_on_precision', p_planted_on_precision);
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_occupancy garden.cycle_occupancies%rowtype;
  v_crop_id uuid;
  v_new_cycle_id uuid;
  v_close_event_id uuid;
  v_start_event_id uuid;
  v_effective_end date := coalesce(p_planted_on, current_date);
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'replace_cycle', v_payload);
  if v_response is not null then return v_response; end if;
  if char_length(trim(p_crop_name)) not between 1 and 100 then raise exception 'Crop name is required'; end if;
  if (p_planted_on is null and p_planted_on_precision <> 'unknown') or (p_planted_on is not null and p_planted_on_precision not in ('exact', 'approximate')) then raise exception 'Invalid planted date precision'; end if;
  select * into v_cycle from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner for update;
  if not found or v_cycle.state <> 'active' then raise exception 'Current grow cycle not found'; end if;
  if v_cycle.revision <> p_expected_revision then raise exception 'Cycle changed; review it before replacing'; end if;
  select * into v_occupancy from garden.cycle_occupancies where grow_cycle_id = p_grow_cycle_id and occupied_until is null for update;
  if not found then raise exception 'Current occupancy not found'; end if;
  if v_occupancy.occupied_from is not null and v_effective_end < v_occupancy.occupied_from then raise exception 'Replacement cannot precede occupancy'; end if;
  update garden.cycle_occupancies set occupied_until = v_effective_end where id = v_occupancy.id;
  update garden.grow_cycles set state = 'closed', revision = revision + 1, updated_at = now() where id = p_grow_cycle_id;
  insert into garden.events(owner_id, grow_cycle_id, event_type, note) values (v_owner, p_grow_cycle_id, 'cycle_ended', 'Ciclo cerrado por reemplazo') returning id into v_close_event_id;
  insert into garden.cycle_revisions(owner_id, grow_cycle_id, revision_number, operation, previous_values, next_values, reason)
  values (v_owner, p_grow_cycle_id, v_cycle.revision + 1, 'replaced', jsonb_build_object('state', v_cycle.state, 'occupied_until', v_occupancy.occupied_until), jsonb_build_object('state', 'closed', 'occupied_until', v_effective_end), 'replacement');
  insert into garden.crops(owner_id, common_name) values (v_owner, trim(p_crop_name))
  on conflict (owner_id, common_name) do update set common_name = excluded.common_name returning id into v_crop_id;
  insert into garden.grow_cycles(owner_id, crop_id, planted_on, planted_on_precision) values (v_owner, v_crop_id, p_planted_on, p_planted_on_precision) returning id into v_new_cycle_id;
  insert into garden.cycle_occupancies(position_id, grow_cycle_id, occupied_from) values (v_occupancy.position_id, v_new_cycle_id, p_planted_on);
  insert into garden.events(owner_id, grow_cycle_id, event_type, note) values (v_owner, v_new_cycle_id, 'cycle_started', 'Ciclo iniciado por reemplazo') returning id into v_start_event_id;
  v_response := jsonb_build_object('previous_grow_cycle_id', p_grow_cycle_id, 'grow_cycle_id', v_new_cycle_id, 'closed_event_id', v_close_event_id, 'started_event_id', v_start_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'replace_cycle', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_review_import_candidate(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_review_import_candidate(p_request_id uuid, p_candidate_id uuid, p_decision text, p_decision_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_owner uuid := public.garden_owner_id(); v_candidate garden.import_candidates%rowtype; v_payload jsonb; v_response jsonb; v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_decision not in ('confirmed', 'rejected') then raise exception 'Invalid import decision'; end if;
  v_payload := jsonb_build_object('candidate_id', p_candidate_id, 'decision', p_decision, 'decision_note', nullif(trim(p_decision_note), ''));
  v_response := garden.command_response(v_owner, p_request_id, 'review_import_candidate', v_payload);
  if v_response is not null then return v_response; end if;
  select * into v_candidate from garden.import_candidates where id = p_candidate_id and owner_id = v_owner for update;
  if not found then raise exception 'Import candidate not found'; end if;
  if v_candidate.decision <> 'pending' then raise exception 'Import candidate was already decided'; end if;
  if p_decision = 'confirmed' then
    if v_candidate.candidate_type <> 'observation' then raise exception 'Only observation candidates can become a fact'; end if;
    if v_candidate.grow_cycle_id is null or v_candidate.occurred_on_precision <> 'exact' or v_candidate.occurred_on is null then raise exception 'A cycle and exact date are required before confirming this import'; end if;
    insert into garden.events(owner_id, garden_id, grow_cycle_id, event_type, occurred_at, note, event_data)
    select v_owner, p.garden_id, v_candidate.grow_cycle_id, 'observation',
      (v_candidate.occurred_on::timestamp + interval '12 hours') at time zone 'UTC',
      v_candidate.note,
      jsonb_build_object(
        'source', 'confirmed_import', 'import_candidate_id', v_candidate.id,
        'source_data', v_candidate.source_data, 'occurred_on', v_candidate.occurred_on,
        'occurred_at_precision', 'date'
      )
    from garden.cycle_occupancies o join garden.positions p on p.id = o.position_id
    where o.grow_cycle_id = v_candidate.grow_cycle_id order by o.created_at limit 1 returning id into v_event_id;
    if v_event_id is null then raise exception 'Candidate cycle has no position history'; end if;
    update garden.import_candidates set decision = 'confirmed', decision_note = nullif(trim(p_decision_note), ''), confirmed_event_id = v_event_id, decided_at = now() where id = v_candidate.id;
  else
    update garden.import_candidates set decision = 'rejected', decision_note = nullif(trim(p_decision_note), ''), decided_at = now() where id = v_candidate.id;
  end if;
  if not exists (select 1 from garden.import_candidates where batch_id = v_candidate.batch_id and decision = 'pending') then update garden.import_batches set status = 'completed' where id = v_candidate.batch_id; end if;
  v_response := jsonb_build_object('candidate_id', v_candidate.id, 'decision', p_decision, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'review_import_candidate', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_revoke_guest_garden_story(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_revoke_guest_garden_story(p_request_id uuid, p_story_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('story_id', p_story_id);
  v_response := garden.command_response(v_owner, p_request_id, 'revoke_guest_garden_story', v_payload);
  if v_response is not null then return v_response; end if;
  update garden.guest_garden_stories set revoked_at = coalesce(revoked_at, now()) where id = p_story_id and owner_id = v_owner;
  if not found then raise exception 'Guest garden story not found'; end if;
  v_response := jsonb_build_object('story_id', p_story_id, 'revoked', true);
  perform garden.store_command_response(v_owner, p_request_id, 'revoke_guest_garden_story', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_revoke_guest_plant_story(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_revoke_guest_plant_story(p_request_id uuid, p_story_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('story_id', p_story_id);
  v_response := garden.command_response(v_owner, p_request_id, 'revoke_guest_plant_story', v_payload);
  if v_response is not null then return v_response; end if;
  update garden.guest_plant_stories
  set revoked_at = coalesce(revoked_at, now())
  where id = p_story_id and owner_id = v_owner;
  if not found then raise exception 'Guest story not found'; end if;
  v_response := jsonb_build_object('story_id', p_story_id, 'revoked', true);
  perform garden.store_command_response(v_owner, p_request_id, 'revoke_guest_plant_story', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_set_cycle_cover(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_set_cycle_cover(p_request_id uuid, p_grow_cycle_id uuid, p_photo_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_owner uuid := public.garden_owner_id(); v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'photo_id', p_photo_id);
  v_response := garden.command_response(v_owner, p_request_id, 'set_cycle_cover', v_payload);
  if v_response is not null then return v_response; end if;
  if not exists (select 1 from garden.grow_cycles where id = p_grow_cycle_id and owner_id = v_owner) then raise exception 'Grow cycle not found'; end if;
  if p_photo_id is not null and not exists (
    select 1 from garden.photos ph left join garden.events e on e.id = ph.event_id
    where ph.id = p_photo_id and ph.owner_id = v_owner and ph.upload_status = 'uploaded'
      and (e.grow_cycle_id = p_grow_cycle_id or ph.import_provenance->>'grow_cycle_id' = p_grow_cycle_id::text)
      and (e.id is null or e.invalidated_at is null)
  ) then raise exception 'Photo is not available for this cycle'; end if;
  update garden.grow_cycles set cover_photo_id = p_photo_id, updated_at = now() where id = p_grow_cycle_id and owner_id = v_owner;
  v_response := jsonb_build_object('grow_cycle_id', p_grow_cycle_id, 'cover_photo_id', p_photo_id);
  perform garden.store_command_response(v_owner, p_request_id, 'set_cycle_cover', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_set_garden_cover(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_set_garden_cover(p_request_id uuid, p_garden_id uuid, p_photo_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_owner uuid := public.garden_owner_id(); v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('garden_id', p_garden_id, 'photo_id', p_photo_id); v_response := garden.command_response(v_owner, p_request_id, 'set_garden_cover', v_payload); if v_response is not null then return v_response; end if;
  if not exists (select 1 from garden.gardens g where g.id = p_garden_id and g.owner_id = v_owner) then raise exception 'Garden not found'; end if;
  if p_photo_id is not null and not exists (select 1 from garden.photos ph left join garden.events e on e.id = ph.event_id where ph.id = p_photo_id and ph.owner_id = v_owner and ph.upload_status = 'uploaded' and (ph.garden_id = p_garden_id or (e.garden_id = p_garden_id and e.invalidated_at is null))) then raise exception 'Photo is not available for this garden'; end if;
  update garden.gardens set cover_photo_id = p_photo_id, updated_at = now() where id = p_garden_id and owner_id = v_owner;
  v_response := jsonb_build_object('garden_id', p_garden_id, 'cover_photo_id', p_photo_id); perform garden.store_command_response(v_owner, p_request_id, 'set_garden_cover', v_payload, v_response); return v_response;
end;
$$;


--
-- Name: garden_set_home_headline(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_set_home_headline(p_request_id uuid, p_home_headline text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_owner uuid := (select auth.uid()); v_value text := nullif(trim(p_home_headline), ''); v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if v_value is null or char_length(v_value) > 120 then raise exception 'Home headline must contain between 1 and 120 characters'; end if;
  v_payload := jsonb_build_object('home_headline', v_value);
  v_response := garden.command_response(v_owner, p_request_id, 'set_home_headline', v_payload);
  if v_response is not null then return v_response; end if;
  insert into garden.owner_settings(owner_id, home_headline) values (v_owner, v_value)
  on conflict (owner_id) do update set home_headline = excluded.home_headline, updated_at = now();
  v_response := jsonb_build_object('home_headline', v_value);
  perform garden.store_command_response(v_owner, p_request_id, 'set_home_headline', v_payload, v_response);
  return v_response;
end; $$;


--
-- Name: garden_set_home_hero(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_set_home_hero(p_request_id uuid, p_photo_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_payload := jsonb_build_object('photo_id', p_photo_id);
  v_response := garden.command_response(v_owner, p_request_id, 'set_home_hero', v_payload);
  if v_response is not null then return v_response; end if;
  if p_photo_id is not null and not exists (
    select 1 from garden.photos
    where id = p_photo_id and owner_id = v_owner and upload_status = 'uploaded'
      and media_scope in ('home_hero', 'cycle_evidence', 'garden_cover', 'garden_general')
  ) then raise exception 'Home photo not available'; end if;
  insert into garden.owner_settings(owner_id, home_hero_photo_id)
  values (v_owner, p_photo_id)
  on conflict (owner_id) do update set home_hero_photo_id = excluded.home_hero_photo_id, updated_at = now();
  v_response := jsonb_build_object('home_hero_photo_id', p_photo_id);
  perform garden.store_command_response(v_owner, p_request_id, 'set_home_hero', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_set_maintenance_session_state(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_set_maintenance_session_state(p_request_id uuid, p_session_id uuid, p_state text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_owner uuid := public.garden_owner_id(); v_session garden.maintenance_sessions%rowtype; v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_state not in ('paused', 'in_progress', 'completed', 'abandoned') then raise exception 'Invalid session state'; end if;
  v_payload := jsonb_build_object('session_id', p_session_id, 'state', p_state);
  v_response := garden.command_response(v_owner, p_request_id, 'set_maintenance_session_state', v_payload);
  if v_response is not null then return; end if;
  select * into v_session from garden.maintenance_sessions where id = p_session_id and owner_id = v_owner for update;
  if not found or v_session.state not in ('in_progress', 'paused') then raise exception 'Open maintenance session not found'; end if;
  update garden.maintenance_sessions set state = p_state, completed_at = case when p_state in ('completed', 'abandoned') then now() else null end where id = v_session.id;
  perform garden.store_command_response(v_owner, p_request_id, 'set_maintenance_session_state', v_payload, '{}'::jsonb);
end;
$$;


--
-- Name: garden_start_cycle(uuid, uuid, text, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_start_cycle(p_request_id uuid, p_position_id uuid, p_crop_name text, p_planted_on date, p_planted_on_precision text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id(); v_payload jsonb := jsonb_build_object('position_id', p_position_id, 'crop_name', trim(p_crop_name), 'planted_on', p_planted_on, 'planted_on_precision', p_planted_on_precision);
  v_response jsonb; v_crop_id uuid; v_cycle_id uuid; v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'start_cycle', v_payload);
  if v_response is not null then return v_response; end if;
  if char_length(trim(p_crop_name)) not between 1 and 100 then raise exception 'Crop name is required'; end if;
  if not exists (select 1 from garden.positions p join garden.gardens g on g.id = p.garden_id join garden.layout_sites s on s.position_id = p.id and s.site_kind = 'grow' and s.is_active where p.id = p_position_id and g.owner_id = v_owner) then raise exception 'Position is not available for cultivation'; end if;
  if exists (select 1 from garden.cycle_occupancies where position_id = p_position_id and occupied_until is null) then raise exception 'Position already has a current grow cycle'; end if;
  if (p_planted_on is null and p_planted_on_precision <> 'unknown') or (p_planted_on is not null and p_planted_on_precision not in ('exact', 'approximate')) then raise exception 'Invalid planted date precision'; end if;
  insert into garden.crops(owner_id, common_name) values (v_owner, trim(p_crop_name)) on conflict (owner_id, common_name) do update set common_name = excluded.common_name returning id into v_crop_id;
  insert into garden.grow_cycles(owner_id, crop_id, planted_on, planted_on_precision) values (v_owner, v_crop_id, p_planted_on, p_planted_on_precision) returning id into v_cycle_id;
  insert into garden.cycle_occupancies(position_id, grow_cycle_id, occupied_from) values (p_position_id, v_cycle_id, p_planted_on);
  insert into garden.events(owner_id, grow_cycle_id, event_type, note) values (v_owner, v_cycle_id, 'cycle_started', 'Ciclo iniciado') returning id into v_event_id;
  v_response := jsonb_build_object('grow_cycle_id', v_cycle_id, 'event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'start_cycle', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_start_maintenance_session(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_start_maintenance_session(p_request_id uuid, p_garden_ids uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_owner uuid := public.garden_owner_id(); v_payload jsonb; v_response jsonb; v_session_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if coalesce(cardinality(p_garden_ids), 0) not between 1 and 2 then raise exception 'Select one or two gardens'; end if;
  if array_length(array(select distinct unnest(p_garden_ids)), 1) <> cardinality(p_garden_ids) then raise exception 'Garden selection contains duplicates'; end if;
  if (select count(*) from garden.gardens where owner_id = v_owner and id = any(p_garden_ids)) <> cardinality(p_garden_ids) then raise exception 'Garden not found'; end if;
  v_payload := jsonb_build_object('garden_ids', p_garden_ids); v_response := garden.command_response(v_owner, p_request_id, 'start_maintenance_session', v_payload);
  if v_response is not null then return v_response; end if;
  if exists (select 1 from garden.maintenance_sessions where owner_id = v_owner and state in ('in_progress', 'paused')) then raise exception 'Resume or abandon the existing maintenance session first'; end if;
  insert into garden.maintenance_sessions(owner_id) values (v_owner) returning id into v_session_id;
  insert into garden.maintenance_session_positions(session_id, garden_id, position_id, captured_grow_cycle_id, position_number, ordinal)
  select v_session_id, p.garden_id, p.id, current_cycle.grow_cycle_id, p.position_number, row_number() over (order by array_position(p_garden_ids, p.garden_id), p.position_number)::integer
  from garden.positions p join garden.layout_sites s on s.position_id = p.id and s.site_kind = 'grow' and s.is_active
  left join garden.cycle_occupancies current_cycle on current_cycle.position_id = p.id and current_cycle.occupied_until is null
  where p.garden_id = any(p_garden_ids);
  v_response := jsonb_build_object('session_id', v_session_id); perform garden.store_command_response(v_owner, p_request_id, 'start_maintenance_session', v_payload, v_response); return v_response;
end;
$$;


--
-- Name: garden_update_garden_name(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_update_garden_name(p_request_id uuid, p_garden_id uuid, p_name text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_owner uuid := (select auth.uid()); v_name text := nullif(trim(p_name), ''); v_payload jsonb; v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if v_name is null or char_length(v_name) > 80 then raise exception 'Garden name must contain between 1 and 80 characters'; end if;
  v_payload := jsonb_build_object('garden_id', p_garden_id, 'name', v_name);
  v_response := garden.command_response(v_owner, p_request_id, 'update_garden_name', v_payload);
  if v_response is not null then return v_response; end if;
  update garden.gardens set name = v_name where id = p_garden_id and owner_id = v_owner;
  if not found then raise exception 'Garden not found'; end if;
  v_response := jsonb_build_object('garden_id', p_garden_id, 'name', v_name);
  perform garden.store_command_response(v_owner, p_request_id, 'update_garden_name', v_payload, v_response);
  return v_response;
end; $$;


--
-- Name: garden_update_import_candidate(uuid, uuid, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_update_import_candidate(p_request_id uuid, p_candidate_id uuid, p_grow_cycle_id uuid, p_occurred_on date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_candidate garden.import_candidates%rowtype;
  v_payload jsonb;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_grow_cycle_id is null or p_occurred_on is null then raise exception 'A cycle and exact date are required'; end if;

  v_payload := jsonb_build_object(
    'candidate_id', p_candidate_id,
    'grow_cycle_id', p_grow_cycle_id,
    'occurred_on', p_occurred_on
  );
  v_response := garden.command_response(v_owner, p_request_id, 'update_import_candidate', v_payload);
  if v_response is not null then return v_response; end if;

  select * into v_candidate
  from garden.import_candidates
  where id = p_candidate_id and owner_id = v_owner
  for update;
  if not found then raise exception 'Pending import candidate not found'; end if;
  if v_candidate.decision <> 'pending' then raise exception 'Import candidate was already decided'; end if;
  if v_candidate.candidate_type <> 'observation' then raise exception 'Only observation candidates can be completed'; end if;
  if not exists (
    select 1 from garden.grow_cycles
    where id = p_grow_cycle_id and owner_id = v_owner
  ) then raise exception 'Candidate cycle not found'; end if;

  update garden.import_candidates
  set grow_cycle_id = p_grow_cycle_id,
      occurred_on = p_occurred_on,
      occurred_on_precision = 'exact'
  where id = v_candidate.id;

  v_response := jsonb_build_object('candidate_id', v_candidate.id, 'updated', true);
  perform garden.store_command_response(v_owner, p_request_id, 'update_import_candidate', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_update_layout_site(uuid, uuid, integer, integer, text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_update_layout_site(p_request_id uuid, p_site_id uuid, p_grid_x integer, p_grid_y integer, p_site_kind text, p_active boolean, p_label text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id(); v_payload jsonb := jsonb_build_object('site_id', p_site_id, 'grid_x', p_grid_x, 'grid_y', p_grid_y, 'site_kind', p_site_kind, 'active', p_active, 'label', nullif(trim(p_label), ''));
  v_response jsonb; v_site garden.layout_sites%rowtype; v_position_id uuid; v_position_number integer;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  v_response := garden.command_response(v_owner, p_request_id, 'update_layout_site', v_payload);
  if v_response is not null then return v_response; end if;
  if p_site_kind not in ('grow', 'utility') then raise exception 'Invalid physical site type'; end if;
  if p_grid_x not between 1 and 8 or p_grid_y not between 1 and 9 then raise exception 'Invalid map coordinate'; end if;
  if char_length(trim(coalesce(p_label, ''))) > 80 then raise exception 'Label must have at most 80 characters'; end if;
  select s.* into v_site from garden.layout_sites s join garden.gardens g on g.id = s.garden_id
  where s.id = p_site_id and g.owner_id = v_owner for update of s;
  if not found then raise exception 'Physical site not found'; end if;
  if (not p_active or p_site_kind = 'utility') and v_site.position_id is not null and exists (
    select 1 from garden.cycle_occupancies where position_id = v_site.position_id and occupied_until is null
  ) then raise exception 'Move or close the active grow cycle before changing this physical point'; end if;
  if p_active and exists (select 1 from garden.layout_sites s where s.garden_id = v_site.garden_id and s.id <> v_site.id and s.grid_x = p_grid_x and s.grid_y = p_grid_y and s.is_active) then
    raise exception 'That point is already occupied on the map';
  end if;
  v_position_id := v_site.position_id;
  if p_site_kind = 'grow' and v_position_id is null then
    select coalesce(max(position_number), 0) + 1 into v_position_number from garden.positions where garden_id = v_site.garden_id;
    if v_position_number > 36 then raise exception 'A garden can have at most 36 cultivation positions'; end if;
    insert into garden.positions(garden_id, position_number) values (v_site.garden_id, v_position_number) returning id into v_position_id;
  else
    select position_number into v_position_number from garden.positions where id = v_position_id;
  end if;
  update garden.layout_sites set position_id = v_position_id, site_kind = p_site_kind, is_active = p_active,
    grid_x = p_grid_x, grid_y = p_grid_y, label = nullif(trim(p_label), ''), updated_at = now() where id = v_site.id;
  perform garden.refresh_position_capacity(v_site.garden_id);
  insert into garden.layout_events(owner_id, garden_id, layout_site_id, operation, event_data)
  values (v_owner, v_site.garden_id, v_site.id, 'site_updated', jsonb_build_object('site_kind', p_site_kind, 'active', p_active, 'grid_x', p_grid_x, 'grid_y', p_grid_y, 'position_number', v_position_number));
  v_response := jsonb_build_object('site_id', v_site.id, 'position_id', v_position_id, 'position_number', v_position_number);
  perform garden.store_command_response(v_owner, p_request_id, 'update_layout_site', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_create_custom_system(uuid, uuid, uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_create_custom_system(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_definition_id uuid, p_name text, p_levels jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_total integer := 0;
  v_position_number integer := 0;
  v_level jsonb;
  v_cell jsonb;
  v_active jsonb;
  v_level_number integer := 0;
  v_rows integer;
  v_columns integer;
  v_row integer;
  v_column integer;
  v_position_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_request_id is null or p_garden_id is null or p_system_instance_id is null or p_definition_id is null then raise exception 'Ids are required'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'System name is required'; end if;
  if jsonb_typeof(p_levels) <> 'array' or jsonb_array_length(p_levels) not between 1 and 12 then raise exception 'One to twelve levels are required'; end if;
  select response into v_response from garden.command_receipts where owner_id = v_owner and request_id = p_request_id and command_name = 'garden_x_create_custom_system';
  if found then return v_response; end if;

  for v_level in select value from jsonb_array_elements(p_levels) loop
    v_level_number := v_level_number + 1;
    if jsonb_typeof(v_level) <> 'object' or coalesce(v_level->>'rows', '') !~ '^[0-9]+$' or coalesce(v_level->>'columns', '') !~ '^[0-9]+$' then raise exception 'Each level needs rows and columns'; end if;
    v_rows := (v_level->>'rows')::integer; v_columns := (v_level->>'columns')::integer;
    if v_rows not between 1 and 9 or v_columns not between 1 and 8 then raise exception 'Rows must be 1–9 and columns must be 1–8'; end if;
    v_active := v_level->'active_cells';
    if v_active is null then
      select jsonb_agg(jsonb_build_object('row', row_number, 'column', column_number) order by row_number, column_number) into v_active
      from generate_series(1, v_rows) as rows(row_number) cross join generate_series(1, v_columns) as columns(column_number);
    end if;
    if jsonb_typeof(v_active) <> 'array' or jsonb_array_length(v_active) < 1 then raise exception 'Each level needs at least one active cell'; end if;
    for v_cell in select value from jsonb_array_elements(v_active) loop
      if jsonb_typeof(v_cell) <> 'object' or coalesce(v_cell->>'row', '') !~ '^[0-9]+$' or coalesce(v_cell->>'column', '') !~ '^[0-9]+$' then raise exception 'Active cells need row and column'; end if;
      v_row := (v_cell->>'row')::integer; v_column := (v_cell->>'column')::integer;
      if v_row not between 1 and v_rows or v_column not between 1 and v_columns then raise exception 'Active cell is outside its grid'; end if;
      if (select count(*) from jsonb_array_elements(v_active) prior where prior = v_cell) > 1 then raise exception 'Active cells cannot repeat'; end if;
    end loop;
    v_total := v_total + jsonb_array_length(v_active);
  end loop;
  if v_total > 36 then raise exception 'A custom system supports at most 36 positions'; end if;

  insert into garden.custom_system_definitions(id, owner_id, name, metadata) values (p_definition_id, v_owner, trim(p_name), jsonb_build_object('created_via', 'garden_x_v2_custom_system_builder'));
  insert into garden.gardens(id, owner_id, name, system_model, position_capacity, map_layout, kind, place, note, sort_order)
  values (p_garden_id, v_owner, trim(p_name), 'Custom System', v_total, 'custom_grid', 'hydroponic', '', 'Custom system layout', coalesce((select max(sort_order) + 1 from garden.gardens where owner_id = v_owner), 0));
  insert into garden.system_instances(id, owner_id, garden_id, name, system_definition_key, legacy_system_model, status, metadata)
  values (p_system_instance_id, v_owner, p_garden_id, trim(p_name), 'custom:' || p_definition_id::text, 'Custom System', 'active', jsonb_build_object('created_via', 'garden_x_v2_custom_system_builder', 'baseline_bridge', 'garden_x_v1', 'custom_definition_id', p_definition_id));

  v_level_number := 0;
  for v_level in select value from jsonb_array_elements(p_levels) loop
    v_level_number := v_level_number + 1; v_rows := (v_level->>'rows')::integer; v_columns := (v_level->>'columns')::integer;
    v_active := v_level->'active_cells';
    if v_active is null then
      select jsonb_agg(jsonb_build_object('row', row_number, 'column', column_number) order by row_number, column_number) into v_active
      from generate_series(1, v_rows) as rows(row_number) cross join generate_series(1, v_columns) as columns(column_number);
    end if;
    insert into garden.custom_system_levels(definition_id, level_number, row_count, column_count, active_cells) values (p_definition_id, v_level_number, v_rows, v_columns, v_active);
    for v_cell in select value from jsonb_array_elements(v_active) order by (value->>'row')::integer, (value->>'column')::integer loop
      v_position_number := v_position_number + 1; v_row := (v_cell->>'row')::integer; v_column := (v_cell->>'column')::integer;
      insert into garden.positions(garden_id, system_instance_id, position_number) values (p_garden_id, p_system_instance_id, v_position_number) returning id into v_position_id;
      insert into garden.layout_sites(garden_id, system_instance_id, position_id, site_kind, is_active, grid_x, grid_y, level_number, row_number, column_number)
      values (p_garden_id, p_system_instance_id, v_position_id, 'grow', true, v_column, v_row, v_level_number, v_row, v_column);
    end loop;
  end loop;
  insert into garden.layout_events(owner_id, garden_id, operation, event_data) values (v_owner, p_garden_id, 'site_added', jsonb_build_object('source', 'garden_x_v2_custom_system_builder', 'level_count', jsonb_array_length(p_levels), 'position_count', v_total));
  v_response := jsonb_build_object('garden_id', p_garden_id, 'system_instance_id', p_system_instance_id, 'custom_definition_id', p_definition_id, 'position_count', v_total);
  insert into garden.command_receipts(owner_id, request_id, command_name, response) values (v_owner, p_request_id, 'garden_x_create_custom_system', v_response);
  return v_response;
end;
$_$;


--
-- Name: garden_x_create_garden(uuid, uuid, uuid, text, text, text, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_create_garden(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_name text, p_kind text, p_place text, p_note text, p_system_definition_key text, p_system_name text, p_position_capacity integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_layout text := 'custom_grid';
  v_position_id uuid;
  v_n integer;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
   where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_create_garden';
  if found then return v_response; end if;

  if p_garden_id is null or p_system_instance_id is null then raise exception 'Ids are required'; end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 80 then raise exception 'Garden name is required'; end if;
  if p_position_capacity not between 1 and 36 then raise exception 'Position capacity must be from 1 to 36'; end if;

  v_layout := case
    when p_system_definition_key='uruq_8_v1' then 'uruq_8_v1'
    when p_system_definition_key='uruq_12_v1' then 'uruq_12_v1'
    else 'custom_grid'
  end;

  insert into garden.gardens(
    id,owner_id,name,system_model,position_capacity,map_layout,kind,place,note,sort_order
  ) values(
    p_garden_id,v_owner,trim(p_name),nullif(trim(coalesce(p_system_name,'')),''),
    p_position_capacity,v_layout,coalesce(nullif(trim(coalesce(p_kind,'')),''),'hydroponic'),
    coalesce(trim(p_place),''),coalesce(trim(p_note),''),
    coalesce((select max(sort_order)+1 from garden.gardens where owner_id=v_owner),0)
  );

  insert into garden.system_instances(
    id,owner_id,garden_id,name,system_definition_key,legacy_system_model,status,metadata
  ) values(
    p_system_instance_id,v_owner,p_garden_id,
    coalesce(nullif(trim(coalesce(p_system_name,'')),''),trim(p_name)),
    nullif(trim(coalesce(p_system_definition_key,'')),''),
    nullif(trim(coalesce(p_system_name,'')),''),
    'active',jsonb_build_object('created_via','garden_x_v1','baseline_bridge','garden_x_v1')
  );

  for v_n in 1..p_position_capacity loop
    insert into garden.positions(garden_id,system_instance_id,position_number)
    values(p_garden_id,p_system_instance_id,v_n) returning id into v_position_id;

    insert into garden.layout_sites(
      garden_id,system_instance_id,position_id,site_kind,is_active,grid_x,grid_y
    ) values(
      p_garden_id,p_system_instance_id,v_position_id,'grow',true,
      case
        when v_layout='uruq_8_v1' then case v_n when 1 then 2 when 2 then 6 when 3 then 1 when 4 then 4 when 5 then 7 when 6 then 1 when 7 then 4 when 8 then 7 end
        when v_layout='uruq_12_v1' then case v_n when 1 then 4 when 2 then 1 when 3 then 3 when 4 then 5 when 5 then 7 when 6 then 2 when 7 then 4 when 8 then 6 when 9 then 1 when 10 then 3 when 11 then 5 when 12 then 7 end
        else ((v_n-1)%4)*2+1
      end,
      case
        when v_layout='uruq_8_v1' then case when v_n<=2 then 1 when v_n<=5 then 2 else 3 end
        when v_layout='uruq_12_v1' then case when v_n=1 then 1 when v_n<=5 then 2 when v_n<=8 then 3 else 4 end
        else ((v_n-1)/4)+1
      end
    );
  end loop;

  insert into garden.layout_events(owner_id,garden_id,operation,event_data)
  values(v_owner,p_garden_id,'site_added',jsonb_build_object('source','garden_x_v1','layout',v_layout));

  v_response:=jsonb_build_object('garden_id',p_garden_id,'system_instance_id',p_system_instance_id);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_create_garden',v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_create_journal_moment(uuid, uuid, date, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_create_journal_moment(p_request_id uuid, p_grow_cycle_id uuid, p_occurred_on date, p_note text DEFAULT NULL::text, p_milestone text DEFAULT NULL::text, p_has_photo boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
  v_garden_id uuid;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_occurred_on is null then raise exception 'Moment date is required'; end if;
  if p_milestone is not null and p_milestone not in (
    'germinated','sprouted','flowering','fruiting','harvest',
    'growth_observed','flowered','fruited','harvested','regrowth','propagated',
    'transplanted','damaged','recovered'
  ) then raise exception 'Unsupported journal milestone'; end if;
  if char_length(coalesce(trim(p_note), '')) > 1000 then raise exception 'Moment note is too long'; end if;
  if nullif(trim(p_note), '') is null and p_milestone is null and not coalesce(p_has_photo, false) then
    raise exception 'A moment needs a photo, note, or milestone';
  end if;
  v_payload := jsonb_build_object('grow_cycle_id',p_grow_cycle_id,'occurred_on',p_occurred_on,
    'note',nullif(trim(p_note),''),'milestone',p_milestone,'has_photo',coalesce(p_has_photo,false));
  v_response := garden.command_response(v_owner,p_request_id,'garden_x_create_journal_moment',v_payload);
  if v_response is not null then return v_response; end if;
  select p.garden_id into v_garden_id
  from garden.grow_cycles gc
  join garden.cycle_occupancies o on o.grow_cycle_id=gc.id and o.occupied_until is null
  join garden.positions p on p.id=o.position_id
  where gc.id=p_grow_cycle_id and gc.owner_id=v_owner and gc.state='active'
  limit 1;
  if not found then raise exception 'Current grow cycle not found'; end if;
  insert into garden.events(owner_id,garden_id,grow_cycle_id,event_type,occurred_at,note,event_data)
  values(v_owner,v_garden_id,p_grow_cycle_id,'observation',
    (p_occurred_on::timestamp + interval '12 hours') at time zone 'UTC',nullif(trim(p_note),''),
    jsonb_build_object('source','garden_x_journal','occurred_on',p_occurred_on,
      'occurred_at_precision','date','journal_milestone',p_milestone,
      'photo_expected',coalesce(p_has_photo,false)))
  returning id into v_event_id;
  v_response := jsonb_build_object('event_id',v_event_id);
  perform garden.store_command_response(v_owner,p_request_id,'garden_x_create_journal_moment',v_payload,v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_create_library_plant(uuid, uuid, uuid, text, text, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_create_library_plant(p_request_id uuid, p_plant_instance_id uuid, p_position_id uuid, p_library_plant_id text, p_nickname text DEFAULT NULL::text, p_planted_on date DEFAULT NULL::date, p_planted_on_precision text DEFAULT 'unknown'::text, p_origin_type text DEFAULT 'unknown'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_catalog garden.library_catalog_items%rowtype;
  v_crop_id uuid;
  v_cycle_id uuid;
  v_event_id uuid;
  v_garden_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
  where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_create_library_plant';
  if found then return v_response; end if;
  if p_plant_instance_id is null or p_position_id is null then raise exception 'Plant and position are required'; end if;
  if p_planted_on_precision not in ('exact','approximate','unknown') then raise exception 'Invalid planted date precision'; end if;
  if (p_planted_on is null and p_planted_on_precision <> 'unknown')
    or (p_planted_on is not null and p_planted_on_precision='unknown') then
    raise exception 'Planting date and precision do not match';
  end if;
  if p_origin_type is null or p_origin_type not in ('unknown','seed','bare_root','cutting','seedling','transplant') then
    raise exception 'Invalid plant origin';
  end if;

  select * into v_catalog from garden.library_catalog_items
  where library_plant_id=trim(coalesce(p_library_plant_id,'')) and status='active';
  if not found then raise exception 'Garden Library identity is unavailable'; end if;
  select g.id into v_garden_id
  from garden.positions p
  join garden.system_instances s on s.id=p.system_instance_id
  join garden.gardens g on g.id=s.garden_id
  where p.id=p_position_id and s.owner_id=v_owner and g.owner_id=v_owner and s.status='active';
  if v_garden_id is null then raise exception 'Position not found'; end if;
  if exists(select 1 from garden.cycle_occupancies where position_id=p_position_id and occupied_until is null) then
    raise exception 'Position already has a current plant';
  end if;
  insert into garden.crops(owner_id,common_name,scientific_name)
  values(v_owner,v_catalog.common_name,v_catalog.scientific_name)
  on conflict(owner_id,common_name) do update
    set scientific_name=coalesce(garden.crops.scientific_name,excluded.scientific_name)
  returning id into v_crop_id;
  insert into garden.plant_instances(
    id,owner_id,nickname,reference_key,common_name,scientific_name,cultivar,status,metadata,
    library_plant_id,library_catalog_version,library_common_name_snapshot,
    library_scientific_name_snapshot,library_cultivar_snapshot
  ) values(
    p_plant_instance_id,v_owner,nullif(trim(coalesce(p_nickname,'')),''),
    v_catalog.library_plant_id,v_catalog.common_name,v_catalog.scientific_name,v_catalog.cultivar,'active',
    jsonb_build_object('created_via','garden_x_v1_library','library_plant_id',v_catalog.library_plant_id),
    v_catalog.library_plant_id,v_catalog.catalog_version,v_catalog.common_name,
    v_catalog.scientific_name,v_catalog.cultivar
  );
  insert into garden.grow_cycles(owner_id,crop_id,plant_instance_id,planted_on,planted_on_precision,origin_type)
  values(v_owner,v_crop_id,p_plant_instance_id,p_planted_on,p_planted_on_precision,p_origin_type)
  returning id into v_cycle_id;
  insert into garden.cycle_occupancies(position_id,grow_cycle_id,occupied_from)
  values(p_position_id,v_cycle_id,p_planted_on);
  insert into garden.events(owner_id,grow_cycle_id,garden_id,event_type,occurred_at,note,event_data)
  values(v_owner,v_cycle_id,v_garden_id,'cycle_started',coalesce(p_planted_on::timestamptz,now()),'Added to garden',
    jsonb_build_object('source','garden_x_v1_library','library_plant_id',v_catalog.library_plant_id,
      'library_catalog_version',v_catalog.catalog_version,'occurred_on',p_planted_on,
      'occurred_at_precision',case when p_planted_on is null then 'unknown' else 'date' end))
  returning id into v_event_id;
  v_response := jsonb_build_object('plant_instance_id',p_plant_instance_id,'grow_cycle_id',v_cycle_id,'event_id',v_event_id);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_create_library_plant',v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_create_observation(uuid, uuid, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_create_observation(p_request_id uuid, p_grow_cycle_id uuid, p_occurred_on date, p_note text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb := jsonb_build_object(
    'grow_cycle_id', p_grow_cycle_id,
    'occurred_on', p_occurred_on,
    'note', nullif(trim(p_note), '')
  );
  v_response jsonb;
  v_garden_id uuid;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_occurred_on is null then raise exception 'Observation date is required'; end if;
  if nullif(trim(p_note), '') is null then raise exception 'Observation needs a note'; end if;
  if char_length(trim(p_note)) > 1000 then raise exception 'Observation note is too long'; end if;

  v_response := garden.command_response(v_owner, p_request_id, 'garden_x_create_observation', v_payload);
  if v_response is not null then return v_response; end if;

  select p.garden_id into v_garden_id
  from garden.grow_cycles gc
  join garden.cycle_occupancies o on o.grow_cycle_id = gc.id and o.occupied_until is null
  join garden.positions p on p.id = o.position_id
  where gc.id = p_grow_cycle_id and gc.owner_id = v_owner and gc.state = 'active'
  limit 1;
  if not found then raise exception 'Current grow cycle not found'; end if;

  insert into garden.events(owner_id, garden_id, grow_cycle_id, event_type, occurred_at, note, event_data)
  values (
    v_owner, v_garden_id, p_grow_cycle_id, 'observation',
    (p_occurred_on::timestamp + interval '12 hours') at time zone 'UTC',
    trim(p_note),
    jsonb_build_object('source','garden_x','occurred_on',p_occurred_on,'occurred_at_precision','date')
  )
  returning id into v_event_id;

  v_response := jsonb_build_object('event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'garden_x_create_observation', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_create_plant(uuid, uuid, uuid, text, text, text, text, text, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_create_plant(p_request_id uuid, p_plant_instance_id uuid, p_position_id uuid, p_nickname text, p_common_name text, p_scientific_name text DEFAULT NULL::text, p_cultivar text DEFAULT NULL::text, p_reference_key text DEFAULT NULL::text, p_planted_on date DEFAULT NULL::date, p_planted_on_precision text DEFAULT 'unknown'::text, p_origin_type text DEFAULT 'unknown'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_crop_id uuid;
  v_cycle_id uuid;
  v_event_id uuid;
  v_garden_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
  where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_create_plant';
  if found then return v_response; end if;
  if p_plant_instance_id is null then raise exception 'Plant id is required'; end if;
  if char_length(trim(coalesce(p_common_name,''))) not between 1 and 100 then raise exception 'Common name is required'; end if;
  if p_planted_on_precision not in ('exact','approximate','unknown') then raise exception 'Invalid planted date precision'; end if;
  if (p_planted_on is null and p_planted_on_precision <> 'unknown')
     or (p_planted_on is not null and p_planted_on_precision='unknown') then
    raise exception 'Planting date and precision do not match';
  end if;
  if p_origin_type is null or p_origin_type not in ('unknown','seed','bare_root','cutting','seedling','transplant') then
    raise exception 'Invalid plant origin';
  end if;

  select g.id into v_garden_id
  from garden.positions p
  join garden.system_instances s on s.id=p.system_instance_id
  join garden.gardens g on g.id=s.garden_id
  where p.id=p_position_id and s.owner_id=v_owner and g.owner_id=v_owner and s.status='active';
  if v_garden_id is null then raise exception 'Position not found'; end if;
  if exists(select 1 from garden.cycle_occupancies where position_id=p_position_id and occupied_until is null) then
    raise exception 'Position already has a current plant';
  end if;

  insert into garden.crops(owner_id,common_name,scientific_name)
  values(v_owner,trim(p_common_name),nullif(trim(coalesce(p_scientific_name,'')),''))
  on conflict(owner_id,common_name) do update
    set scientific_name=coalesce(garden.crops.scientific_name,excluded.scientific_name)
  returning id into v_crop_id;
  insert into garden.plant_instances(
    id,owner_id,nickname,reference_key,common_name,scientific_name,cultivar,status,metadata
  ) values(
    p_plant_instance_id,v_owner,nullif(trim(coalesce(p_nickname,'')),''),
    nullif(trim(coalesce(p_reference_key,'')),''),trim(p_common_name),
    nullif(trim(coalesce(p_scientific_name,'')),''),nullif(trim(coalesce(p_cultivar,'')),''),
    'active',jsonb_build_object('created_via','garden_x_v1')
  );
  insert into garden.grow_cycles(owner_id,crop_id,plant_instance_id,planted_on,planted_on_precision,origin_type)
  values(v_owner,v_crop_id,p_plant_instance_id,p_planted_on,p_planted_on_precision,p_origin_type)
  returning id into v_cycle_id;
  insert into garden.cycle_occupancies(position_id,grow_cycle_id,occupied_from)
  values(p_position_id,v_cycle_id,p_planted_on);
  insert into garden.events(owner_id,grow_cycle_id,garden_id,event_type,occurred_at,note,event_data)
  values(v_owner,v_cycle_id,v_garden_id,'cycle_started',coalesce(p_planted_on::timestamptz,now()),'Added to garden',
    jsonb_build_object('source','garden_x_v1','occurred_on',p_planted_on,
      'occurred_at_precision',case when p_planted_on is null then 'unknown' else 'date' end))
  returning id into v_event_id;
  v_response := jsonb_build_object('plant_instance_id',p_plant_instance_id,'grow_cycle_id',v_cycle_id,'event_id',v_event_id);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_create_plant',v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_delete_garden(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_delete_garden(p_request_id uuid, p_garden_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: garden_x_delete_photo(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_delete_photo(p_request_id uuid, p_photo_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_photo garden.photos%rowtype;
  v_payload jsonb;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_photo_id is null then raise exception 'Photo id is required'; end if;

  v_payload := jsonb_build_object('photo_id', p_photo_id);
  v_response := garden.command_response(v_owner, p_request_id, 'delete_photo', v_payload);
  if v_response is not null then return v_response; end if;

  select * into v_photo
  from garden.photos
  where id = p_photo_id and owner_id = v_owner
  for update;
  if not found then raise exception 'Photo not found'; end if;

  update garden.saved_films
  set photo_ids = array_remove(photo_ids, p_photo_id)
  where owner_id = v_owner and p_photo_id = any(photo_ids);

  delete from garden.photos where id = p_photo_id and owner_id = v_owner;

  v_response := jsonb_build_object(
    'photo_id', p_photo_id,
    'storage_path', v_photo.storage_path,
    'deleted', true,
    'event_preserved', v_photo.event_id is not null
  );
  perform garden.store_command_response(v_owner, p_request_id, 'delete_photo', v_payload, v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_get_bootstrap(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_get_bootstrap() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
with base as (
  select public.garden_x_get_bootstrap_b35_base() as value
), gardens as (
  select coalesce(jsonb_agg(
    item || jsonb_strip_nulls(jsonb_build_object(
      'cultivation_method', case
        when s.metadata->>'cultivation_method' in ('hydroponic','soil','container') then s.metadata->>'cultivation_method'
        else null
      end
    )) order by entries.ordinality
  ), '[]'::jsonb) as value
  from base
  cross join lateral jsonb_array_elements(base.value->'gardens') with ordinality as entries(item, ordinality)
  left join garden.system_instances s
    on s.id=nullif(item->>'system_instance_id','')::uuid
   and s.owner_id=public.garden_owner_id()
), plants as (
  select coalesce(jsonb_agg(
    item || jsonb_build_object('origin_type',coalesce(gc.origin_type,'unknown')) order by entries.ordinality
  ), '[]'::jsonb) as value
  from base
  cross join lateral jsonb_array_elements(base.value->'plants') with ordinality as entries(item, ordinality)
  left join garden.grow_cycles gc
    on gc.id=nullif(item->>'grow_cycle_id','')::uuid
   and gc.owner_id=public.garden_owner_id()
)
select jsonb_set(
  jsonb_set(base.value,'{gardens}',gardens.value,true),
  '{plants}',plants.value,true
)
from base cross join gardens cross join plants;
$$;


--
-- Name: garden_x_get_historical_photos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_get_historical_photos() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',ph.id,'plant_instance_id',gc.plant_instance_id,'grow_cycle_id',gc.id,'event_id',null,
   'storage_path',ph.storage_path,'original_filename',ph.original_filename,'content_type',ph.content_type,
   'byte_size',ph.byte_size,'captured_at',ph.captured_at,'captured_at_precision',ph.captured_at_precision,
   'width',ph.width,'height',ph.height,'media_scope',ph.media_scope
 ) order by coalesce(ph.captured_at,ph.created_at) desc),'[]'::jsonb)
 from garden.photos ph
 join garden.grow_cycles gc on gc.id=(ph.import_provenance->>'grow_cycle_id')::uuid
 join garden.plant_instances pi on pi.id=gc.plant_instance_id
 where ph.owner_id=public.garden_owner_id()
   and pi.owner_id=public.garden_owner_id()
   and ph.event_id is null
   and ph.media_scope='cycle_evidence'
   and ph.upload_status='uploaded'
   and ph.import_provenance ? 'grow_cycle_id'
$$;


--
-- Name: garden_x_get_saved_films(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_get_saved_films() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',f.id,'plant_instance_id',f.plant_instance_id,'title',f.title,'photo_ids',f.photo_ids,'music',f.music,'created_at',f.created_at
 ) order by f.created_at desc),'[]'::jsonb)
 from garden.saved_films f where f.owner_id=public.garden_owner_id()
$$;


--
-- Name: garden_x_move_plant(uuid, uuid, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_move_plant(p_request_id uuid, p_plant_instance_id uuid, p_target_position_id uuid, p_moved_on date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_cycle garden.grow_cycles%rowtype;
  v_source garden.cycle_occupancies%rowtype;
  v_source_garden uuid;
  v_target_garden uuid;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
  where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_move_plant';
  if found then return v_response; end if;
  if p_moved_on is null then raise exception 'Move date is required'; end if;

  select gc.* into v_cycle from garden.grow_cycles gc
  where gc.plant_instance_id=p_plant_instance_id and gc.owner_id=v_owner and gc.state='active'
  order by gc.created_at desc limit 1 for update;
  if not found then raise exception 'Active plant cycle not found'; end if;

  select * into v_source from garden.cycle_occupancies
  where grow_cycle_id=v_cycle.id and occupied_until is null for update;
  if not found then raise exception 'Current occupancy not found'; end if;

  select p.garden_id into v_source_garden from garden.positions p where p.id=v_source.position_id;
  select s.garden_id into v_target_garden
  from garden.positions p join garden.system_instances s on s.id=p.system_instance_id
  where p.id=p_target_position_id and s.owner_id=v_owner and s.status='active';
  if v_target_garden is null then raise exception 'Target position not found'; end if;
  if p_target_position_id=v_source.position_id then raise exception 'Target position is already current'; end if;

  -- Do not reject an occupied target: temporary shared occupancy is intentional
  -- during physical reorganization. The cycle-level unique index still ensures
  -- this plant/cycle cannot have two current positions.
  update garden.cycle_occupancies set occupied_until=p_moved_on where id=v_source.id;
  insert into garden.cycle_occupancies(position_id,grow_cycle_id,occupied_from)
  values(p_target_position_id,v_cycle.id,p_moved_on);
  update garden.grow_cycles set revision=revision+1,updated_at=now() where id=v_cycle.id;

  insert into garden.events(owner_id,grow_cycle_id,garden_id,event_type,occurred_at,note,event_data)
  values(
    v_owner,v_cycle.id,v_target_garden,'cycle_moved',p_moved_on::timestamptz,'Relocated',
    jsonb_build_object('source','garden_x_v1','from_garden_id',v_source_garden,'from_position_id',v_source.position_id,
      'to_garden_id',v_target_garden,'to_position_id',p_target_position_id,'occurred_on',p_moved_on,'occurred_at_precision','date')
  ) returning id into v_event_id;

  v_response:=jsonb_build_object('plant_instance_id',p_plant_instance_id,'grow_cycle_id',v_cycle.id,'event_id',v_event_id);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_move_plant',v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_prepare_event_photo(uuid, uuid, text, text, bigint, timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_prepare_event_photo(p_photo_id uuid, p_event_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint, p_captured_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_captured_at_precision text DEFAULT 'unknown'::text, p_checksum_sha256 text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_existing garden.photos%rowtype;
  v_ext text;
  v_path text;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_photo_id is null then raise exception 'Photo id is required'; end if;
  if not exists(
    select 1 from garden.events e
    where e.id=p_event_id and e.owner_id=v_owner and e.invalidated_at is null
  ) then raise exception 'Event not found'; end if;
  if p_byte_size is null or p_byte_size <= 0 or p_byte_size > 52428800 then raise exception 'Invalid photo size'; end if;
  if p_captured_at_precision not in ('exact','approximate','unknown') then raise exception 'Invalid capture precision'; end if;
  if (p_captured_at is null and p_captured_at_precision <> 'unknown')
     or (p_captured_at is not null and p_captured_at_precision='unknown') then
    raise exception 'Capture date and precision do not match';
  end if;

  select * into v_existing from garden.photos where id=p_photo_id and owner_id=v_owner;
  if found then
    if v_existing.event_id <> p_event_id then raise exception 'Photo id already belongs to another event'; end if;
    return jsonb_build_object('photo_id',v_existing.id,'storage_path',v_existing.storage_path,'upload_status',v_existing.upload_status);
  end if;

  v_ext := case lower(p_content_type)
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/heic' then 'heic'
    when 'image/heif' then 'heif'
    when 'image/webp' then 'webp'
    else null
  end;
  if v_ext is null then raise exception 'Unsupported image type'; end if;

  v_path := v_owner::text || '/' || p_photo_id::text || '/original.' || v_ext;
  insert into garden.photos(
    id,owner_id,event_id,storage_path,original_filename,content_type,byte_size,
    captured_at,captured_at_precision,upload_status,checksum_sha256,media_scope
  ) values(
    p_photo_id,v_owner,p_event_id,v_path,
    coalesce(nullif(trim(p_original_filename),''),'garden-photo.'||v_ext),
    lower(p_content_type),p_byte_size,p_captured_at,p_captured_at_precision,
    'pending',nullif(trim(coalesce(p_checksum_sha256,'')),''),'cycle_evidence'
  );

  return jsonb_build_object('photo_id',p_photo_id,'storage_path',v_path,'upload_status','pending');
end;
$$;


--
-- Name: garden_x_record_harvest(uuid, uuid, integer, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_occurred_on date, p_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  return public.garden_record_harvest(
    p_request_id,
    p_grow_cycle_id,
    p_expected_revision,
    p_occurred_on,
    p_note
  );
end;
$$;


--
-- Name: garden_x_record_system_maintenance(uuid, uuid, text, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_record_system_maintenance(p_request_id uuid, p_garden_id uuid, p_action text, p_occurred_on date, p_note text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
  values (
    v_owner,
    p_garden_id,
    null,
    'system_maintenance',
    ((p_occurred_on::timestamp + interval '12 hours') at time zone 'UTC'),
    nullif(trim(p_note), ''),
    jsonb_build_object('class', v_class, 'source', 'garden_detail', 'occurred_on', p_occurred_on, 'occurred_at_precision', 'date')
  )
  returning id into v_event_id;
  v_response := jsonb_build_object('event_id', v_event_id, 'garden_id', p_garden_id, 'action', p_action, 'occurred_on', p_occurred_on);
  insert into garden.command_receipts(owner_id, request_id, command_name, response) values (v_owner, p_request_id, 'garden_x_record_system_maintenance', v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_reorder_gardens(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_reorder_gardens(p_request_id uuid, p_garden_ids uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_id uuid;
  v_i integer := 0;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
   where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_reorder_gardens';
  if found then return v_response; end if;
  if coalesce(cardinality(p_garden_ids),0)=0 then raise exception 'Garden order is required'; end if;
  if (select count(*) from garden.gardens where owner_id=v_owner and id=any(p_garden_ids)) <> cardinality(p_garden_ids)
    then raise exception 'Garden order contains an unavailable garden'; end if;

  foreach v_id in array p_garden_ids loop
    update garden.gardens set sort_order=v_i,updated_at=now() where id=v_id and owner_id=v_owner;
    v_i:=v_i+1;
  end loop;

  v_response:=jsonb_build_object('updated',true,'count',cardinality(p_garden_ids));
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_reorder_gardens',v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_replace_library_plant(uuid, uuid, uuid, text, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_replace_library_plant(p_request_id uuid, p_old_plant_instance_id uuid, p_new_plant_instance_id uuid, p_nickname text, p_library_plant_id text, p_started_on date DEFAULT CURRENT_DATE) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_catalog garden.library_catalog_items%rowtype;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
  where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_replace_library_plant';
  if found then return v_response; end if;
  select * into v_catalog from garden.library_catalog_items
  where library_plant_id=trim(coalesce(p_library_plant_id,'')) and status='active';
  if not found then raise exception 'Garden Library identity is unavailable'; end if;
  v_response := public.garden_x_replace_plant(
    p_request_id,p_old_plant_instance_id,p_new_plant_instance_id,p_nickname,
    v_catalog.common_name,v_catalog.scientific_name,v_catalog.cultivar,
    v_catalog.library_plant_id,p_started_on
  );
  update garden.plant_instances
  set library_plant_id=v_catalog.library_plant_id, library_catalog_version=v_catalog.catalog_version,
      library_common_name_snapshot=v_catalog.common_name,
      library_scientific_name_snapshot=v_catalog.scientific_name,
      library_cultivar_snapshot=v_catalog.cultivar,
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object('created_via','garden_x_v1_library_replacement'),
      updated_at=now()
  where id=p_new_plant_instance_id and owner_id=v_owner;
  v_response := v_response || jsonb_build_object('library_plant_id',v_catalog.library_plant_id,'library_catalog_version',v_catalog.catalog_version);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_replace_library_plant',v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_replace_plant(uuid, uuid, uuid, text, text, text, text, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_replace_plant(p_request_id uuid, p_old_plant_instance_id uuid, p_new_plant_instance_id uuid, p_nickname text, p_common_name text, p_scientific_name text DEFAULT NULL::text, p_cultivar text DEFAULT NULL::text, p_reference_key text DEFAULT NULL::text, p_started_on date DEFAULT CURRENT_DATE) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_old_cycle garden.grow_cycles%rowtype;
  v_occ garden.cycle_occupancies%rowtype;
  v_crop_id uuid;
  v_new_cycle_id uuid;
  v_end_event_id uuid;
  v_start_event_id uuid;
  v_garden_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
   where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_replace_plant';
  if found then return v_response; end if;
  if p_started_on is null then raise exception 'Start date is required'; end if;
  if char_length(trim(coalesce(p_common_name,''))) not between 1 and 100 then raise exception 'Common name is required'; end if;

  select gc.* into v_old_cycle
  from garden.grow_cycles gc
  where gc.plant_instance_id=p_old_plant_instance_id and gc.owner_id=v_owner and gc.state='active'
  order by gc.created_at desc limit 1 for update;
  if not found then raise exception 'Current plant cycle not found'; end if;

  select * into v_occ from garden.cycle_occupancies
  where grow_cycle_id=v_old_cycle.id and occupied_until is null for update;
  if not found then raise exception 'Current occupancy not found'; end if;
  if v_occ.occupied_from is not null and p_started_on<v_occ.occupied_from then raise exception 'Replacement cannot precede occupancy'; end if;

  select p.garden_id into v_garden_id from garden.positions p where p.id=v_occ.position_id;

  update garden.cycle_occupancies set occupied_until=p_started_on where id=v_occ.id;
  update garden.grow_cycles set state='closed',revision=revision+1,updated_at=now() where id=v_old_cycle.id;
  update garden.plant_instances set status='ended',updated_at=now() where id=p_old_plant_instance_id and owner_id=v_owner;

  insert into garden.events(owner_id,grow_cycle_id,garden_id,event_type,occurred_at,note,event_data)
  values(v_owner,v_old_cycle.id,v_garden_id,'cycle_ended',p_started_on::timestamptz,
    'Cycle closed: replacement',jsonb_build_object('source','garden_x_v1','reason','replacement','occurred_on',p_started_on,'occurred_at_precision','date'))
  returning id into v_end_event_id;

  insert into garden.cycle_revisions(owner_id,grow_cycle_id,revision_number,operation,previous_values,next_values,reason)
  values(v_owner,v_old_cycle.id,v_old_cycle.revision+1,'closed',
    jsonb_build_object('state',v_old_cycle.state,'occupied_until',v_occ.occupied_until),
    jsonb_build_object('state','closed','occupied_until',p_started_on),'replacement');

  insert into garden.crops(owner_id,common_name,scientific_name)
  values(v_owner,trim(p_common_name),nullif(trim(coalesce(p_scientific_name,'')),''))
  on conflict(owner_id,common_name) do update set scientific_name=coalesce(garden.crops.scientific_name,excluded.scientific_name)
  returning id into v_crop_id;

  insert into garden.plant_instances(id,owner_id,nickname,reference_key,common_name,scientific_name,cultivar,status,metadata)
  values(p_new_plant_instance_id,v_owner,nullif(trim(coalesce(p_nickname,'')),''),
    nullif(trim(coalesce(p_reference_key,'')),''),
    trim(p_common_name),nullif(trim(coalesce(p_scientific_name,'')),''),
    nullif(trim(coalesce(p_cultivar,'')),''),'active',jsonb_build_object('created_via','garden_x_v1','replaced_plant_id',p_old_plant_instance_id));

  insert into garden.grow_cycles(owner_id,crop_id,plant_instance_id,planted_on,planted_on_precision)
  values(v_owner,v_crop_id,p_new_plant_instance_id,p_started_on,'exact') returning id into v_new_cycle_id;
  insert into garden.cycle_occupancies(position_id,grow_cycle_id,occupied_from)
  values(v_occ.position_id,v_new_cycle_id,p_started_on);

  insert into garden.events(owner_id,grow_cycle_id,garden_id,event_type,occurred_at,note,event_data)
  values(v_owner,v_new_cycle_id,v_garden_id,'cycle_started',p_started_on::timestamptz,'Added to garden',
    jsonb_build_object('source','garden_x_v1','replaced_plant_id',p_old_plant_instance_id,'occurred_on',p_started_on,'occurred_at_precision','date'))
  returning id into v_start_event_id;

  v_response:=jsonb_build_object('old_plant_instance_id',p_old_plant_instance_id,'new_plant_instance_id',p_new_plant_instance_id,
    'new_grow_cycle_id',v_new_cycle_id,'end_event_id',v_end_event_id,'start_event_id',v_start_event_id,'position_id',v_occ.position_id);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_replace_plant',v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_save_film(uuid, uuid, uuid, text, uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_save_film(p_request_id uuid, p_film_id uuid, p_plant_instance_id uuid, p_title text, p_photo_ids uuid[], p_music text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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


--
-- Name: garden_x_set_custom_system_photo(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_set_custom_system_photo(p_request_id uuid, p_definition_id uuid, p_photo_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id(); v_response jsonb; v_garden_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select response into v_response from garden.command_receipts where owner_id = v_owner and request_id = p_request_id and command_name = 'garden_x_set_custom_system_photo';
  if found then return v_response; end if;
  select s.garden_id into v_garden_id from garden.system_instances s
  where s.owner_id = v_owner and s.metadata->>'custom_definition_id' = p_definition_id::text and s.status = 'active';
  if v_garden_id is null then raise exception 'Custom system not found'; end if;
  if not exists (select 1 from garden.photos ph where ph.id = p_photo_id and ph.owner_id = v_owner and ph.garden_id = v_garden_id and ph.media_scope = 'garden_cover' and ph.upload_status = 'uploaded') then raise exception 'System photo not available'; end if;
  update garden.custom_system_definitions set photo_id = p_photo_id, updated_at = now() where id = p_definition_id and owner_id = v_owner;
  update garden.gardens set cover_photo_id = p_photo_id, updated_at = now() where id = v_garden_id and owner_id = v_owner;
  v_response := jsonb_build_object('custom_definition_id', p_definition_id, 'photo_id', p_photo_id);
  insert into garden.command_receipts(owner_id, request_id, command_name, response) values (v_owner, p_request_id, 'garden_x_set_custom_system_photo', v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_sync_library_catalog(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_sync_library_catalog(p_catalog jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_count integer;
begin
  if jsonb_typeof(p_catalog) <> 'array' or jsonb_array_length(p_catalog) = 0 then
    raise exception 'Catalog entries are required';
  end if;
  insert into garden.library_catalog_items(
    library_plant_id,catalog_version,common_name,scientific_name,cultivar,
    aliases,category,status,provenance,synced_at
  )
  select
    trim(item->>'libraryPlantId'),
    trim(item->>'catalogVersion'),
    trim(item->>'commonName'),
    nullif(trim(coalesce(item->>'scientificName','')),''),
    nullif(trim(coalesce(item->>'cultivar','')),''),
    coalesce(item->'aliases','[]'::jsonb),
    trim(item->>'category'),
    coalesce(nullif(trim(item->>'status'),''),'active'),
    coalesce(item->'provenance','[]'::jsonb),
    now()
  from jsonb_array_elements(p_catalog) item
  where trim(coalesce(item->>'libraryPlantId','')) <> ''
    and trim(coalesce(item->>'catalogVersion','')) <> ''
    and trim(coalesce(item->>'commonName','')) <> ''
  on conflict (library_plant_id) do update set
    catalog_version=excluded.catalog_version,
    common_name=excluded.common_name,
    scientific_name=excluded.scientific_name,
    cultivar=excluded.cultivar,
    aliases=excluded.aliases,
    category=excluded.category,
    status=excluded.status,
    provenance=excluded.provenance,
    synced_at=excluded.synced_at;
  get diagnostics v_count = row_count;
  if v_count <> jsonb_array_length(p_catalog) then
    raise exception 'Catalog contains invalid entries';
  end if;
  return jsonb_build_object('synced',v_count);
end;
$$;


--
-- Name: garden_x_update_custom_system_layout(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_update_custom_system_layout(p_request_id uuid, p_garden_id uuid, p_levels jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_system garden.system_instances%rowtype;
  v_definition_id uuid;
  v_expected_total integer := 0;
  v_position_total integer;
  v_level jsonb;
  v_cell jsonb;
  v_active jsonb;
  v_normalized_levels jsonb := '[]'::jsonb;
  v_level_number integer := 0;
  v_rows integer;
  v_columns integer;
  v_row integer;
  v_column integer;
  v_position_number integer := 0;
  v_position_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_request_id is null or p_garden_id is null then raise exception 'Ids are required'; end if;
  if jsonb_typeof(p_levels) <> 'array' or jsonb_array_length(p_levels) not between 1 and 12 then raise exception 'One to twelve levels are required'; end if;
  select response into v_response from garden.command_receipts where owner_id = v_owner and request_id = p_request_id and command_name = 'garden_x_update_custom_system_layout';
  if found then return v_response; end if;
  select s.* into v_system from garden.system_instances s where s.garden_id = p_garden_id and s.owner_id = v_owner and s.status = 'active' for update;
  if not found then raise exception 'System not found'; end if;
  v_definition_id := nullif(v_system.metadata->>'custom_definition_id', '')::uuid;
  select count(*) into v_position_total from garden.positions p where p.system_instance_id = v_system.id;

  for v_level in select value from jsonb_array_elements(p_levels) loop
    v_level_number := v_level_number + 1;
    if jsonb_typeof(v_level) <> 'object' or coalesce(v_level->>'rows', '') !~ '^[0-9]+$' or coalesce(v_level->>'columns', '') !~ '^[0-9]+$' then raise exception 'Each level needs rows and columns'; end if;
    v_rows := (v_level->>'rows')::integer; v_columns := (v_level->>'columns')::integer;
    if v_rows not between 1 and 9 or v_columns not between 1 and 8 then raise exception 'Rows must be 1–9 and columns must be 1–8'; end if;
    v_active := v_level->'active_cells';
    if v_active is null then
      select jsonb_agg(jsonb_build_object('row', row_number, 'column', column_number) order by row_number, column_number) into v_active
      from generate_series(1, v_rows) as rows(row_number) cross join generate_series(1, v_columns) as columns(column_number);
    end if;
    if jsonb_typeof(v_active) <> 'array' or jsonb_array_length(v_active) < 1 then raise exception 'Each level needs at least one active cell'; end if;
    for v_cell in select value from jsonb_array_elements(v_active) loop
      if jsonb_typeof(v_cell) <> 'object' or coalesce(v_cell->>'row', '') !~ '^[0-9]+$' or coalesce(v_cell->>'column', '') !~ '^[0-9]+$' then raise exception 'Active cells need row and column'; end if;
      v_row := (v_cell->>'row')::integer; v_column := (v_cell->>'column')::integer;
      if v_row not between 1 and v_rows or v_column not between 1 and v_columns then raise exception 'Active cell is outside its grid'; end if;
      if (select count(*) from jsonb_array_elements(v_active) prior where prior = v_cell) > 1 then raise exception 'Active cells cannot repeat'; end if;
    end loop;
    v_expected_total := v_expected_total + jsonb_array_length(v_active);
    v_normalized_levels := v_normalized_levels || jsonb_build_array(jsonb_build_object('levelNumber', v_level_number, 'rows', v_rows, 'columns', v_columns, 'activeCells', v_active));
  end loop;
  if v_expected_total <> v_position_total then raise exception 'Active cells must equal the existing position count'; end if;

  update garden.layout_sites set is_active = false, updated_at = now() where system_instance_id = v_system.id;
  if v_definition_id is not null then delete from garden.custom_system_levels where definition_id = v_definition_id; end if;
  v_level_number := 0;
  for v_level in select value from jsonb_array_elements(p_levels) loop
    v_level_number := v_level_number + 1; v_rows := (v_level->>'rows')::integer; v_columns := (v_level->>'columns')::integer; v_active := v_level->'active_cells';
    if v_active is null then select jsonb_agg(jsonb_build_object('row', row_number, 'column', column_number) order by row_number, column_number) into v_active from generate_series(1, v_rows) as rows(row_number) cross join generate_series(1, v_columns) as columns(column_number); end if;
    if v_definition_id is not null then insert into garden.custom_system_levels(definition_id, level_number, row_count, column_count, active_cells) values (v_definition_id, v_level_number, v_rows, v_columns, v_active); end if;
    for v_cell in select value from jsonb_array_elements(v_active) order by (value->>'row')::integer, (value->>'column')::integer loop
      v_position_number := v_position_number + 1; v_row := (v_cell->>'row')::integer; v_column := (v_cell->>'column')::integer;
      select p.id into v_position_id from garden.positions p where p.system_instance_id = v_system.id and p.position_number = v_position_number;
      if v_position_id is null then raise exception 'Position numbering is incomplete'; end if;
      update garden.layout_sites set level_number = v_level_number, row_number = v_row, column_number = v_column, grid_x = v_column, grid_y = v_row, is_active = true, updated_at = now() where system_instance_id = v_system.id and position_id = v_position_id;
      if not found then raise exception 'Position layout is incomplete'; end if;
    end loop;
  end loop;
  if v_definition_id is null then update garden.system_instances set metadata = jsonb_set(metadata, '{layout_levels}', v_normalized_levels, true), updated_at = now() where id = v_system.id and owner_id = v_owner; else update garden.custom_system_definitions set updated_at = now() where id = v_definition_id and owner_id = v_owner; end if;
  v_response := jsonb_build_object('garden_id', p_garden_id, 'position_count', v_position_total, 'updated', true);
  insert into garden.command_receipts(owner_id, request_id, command_name, response) values (v_owner, p_request_id, 'garden_x_update_custom_system_layout', v_response);
  return v_response;
end;
$_$;


--
-- Name: garden_x_update_garden_settings(uuid, uuid, uuid, text, text, text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_update_garden_settings(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_name text, p_kind text, p_place text, p_note text, p_system_name text, p_archived boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
  v_system_name text := nullif(trim(coalesce(p_system_name, '')), '');
  v_system_instance_id uuid;
begin
  if v_owner is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  select response into v_response
  from garden.command_receipts
  where owner_id = v_owner
    and request_id = p_request_id
  and command_name = 'garden_x_update_garden_settings';
  if found then return v_response; end if;

  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Garden name is required';
  end if;

  select id into v_system_instance_id
  from garden.system_instances
  where id = p_system_instance_id
    and garden_id = p_garden_id
    and owner_id = v_owner
    and status = 'active'
  for update;
  if not found then raise exception 'Garden system not found'; end if;

  update garden.gardens
  set name = trim(p_name),
      kind = coalesce(nullif(trim(coalesce(p_kind, '')), ''), kind),
      place = coalesce(trim(p_place), ''),
      note = coalesce(trim(p_note), ''),
      archived_at = case when p_archived then coalesce(archived_at, now()) else null end,
      updated_at = now()
  where id = p_garden_id and owner_id = v_owner;
  if not found then raise exception 'Garden not found'; end if;

  if v_system_name is not null then
    update garden.system_instances
    set name = v_system_name, updated_at = now()
    where id = v_system_instance_id and owner_id = v_owner;
  end if;

  -- system_model, legacy_system_model, system_definition_key, capacity,
  -- cover selection, and geometry belong to separate canonical concepts.
  v_response := jsonb_build_object(
    'garden_id', p_garden_id,
    'updated', true,
    'system_name_updated', v_system_name is not null,
    'archived', p_archived
  );
  insert into garden.command_receipts(owner_id, request_id, command_name, response)
  values (v_owner, p_request_id, 'garden_x_update_garden_settings', v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_update_library_plant_identity(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_update_library_plant_identity(p_request_id uuid, p_plant_instance_id uuid, p_nickname text, p_library_plant_id text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_catalog garden.library_catalog_items%rowtype;
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
  where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_update_library_plant_identity';
  if found then return v_response; end if;
  select * into v_catalog from garden.library_catalog_items
  where library_plant_id=trim(coalesce(p_library_plant_id,'')) and status='active';
  if not found then raise exception 'Garden Library identity is unavailable'; end if;
  update garden.plant_instances
  set nickname=nullif(trim(coalesce(p_nickname,'')),''), reference_key=v_catalog.library_plant_id,
      common_name=v_catalog.common_name, scientific_name=v_catalog.scientific_name, cultivar=v_catalog.cultivar,
      library_plant_id=v_catalog.library_plant_id, library_catalog_version=v_catalog.catalog_version,
      library_common_name_snapshot=coalesce(library_common_name_snapshot,v_catalog.common_name),
      library_scientific_name_snapshot=coalesce(library_scientific_name_snapshot,v_catalog.scientific_name),
      library_cultivar_snapshot=coalesce(library_cultivar_snapshot,v_catalog.cultivar), updated_at=now()
  where id=p_plant_instance_id and owner_id=v_owner;
  if not found then raise exception 'Plant not found'; end if;
  v_response:=jsonb_build_object('plant_instance_id',p_plant_instance_id,'updated',true);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_update_library_plant_identity',v_response);
  return v_response;
end;
$$;


--
-- Name: garden_x_update_plant_identity(uuid, uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.garden_x_update_plant_identity(p_request_id uuid, p_plant_instance_id uuid, p_nickname text, p_common_name text, p_scientific_name text DEFAULT NULL::text, p_cultivar text DEFAULT NULL::text, p_reference_key text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_owner uuid := public.garden_owner_id();
  v_response jsonb;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select response into v_response from garden.command_receipts
  where owner_id=v_owner and request_id=p_request_id and command_name='garden_x_update_plant_identity';
  if found then return v_response; end if;
  if char_length(trim(coalesce(p_common_name,''))) not between 1 and 100 then raise exception 'Common name is required'; end if;

  update garden.plant_instances
  set nickname=nullif(trim(coalesce(p_nickname,'')),''),
      common_name=trim(p_common_name),
      scientific_name=nullif(trim(coalesce(p_scientific_name,'')),''),
      cultivar=nullif(trim(coalesce(p_cultivar,'')),''),
      reference_key=nullif(trim(coalesce(p_reference_key,'')),''),
      updated_at=now()
  where id=p_plant_instance_id and owner_id=v_owner;
  if not found then raise exception 'Plant not found'; end if;

  v_response:=jsonb_build_object('plant_instance_id',p_plant_instance_id,'updated',true);
  insert into garden.command_receipts(owner_id,request_id,command_name,response)
  values(v_owner,p_request_id,'garden_x_update_plant_identity',v_response);
  return v_response;
end;
$$;


--
-- Name: gardenpedia_research_begin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gardenpedia_research_begin(p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_request garden.gardenpedia_requests%rowtype;
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode='42501'; end if;
  update garden.gardenpedia_requests set status='researching',updated_at=now()
    where id=p_request_id and status in ('requested','research_failed','needs_revision')
    returning * into v_request;
  if not found then raise exception 'Request is not available for research'; end if;
  return jsonb_build_object('id',v_request.id,'requestedText',v_request.requested_text,'createdAt',v_request.created_at);
end;
$$;


--
-- Name: gardenpedia_research_failed(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gardenpedia_research_failed(p_request_id uuid, p_error text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode='42501'; end if;
  update garden.gardenpedia_requests set status='research_failed',updated_at=now()
    where id=p_request_id and status='researching';
  if not found then raise exception 'Request is not currently researching'; end if;
  return jsonb_build_object('requestId',p_request_id,'status','research_failed','error',left(coalesce(p_error,'research_failed'),240));
end;
$$;


--
-- Name: gardenpedia_submit_proposal(uuid, text, text, jsonb, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gardenpedia_submit_proposal(p_request_id uuid, p_contract_name text, p_contract_version text, p_candidate_identity jsonb, p_proposed_data jsonb, p_evidence jsonb, p_confidence_status jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_owner uuid := auth.uid(); v_id uuid;
begin
  if not garden.gardenpedia_is_curator() then raise exception 'Curator authorization required' using errcode = '42501'; end if;
  if not exists(select 1 from garden.gardenpedia_requests where id=p_request_id) then raise exception 'Request not found'; end if;
  if nullif(trim(coalesce(p_contract_name,'')),'') is null or nullif(trim(coalesce(p_contract_version,'')),'') is null then raise exception 'Contract name and version are required'; end if;
  if jsonb_typeof(coalesce(p_candidate_identity,'{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_proposed_data,'{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_evidence,'[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_confidence_status,'{}'::jsonb)) <> 'object' then raise exception 'Invalid proposal structure'; end if;
  insert into garden.gardenpedia_proposals(request_id,contract_name,contract_version,candidate_identity,proposed_data,evidence,confidence_status,created_by)
  values(p_request_id,trim(p_contract_name),trim(p_contract_version),coalesce(p_candidate_identity,'{}'::jsonb),coalesce(p_proposed_data,'{}'::jsonb),coalesce(p_evidence,'[]'::jsonb),coalesce(p_confidence_status,'{}'::jsonb),v_owner)
  returning id into v_id;
  update garden.gardenpedia_requests set status='proposal_ready',updated_at=now() where id=p_request_id;
  return jsonb_build_object('id',v_id,'reviewStatus','in_review');
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ai_requests; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.ai_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    request_key text NOT NULL,
    request_type text NOT NULL,
    status text DEFAULT 'started'::text NOT NULL,
    evidence_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    garden_ai_standard_version text DEFAULT 'garden_ai_standard_v1'::text NOT NULL,
    context_schema_version text DEFAULT 'garden_ai_context_v1'::text NOT NULL,
    proposal_schema_version text DEFAULT 'garden_ai_check_v1'::text NOT NULL,
    prompt_version text DEFAULT 'unassigned'::text NOT NULL,
    provider_adapter_version text DEFAULT 'mock_v1'::text NOT NULL,
    model_identifier text,
    proposal jsonb,
    proposal_decision text,
    duration_ms integer,
    usage_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    estimated_cost_usd numeric(12,6),
    error_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    proposal_expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    audit_expires_at timestamp with time zone DEFAULT (now() + '90 days'::interval) NOT NULL,
    CONSTRAINT ai_requests_duration_ms_check CHECK (((duration_ms IS NULL) OR (duration_ms >= 0))),
    CONSTRAINT ai_requests_estimated_cost_usd_check CHECK (((estimated_cost_usd IS NULL) OR (estimated_cost_usd >= (0)::numeric))),
    CONSTRAINT ai_requests_evidence_refs_check CHECK ((jsonb_typeof(evidence_refs) = 'array'::text)),
    CONSTRAINT ai_requests_proposal_check CHECK (((proposal IS NULL) OR (jsonb_typeof(proposal) = 'object'::text))),
    CONSTRAINT ai_requests_proposal_decision_check CHECK (((proposal_decision IS NULL) OR (proposal_decision = ANY (ARRAY['pending'::text, 'dismissed'::text, 'attention_created'::text, 'fact_flow_opened'::text])))),
    CONSTRAINT ai_requests_request_type_check CHECK ((request_type = ANY (ARRAY['ai_check'::text, 'ask_garden'::text, 'identify'::text, 'meaningful_change'::text, 'garden_summary_global'::text, 'garden_summary_local'::text, 'share_caption'::text]))),
    CONSTRAINT ai_requests_status_check CHECK ((status = ANY (ARRAY['started'::text, 'completed'::text, 'failed'::text, 'expired'::text]))),
    CONSTRAINT ai_requests_usage_metadata_check CHECK ((jsonb_typeof(usage_metadata) = 'object'::text))
);


--
-- Name: TABLE ai_requests; Type: COMMENT; Schema: garden; Owner: -
--

COMMENT ON TABLE garden.ai_requests IS 'Non-canonical Garden AI request metadata. Never store raw prompts, images, signed URLs, or model reasoning here.';


--
-- Name: COLUMN ai_requests.evidence_refs; Type: COMMENT; Schema: garden; Owner: -
--

COMMENT ON COLUMN garden.ai_requests.evidence_refs IS 'Validated IDs and kinds only; storage paths and image bytes are intentionally excluded.';


--
-- Name: COLUMN ai_requests.proposal; Type: COMMENT; Schema: garden; Owner: -
--

COMMENT ON COLUMN garden.ai_requests.proposal IS 'Validated, non-canonical proposal payload retained only until proposal_expires_at.';


--
-- Name: COLUMN ai_requests.proposal_expires_at; Type: COMMENT; Schema: garden; Owner: -
--

COMMENT ON COLUMN garden.ai_requests.proposal_expires_at IS 'Private proposal retention deadline; proposal payloads, when added, must be removed after this time.';


--
-- Name: COLUMN ai_requests.audit_expires_at; Type: COMMENT; Schema: garden; Owner: -
--

COMMENT ON COLUMN garden.ai_requests.audit_expires_at IS 'Bounded audit metadata retention deadline.';


--
-- Name: attention_history; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.attention_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    attention_item_id uuid NOT NULL,
    from_status text,
    to_status text NOT NULL,
    operation text NOT NULL,
    reason text,
    related_event_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT attention_history_from_status_check CHECK ((from_status = ANY (ARRAY['open'::text, 'completed'::text, 'dismissed'::text]))),
    CONSTRAINT attention_history_operation_check CHECK ((operation = ANY (ARRAY['created'::text, 'deferred'::text, 'completed'::text, 'dismissed'::text]))),
    CONSTRAINT attention_history_to_status_check CHECK ((to_status = ANY (ARRAY['open'::text, 'completed'::text, 'dismissed'::text])))
);


--
-- Name: attention_items; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.attention_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    garden_id uuid,
    grow_cycle_id uuid,
    purpose text NOT NULL,
    subject_key text DEFAULT 'general'::text NOT NULL,
    title text NOT NULL,
    origin text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    due_on date,
    next_review_on date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_event_id uuid,
    completed_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    dismissed_reason text,
    CONSTRAINT attention_items_origin_check CHECK ((origin = ANY (ARRAY['manual'::text, 'rule'::text, 'follow_up'::text, 'visual_review'::text, 'incident'::text, 'ai_proposal'::text]))),
    CONSTRAINT attention_items_purpose_check CHECK (((char_length(TRIM(BOTH FROM purpose)) >= 1) AND (char_length(TRIM(BOTH FROM purpose)) <= 80))),
    CONSTRAINT attention_items_status_check CHECK ((status = ANY (ARRAY['open'::text, 'completed'::text, 'dismissed'::text]))),
    CONSTRAINT attention_items_subject_key_check CHECK (((char_length(TRIM(BOTH FROM subject_key)) >= 1) AND (char_length(TRIM(BOTH FROM subject_key)) <= 160))),
    CONSTRAINT attention_items_terminal_details CHECK ((((status = 'open'::text) AND (completed_event_id IS NULL) AND (completed_at IS NULL) AND (dismissed_at IS NULL) AND (dismissed_reason IS NULL)) OR ((status = 'completed'::text) AND (completed_event_id IS NOT NULL) AND (completed_at IS NOT NULL) AND (dismissed_at IS NULL) AND (dismissed_reason IS NULL)) OR ((status = 'dismissed'::text) AND (completed_event_id IS NULL) AND (completed_at IS NULL) AND (dismissed_at IS NOT NULL) AND ((char_length(TRIM(BOTH FROM dismissed_reason)) >= 1) AND (char_length(TRIM(BOTH FROM dismissed_reason)) <= 500))))),
    CONSTRAINT attention_items_title_check CHECK (((char_length(TRIM(BOTH FROM title)) >= 1) AND (char_length(TRIM(BOTH FROM title)) <= 180)))
);


--
-- Name: command_receipts; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.command_receipts (
    owner_id uuid NOT NULL,
    request_id uuid NOT NULL,
    command_name text NOT NULL,
    response jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_payload jsonb
);


--
-- Name: crops; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.crops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    common_name text NOT NULL,
    scientific_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crops_common_name_check CHECK (((char_length(TRIM(BOTH FROM common_name)) >= 1) AND (char_length(TRIM(BOTH FROM common_name)) <= 100)))
);


--
-- Name: custom_system_definitions; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.custom_system_definitions (
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    photo_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_system_definitions_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text)),
    CONSTRAINT custom_system_definitions_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 80)))
);


--
-- Name: custom_system_levels; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.custom_system_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    definition_id uuid NOT NULL,
    level_number integer NOT NULL,
    row_count integer NOT NULL,
    column_count integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    active_cells jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT custom_system_levels_column_count_check CHECK (((column_count >= 1) AND (column_count <= 8))),
    CONSTRAINT custom_system_levels_level_number_check CHECK (((level_number >= 1) AND (level_number <= 12))),
    CONSTRAINT custom_system_levels_row_count_check CHECK (((row_count >= 1) AND (row_count <= 9)))
);


--
-- Name: cycle_occupancies; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.cycle_occupancies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    position_id uuid NOT NULL,
    grow_cycle_id uuid NOT NULL,
    occupied_from date,
    occupied_until date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cycle_occupancies_check CHECK (((occupied_until IS NULL) OR (occupied_from IS NULL) OR (occupied_until >= occupied_from)))
);


--
-- Name: cycle_revisions; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.cycle_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    grow_cycle_id uuid NOT NULL,
    revision_number integer NOT NULL,
    operation text NOT NULL,
    previous_values jsonb NOT NULL,
    next_values jsonb NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cycle_revisions_operation_check CHECK ((operation = ANY (ARRAY['planting_corrected'::text, 'closed'::text, 'replaced'::text, 'moved'::text, 'reopened'::text, 'origin_corrected'::text]))),
    CONSTRAINT cycle_revisions_reason_check CHECK (((char_length(TRIM(BOTH FROM reason)) >= 1) AND (char_length(TRIM(BOTH FROM reason)) <= 500))),
    CONSTRAINT cycle_revisions_revision_number_check CHECK ((revision_number > 1))
);


--
-- Name: event_revisions; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.event_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    event_id uuid NOT NULL,
    revision_number integer NOT NULL,
    operation text NOT NULL,
    previous_values jsonb NOT NULL,
    next_values jsonb NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_revisions_operation_check CHECK ((operation = 'invalidated'::text)),
    CONSTRAINT event_revisions_reason_check CHECK (((char_length(TRIM(BOTH FROM reason)) >= 1) AND (char_length(TRIM(BOTH FROM reason)) <= 500))),
    CONSTRAINT event_revisions_revision_number_check CHECK ((revision_number > 1))
);


--
-- Name: events; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    grow_cycle_id uuid,
    event_type text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    invalidated_at timestamp with time zone,
    invalidated_by uuid,
    invalidated_reason text,
    garden_id uuid NOT NULL,
    event_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT events_event_type_check CHECK ((event_type = ANY (ARRAY['observation'::text, 'planting'::text, 'harvest'::text, 'action'::text, 'cycle_started'::text, 'cycle_ended'::text, 'cycle_moved'::text, 'seeds_added'::text, 'germination_observed'::text, 'germination_confirmed'::text, 'plant_count_observed'::text, 'visual_review'::text, 'development_review'::text, 'intervention'::text, 'incident_opened'::text, 'incident_resolved'::text, 'system_maintenance'::text, 'measurement'::text, 'readiness_review'::text]))),
    CONSTRAINT events_invalidation_fields_check CHECK ((((invalidated_at IS NULL) AND (invalidated_by IS NULL) AND (invalidated_reason IS NULL)) OR ((invalidated_at IS NOT NULL) AND (invalidated_by IS NOT NULL) AND ((char_length(TRIM(BOTH FROM invalidated_reason)) >= 1) AND (char_length(TRIM(BOTH FROM invalidated_reason)) <= 500))))),
    CONSTRAINT events_revision_check CHECK ((revision > 0)),
    CONSTRAINT events_subject_present CHECK ((garden_id IS NOT NULL))
);


--
-- Name: gardenpedia_curators; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.gardenpedia_curators (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    granted_by text DEFAULT 'initial_curator_bootstrap'::text NOT NULL
);


--
-- Name: gardenpedia_proposals; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.gardenpedia_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_id uuid NOT NULL,
    contract_name text NOT NULL,
    contract_version text NOT NULL,
    candidate_identity jsonb DEFAULT '{}'::jsonb NOT NULL,
    proposed_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    confidence_status jsonb DEFAULT '{}'::jsonb NOT NULL,
    review_status text DEFAULT 'in_review'::text NOT NULL,
    created_by uuid NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    publication_version text,
    publication_reference text,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    publication_status text DEFAULT 'not_started'::text NOT NULL,
    publication_error text,
    approved_by uuid,
    approved_at timestamp with time zone,
    CONSTRAINT gardenpedia_proposals_candidate_identity_check CHECK ((jsonb_typeof(candidate_identity) = 'object'::text)),
    CONSTRAINT gardenpedia_proposals_check CHECK (((review_status = 'published'::text) = (published_at IS NOT NULL))),
    CONSTRAINT gardenpedia_proposals_confidence_status_check CHECK ((jsonb_typeof(confidence_status) = 'object'::text)),
    CONSTRAINT gardenpedia_proposals_evidence_check CHECK ((jsonb_typeof(evidence) = 'array'::text)),
    CONSTRAINT gardenpedia_proposals_proposed_data_check CHECK ((jsonb_typeof(proposed_data) = 'object'::text)),
    CONSTRAINT gardenpedia_proposals_publication_status_check CHECK ((publication_status = ANY (ARRAY['not_started'::text, 'bundle_ready'::text, 'publishing'::text, 'publication_failed'::text, 'published'::text]))),
    CONSTRAINT gardenpedia_proposals_review_status_check CHECK ((review_status = ANY (ARRAY['draft'::text, 'in_review'::text, 'approved'::text, 'rejected'::text, 'published'::text])))
);


--
-- Name: gardenpedia_requests; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.gardenpedia_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    requested_text text NOT NULL,
    normalized_text text NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT gardenpedia_requests_normalized_text_check CHECK (((char_length(TRIM(BOTH FROM normalized_text)) >= 2) AND (char_length(TRIM(BOTH FROM normalized_text)) <= 200))),
    CONSTRAINT gardenpedia_requests_requested_text_check CHECK (((char_length(TRIM(BOTH FROM requested_text)) >= 2) AND (char_length(TRIM(BOTH FROM requested_text)) <= 200))),
    CONSTRAINT gardenpedia_requests_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'researching'::text, 'research_failed'::text, 'proposal_ready'::text, 'needs_revision'::text, 'approved'::text, 'publishing'::text, 'declined'::text, 'published'::text])))
);


--
-- Name: gardens; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.gardens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    system_model text,
    position_capacity integer NOT NULL,
    map_layout text DEFAULT 'provisional_list'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cover_photo_id uuid,
    kind text DEFAULT 'hydroponic'::text NOT NULL,
    place text DEFAULT ''::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    archived_at timestamp with time zone,
    CONSTRAINT garden_map_layout_supported CHECK ((map_layout = ANY (ARRAY['provisional_list'::text, 'uruq_8_v1'::text, 'uruq_12_v1'::text, 'custom_grid'::text]))),
    CONSTRAINT garden_position_capacity_range CHECK (((position_capacity >= 0) AND (position_capacity <= 36))),
    CONSTRAINT gardens_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 80)))
);


--
-- Name: grow_cycles; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.grow_cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    crop_id uuid NOT NULL,
    planted_on date,
    planted_on_precision text DEFAULT 'unknown'::text NOT NULL,
    state text DEFAULT 'active'::text NOT NULL,
    harvest_readiness text DEFAULT 'not_yet'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cover_photo_id uuid,
    plant_instance_id uuid,
    origin_type text DEFAULT 'unknown'::text NOT NULL,
    CONSTRAINT grow_cycles_check CHECK ((((planted_on IS NULL) AND (planted_on_precision = 'unknown'::text)) OR ((planted_on IS NOT NULL) AND (planted_on_precision = ANY (ARRAY['exact'::text, 'approximate'::text]))))),
    CONSTRAINT grow_cycles_harvest_readiness_check CHECK ((harvest_readiness = ANY (ARRAY['not_yet'::text, 'evaluate'::text, 'ready'::text, 'not_applicable'::text]))),
    CONSTRAINT grow_cycles_origin_type_check CHECK ((origin_type = ANY (ARRAY['unknown'::text, 'seed'::text, 'bare_root'::text, 'cutting'::text, 'seedling'::text, 'transplant'::text]))),
    CONSTRAINT grow_cycles_planted_on_precision_check CHECK ((planted_on_precision = ANY (ARRAY['exact'::text, 'approximate'::text, 'unknown'::text]))),
    CONSTRAINT grow_cycles_revision_check CHECK ((revision > 0)),
    CONSTRAINT grow_cycles_state_check CHECK ((state = ANY (ARRAY['active'::text, 'closed'::text])))
);


--
-- Name: COLUMN grow_cycles.origin_type; Type: COMMENT; Schema: garden; Owner: -
--

COMMENT ON COLUMN garden.grow_cycles.origin_type IS 'How this observed plant life cycle began; unknown preserves cycles created before origin capture.';


--
-- Name: guest_garden_stories; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.guest_garden_stories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    garden_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT guest_garden_stories_check CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at))),
    CONSTRAINT guest_garden_stories_token_hash_check CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: guest_plant_stories; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.guest_plant_stories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    grow_cycle_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    hero_photo_id uuid,
    caption_overrides jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT guest_plant_stories_caption_overrides_object CHECK ((jsonb_typeof(caption_overrides) = 'object'::text)),
    CONSTRAINT guest_plant_stories_check CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at))),
    CONSTRAINT guest_plant_stories_token_hash_check CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text))
);


--
-- Name: guest_plant_story_items; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.guest_plant_story_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    story_id uuid NOT NULL,
    event_id uuid,
    photo_id uuid,
    include_note boolean DEFAULT false NOT NULL,
    CONSTRAINT guest_plant_story_items_check CHECK (((event_id IS NOT NULL) <> (photo_id IS NOT NULL)))
);


--
-- Name: home_visits; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.home_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    base_cursor bigint NOT NULL,
    base_shown_at timestamp with time zone,
    snapshot_cursor bigint DEFAULT 0 NOT NULL,
    snapshot_at timestamp with time zone DEFAULT now() NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    last_gardens_access_at timestamp with time zone DEFAULT now() NOT NULL,
    visit_gap_minutes integer NOT NULL,
    config_version integer NOT NULL,
    acknowledged_at timestamp with time zone,
    CONSTRAINT home_visits_base_cursor_check CHECK ((base_cursor >= 0)),
    CONSTRAINT home_visits_config_version_check CHECK ((config_version > 0)),
    CONSTRAINT home_visits_snapshot_cursor_check CHECK ((snapshot_cursor >= 0)),
    CONSTRAINT home_visits_visit_gap_minutes_check CHECK (((visit_gap_minutes >= 1) AND (visit_gap_minutes <= 1440)))
);


--
-- Name: import_batches; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.import_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    source_label text NOT NULL,
    source_fingerprint text NOT NULL,
    status text DEFAULT 'reviewing'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT import_batches_source_fingerprint_check CHECK ((source_fingerprint ~ '^[a-f0-9]{64}$'::text)),
    CONSTRAINT import_batches_source_label_check CHECK (((char_length(TRIM(BOTH FROM source_label)) >= 1) AND (char_length(TRIM(BOTH FROM source_label)) <= 180))),
    CONSTRAINT import_batches_status_check CHECK ((status = ANY (ARRAY['reviewing'::text, 'completed'::text])))
);


--
-- Name: import_candidates; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.import_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    candidate_key text NOT NULL,
    candidate_type text NOT NULL,
    grow_cycle_id uuid,
    occurred_on date,
    occurred_on_precision text DEFAULT 'unknown'::text NOT NULL,
    note text NOT NULL,
    source_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    decision text DEFAULT 'pending'::text NOT NULL,
    decision_note text,
    confirmed_event_id uuid,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT import_candidates_candidate_key_check CHECK (((char_length(TRIM(BOTH FROM candidate_key)) >= 1) AND (char_length(TRIM(BOTH FROM candidate_key)) <= 120))),
    CONSTRAINT import_candidates_candidate_type_check CHECK ((candidate_type = ANY (ARRAY['observation'::text, 'recommendation'::text, 'conflict'::text]))),
    CONSTRAINT import_candidates_check CHECK ((((occurred_on IS NULL) AND (occurred_on_precision = 'unknown'::text)) OR ((occurred_on IS NOT NULL) AND (occurred_on_precision = 'exact'::text)))),
    CONSTRAINT import_candidates_check1 CHECK ((((decision = 'pending'::text) AND (confirmed_event_id IS NULL) AND (decided_at IS NULL)) OR ((decision = 'rejected'::text) AND (confirmed_event_id IS NULL) AND (decided_at IS NOT NULL)) OR ((decision = 'confirmed'::text) AND (confirmed_event_id IS NOT NULL) AND (decided_at IS NOT NULL)))),
    CONSTRAINT import_candidates_decision_check CHECK ((decision = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text]))),
    CONSTRAINT import_candidates_note_check CHECK (((char_length(TRIM(BOTH FROM note)) >= 1) AND (char_length(TRIM(BOTH FROM note)) <= 1000))),
    CONSTRAINT import_candidates_occurred_on_precision_check CHECK ((occurred_on_precision = ANY (ARRAY['exact'::text, 'unknown'::text])))
);


--
-- Name: layout_events; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.layout_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    garden_id uuid NOT NULL,
    layout_site_id uuid,
    operation text NOT NULL,
    event_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT layout_events_operation_check CHECK ((operation = ANY (ARRAY['site_added'::text, 'site_updated'::text])))
);


--
-- Name: layout_sites; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.layout_sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    garden_id uuid NOT NULL,
    position_id uuid,
    site_kind text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    grid_x integer NOT NULL,
    grid_y integer NOT NULL,
    label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    system_instance_id uuid,
    level_number integer,
    row_number integer,
    column_number integer,
    CONSTRAINT layout_sites_column_number_check CHECK (((column_number >= 1) AND (column_number <= 8))),
    CONSTRAINT layout_sites_grid_x_check CHECK (((grid_x >= 1) AND (grid_x <= 8))),
    CONSTRAINT layout_sites_grid_y_check CHECK (((grid_y >= 1) AND (grid_y <= 9))),
    CONSTRAINT layout_sites_label_check CHECK (((label IS NULL) OR ((char_length(TRIM(BOTH FROM label)) >= 1) AND (char_length(TRIM(BOTH FROM label)) <= 80)))),
    CONSTRAINT layout_sites_level_number_check CHECK (((level_number >= 1) AND (level_number <= 12))),
    CONSTRAINT layout_sites_row_number_check CHECK (((row_number >= 1) AND (row_number <= 9))),
    CONSTRAINT layout_sites_site_kind_check CHECK ((site_kind = ANY (ARRAY['grow'::text, 'utility'::text])))
);


--
-- Name: library_catalog_items; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.library_catalog_items (
    library_plant_id text NOT NULL,
    catalog_version text NOT NULL,
    common_name text NOT NULL,
    scientific_name text,
    cultivar text,
    aliases jsonb DEFAULT '[]'::jsonb NOT NULL,
    category text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    provenance jsonb DEFAULT '[]'::jsonb NOT NULL,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT library_catalog_items_aliases_check CHECK ((jsonb_typeof(aliases) = 'array'::text)),
    CONSTRAINT library_catalog_items_catalog_version_check CHECK (((char_length(catalog_version) >= 1) AND (char_length(catalog_version) <= 120))),
    CONSTRAINT library_catalog_items_category_check CHECK (((char_length(TRIM(BOTH FROM category)) >= 1) AND (char_length(TRIM(BOTH FROM category)) <= 80))),
    CONSTRAINT library_catalog_items_common_name_check CHECK (((char_length(TRIM(BOTH FROM common_name)) >= 1) AND (char_length(TRIM(BOTH FROM common_name)) <= 100))),
    CONSTRAINT library_catalog_items_library_plant_id_check CHECK ((library_plant_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text)),
    CONSTRAINT library_catalog_items_provenance_check CHECK ((jsonb_typeof(provenance) = 'array'::text)),
    CONSTRAINT library_catalog_items_status_check CHECK ((status = ANY (ARRAY['active'::text, 'retired'::text])))
);


--
-- Name: maintenance_session_positions; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.maintenance_session_positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    garden_id uuid NOT NULL,
    position_id uuid NOT NULL,
    captured_grow_cycle_id uuid,
    position_number integer NOT NULL,
    ordinal integer NOT NULL,
    progress text DEFAULT 'not_reviewed'::text NOT NULL,
    visual_review_event_id uuid,
    progressed_at timestamp with time zone,
    inspected_at timestamp with time zone,
    inspection_source text,
    CONSTRAINT maintenance_session_positions_ordinal_check CHECK ((ordinal > 0)),
    CONSTRAINT maintenance_session_positions_position_number_check CHECK ((position_number > 0)),
    CONSTRAINT maintenance_session_positions_progress_check CHECK ((((progress = 'reviewed'::text) AND (inspected_at IS NOT NULL)) OR ((progress = ANY (ARRAY['not_reviewed'::text, 'skipped'::text])) AND (inspected_at IS NULL) AND (visual_review_event_id IS NULL)))),
    CONSTRAINT maintenance_session_positions_source_check CHECK (((inspection_source IS NULL) OR (inspection_source = ANY (ARRAY['healthy_review'::text, 'observation'::text, 'fact'::text, 'manual'::text]))))
);


--
-- Name: maintenance_sessions; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.maintenance_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    state text DEFAULT 'in_progress'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    cursor_position integer DEFAULT 0 NOT NULL,
    CONSTRAINT maintenance_sessions_check CHECK ((((state = ANY (ARRAY['in_progress'::text, 'paused'::text])) AND (completed_at IS NULL)) OR ((state = ANY (ARRAY['completed'::text, 'abandoned'::text])) AND (completed_at IS NOT NULL)))),
    CONSTRAINT maintenance_sessions_cursor_position_check CHECK ((cursor_position >= 0)),
    CONSTRAINT maintenance_sessions_state_check CHECK ((state = ANY (ARRAY['in_progress'::text, 'paused'::text, 'completed'::text, 'abandoned'::text])))
);


--
-- Name: owner_change_log; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.owner_change_log (
    cursor bigint NOT NULL,
    owner_id uuid NOT NULL,
    change_kind text NOT NULL,
    garden_id uuid,
    grow_cycle_id uuid,
    source_id uuid NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    committed_at timestamp with time zone DEFAULT now() NOT NULL,
    summary text NOT NULL,
    CONSTRAINT owner_change_log_change_kind_check CHECK ((change_kind = ANY (ARRAY['event'::text, 'correction'::text, 'attention'::text]))),
    CONSTRAINT owner_change_log_summary_check CHECK (((char_length(TRIM(BOTH FROM summary)) >= 1) AND (char_length(TRIM(BOTH FROM summary)) <= 240)))
);


--
-- Name: owner_change_log_cursor_seq; Type: SEQUENCE; Schema: garden; Owner: -
--

ALTER TABLE garden.owner_change_log ALTER COLUMN cursor ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME garden.owner_change_log_cursor_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: owner_home_state; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.owner_home_state (
    owner_id uuid NOT NULL,
    last_shown_cursor bigint DEFAULT 0 NOT NULL,
    last_shown_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT owner_home_state_last_shown_cursor_check CHECK ((last_shown_cursor >= 0))
);


--
-- Name: owner_settings; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.owner_settings (
    owner_id uuid NOT NULL,
    since_last_time_visit_gap_minutes integer DEFAULT 30 NOT NULL,
    config_version integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    home_hero_photo_id uuid,
    home_headline text,
    CONSTRAINT owner_settings_config_version_check CHECK ((config_version > 0)),
    CONSTRAINT owner_settings_home_headline_check CHECK (((home_headline IS NULL) OR ((char_length(TRIM(BOTH FROM home_headline)) >= 1) AND (char_length(TRIM(BOTH FROM home_headline)) <= 120)))),
    CONSTRAINT owner_settings_since_last_time_visit_gap_minutes_check CHECK (((since_last_time_visit_gap_minutes >= 1) AND (since_last_time_visit_gap_minutes <= 1440)))
);


--
-- Name: photos; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    event_id uuid,
    storage_path text NOT NULL,
    original_filename text NOT NULL,
    content_type text NOT NULL,
    byte_size bigint NOT NULL,
    captured_at timestamp with time zone,
    captured_at_precision text DEFAULT 'unknown'::text NOT NULL,
    upload_status text DEFAULT 'pending'::text NOT NULL,
    width integer,
    height integer,
    checksum_sha256 text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    garden_id uuid,
    media_scope text DEFAULT 'cycle_evidence'::text NOT NULL,
    import_version text,
    import_key text,
    import_provenance jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT photos_captured_at_precision_check CHECK ((captured_at_precision = ANY (ARRAY['exact'::text, 'approximate'::text, 'unknown'::text]))),
    CONSTRAINT photos_check CHECK ((((captured_at IS NULL) AND (captured_at_precision = 'unknown'::text)) OR ((captured_at IS NOT NULL) AND (captured_at_precision = ANY (ARRAY['exact'::text, 'approximate'::text]))))),
    CONSTRAINT photos_checksum_sha256_check CHECK (((checksum_sha256 IS NULL) OR (checksum_sha256 ~ '^[0-9a-f]{64}$'::text))),
    CONSTRAINT photos_content_type_check CHECK ((content_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/heic'::text, 'image/heif'::text, 'image/webp'::text]))),
    CONSTRAINT photos_height_check CHECK ((height > 0)),
    CONSTRAINT photos_import_identity_check CHECK ((((import_version IS NULL) AND (import_key IS NULL)) OR ((import_version IS NOT NULL) AND ((char_length(TRIM(BOTH FROM import_version)) >= 1) AND (char_length(TRIM(BOTH FROM import_version)) <= 80)) AND (import_key IS NOT NULL) AND ((char_length(TRIM(BOTH FROM import_key)) >= 1) AND (char_length(TRIM(BOTH FROM import_key)) <= 240))))),
    CONSTRAINT photos_import_provenance_object_check CHECK ((jsonb_typeof(import_provenance) = 'object'::text)),
    CONSTRAINT photos_media_scope_check CHECK ((media_scope = ANY (ARRAY['cycle_evidence'::text, 'garden_cover'::text, 'garden_general'::text, 'home_hero'::text]))),
    CONSTRAINT photos_upload_status_check CHECK ((upload_status = ANY (ARRAY['pending'::text, 'uploaded'::text, 'failed'::text]))),
    CONSTRAINT photos_width_check CHECK ((width > 0))
);


--
-- Name: plant_instances; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.plant_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    nickname text,
    reference_key text,
    common_name text NOT NULL,
    scientific_name text,
    cultivar text,
    status text DEFAULT 'active'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    library_plant_id text,
    library_catalog_version text,
    library_common_name_snapshot text,
    library_scientific_name_snapshot text,
    library_cultivar_snapshot text,
    CONSTRAINT plant_instances_common_name_check CHECK (((char_length(TRIM(BOTH FROM common_name)) >= 1) AND (char_length(TRIM(BOTH FROM common_name)) <= 100))),
    CONSTRAINT plant_instances_library_identity_check CHECK ((((library_plant_id IS NULL) AND (library_catalog_version IS NULL)) OR ((library_plant_id IS NOT NULL) AND (library_catalog_version IS NOT NULL)))),
    CONSTRAINT plant_instances_nickname_check CHECK (((nickname IS NULL) OR ((char_length(TRIM(BOTH FROM nickname)) >= 1) AND (char_length(TRIM(BOTH FROM nickname)) <= 100)))),
    CONSTRAINT plant_instances_status_check CHECK ((status = ANY (ARRAY['active'::text, 'dormant'::text, 'ended'::text, 'archived'::text])))
);


--
-- Name: positions; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    garden_id uuid NOT NULL,
    position_number integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    system_instance_id uuid,
    CONSTRAINT positions_position_number_check CHECK ((position_number > 0))
);


--
-- Name: recurrence_rules; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.recurrence_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    garden_id uuid NOT NULL,
    grow_cycle_id uuid,
    purpose text NOT NULL,
    schedule_type text NOT NULL,
    interval_days integer,
    anchor_on date,
    active boolean DEFAULT false NOT NULL,
    paused_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recurrence_rules_check CHECK ((((schedule_type = 'interval_from_action'::text) AND (interval_days IS NOT NULL) AND (anchor_on IS NULL)) OR ((schedule_type = 'alternate_tuesday'::text) AND (interval_days IS NULL) AND (anchor_on IS NOT NULL) AND (EXTRACT(isodow FROM anchor_on) = (2)::numeric)))),
    CONSTRAINT recurrence_rules_interval_days_check CHECK ((interval_days > 0)),
    CONSTRAINT recurrence_rules_purpose_check CHECK ((purpose = ANY (ARRAY['evaluate_visual_review'::text, 'evaluate_thinning'::text, 'evaluate_pruning'::text, 'evaluate_support'::text, 'perform_thinning'::text, 'perform_pruning'::text, 'perform_support'::text, 'perform_harvest'::text, 'perform_water_change'::text, 'perform_refill'::text, 'perform_nutrients'::text, 'perform_cleaning'::text]))),
    CONSTRAINT recurrence_rules_schedule_type_check CHECK ((schedule_type = ANY (ARRAY['interval_from_action'::text, 'alternate_tuesday'::text])))
);


--
-- Name: saved_films; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.saved_films (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    plant_instance_id uuid NOT NULL,
    title text NOT NULL,
    photo_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    music text DEFAULT 'none'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT saved_films_title_check CHECK (((char_length(TRIM(BOTH FROM title)) >= 1) AND (char_length(TRIM(BOTH FROM title)) <= 120)))
);


--
-- Name: seed_packages; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.seed_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    library_plant_id text,
    seed_name text NOT NULL,
    brand text,
    package_status text DEFAULT 'unknown'::text NOT NULL,
    quantity_level text DEFAULT 'unknown'::text NOT NULL,
    storage_location text,
    purchase_date date,
    legacy_purchase_year text,
    germination_test_date date,
    germination_result_pct integer,
    notes text,
    archived boolean DEFAULT false NOT NULL,
    legacy_source text,
    legacy_source_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT seed_packages_brand_check CHECK (((brand IS NULL) OR (char_length(TRIM(BOTH FROM brand)) <= 160))),
    CONSTRAINT seed_packages_check CHECK (((legacy_source IS NULL) = (legacy_source_key IS NULL))),
    CONSTRAINT seed_packages_germination_result_pct_check CHECK (((germination_result_pct >= 0) AND (germination_result_pct <= 100))),
    CONSTRAINT seed_packages_legacy_purchase_year_check CHECK (((legacy_purchase_year IS NULL) OR (char_length(legacy_purchase_year) <= 12))),
    CONSTRAINT seed_packages_notes_check CHECK (((notes IS NULL) OR (char_length(notes) <= 5000))),
    CONSTRAINT seed_packages_package_status_check CHECK ((package_status = ANY (ARRAY['opened'::text, 'unopened'::text, 'unknown'::text]))),
    CONSTRAINT seed_packages_quantity_level_check CHECK ((quantity_level = ANY (ARRAY['full'::text, 'high'::text, 'medium'::text, 'low'::text, 'almost_empty'::text, 'unknown'::text]))),
    CONSTRAINT seed_packages_seed_name_check CHECK (((char_length(TRIM(BOTH FROM seed_name)) >= 1) AND (char_length(TRIM(BOTH FROM seed_name)) <= 160))),
    CONSTRAINT seed_packages_storage_location_check CHECK (((storage_location IS NULL) OR (char_length(storage_location) <= 300)))
);


--
-- Name: storage_cleanup_queue; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.storage_cleanup_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    garden_id uuid NOT NULL,
    bucket text NOT NULL,
    storage_path text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cleaned_at timestamp with time zone,
    CONSTRAINT storage_cleanup_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'cleaned'::text, 'failed'::text])))
);


--
-- Name: system_instances; Type: TABLE; Schema: garden; Owner: -
--

CREATE TABLE garden.system_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    garden_id uuid NOT NULL,
    name text NOT NULL,
    system_definition_key text,
    legacy_system_model text,
    status text DEFAULT 'active'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    gardenpedia_model_id text,
    CONSTRAINT system_instances_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(TRIM(BOTH FROM name)) <= 80))),
    CONSTRAINT system_instances_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'archived'::text])))
);


--
-- Name: COLUMN system_instances.gardenpedia_model_id; Type: COMMENT; Schema: garden; Owner: -
--

COMMENT ON COLUMN garden.system_instances.gardenpedia_model_id IS 'Optional link to a public Gardenpedia machine model. Set only from an explicit system-definition mapping; never inferred from editable labels.';


--
-- Name: custom_seeds; Type: TABLE; Schema: garden_lab; Owner: -
--

CREATE TABLE garden_lab.custom_seeds (
    owner_id uuid NOT NULL,
    seed_key text NOT NULL,
    packet_name text NOT NULL,
    brand text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_seeds_packet_name_check CHECK (((char_length(TRIM(BOTH FROM packet_name)) >= 1) AND (char_length(TRIM(BOTH FROM packet_name)) <= 160)))
);


--
-- Name: machine_state; Type: TABLE; Schema: garden_lab; Owner: -
--

CREATE TABLE garden_lab.machine_state (
    owner_id uuid NOT NULL,
    machine_key text NOT NULL,
    state jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT machine_state_state_check CHECK ((jsonb_typeof(state) = 'object'::text))
);


--
-- Name: seed_personal_state; Type: TABLE; Schema: garden_lab; Owner: -
--

CREATE TABLE garden_lab.seed_personal_state (
    owner_id uuid NOT NULL,
    seed_key text NOT NULL,
    package_status text DEFAULT 'unknown'::text NOT NULL,
    quantity_level text DEFAULT 'unknown'::text NOT NULL,
    storage_location text,
    purchase_date date,
    legacy_purchase_year text,
    germination_test_date date,
    germination_result_pct integer,
    notes text,
    archived boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT seed_personal_state_germination_result_pct_check CHECK (((germination_result_pct >= 0) AND (germination_result_pct <= 100))),
    CONSTRAINT seed_personal_state_package_status_check CHECK ((package_status = ANY (ARRAY['opened'::text, 'unopened'::text, 'unknown'::text]))),
    CONSTRAINT seed_personal_state_quantity_level_check CHECK ((quantity_level = ANY (ARRAY['full'::text, 'high'::text, 'medium'::text, 'low'::text, 'almost_empty'::text, 'unknown'::text])))
);


--
-- Name: ai_requests ai_requests_owner_id_request_key_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.ai_requests
    ADD CONSTRAINT ai_requests_owner_id_request_key_key UNIQUE (owner_id, request_key);


--
-- Name: ai_requests ai_requests_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.ai_requests
    ADD CONSTRAINT ai_requests_pkey PRIMARY KEY (id);


--
-- Name: attention_history attention_history_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.attention_history
    ADD CONSTRAINT attention_history_pkey PRIMARY KEY (id);


--
-- Name: attention_items attention_items_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.attention_items
    ADD CONSTRAINT attention_items_pkey PRIMARY KEY (id);


--
-- Name: command_receipts command_receipts_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.command_receipts
    ADD CONSTRAINT command_receipts_pkey PRIMARY KEY (owner_id, request_id, command_name);


--
-- Name: crops crops_owner_id_common_name_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.crops
    ADD CONSTRAINT crops_owner_id_common_name_key UNIQUE (owner_id, common_name);


--
-- Name: crops crops_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.crops
    ADD CONSTRAINT crops_pkey PRIMARY KEY (id);


--
-- Name: custom_system_definitions custom_system_definitions_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.custom_system_definitions
    ADD CONSTRAINT custom_system_definitions_pkey PRIMARY KEY (id);


--
-- Name: custom_system_levels custom_system_levels_definition_id_level_number_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.custom_system_levels
    ADD CONSTRAINT custom_system_levels_definition_id_level_number_key UNIQUE (definition_id, level_number);


--
-- Name: custom_system_levels custom_system_levels_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.custom_system_levels
    ADD CONSTRAINT custom_system_levels_pkey PRIMARY KEY (id);


--
-- Name: cycle_occupancies cycle_occupancies_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.cycle_occupancies
    ADD CONSTRAINT cycle_occupancies_pkey PRIMARY KEY (id);


--
-- Name: cycle_revisions cycle_revisions_grow_cycle_id_revision_number_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.cycle_revisions
    ADD CONSTRAINT cycle_revisions_grow_cycle_id_revision_number_key UNIQUE (grow_cycle_id, revision_number);


--
-- Name: cycle_revisions cycle_revisions_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.cycle_revisions
    ADD CONSTRAINT cycle_revisions_pkey PRIMARY KEY (id);


--
-- Name: event_revisions event_revisions_event_id_revision_number_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.event_revisions
    ADD CONSTRAINT event_revisions_event_id_revision_number_key UNIQUE (event_id, revision_number);


--
-- Name: event_revisions event_revisions_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.event_revisions
    ADD CONSTRAINT event_revisions_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: gardenpedia_curators gardenpedia_curators_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.gardenpedia_curators
    ADD CONSTRAINT gardenpedia_curators_pkey PRIMARY KEY (user_id);


--
-- Name: gardenpedia_proposals gardenpedia_proposals_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.gardenpedia_proposals
    ADD CONSTRAINT gardenpedia_proposals_pkey PRIMARY KEY (id);


--
-- Name: gardenpedia_requests gardenpedia_requests_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.gardenpedia_requests
    ADD CONSTRAINT gardenpedia_requests_pkey PRIMARY KEY (id);


--
-- Name: gardens gardens_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.gardens
    ADD CONSTRAINT gardens_pkey PRIMARY KEY (id);


--
-- Name: grow_cycles grow_cycles_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.grow_cycles
    ADD CONSTRAINT grow_cycles_pkey PRIMARY KEY (id);


--
-- Name: guest_garden_stories guest_garden_stories_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.guest_garden_stories
    ADD CONSTRAINT guest_garden_stories_pkey PRIMARY KEY (id);


--
-- Name: guest_garden_stories guest_garden_stories_token_hash_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.guest_garden_stories
    ADD CONSTRAINT guest_garden_stories_token_hash_key UNIQUE (token_hash);


--
-- Name: guest_plant_stories guest_plant_stories_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.guest_plant_stories
    ADD CONSTRAINT guest_plant_stories_pkey PRIMARY KEY (id);


--
-- Name: guest_plant_stories guest_plant_stories_token_hash_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.guest_plant_stories
    ADD CONSTRAINT guest_plant_stories_token_hash_key UNIQUE (token_hash);


--
-- Name: guest_plant_story_items guest_plant_story_items_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.guest_plant_story_items
    ADD CONSTRAINT guest_plant_story_items_pkey PRIMARY KEY (id);


--
-- Name: home_visits home_visits_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.home_visits
    ADD CONSTRAINT home_visits_pkey PRIMARY KEY (id);


--
-- Name: import_batches import_batches_owner_id_source_fingerprint_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.import_batches
    ADD CONSTRAINT import_batches_owner_id_source_fingerprint_key UNIQUE (owner_id, source_fingerprint);


--
-- Name: import_batches import_batches_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.import_batches
    ADD CONSTRAINT import_batches_pkey PRIMARY KEY (id);


--
-- Name: import_candidates import_candidates_batch_id_candidate_key_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.import_candidates
    ADD CONSTRAINT import_candidates_batch_id_candidate_key_key UNIQUE (batch_id, candidate_key);


--
-- Name: import_candidates import_candidates_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.import_candidates
    ADD CONSTRAINT import_candidates_pkey PRIMARY KEY (id);


--
-- Name: layout_events layout_events_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.layout_events
    ADD CONSTRAINT layout_events_pkey PRIMARY KEY (id);


--
-- Name: layout_sites layout_sites_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.layout_sites
    ADD CONSTRAINT layout_sites_pkey PRIMARY KEY (id);


--
-- Name: layout_sites layout_sites_position_id_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.layout_sites
    ADD CONSTRAINT layout_sites_position_id_key UNIQUE (position_id);


--
-- Name: library_catalog_items library_catalog_items_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.library_catalog_items
    ADD CONSTRAINT library_catalog_items_pkey PRIMARY KEY (library_plant_id);


--
-- Name: maintenance_session_positions maintenance_session_positions_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.maintenance_session_positions
    ADD CONSTRAINT maintenance_session_positions_pkey PRIMARY KEY (id);


--
-- Name: maintenance_session_positions maintenance_session_positions_session_id_ordinal_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.maintenance_session_positions
    ADD CONSTRAINT maintenance_session_positions_session_id_ordinal_key UNIQUE (session_id, ordinal);


--
-- Name: maintenance_session_positions maintenance_session_positions_session_id_position_id_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.maintenance_session_positions
    ADD CONSTRAINT maintenance_session_positions_session_id_position_id_key UNIQUE (session_id, position_id);


--
-- Name: maintenance_sessions maintenance_sessions_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.maintenance_sessions
    ADD CONSTRAINT maintenance_sessions_pkey PRIMARY KEY (id);


--
-- Name: owner_change_log owner_change_log_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.owner_change_log
    ADD CONSTRAINT owner_change_log_pkey PRIMARY KEY (cursor);


--
-- Name: owner_home_state owner_home_state_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.owner_home_state
    ADD CONSTRAINT owner_home_state_pkey PRIMARY KEY (owner_id);


--
-- Name: owner_settings owner_settings_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.owner_settings
    ADD CONSTRAINT owner_settings_pkey PRIMARY KEY (owner_id);


--
-- Name: photos photos_byte_size_check; Type: CHECK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE garden.photos
    ADD CONSTRAINT photos_byte_size_check CHECK (((byte_size > 0) AND (byte_size <= 31457280))) NOT VALID;


--
-- Name: photos photos_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.photos
    ADD CONSTRAINT photos_pkey PRIMARY KEY (id);


--
-- Name: photos photos_storage_path_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.photos
    ADD CONSTRAINT photos_storage_path_key UNIQUE (storage_path);


--
-- Name: plant_instances plant_instances_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.plant_instances
    ADD CONSTRAINT plant_instances_pkey PRIMARY KEY (id);


--
-- Name: positions positions_garden_id_position_number_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.positions
    ADD CONSTRAINT positions_garden_id_position_number_key UNIQUE (garden_id, position_number);


--
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


--
-- Name: recurrence_rules recurrence_rules_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.recurrence_rules
    ADD CONSTRAINT recurrence_rules_pkey PRIMARY KEY (id);


--
-- Name: saved_films saved_films_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.saved_films
    ADD CONSTRAINT saved_films_pkey PRIMARY KEY (id);


--
-- Name: seed_packages seed_packages_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.seed_packages
    ADD CONSTRAINT seed_packages_pkey PRIMARY KEY (id);


--
-- Name: storage_cleanup_queue storage_cleanup_queue_bucket_storage_path_key; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.storage_cleanup_queue
    ADD CONSTRAINT storage_cleanup_queue_bucket_storage_path_key UNIQUE (bucket, storage_path);


--
-- Name: storage_cleanup_queue storage_cleanup_queue_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.storage_cleanup_queue
    ADD CONSTRAINT storage_cleanup_queue_pkey PRIMARY KEY (id);


--
-- Name: system_instances system_instances_pkey; Type: CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.system_instances
    ADD CONSTRAINT system_instances_pkey PRIMARY KEY (id);


--
-- Name: custom_seeds custom_seeds_pkey; Type: CONSTRAINT; Schema: garden_lab; Owner: -
--

ALTER TABLE ONLY garden_lab.custom_seeds
    ADD CONSTRAINT custom_seeds_pkey PRIMARY KEY (owner_id, seed_key);


--
-- Name: machine_state machine_state_pkey; Type: CONSTRAINT; Schema: garden_lab; Owner: -
--

ALTER TABLE ONLY garden_lab.machine_state
    ADD CONSTRAINT machine_state_pkey PRIMARY KEY (owner_id, machine_key);


--
-- Name: seed_personal_state seed_personal_state_pkey; Type: CONSTRAINT; Schema: garden_lab; Owner: -
--

ALTER TABLE ONLY garden_lab.seed_personal_state
    ADD CONSTRAINT seed_personal_state_pkey PRIMARY KEY (owner_id, seed_key);


--
-- Name: ai_requests_expiry; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX ai_requests_expiry ON garden.ai_requests USING btree (proposal_expires_at, audit_expires_at);


--
-- Name: ai_requests_owner_created_at; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX ai_requests_owner_created_at ON garden.ai_requests USING btree (owner_id, created_at DESC);


--
-- Name: attention_history_item_created_at; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX attention_history_item_created_at ON garden.attention_history USING btree (attention_item_id, created_at DESC);


--
-- Name: attention_items_one_open_identity; Type: INDEX; Schema: garden; Owner: -
--

CREATE UNIQUE INDEX attention_items_one_open_identity ON garden.attention_items USING btree (owner_id, COALESCE(garden_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(grow_cycle_id, '00000000-0000-0000-0000-000000000000'::uuid), purpose, subject_key) WHERE (status = 'open'::text);


--
-- Name: attention_items_open_cycle; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX attention_items_open_cycle ON garden.attention_items USING btree (owner_id, grow_cycle_id, due_on, next_review_on, created_at) WHERE ((status = 'open'::text) AND (grow_cycle_id IS NOT NULL));


--
-- Name: attention_items_open_garden; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX attention_items_open_garden ON garden.attention_items USING btree (owner_id, garden_id, due_on, next_review_on, created_at) WHERE ((status = 'open'::text) AND (grow_cycle_id IS NULL));


--
-- Name: attention_items_owner_open; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX attention_items_owner_open ON garden.attention_items USING btree (owner_id, status, due_on, created_at) WHERE (status = 'open'::text);


--
-- Name: custom_system_definitions_owner_created; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX custom_system_definitions_owner_created ON garden.custom_system_definitions USING btree (owner_id, created_at DESC);


--
-- Name: cycle_occupancies_one_current_cycle; Type: INDEX; Schema: garden; Owner: -
--

CREATE UNIQUE INDEX cycle_occupancies_one_current_cycle ON garden.cycle_occupancies USING btree (grow_cycle_id) WHERE (occupied_until IS NULL);


--
-- Name: cycle_revisions_cycle_created_at; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX cycle_revisions_cycle_created_at ON garden.cycle_revisions USING btree (grow_cycle_id, created_at DESC);


--
-- Name: event_revisions_event_created_at; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX event_revisions_event_created_at ON garden.event_revisions USING btree (event_id, created_at DESC);


--
-- Name: events_current_cycle_occurred_at; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX events_current_cycle_occurred_at ON garden.events USING btree (grow_cycle_id, occurred_at DESC) WHERE (invalidated_at IS NULL);


--
-- Name: events_cycle_fact_projection; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX events_cycle_fact_projection ON garden.events USING btree (grow_cycle_id, occurred_at DESC, id DESC) WHERE ((invalidated_at IS NULL) AND (grow_cycle_id IS NOT NULL));


--
-- Name: events_cycle_occurred_at; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX events_cycle_occurred_at ON garden.events USING btree (grow_cycle_id, occurred_at DESC);


--
-- Name: events_garden_occurred_at; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX events_garden_occurred_at ON garden.events USING btree (garden_id, occurred_at DESC);


--
-- Name: gardenpedia_proposals_request_created_idx; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX gardenpedia_proposals_request_created_idx ON garden.gardenpedia_proposals USING btree (request_id, created_at DESC);


--
-- Name: gardenpedia_requests_owner_created_idx; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX gardenpedia_requests_owner_created_idx ON garden.gardenpedia_requests USING btree (owner_id, created_at DESC);


--
-- Name: gardens_cover_photo_id; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX gardens_cover_photo_id ON garden.gardens USING btree (cover_photo_id) WHERE (cover_photo_id IS NOT NULL);


--
-- Name: grow_cycles_cover_photo_id; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX grow_cycles_cover_photo_id ON garden.grow_cycles USING btree (cover_photo_id) WHERE (cover_photo_id IS NOT NULL);


--
-- Name: grow_cycles_plant_instance; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX grow_cycles_plant_instance ON garden.grow_cycles USING btree (plant_instance_id, created_at);


--
-- Name: guest_garden_stories_owner_garden; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX guest_garden_stories_owner_garden ON garden.guest_garden_stories USING btree (owner_id, garden_id, created_at DESC);


--
-- Name: guest_plant_stories_owner_cycle; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX guest_plant_stories_owner_cycle ON garden.guest_plant_stories USING btree (owner_id, grow_cycle_id, created_at DESC);


--
-- Name: guest_story_items_event; Type: INDEX; Schema: garden; Owner: -
--

CREATE UNIQUE INDEX guest_story_items_event ON garden.guest_plant_story_items USING btree (story_id, event_id) WHERE (event_id IS NOT NULL);


--
-- Name: guest_story_items_photo; Type: INDEX; Schema: garden; Owner: -
--

CREATE UNIQUE INDEX guest_story_items_photo ON garden.guest_plant_story_items USING btree (story_id, photo_id) WHERE (photo_id IS NOT NULL);


--
-- Name: home_visits_owner_access; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX home_visits_owner_access ON garden.home_visits USING btree (owner_id, last_gardens_access_at DESC);


--
-- Name: import_candidates_owner_pending; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX import_candidates_owner_pending ON garden.import_candidates USING btree (owner_id, decision, created_at);


--
-- Name: layout_events_garden_created_at; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX layout_events_garden_created_at ON garden.layout_events USING btree (garden_id, created_at DESC);


--
-- Name: layout_sites_garden; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX layout_sites_garden ON garden.layout_sites USING btree (garden_id, grid_y, grid_x);


--
-- Name: layout_sites_one_active_point; Type: INDEX; Schema: garden; Owner: -
--

CREATE UNIQUE INDEX layout_sites_one_active_point ON garden.layout_sites USING btree (garden_id, level_number, grid_x, grid_y) WHERE is_active;


--
-- Name: layout_sites_system_instance; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX layout_sites_system_instance ON garden.layout_sites USING btree (system_instance_id, grid_y, grid_x);


--
-- Name: layout_sites_system_level_row_column; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX layout_sites_system_level_row_column ON garden.layout_sites USING btree (system_instance_id, level_number, row_number, column_number);


--
-- Name: maintenance_session_positions_session; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX maintenance_session_positions_session ON garden.maintenance_session_positions USING btree (session_id, ordinal);


--
-- Name: maintenance_sessions_owner_open; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX maintenance_sessions_owner_open ON garden.maintenance_sessions USING btree (owner_id, started_at DESC) WHERE (state = ANY (ARRAY['in_progress'::text, 'paused'::text]));


--
-- Name: owner_change_log_owner_cursor; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX owner_change_log_owner_cursor ON garden.owner_change_log USING btree (owner_id, cursor);


--
-- Name: photos_garden_general; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX photos_garden_general ON garden.photos USING btree (owner_id, garden_id, created_at DESC) WHERE (media_scope = 'garden_general'::text);


--
-- Name: photos_garden_scope_created; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX photos_garden_scope_created ON garden.photos USING btree (garden_id, media_scope, created_at DESC) WHERE (garden_id IS NOT NULL);


--
-- Name: photos_owner_import_identity; Type: INDEX; Schema: garden; Owner: -
--

CREATE UNIQUE INDEX photos_owner_import_identity ON garden.photos USING btree (owner_id, import_version, import_key) WHERE ((import_version IS NOT NULL) AND (import_key IS NOT NULL));


--
-- Name: photos_owner_import_version; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX photos_owner_import_version ON garden.photos USING btree (owner_id, import_version) WHERE (import_version IS NOT NULL);


--
-- Name: photos_owner_scope_created; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX photos_owner_scope_created ON garden.photos USING btree (owner_id, media_scope, created_at DESC);


--
-- Name: plant_instances_owner_library_plant_idx; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX plant_instances_owner_library_plant_idx ON garden.plant_instances USING btree (owner_id, library_plant_id) WHERE (library_plant_id IS NOT NULL);


--
-- Name: plant_instances_owner_status; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX plant_instances_owner_status ON garden.plant_instances USING btree (owner_id, status);


--
-- Name: positions_system_instance; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX positions_system_instance ON garden.positions USING btree (system_instance_id, position_number);


--
-- Name: recurrence_rules_one_active_identity; Type: INDEX; Schema: garden; Owner: -
--

CREATE UNIQUE INDEX recurrence_rules_one_active_identity ON garden.recurrence_rules USING btree (owner_id, garden_id, COALESCE(grow_cycle_id, '00000000-0000-0000-0000-000000000000'::uuid), purpose) WHERE active;


--
-- Name: saved_films_owner_plant; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX saved_films_owner_plant ON garden.saved_films USING btree (owner_id, plant_instance_id, created_at DESC);


--
-- Name: seed_packages_legacy_reconciliation_idx; Type: INDEX; Schema: garden; Owner: -
--

CREATE UNIQUE INDEX seed_packages_legacy_reconciliation_idx ON garden.seed_packages USING btree (owner_id, legacy_source, legacy_source_key) WHERE (legacy_source IS NOT NULL);


--
-- Name: seed_packages_owner_updated_idx; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX seed_packages_owner_updated_idx ON garden.seed_packages USING btree (owner_id, archived, updated_at DESC);


--
-- Name: system_instances_owner_garden; Type: INDEX; Schema: garden; Owner: -
--

CREATE INDEX system_instances_owner_garden ON garden.system_instances USING btree (owner_id, garden_id);


--
-- Name: attention_items attention_items_log_change; Type: TRIGGER; Schema: garden; Owner: -
--

CREATE TRIGGER attention_items_log_change AFTER INSERT OR UPDATE ON garden.attention_items FOR EACH ROW EXECUTE FUNCTION garden.log_attention_change();


--
-- Name: cycle_occupancies cycle_occupancies_assert_integrity; Type: TRIGGER; Schema: garden; Owner: -
--

CREATE TRIGGER cycle_occupancies_assert_integrity BEFORE INSERT OR UPDATE ON garden.cycle_occupancies FOR EACH ROW EXECUTE FUNCTION garden.assert_occupancy_integrity();


--
-- Name: cycle_revisions cycle_revisions_log_change; Type: TRIGGER; Schema: garden; Owner: -
--

CREATE TRIGGER cycle_revisions_log_change AFTER INSERT ON garden.cycle_revisions FOR EACH ROW EXECUTE FUNCTION garden.log_cycle_correction_change();


--
-- Name: event_revisions event_revisions_log_change; Type: TRIGGER; Schema: garden; Owner: -
--

CREATE TRIGGER event_revisions_log_change AFTER INSERT ON garden.event_revisions FOR EACH ROW EXECUTE FUNCTION garden.log_event_correction_change();


--
-- Name: events events_assert_subject_integrity; Type: TRIGGER; Schema: garden; Owner: -
--

CREATE TRIGGER events_assert_subject_integrity BEFORE INSERT OR UPDATE ON garden.events FOR EACH ROW EXECUTE FUNCTION garden.assert_event_subject_integrity();


--
-- Name: events events_log_change; Type: TRIGGER; Schema: garden; Owner: -
--

CREATE TRIGGER events_log_change AFTER INSERT ON garden.events FOR EACH ROW EXECUTE FUNCTION garden.log_event_change();


--
-- Name: library_catalog_items gardenpedia_catalog_publication_sync; Type: TRIGGER; Schema: garden; Owner: -
--

CREATE TRIGGER gardenpedia_catalog_publication_sync AFTER INSERT OR UPDATE ON garden.library_catalog_items FOR EACH ROW EXECUTE FUNCTION garden.gardenpedia_catalog_publication_sync();


--
-- Name: grow_cycles grow_cycles_dismiss_open_attention_on_close; Type: TRIGGER; Schema: garden; Owner: -
--

CREATE TRIGGER grow_cycles_dismiss_open_attention_on_close AFTER UPDATE OF state ON garden.grow_cycles FOR EACH ROW EXECUTE FUNCTION garden.dismiss_open_attention_for_closed_cycle();


--
-- Name: ai_requests ai_requests_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.ai_requests
    ADD CONSTRAINT ai_requests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: attention_history attention_history_attention_item_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.attention_history
    ADD CONSTRAINT attention_history_attention_item_id_fkey FOREIGN KEY (attention_item_id) REFERENCES garden.attention_items(id) ON DELETE RESTRICT;


--
-- Name: attention_history attention_history_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.attention_history
    ADD CONSTRAINT attention_history_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: attention_history attention_history_related_event_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.attention_history
    ADD CONSTRAINT attention_history_related_event_id_fkey FOREIGN KEY (related_event_id) REFERENCES garden.events(id) ON DELETE RESTRICT;


--
-- Name: attention_items attention_items_completed_event_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.attention_items
    ADD CONSTRAINT attention_items_completed_event_id_fkey FOREIGN KEY (completed_event_id) REFERENCES garden.events(id) ON DELETE RESTRICT;


--
-- Name: attention_items attention_items_garden_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.attention_items
    ADD CONSTRAINT attention_items_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES garden.gardens(id) ON DELETE CASCADE;


--
-- Name: attention_items attention_items_grow_cycle_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.attention_items
    ADD CONSTRAINT attention_items_grow_cycle_id_fkey FOREIGN KEY (grow_cycle_id) REFERENCES garden.grow_cycles(id) ON DELETE CASCADE;


--
-- Name: attention_items attention_items_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.attention_items
    ADD CONSTRAINT attention_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: command_receipts command_receipts_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.command_receipts
    ADD CONSTRAINT command_receipts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: crops crops_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.crops
    ADD CONSTRAINT crops_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: custom_system_definitions custom_system_definitions_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.custom_system_definitions
    ADD CONSTRAINT custom_system_definitions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: custom_system_definitions custom_system_definitions_photo_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.custom_system_definitions
    ADD CONSTRAINT custom_system_definitions_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES garden.photos(id) ON DELETE SET NULL;


--
-- Name: custom_system_levels custom_system_levels_definition_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.custom_system_levels
    ADD CONSTRAINT custom_system_levels_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES garden.custom_system_definitions(id) ON DELETE CASCADE;


--
-- Name: cycle_occupancies cycle_occupancies_grow_cycle_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.cycle_occupancies
    ADD CONSTRAINT cycle_occupancies_grow_cycle_id_fkey FOREIGN KEY (grow_cycle_id) REFERENCES garden.grow_cycles(id) ON DELETE RESTRICT;


--
-- Name: cycle_occupancies cycle_occupancies_position_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.cycle_occupancies
    ADD CONSTRAINT cycle_occupancies_position_id_fkey FOREIGN KEY (position_id) REFERENCES garden.positions(id) ON DELETE RESTRICT;


--
-- Name: cycle_revisions cycle_revisions_grow_cycle_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.cycle_revisions
    ADD CONSTRAINT cycle_revisions_grow_cycle_id_fkey FOREIGN KEY (grow_cycle_id) REFERENCES garden.grow_cycles(id) ON DELETE RESTRICT;


--
-- Name: cycle_revisions cycle_revisions_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.cycle_revisions
    ADD CONSTRAINT cycle_revisions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: event_revisions event_revisions_event_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.event_revisions
    ADD CONSTRAINT event_revisions_event_id_fkey FOREIGN KEY (event_id) REFERENCES garden.events(id) ON DELETE RESTRICT;


--
-- Name: event_revisions event_revisions_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.event_revisions
    ADD CONSTRAINT event_revisions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: events events_garden_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.events
    ADD CONSTRAINT events_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES garden.gardens(id) ON DELETE RESTRICT;


--
-- Name: events events_grow_cycle_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.events
    ADD CONSTRAINT events_grow_cycle_id_fkey FOREIGN KEY (grow_cycle_id) REFERENCES garden.grow_cycles(id) ON DELETE CASCADE;


--
-- Name: events events_invalidated_by_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.events
    ADD CONSTRAINT events_invalidated_by_fkey FOREIGN KEY (invalidated_by) REFERENCES auth.users(id);


--
-- Name: events events_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.events
    ADD CONSTRAINT events_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: gardenpedia_curators gardenpedia_curators_user_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.gardenpedia_curators
    ADD CONSTRAINT gardenpedia_curators_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: gardenpedia_proposals gardenpedia_proposals_approved_by_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.gardenpedia_proposals
    ADD CONSTRAINT gardenpedia_proposals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);


--
-- Name: gardenpedia_proposals gardenpedia_proposals_created_by_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.gardenpedia_proposals
    ADD CONSTRAINT gardenpedia_proposals_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: gardenpedia_proposals gardenpedia_proposals_request_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.gardenpedia_proposals
    ADD CONSTRAINT gardenpedia_proposals_request_id_fkey FOREIGN KEY (request_id) REFERENCES garden.gardenpedia_requests(id) ON DELETE CASCADE;


--
-- Name: gardenpedia_proposals gardenpedia_proposals_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.gardenpedia_proposals
    ADD CONSTRAINT gardenpedia_proposals_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);


--
-- Name: gardenpedia_requests gardenpedia_requests_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.gardenpedia_requests
    ADD CONSTRAINT gardenpedia_requests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: gardens gardens_cover_photo_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.gardens
    ADD CONSTRAINT gardens_cover_photo_id_fkey FOREIGN KEY (cover_photo_id) REFERENCES garden.photos(id) ON DELETE SET NULL;


--
-- Name: gardens gardens_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.gardens
    ADD CONSTRAINT gardens_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: grow_cycles grow_cycles_cover_photo_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.grow_cycles
    ADD CONSTRAINT grow_cycles_cover_photo_id_fkey FOREIGN KEY (cover_photo_id) REFERENCES garden.photos(id) ON DELETE SET NULL;


--
-- Name: grow_cycles grow_cycles_crop_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.grow_cycles
    ADD CONSTRAINT grow_cycles_crop_id_fkey FOREIGN KEY (crop_id) REFERENCES garden.crops(id) ON DELETE RESTRICT;


--
-- Name: grow_cycles grow_cycles_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.grow_cycles
    ADD CONSTRAINT grow_cycles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: grow_cycles grow_cycles_plant_instance_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.grow_cycles
    ADD CONSTRAINT grow_cycles_plant_instance_id_fkey FOREIGN KEY (plant_instance_id) REFERENCES garden.plant_instances(id) ON DELETE RESTRICT;


--
-- Name: guest_garden_stories guest_garden_stories_garden_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.guest_garden_stories
    ADD CONSTRAINT guest_garden_stories_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES garden.gardens(id) ON DELETE CASCADE;


--
-- Name: guest_garden_stories guest_garden_stories_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.guest_garden_stories
    ADD CONSTRAINT guest_garden_stories_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: guest_plant_stories guest_plant_stories_grow_cycle_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.guest_plant_stories
    ADD CONSTRAINT guest_plant_stories_grow_cycle_id_fkey FOREIGN KEY (grow_cycle_id) REFERENCES garden.grow_cycles(id) ON DELETE CASCADE;


--
-- Name: guest_plant_stories guest_plant_stories_hero_photo_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.guest_plant_stories
    ADD CONSTRAINT guest_plant_stories_hero_photo_id_fkey FOREIGN KEY (hero_photo_id) REFERENCES garden.photos(id) ON DELETE SET NULL;


--
-- Name: guest_plant_stories guest_plant_stories_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.guest_plant_stories
    ADD CONSTRAINT guest_plant_stories_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: guest_plant_story_items guest_plant_story_items_event_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.guest_plant_story_items
    ADD CONSTRAINT guest_plant_story_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES garden.events(id) ON DELETE CASCADE;


--
-- Name: guest_plant_story_items guest_plant_story_items_photo_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.guest_plant_story_items
    ADD CONSTRAINT guest_plant_story_items_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES garden.photos(id) ON DELETE CASCADE;


--
-- Name: guest_plant_story_items guest_plant_story_items_story_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.guest_plant_story_items
    ADD CONSTRAINT guest_plant_story_items_story_id_fkey FOREIGN KEY (story_id) REFERENCES garden.guest_plant_stories(id) ON DELETE CASCADE;


--
-- Name: home_visits home_visits_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.home_visits
    ADD CONSTRAINT home_visits_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: import_batches import_batches_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.import_batches
    ADD CONSTRAINT import_batches_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: import_candidates import_candidates_batch_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.import_candidates
    ADD CONSTRAINT import_candidates_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES garden.import_batches(id) ON DELETE CASCADE;


--
-- Name: import_candidates import_candidates_confirmed_event_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.import_candidates
    ADD CONSTRAINT import_candidates_confirmed_event_id_fkey FOREIGN KEY (confirmed_event_id) REFERENCES garden.events(id) ON DELETE RESTRICT;


--
-- Name: import_candidates import_candidates_grow_cycle_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.import_candidates
    ADD CONSTRAINT import_candidates_grow_cycle_id_fkey FOREIGN KEY (grow_cycle_id) REFERENCES garden.grow_cycles(id) ON DELETE RESTRICT;


--
-- Name: import_candidates import_candidates_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.import_candidates
    ADD CONSTRAINT import_candidates_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: layout_events layout_events_garden_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.layout_events
    ADD CONSTRAINT layout_events_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES garden.gardens(id) ON DELETE CASCADE;


--
-- Name: layout_events layout_events_layout_site_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.layout_events
    ADD CONSTRAINT layout_events_layout_site_id_fkey FOREIGN KEY (layout_site_id) REFERENCES garden.layout_sites(id) ON DELETE SET NULL;


--
-- Name: layout_events layout_events_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.layout_events
    ADD CONSTRAINT layout_events_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: layout_sites layout_sites_garden_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.layout_sites
    ADD CONSTRAINT layout_sites_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES garden.gardens(id) ON DELETE CASCADE;


--
-- Name: layout_sites layout_sites_position_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.layout_sites
    ADD CONSTRAINT layout_sites_position_id_fkey FOREIGN KEY (position_id) REFERENCES garden.positions(id) ON DELETE RESTRICT;


--
-- Name: layout_sites layout_sites_system_instance_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.layout_sites
    ADD CONSTRAINT layout_sites_system_instance_id_fkey FOREIGN KEY (system_instance_id) REFERENCES garden.system_instances(id) ON DELETE RESTRICT;


--
-- Name: maintenance_session_positions maintenance_session_positions_captured_grow_cycle_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.maintenance_session_positions
    ADD CONSTRAINT maintenance_session_positions_captured_grow_cycle_id_fkey FOREIGN KEY (captured_grow_cycle_id) REFERENCES garden.grow_cycles(id) ON DELETE RESTRICT;


--
-- Name: maintenance_session_positions maintenance_session_positions_garden_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.maintenance_session_positions
    ADD CONSTRAINT maintenance_session_positions_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES garden.gardens(id) ON DELETE RESTRICT;


--
-- Name: maintenance_session_positions maintenance_session_positions_position_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.maintenance_session_positions
    ADD CONSTRAINT maintenance_session_positions_position_id_fkey FOREIGN KEY (position_id) REFERENCES garden.positions(id) ON DELETE RESTRICT;


--
-- Name: maintenance_session_positions maintenance_session_positions_session_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.maintenance_session_positions
    ADD CONSTRAINT maintenance_session_positions_session_id_fkey FOREIGN KEY (session_id) REFERENCES garden.maintenance_sessions(id) ON DELETE CASCADE;


--
-- Name: maintenance_session_positions maintenance_session_positions_visual_review_event_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.maintenance_session_positions
    ADD CONSTRAINT maintenance_session_positions_visual_review_event_id_fkey FOREIGN KEY (visual_review_event_id) REFERENCES garden.events(id) ON DELETE RESTRICT;


--
-- Name: maintenance_sessions maintenance_sessions_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.maintenance_sessions
    ADD CONSTRAINT maintenance_sessions_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: owner_change_log owner_change_log_garden_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.owner_change_log
    ADD CONSTRAINT owner_change_log_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES garden.gardens(id) ON DELETE SET NULL;


--
-- Name: owner_change_log owner_change_log_grow_cycle_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.owner_change_log
    ADD CONSTRAINT owner_change_log_grow_cycle_id_fkey FOREIGN KEY (grow_cycle_id) REFERENCES garden.grow_cycles(id) ON DELETE SET NULL;


--
-- Name: owner_change_log owner_change_log_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.owner_change_log
    ADD CONSTRAINT owner_change_log_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: owner_home_state owner_home_state_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.owner_home_state
    ADD CONSTRAINT owner_home_state_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: owner_settings owner_settings_home_hero_photo_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.owner_settings
    ADD CONSTRAINT owner_settings_home_hero_photo_id_fkey FOREIGN KEY (home_hero_photo_id) REFERENCES garden.photos(id) ON DELETE SET NULL;


--
-- Name: owner_settings owner_settings_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.owner_settings
    ADD CONSTRAINT owner_settings_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: photos photos_event_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.photos
    ADD CONSTRAINT photos_event_id_fkey FOREIGN KEY (event_id) REFERENCES garden.events(id) ON DELETE CASCADE;


--
-- Name: photos photos_garden_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.photos
    ADD CONSTRAINT photos_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES garden.gardens(id) ON DELETE CASCADE;


--
-- Name: photos photos_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.photos
    ADD CONSTRAINT photos_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: plant_instances plant_instances_library_plant_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.plant_instances
    ADD CONSTRAINT plant_instances_library_plant_id_fkey FOREIGN KEY (library_plant_id) REFERENCES garden.library_catalog_items(library_plant_id) ON UPDATE CASCADE;


--
-- Name: plant_instances plant_instances_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.plant_instances
    ADD CONSTRAINT plant_instances_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: positions positions_garden_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.positions
    ADD CONSTRAINT positions_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES garden.gardens(id) ON DELETE CASCADE;


--
-- Name: positions positions_system_instance_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.positions
    ADD CONSTRAINT positions_system_instance_id_fkey FOREIGN KEY (system_instance_id) REFERENCES garden.system_instances(id) ON DELETE RESTRICT;


--
-- Name: recurrence_rules recurrence_rules_garden_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.recurrence_rules
    ADD CONSTRAINT recurrence_rules_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES garden.gardens(id) ON DELETE CASCADE;


--
-- Name: recurrence_rules recurrence_rules_grow_cycle_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.recurrence_rules
    ADD CONSTRAINT recurrence_rules_grow_cycle_id_fkey FOREIGN KEY (grow_cycle_id) REFERENCES garden.grow_cycles(id) ON DELETE CASCADE;


--
-- Name: recurrence_rules recurrence_rules_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.recurrence_rules
    ADD CONSTRAINT recurrence_rules_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: saved_films saved_films_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.saved_films
    ADD CONSTRAINT saved_films_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: saved_films saved_films_plant_instance_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.saved_films
    ADD CONSTRAINT saved_films_plant_instance_id_fkey FOREIGN KEY (plant_instance_id) REFERENCES garden.plant_instances(id) ON DELETE CASCADE;


--
-- Name: seed_packages seed_packages_library_plant_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.seed_packages
    ADD CONSTRAINT seed_packages_library_plant_id_fkey FOREIGN KEY (library_plant_id) REFERENCES garden.library_catalog_items(library_plant_id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: seed_packages seed_packages_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.seed_packages
    ADD CONSTRAINT seed_packages_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: storage_cleanup_queue storage_cleanup_queue_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.storage_cleanup_queue
    ADD CONSTRAINT storage_cleanup_queue_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: system_instances system_instances_garden_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.system_instances
    ADD CONSTRAINT system_instances_garden_id_fkey FOREIGN KEY (garden_id) REFERENCES garden.gardens(id) ON DELETE CASCADE;


--
-- Name: system_instances system_instances_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden; Owner: -
--

ALTER TABLE ONLY garden.system_instances
    ADD CONSTRAINT system_instances_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: custom_seeds custom_seeds_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden_lab; Owner: -
--

ALTER TABLE ONLY garden_lab.custom_seeds
    ADD CONSTRAINT custom_seeds_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: machine_state machine_state_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden_lab; Owner: -
--

ALTER TABLE ONLY garden_lab.machine_state
    ADD CONSTRAINT machine_state_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: seed_personal_state seed_personal_state_owner_id_fkey; Type: FK CONSTRAINT; Schema: garden_lab; Owner: -
--

ALTER TABLE ONLY garden_lab.seed_personal_state
    ADD CONSTRAINT seed_personal_state_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_requests; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.ai_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_requests ai_requests_owner_insert; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY ai_requests_owner_insert ON garden.ai_requests FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: ai_requests ai_requests_owner_select; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY ai_requests_owner_select ON garden.ai_requests FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: ai_requests ai_requests_owner_update; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY ai_requests_owner_update ON garden.ai_requests FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = owner_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: attention_history; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.attention_history ENABLE ROW LEVEL SECURITY;

--
-- Name: attention_items; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.attention_items ENABLE ROW LEVEL SECURITY;

--
-- Name: command_receipts; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.command_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: crops; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.crops ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_system_definitions; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.custom_system_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_system_levels; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.custom_system_levels ENABLE ROW LEVEL SECURITY;

--
-- Name: cycle_occupancies; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.cycle_occupancies ENABLE ROW LEVEL SECURITY;

--
-- Name: cycle_revisions; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.cycle_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: event_revisions; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.event_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.events ENABLE ROW LEVEL SECURITY;

--
-- Name: gardenpedia_curators; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.gardenpedia_curators ENABLE ROW LEVEL SECURITY;

--
-- Name: gardenpedia_proposals; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.gardenpedia_proposals ENABLE ROW LEVEL SECURITY;

--
-- Name: gardenpedia_requests; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.gardenpedia_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: gardens; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.gardens ENABLE ROW LEVEL SECURITY;

--
-- Name: grow_cycles; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.grow_cycles ENABLE ROW LEVEL SECURITY;

--
-- Name: guest_garden_stories; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.guest_garden_stories ENABLE ROW LEVEL SECURITY;

--
-- Name: guest_plant_stories; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.guest_plant_stories ENABLE ROW LEVEL SECURITY;

--
-- Name: guest_plant_story_items; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.guest_plant_story_items ENABLE ROW LEVEL SECURITY;

--
-- Name: home_visits; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.home_visits ENABLE ROW LEVEL SECURITY;

--
-- Name: import_batches; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.import_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: import_candidates; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.import_candidates ENABLE ROW LEVEL SECURITY;

--
-- Name: layout_events; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.layout_events ENABLE ROW LEVEL SECURITY;

--
-- Name: layout_sites; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.layout_sites ENABLE ROW LEVEL SECURITY;

--
-- Name: library_catalog_items; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.library_catalog_items ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_session_positions; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.maintenance_session_positions ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_sessions; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.maintenance_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: owner_change_log; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.owner_change_log ENABLE ROW LEVEL SECURITY;

--
-- Name: owner_home_state; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.owner_home_state ENABLE ROW LEVEL SECURITY;

--
-- Name: owner_settings; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.owner_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: seed_packages owners delete their seed packages; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners delete their seed packages" ON garden.seed_packages FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: seed_packages owners insert their seed packages; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners insert their seed packages" ON garden.seed_packages FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: import_batches owners read import batches; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read import batches" ON garden.import_batches FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: import_candidates owners read import candidates; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read import candidates" ON garden.import_candidates FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: maintenance_session_positions owners read maintenance positions; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read maintenance positions" ON garden.maintenance_session_positions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM garden.maintenance_sessions s
  WHERE ((s.id = maintenance_session_positions.session_id) AND (s.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: maintenance_sessions owners read maintenance sessions; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read maintenance sessions" ON garden.maintenance_sessions FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: attention_items owners read their attention; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their attention" ON garden.attention_items FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: attention_history owners read their attention history; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their attention history" ON garden.attention_history FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: owner_change_log owners read their change log; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their change log" ON garden.owner_change_log FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: crops owners read their crops; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their crops" ON garden.crops FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: custom_system_definitions owners read their custom system definitions; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their custom system definitions" ON garden.custom_system_definitions FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: custom_system_levels owners read their custom system levels; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their custom system levels" ON garden.custom_system_levels FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM garden.custom_system_definitions d
  WHERE ((d.id = custom_system_levels.definition_id) AND (d.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: cycle_revisions owners read their cycle revisions; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their cycle revisions" ON garden.cycle_revisions FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: grow_cycles owners read their cycles; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their cycles" ON garden.grow_cycles FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: event_revisions owners read their event revisions; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their event revisions" ON garden.event_revisions FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: events owners read their events; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their events" ON garden.events FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: owner_settings owners read their garden settings; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their garden settings" ON garden.owner_settings FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: gardens owners read their gardens; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their gardens" ON garden.gardens FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: guest_garden_stories owners read their guest garden stories; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their guest garden stories" ON garden.guest_garden_stories FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: guest_plant_stories owners read their guest stories; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their guest stories" ON garden.guest_plant_stories FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: guest_plant_story_items owners read their guest story items; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their guest story items" ON garden.guest_plant_story_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM garden.guest_plant_stories s
  WHERE ((s.id = guest_plant_story_items.story_id) AND (s.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: owner_home_state owners read their home state; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their home state" ON garden.owner_home_state FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: layout_events owners read their layout events; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their layout events" ON garden.layout_events FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: layout_sites owners read their layout sites; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their layout sites" ON garden.layout_sites FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM garden.gardens g
  WHERE ((g.id = layout_sites.garden_id) AND (g.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: cycle_occupancies owners read their occupancies; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their occupancies" ON garden.cycle_occupancies FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (garden.positions p
     JOIN garden.gardens g ON ((g.id = p.garden_id)))
  WHERE ((p.id = cycle_occupancies.position_id) AND (g.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: photos owners read their photos; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their photos" ON garden.photos FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: plant_instances owners read their plant instances; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their plant instances" ON garden.plant_instances FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: positions owners read their positions; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their positions" ON garden.positions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM garden.gardens g
  WHERE ((g.id = positions.garden_id) AND (g.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: command_receipts owners read their receipts; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their receipts" ON garden.command_receipts FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: recurrence_rules owners read their recurrence rules; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their recurrence rules" ON garden.recurrence_rules FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: saved_films owners read their saved films; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their saved films" ON garden.saved_films FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: seed_packages owners read their seed packages; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their seed packages" ON garden.seed_packages FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: system_instances owners read their system instances; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their system instances" ON garden.system_instances FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: home_visits owners read their visits; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners read their visits" ON garden.home_visits FOR SELECT USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: seed_packages owners update their seed packages; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "owners update their seed packages" ON garden.seed_packages FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = owner_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: photos; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.photos ENABLE ROW LEVEL SECURITY;

--
-- Name: plant_instances; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.plant_instances ENABLE ROW LEVEL SECURITY;

--
-- Name: positions; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.positions ENABLE ROW LEVEL SECURITY;

--
-- Name: recurrence_rules; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.recurrence_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: gardenpedia_proposals request owners and curators read proposals; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "request owners and curators read proposals" ON garden.gardenpedia_proposals FOR SELECT TO authenticated USING ((( SELECT garden.gardenpedia_is_curator() AS gardenpedia_is_curator) OR (EXISTS ( SELECT 1
   FROM garden.gardenpedia_requests r
  WHERE ((r.id = gardenpedia_proposals.request_id) AND (r.owner_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: gardenpedia_requests request owners and curators read requests; Type: POLICY; Schema: garden; Owner: -
--

CREATE POLICY "request owners and curators read requests" ON garden.gardenpedia_requests FOR SELECT TO authenticated USING (((( SELECT auth.uid() AS uid) = owner_id) OR ( SELECT garden.gardenpedia_is_curator() AS gardenpedia_is_curator)));


--
-- Name: saved_films; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.saved_films ENABLE ROW LEVEL SECURITY;

--
-- Name: seed_packages; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.seed_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: storage_cleanup_queue; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.storage_cleanup_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: system_instances; Type: ROW SECURITY; Schema: garden; Owner: -
--

ALTER TABLE garden.system_instances ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_seeds; Type: ROW SECURITY; Schema: garden_lab; Owner: -
--

ALTER TABLE garden_lab.custom_seeds ENABLE ROW LEVEL SECURITY;

--
-- Name: machine_state; Type: ROW SECURITY; Schema: garden_lab; Owner: -
--

ALTER TABLE garden_lab.machine_state ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_seeds owners read lab custom seeds; Type: POLICY; Schema: garden_lab; Owner: -
--

CREATE POLICY "owners read lab custom seeds" ON garden_lab.custom_seeds FOR SELECT TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: machine_state owners read lab machine state; Type: POLICY; Schema: garden_lab; Owner: -
--

CREATE POLICY "owners read lab machine state" ON garden_lab.machine_state FOR SELECT TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: seed_personal_state owners read lab seed state; Type: POLICY; Schema: garden_lab; Owner: -
--

CREATE POLICY "owners read lab seed state" ON garden_lab.seed_personal_state FOR SELECT TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: custom_seeds owners write lab custom seeds; Type: POLICY; Schema: garden_lab; Owner: -
--

CREATE POLICY "owners write lab custom seeds" ON garden_lab.custom_seeds TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: machine_state owners write lab machine state; Type: POLICY; Schema: garden_lab; Owner: -
--

CREATE POLICY "owners write lab machine state" ON garden_lab.machine_state TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: seed_personal_state owners write lab seed state; Type: POLICY; Schema: garden_lab; Owner: -
--

CREATE POLICY "owners write lab seed state" ON garden_lab.seed_personal_state TO authenticated USING ((owner_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));


--
-- Name: seed_personal_state; Type: ROW SECURITY; Schema: garden_lab; Owner: -
--

ALTER TABLE garden_lab.seed_personal_state ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION assert_occupancy_integrity(); Type: ACL; Schema: garden; Owner: -
--

REVOKE ALL ON FUNCTION garden.assert_occupancy_integrity() FROM PUBLIC;


--
-- Name: FUNCTION cleanup_expired_ai_requests(); Type: ACL; Schema: garden; Owner: -
--

REVOKE ALL ON FUNCTION garden.cleanup_expired_ai_requests() FROM PUBLIC;
GRANT ALL ON FUNCTION garden.cleanup_expired_ai_requests() TO service_role;


--
-- Name: FUNCTION command_response(p_owner uuid, p_request_id uuid, p_command_name text, p_payload jsonb); Type: ACL; Schema: garden; Owner: -
--

REVOKE ALL ON FUNCTION garden.command_response(p_owner uuid, p_request_id uuid, p_command_name text, p_payload jsonb) FROM PUBLIC;


--
-- Name: FUNCTION create_open_review_follow_up(p_owner_id uuid, p_garden_id uuid, p_grow_cycle_id uuid, p_origin text, p_subject_key text); Type: ACL; Schema: garden; Owner: -
--

REVOKE ALL ON FUNCTION garden.create_open_review_follow_up(p_owner_id uuid, p_garden_id uuid, p_grow_cycle_id uuid, p_origin text, p_subject_key text) FROM PUBLIC;


--
-- Name: FUNCTION dismiss_open_attention_for_closed_cycle(); Type: ACL; Schema: garden; Owner: -
--

REVOKE ALL ON FUNCTION garden.dismiss_open_attention_for_closed_cycle() FROM PUBLIC;


--
-- Name: FUNCTION gardenpedia_catalog_publication_sync(); Type: ACL; Schema: garden; Owner: -
--

REVOKE ALL ON FUNCTION garden.gardenpedia_catalog_publication_sync() FROM PUBLIC;


--
-- Name: FUNCTION gardenpedia_is_curator(); Type: ACL; Schema: garden; Owner: -
--

REVOKE ALL ON FUNCTION garden.gardenpedia_is_curator() FROM PUBLIC;
GRANT ALL ON FUNCTION garden.gardenpedia_is_curator() TO authenticated;


--
-- Name: FUNCTION refresh_position_capacity(p_garden_id uuid); Type: ACL; Schema: garden; Owner: -
--

REVOKE ALL ON FUNCTION garden.refresh_position_capacity(p_garden_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION resolve_cycle_evidence(p_owner_id uuid, p_grow_cycle_id uuid, p_as_of timestamp with time zone, p_note_event_ids uuid[], p_historical_photo_ids uuid[]); Type: ACL; Schema: garden; Owner: -
--

REVOKE ALL ON FUNCTION garden.resolve_cycle_evidence(p_owner_id uuid, p_grow_cycle_id uuid, p_as_of timestamp with time zone, p_note_event_ids uuid[], p_historical_photo_ids uuid[]) FROM PUBLIC;


--
-- Name: FUNCTION store_command_response(p_owner uuid, p_request_id uuid, p_command_name text, p_payload jsonb, p_response jsonb); Type: ACL; Schema: garden; Owner: -
--

REVOKE ALL ON FUNCTION garden.store_command_response(p_owner uuid, p_request_id uuid, p_command_name text, p_payload jsonb, p_response jsonb) FROM PUBLIC;


--
-- Name: FUNCTION garden_ack_home_snapshot(p_visit_id uuid, p_snapshot_cursor bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_ack_home_snapshot(p_visit_id uuid, p_snapshot_cursor bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_ack_home_snapshot(p_visit_id uuid, p_snapshot_cursor bigint) TO anon;
GRANT ALL ON FUNCTION public.garden_ack_home_snapshot(p_visit_id uuid, p_snapshot_cursor bigint) TO authenticated;
GRANT ALL ON FUNCTION public.garden_ack_home_snapshot(p_visit_id uuid, p_snapshot_cursor bigint) TO service_role;


--
-- Name: FUNCTION garden_add_layout_site(p_request_id uuid, p_garden_id uuid, p_grid_x integer, p_grid_y integer, p_site_kind text, p_label text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_add_layout_site(p_request_id uuid, p_garden_id uuid, p_grid_x integer, p_grid_y integer, p_site_kind text, p_label text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_add_layout_site(p_request_id uuid, p_garden_id uuid, p_grid_x integer, p_grid_y integer, p_site_kind text, p_label text) TO anon;
GRANT ALL ON FUNCTION public.garden_add_layout_site(p_request_id uuid, p_garden_id uuid, p_grid_x integer, p_grid_y integer, p_site_kind text, p_label text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_add_layout_site(p_request_id uuid, p_garden_id uuid, p_grid_x integer, p_grid_y integer, p_site_kind text, p_label text) TO service_role;


--
-- Name: FUNCTION garden_ai_finish_request(p_request_id uuid, p_status text, p_proposal jsonb, p_model_identifier text, p_duration_ms integer, p_usage_metadata jsonb, p_error_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_ai_finish_request(p_request_id uuid, p_status text, p_proposal jsonb, p_model_identifier text, p_duration_ms integer, p_usage_metadata jsonb, p_error_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_ai_finish_request(p_request_id uuid, p_status text, p_proposal jsonb, p_model_identifier text, p_duration_ms integer, p_usage_metadata jsonb, p_error_code text) TO anon;
GRANT ALL ON FUNCTION public.garden_ai_finish_request(p_request_id uuid, p_status text, p_proposal jsonb, p_model_identifier text, p_duration_ms integer, p_usage_metadata jsonb, p_error_code text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_ai_finish_request(p_request_id uuid, p_status text, p_proposal jsonb, p_model_identifier text, p_duration_ms integer, p_usage_metadata jsonb, p_error_code text) TO service_role;


--
-- Name: FUNCTION garden_ai_record_cost(p_request_id uuid, p_estimated_cost_usd numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_ai_record_cost(p_request_id uuid, p_estimated_cost_usd numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_ai_record_cost(p_request_id uuid, p_estimated_cost_usd numeric) TO anon;
GRANT ALL ON FUNCTION public.garden_ai_record_cost(p_request_id uuid, p_estimated_cost_usd numeric) TO authenticated;
GRANT ALL ON FUNCTION public.garden_ai_record_cost(p_request_id uuid, p_estimated_cost_usd numeric) TO service_role;


--
-- Name: FUNCTION garden_ai_start_request(p_request_key text, p_request_type text, p_evidence_refs jsonb, p_proposal_schema_version text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_ai_start_request(p_request_key text, p_request_type text, p_evidence_refs jsonb, p_proposal_schema_version text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_ai_start_request(p_request_key text, p_request_type text, p_evidence_refs jsonb, p_proposal_schema_version text) TO anon;
GRANT ALL ON FUNCTION public.garden_ai_start_request(p_request_key text, p_request_type text, p_evidence_refs jsonb, p_proposal_schema_version text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_ai_start_request(p_request_key text, p_request_type text, p_evidence_refs jsonb, p_proposal_schema_version text) TO service_role;


--
-- Name: FUNCTION garden_close_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_ended_on date, p_reason text, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_close_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_ended_on date, p_reason text, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_close_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_ended_on date, p_reason text, p_note text) TO anon;
GRANT ALL ON FUNCTION public.garden_close_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_ended_on date, p_reason text, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_close_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_ended_on date, p_reason text, p_note text) TO service_role;


--
-- Name: FUNCTION garden_complete_attention_item(p_request_id uuid, p_task_id uuid, p_note text, p_review_result text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_complete_attention_item(p_request_id uuid, p_task_id uuid, p_note text, p_review_result text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_complete_attention_item(p_request_id uuid, p_task_id uuid, p_note text, p_review_result text) TO anon;
GRANT ALL ON FUNCTION public.garden_complete_attention_item(p_request_id uuid, p_task_id uuid, p_note text, p_review_result text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_complete_attention_item(p_request_id uuid, p_task_id uuid, p_note text, p_review_result text) TO service_role;


--
-- Name: FUNCTION garden_correct_cycle_origin(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_origin_type text, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_correct_cycle_origin(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_origin_type text, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_correct_cycle_origin(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_origin_type text, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.garden_correct_cycle_origin(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_origin_type text, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_correct_cycle_origin(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_origin_type text, p_reason text) TO service_role;


--
-- Name: FUNCTION garden_correct_cycle_planting(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_planted_on date, p_planted_on_precision text, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_correct_cycle_planting(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_planted_on date, p_planted_on_precision text, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_correct_cycle_planting(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_planted_on date, p_planted_on_precision text, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.garden_correct_cycle_planting(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_planted_on date, p_planted_on_precision text, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_correct_cycle_planting(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_planted_on date, p_planted_on_precision text, p_reason text) TO service_role;


--
-- Name: FUNCTION garden_create_attention_item(p_request_id uuid, p_garden_id uuid, p_grow_cycle_id uuid, p_purpose text, p_subject_key text, p_due_on date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_create_attention_item(p_request_id uuid, p_garden_id uuid, p_grow_cycle_id uuid, p_purpose text, p_subject_key text, p_due_on date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_create_attention_item(p_request_id uuid, p_garden_id uuid, p_grow_cycle_id uuid, p_purpose text, p_subject_key text, p_due_on date) TO anon;
GRANT ALL ON FUNCTION public.garden_create_attention_item(p_request_id uuid, p_garden_id uuid, p_grow_cycle_id uuid, p_purpose text, p_subject_key text, p_due_on date) TO authenticated;
GRANT ALL ON FUNCTION public.garden_create_attention_item(p_request_id uuid, p_garden_id uuid, p_grow_cycle_id uuid, p_purpose text, p_subject_key text, p_due_on date) TO service_role;


--
-- Name: FUNCTION garden_create_garden(p_request_id uuid, p_name text, p_system_model text, p_position_capacity integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_create_garden(p_request_id uuid, p_name text, p_system_model text, p_position_capacity integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_create_garden(p_request_id uuid, p_name text, p_system_model text, p_position_capacity integer) TO anon;
GRANT ALL ON FUNCTION public.garden_create_garden(p_request_id uuid, p_name text, p_system_model text, p_position_capacity integer) TO authenticated;
GRANT ALL ON FUNCTION public.garden_create_garden(p_request_id uuid, p_name text, p_system_model text, p_position_capacity integer) TO service_role;


--
-- Name: FUNCTION garden_create_guest_garden_story(p_request_id uuid, p_garden_id uuid, p_token_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_create_guest_garden_story(p_request_id uuid, p_garden_id uuid, p_token_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_create_guest_garden_story(p_request_id uuid, p_garden_id uuid, p_token_hash text) TO anon;
GRANT ALL ON FUNCTION public.garden_create_guest_garden_story(p_request_id uuid, p_garden_id uuid, p_token_hash text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_create_guest_garden_story(p_request_id uuid, p_garden_id uuid, p_token_hash text) TO service_role;


--
-- Name: FUNCTION garden_create_guest_plant_story(p_request_id uuid, p_grow_cycle_id uuid, p_token_hash text, p_item_selection jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_create_guest_plant_story(p_request_id uuid, p_grow_cycle_id uuid, p_token_hash text, p_item_selection jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_create_guest_plant_story(p_request_id uuid, p_grow_cycle_id uuid, p_token_hash text, p_item_selection jsonb) TO anon;
GRANT ALL ON FUNCTION public.garden_create_guest_plant_story(p_request_id uuid, p_grow_cycle_id uuid, p_token_hash text, p_item_selection jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.garden_create_guest_plant_story(p_request_id uuid, p_grow_cycle_id uuid, p_token_hash text, p_item_selection jsonb) TO service_role;


--
-- Name: FUNCTION garden_create_guest_plant_story_v2(p_request_id uuid, p_grow_cycle_id uuid, p_token_hash text, p_item_selection jsonb, p_hero_photo_id uuid, p_caption_overrides jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_create_guest_plant_story_v2(p_request_id uuid, p_grow_cycle_id uuid, p_token_hash text, p_item_selection jsonb, p_hero_photo_id uuid, p_caption_overrides jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_create_guest_plant_story_v2(p_request_id uuid, p_grow_cycle_id uuid, p_token_hash text, p_item_selection jsonb, p_hero_photo_id uuid, p_caption_overrides jsonb) TO anon;
GRANT ALL ON FUNCTION public.garden_create_guest_plant_story_v2(p_request_id uuid, p_grow_cycle_id uuid, p_token_hash text, p_item_selection jsonb, p_hero_photo_id uuid, p_caption_overrides jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.garden_create_guest_plant_story_v2(p_request_id uuid, p_grow_cycle_id uuid, p_token_hash text, p_item_selection jsonb, p_hero_photo_id uuid, p_caption_overrides jsonb) TO service_role;


--
-- Name: FUNCTION garden_create_import_batch(p_request_id uuid, p_source_label text, p_source_fingerprint text, p_candidates jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_create_import_batch(p_request_id uuid, p_source_label text, p_source_fingerprint text, p_candidates jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_create_import_batch(p_request_id uuid, p_source_label text, p_source_fingerprint text, p_candidates jsonb) TO anon;
GRANT ALL ON FUNCTION public.garden_create_import_batch(p_request_id uuid, p_source_label text, p_source_fingerprint text, p_candidates jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.garden_create_import_batch(p_request_id uuid, p_source_label text, p_source_fingerprint text, p_candidates jsonb) TO service_role;


--
-- Name: FUNCTION garden_create_observation(p_request_id uuid, p_grow_cycle_id uuid, p_note text, p_original_filename text, p_content_type text, p_byte_size bigint, p_captured_at timestamp with time zone, p_captured_at_precision text, p_checksum_sha256 text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_create_observation(p_request_id uuid, p_grow_cycle_id uuid, p_note text, p_original_filename text, p_content_type text, p_byte_size bigint, p_captured_at timestamp with time zone, p_captured_at_precision text, p_checksum_sha256 text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_create_observation(p_request_id uuid, p_grow_cycle_id uuid, p_note text, p_original_filename text, p_content_type text, p_byte_size bigint, p_captured_at timestamp with time zone, p_captured_at_precision text, p_checksum_sha256 text) TO anon;
GRANT ALL ON FUNCTION public.garden_create_observation(p_request_id uuid, p_grow_cycle_id uuid, p_note text, p_original_filename text, p_content_type text, p_byte_size bigint, p_captured_at timestamp with time zone, p_captured_at_precision text, p_checksum_sha256 text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_create_observation(p_request_id uuid, p_grow_cycle_id uuid, p_note text, p_original_filename text, p_content_type text, p_byte_size bigint, p_captured_at timestamp with time zone, p_captured_at_precision text, p_checksum_sha256 text) TO service_role;


--
-- Name: FUNCTION garden_defer_attention_item(p_request_id uuid, p_task_id uuid, p_next_review_on date, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_defer_attention_item(p_request_id uuid, p_task_id uuid, p_next_review_on date, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_defer_attention_item(p_request_id uuid, p_task_id uuid, p_next_review_on date, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.garden_defer_attention_item(p_request_id uuid, p_task_id uuid, p_next_review_on date, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_defer_attention_item(p_request_id uuid, p_task_id uuid, p_next_review_on date, p_reason text) TO service_role;


--
-- Name: FUNCTION garden_dismiss_attention_item(p_request_id uuid, p_task_id uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_dismiss_attention_item(p_request_id uuid, p_task_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_dismiss_attention_item(p_request_id uuid, p_task_id uuid, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.garden_dismiss_attention_item(p_request_id uuid, p_task_id uuid, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_dismiss_attention_item(p_request_id uuid, p_task_id uuid, p_reason text) TO service_role;


--
-- Name: FUNCTION garden_export_owner_data(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_export_owner_data() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_export_owner_data() TO anon;
GRANT ALL ON FUNCTION public.garden_export_owner_data() TO authenticated;
GRANT ALL ON FUNCTION public.garden_export_owner_data() TO service_role;


--
-- Name: FUNCTION garden_get_ai_ask_context(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_ai_ask_context() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_ai_ask_context() TO anon;
GRANT ALL ON FUNCTION public.garden_get_ai_ask_context() TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_ai_ask_context() TO service_role;


--
-- Name: FUNCTION garden_get_ai_draft_cycle_context(p_grow_cycle_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_ai_draft_cycle_context(p_grow_cycle_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_ai_draft_cycle_context(p_grow_cycle_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_get_ai_draft_cycle_context(p_grow_cycle_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_ai_draft_cycle_context(p_grow_cycle_id uuid) TO service_role;


--
-- Name: FUNCTION garden_get_ai_garden_maintenance_context(p_grow_cycle_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_ai_garden_maintenance_context(p_grow_cycle_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_ai_garden_maintenance_context(p_grow_cycle_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_get_ai_garden_maintenance_context(p_grow_cycle_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_ai_garden_maintenance_context(p_grow_cycle_id uuid) TO service_role;


--
-- Name: FUNCTION garden_get_attention(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_attention() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_attention() TO anon;
GRANT ALL ON FUNCTION public.garden_get_attention() TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_attention() TO service_role;


--
-- Name: FUNCTION garden_get_control_v2(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_control_v2() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_control_v2() TO anon;
GRANT ALL ON FUNCTION public.garden_get_control_v2() TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_control_v2() TO service_role;


--
-- Name: FUNCTION garden_get_control_v2(p_reference_date date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_control_v2(p_reference_date date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_control_v2(p_reference_date date) TO anon;
GRANT ALL ON FUNCTION public.garden_get_control_v2(p_reference_date date) TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_control_v2(p_reference_date date) TO service_role;


--
-- Name: FUNCTION garden_get_cycle(p_grow_cycle_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_cycle(p_grow_cycle_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_cycle(p_grow_cycle_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_get_cycle(p_grow_cycle_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_cycle(p_grow_cycle_id uuid) TO service_role;


--
-- Name: FUNCTION garden_get_garden(p_garden_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_garden(p_garden_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_garden(p_garden_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_get_garden(p_garden_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_garden(p_garden_id uuid) TO service_role;


--
-- Name: FUNCTION garden_get_garden_cover_photos(p_garden_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_garden_cover_photos(p_garden_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_garden_cover_photos(p_garden_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_get_garden_cover_photos(p_garden_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_garden_cover_photos(p_garden_id uuid) TO service_role;


--
-- Name: FUNCTION garden_get_garden_summary_context(p_scope_type text, p_garden_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_garden_summary_context(p_scope_type text, p_garden_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_garden_summary_context(p_scope_type text, p_garden_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_get_garden_summary_context(p_scope_type text, p_garden_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_garden_summary_context(p_scope_type text, p_garden_id uuid) TO service_role;


--
-- Name: FUNCTION garden_get_garden_summary_results(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_garden_summary_results() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_garden_summary_results() TO anon;
GRANT ALL ON FUNCTION public.garden_get_garden_summary_results() TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_garden_summary_results() TO service_role;


--
-- Name: FUNCTION garden_get_guest_garden_stories(p_garden_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_guest_garden_stories(p_garden_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_guest_garden_stories(p_garden_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_get_guest_garden_stories(p_garden_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_guest_garden_stories(p_garden_id uuid) TO service_role;


--
-- Name: FUNCTION garden_get_guest_garden_story(p_token_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_guest_garden_story(p_token_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_guest_garden_story(p_token_hash text) TO anon;
GRANT ALL ON FUNCTION public.garden_get_guest_garden_story(p_token_hash text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_guest_garden_story(p_token_hash text) TO service_role;


--
-- Name: FUNCTION garden_get_guest_plant_stories(p_grow_cycle_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_guest_plant_stories(p_grow_cycle_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_guest_plant_stories(p_grow_cycle_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_get_guest_plant_stories(p_grow_cycle_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_guest_plant_stories(p_grow_cycle_id uuid) TO service_role;


--
-- Name: FUNCTION garden_get_guest_plant_story_v2(p_token_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_guest_plant_story_v2(p_token_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_guest_plant_story_v2(p_token_hash text) TO anon;
GRANT ALL ON FUNCTION public.garden_get_guest_plant_story_v2(p_token_hash text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_guest_plant_story_v2(p_token_hash text) TO service_role;


--
-- Name: FUNCTION garden_get_harvest_history(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_harvest_history() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_harvest_history() TO anon;
GRANT ALL ON FUNCTION public.garden_get_harvest_history() TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_harvest_history() TO service_role;


--
-- Name: FUNCTION garden_get_home(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_home() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_home() TO anon;
GRANT ALL ON FUNCTION public.garden_get_home() TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_home() TO service_role;


--
-- Name: FUNCTION garden_get_home_dashboard(p_visit_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_home_dashboard(p_visit_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_home_dashboard(p_visit_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_get_home_dashboard(p_visit_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_home_dashboard(p_visit_id uuid) TO service_role;


--
-- Name: FUNCTION garden_get_home_media(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_home_media() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_home_media() TO anon;
GRANT ALL ON FUNCTION public.garden_get_home_media() TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_home_media() TO service_role;


--
-- Name: FUNCTION garden_get_import_candidates(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_import_candidates() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_import_candidates() TO anon;
GRANT ALL ON FUNCTION public.garden_get_import_candidates() TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_import_candidates() TO service_role;


--
-- Name: FUNCTION garden_get_maintenance_session(p_session_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_maintenance_session(p_session_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_maintenance_session(p_session_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_get_maintenance_session(p_session_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_maintenance_session(p_session_id uuid) TO service_role;


--
-- Name: FUNCTION garden_get_meaningful_change_results(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_meaningful_change_results() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_meaningful_change_results() TO anon;
GRANT ALL ON FUNCTION public.garden_get_meaningful_change_results() TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_meaningful_change_results() TO service_role;


--
-- Name: FUNCTION garden_get_open_maintenance_session(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_open_maintenance_session() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_open_maintenance_session() TO anon;
GRANT ALL ON FUNCTION public.garden_get_open_maintenance_session() TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_open_maintenance_session() TO service_role;


--
-- Name: FUNCTION garden_get_system_maintenance_events(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_get_system_maintenance_events() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_get_system_maintenance_events() TO anon;
GRANT ALL ON FUNCTION public.garden_get_system_maintenance_events() TO authenticated;
GRANT ALL ON FUNCTION public.garden_get_system_maintenance_events() TO service_role;


--
-- Name: FUNCTION garden_invalidate_event(p_request_id uuid, p_event_id uuid, p_expected_revision integer, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_invalidate_event(p_request_id uuid, p_event_id uuid, p_expected_revision integer, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_invalidate_event(p_request_id uuid, p_event_id uuid, p_expected_revision integer, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.garden_invalidate_event(p_request_id uuid, p_event_id uuid, p_expected_revision integer, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_invalidate_event(p_request_id uuid, p_event_id uuid, p_expected_revision integer, p_reason text) TO service_role;


--
-- Name: FUNCTION garden_lab_service_get_machine_performance(p_owner uuid, p_garden_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_lab_service_get_machine_performance(p_owner uuid, p_garden_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_lab_service_get_machine_performance(p_owner uuid, p_garden_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_lab_service_get_machine_performance(p_owner uuid, p_garden_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_lab_service_get_machine_performance(p_owner uuid, p_garden_id uuid) TO service_role;


--
-- Name: FUNCTION garden_lab_service_get_machine_storage(p_owner uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_lab_service_get_machine_storage(p_owner uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_lab_service_get_machine_storage(p_owner uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_lab_service_get_machine_storage(p_owner uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_lab_service_get_machine_storage(p_owner uuid) TO service_role;


--
-- Name: FUNCTION garden_lab_service_get_seed_storage(p_owner uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_lab_service_get_seed_storage(p_owner uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_lab_service_get_seed_storage(p_owner uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_lab_service_get_seed_storage(p_owner uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_lab_service_get_seed_storage(p_owner uuid) TO service_role;


--
-- Name: FUNCTION garden_lab_service_save_machine(p_owner uuid, p_instance jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_lab_service_save_machine(p_owner uuid, p_instance jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_lab_service_save_machine(p_owner uuid, p_instance jsonb) TO anon;
GRANT ALL ON FUNCTION public.garden_lab_service_save_machine(p_owner uuid, p_instance jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.garden_lab_service_save_machine(p_owner uuid, p_instance jsonb) TO service_role;


--
-- Name: FUNCTION garden_lab_service_seed_operation(p_owner uuid, p_payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_lab_service_seed_operation(p_owner uuid, p_payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_lab_service_seed_operation(p_owner uuid, p_payload jsonb) TO anon;
GRANT ALL ON FUNCTION public.garden_lab_service_seed_operation(p_owner uuid, p_payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.garden_lab_service_seed_operation(p_owner uuid, p_payload jsonb) TO service_role;


--
-- Name: FUNCTION garden_mark_maintenance_position_inspected(p_request_id uuid, p_session_position_id uuid, p_inspection_source text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_mark_maintenance_position_inspected(p_request_id uuid, p_session_position_id uuid, p_inspection_source text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_mark_maintenance_position_inspected(p_request_id uuid, p_session_position_id uuid, p_inspection_source text) TO anon;
GRANT ALL ON FUNCTION public.garden_mark_maintenance_position_inspected(p_request_id uuid, p_session_position_id uuid, p_inspection_source text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_mark_maintenance_position_inspected(p_request_id uuid, p_session_position_id uuid, p_inspection_source text) TO service_role;


--
-- Name: FUNCTION garden_mark_photo_uploaded(p_photo_id uuid, p_checksum_sha256 text, p_width integer, p_height integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_mark_photo_uploaded(p_photo_id uuid, p_checksum_sha256 text, p_width integer, p_height integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_mark_photo_uploaded(p_photo_id uuid, p_checksum_sha256 text, p_width integer, p_height integer) TO anon;
GRANT ALL ON FUNCTION public.garden_mark_photo_uploaded(p_photo_id uuid, p_checksum_sha256 text, p_width integer, p_height integer) TO authenticated;
GRANT ALL ON FUNCTION public.garden_mark_photo_uploaded(p_photo_id uuid, p_checksum_sha256 text, p_width integer, p_height integer) TO service_role;


--
-- Name: FUNCTION garden_move_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_target_position_id uuid, p_moved_on date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_move_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_target_position_id uuid, p_moved_on date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_move_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_target_position_id uuid, p_moved_on date) TO anon;
GRANT ALL ON FUNCTION public.garden_move_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_target_position_id uuid, p_moved_on date) TO authenticated;
GRANT ALL ON FUNCTION public.garden_move_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_target_position_id uuid, p_moved_on date) TO service_role;


--
-- Name: FUNCTION garden_prepare_media_photo(p_request_id uuid, p_scope text, p_garden_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint, p_checksum_sha256 text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_prepare_media_photo(p_request_id uuid, p_scope text, p_garden_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint, p_checksum_sha256 text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_prepare_media_photo(p_request_id uuid, p_scope text, p_garden_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint, p_checksum_sha256 text) TO anon;
GRANT ALL ON FUNCTION public.garden_prepare_media_photo(p_request_id uuid, p_scope text, p_garden_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint, p_checksum_sha256 text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_prepare_media_photo(p_request_id uuid, p_scope text, p_garden_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint, p_checksum_sha256 text) TO service_role;


--
-- Name: FUNCTION garden_progress_maintenance_position(p_request_id uuid, p_session_position_id uuid, p_progress text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_progress_maintenance_position(p_request_id uuid, p_session_position_id uuid, p_progress text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_progress_maintenance_position(p_request_id uuid, p_session_position_id uuid, p_progress text) TO anon;
GRANT ALL ON FUNCTION public.garden_progress_maintenance_position(p_request_id uuid, p_session_position_id uuid, p_progress text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_progress_maintenance_position(p_request_id uuid, p_session_position_id uuid, p_progress text) TO service_role;


--
-- Name: FUNCTION garden_record_cycle_fact(p_request_id uuid, p_grow_cycle_id uuid, p_fact_type text, p_occurred_on date, p_note text, p_fact_data jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_record_cycle_fact(p_request_id uuid, p_grow_cycle_id uuid, p_fact_type text, p_occurred_on date, p_note text, p_fact_data jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_record_cycle_fact(p_request_id uuid, p_grow_cycle_id uuid, p_fact_type text, p_occurred_on date, p_note text, p_fact_data jsonb) TO anon;
GRANT ALL ON FUNCTION public.garden_record_cycle_fact(p_request_id uuid, p_grow_cycle_id uuid, p_fact_type text, p_occurred_on date, p_note text, p_fact_data jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.garden_record_cycle_fact(p_request_id uuid, p_grow_cycle_id uuid, p_fact_type text, p_occurred_on date, p_note text, p_fact_data jsonb) TO service_role;


--
-- Name: FUNCTION garden_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_note text) TO anon;
GRANT ALL ON FUNCTION public.garden_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_note text) TO service_role;


--
-- Name: FUNCTION garden_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_occurred_on date, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_occurred_on date, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_occurred_on date, p_note text) TO anon;
GRANT ALL ON FUNCTION public.garden_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_occurred_on date, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_occurred_on date, p_note text) TO service_role;


--
-- Name: FUNCTION garden_reopen_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_reopen_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_reopen_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_reason text) TO anon;
GRANT ALL ON FUNCTION public.garden_reopen_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_reopen_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_reason text) TO service_role;


--
-- Name: FUNCTION garden_replace_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_crop_name text, p_planted_on date, p_planted_on_precision text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_replace_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_crop_name text, p_planted_on date, p_planted_on_precision text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_replace_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_crop_name text, p_planted_on date, p_planted_on_precision text) TO anon;
GRANT ALL ON FUNCTION public.garden_replace_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_crop_name text, p_planted_on date, p_planted_on_precision text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_replace_cycle(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_crop_name text, p_planted_on date, p_planted_on_precision text) TO service_role;


--
-- Name: FUNCTION garden_review_import_candidate(p_request_id uuid, p_candidate_id uuid, p_decision text, p_decision_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_review_import_candidate(p_request_id uuid, p_candidate_id uuid, p_decision text, p_decision_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_review_import_candidate(p_request_id uuid, p_candidate_id uuid, p_decision text, p_decision_note text) TO anon;
GRANT ALL ON FUNCTION public.garden_review_import_candidate(p_request_id uuid, p_candidate_id uuid, p_decision text, p_decision_note text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_review_import_candidate(p_request_id uuid, p_candidate_id uuid, p_decision text, p_decision_note text) TO service_role;


--
-- Name: FUNCTION garden_revoke_guest_garden_story(p_request_id uuid, p_story_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_revoke_guest_garden_story(p_request_id uuid, p_story_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_revoke_guest_garden_story(p_request_id uuid, p_story_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_revoke_guest_garden_story(p_request_id uuid, p_story_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_revoke_guest_garden_story(p_request_id uuid, p_story_id uuid) TO service_role;


--
-- Name: FUNCTION garden_revoke_guest_plant_story(p_request_id uuid, p_story_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_revoke_guest_plant_story(p_request_id uuid, p_story_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_revoke_guest_plant_story(p_request_id uuid, p_story_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_revoke_guest_plant_story(p_request_id uuid, p_story_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_revoke_guest_plant_story(p_request_id uuid, p_story_id uuid) TO service_role;


--
-- Name: FUNCTION garden_set_cycle_cover(p_request_id uuid, p_grow_cycle_id uuid, p_photo_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_set_cycle_cover(p_request_id uuid, p_grow_cycle_id uuid, p_photo_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_set_cycle_cover(p_request_id uuid, p_grow_cycle_id uuid, p_photo_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_set_cycle_cover(p_request_id uuid, p_grow_cycle_id uuid, p_photo_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_set_cycle_cover(p_request_id uuid, p_grow_cycle_id uuid, p_photo_id uuid) TO service_role;


--
-- Name: FUNCTION garden_set_garden_cover(p_request_id uuid, p_garden_id uuid, p_photo_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_set_garden_cover(p_request_id uuid, p_garden_id uuid, p_photo_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_set_garden_cover(p_request_id uuid, p_garden_id uuid, p_photo_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_set_garden_cover(p_request_id uuid, p_garden_id uuid, p_photo_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_set_garden_cover(p_request_id uuid, p_garden_id uuid, p_photo_id uuid) TO service_role;


--
-- Name: FUNCTION garden_set_home_headline(p_request_id uuid, p_home_headline text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_set_home_headline(p_request_id uuid, p_home_headline text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_set_home_headline(p_request_id uuid, p_home_headline text) TO anon;
GRANT ALL ON FUNCTION public.garden_set_home_headline(p_request_id uuid, p_home_headline text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_set_home_headline(p_request_id uuid, p_home_headline text) TO service_role;


--
-- Name: FUNCTION garden_set_home_hero(p_request_id uuid, p_photo_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_set_home_hero(p_request_id uuid, p_photo_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_set_home_hero(p_request_id uuid, p_photo_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_set_home_hero(p_request_id uuid, p_photo_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_set_home_hero(p_request_id uuid, p_photo_id uuid) TO service_role;


--
-- Name: FUNCTION garden_set_maintenance_session_state(p_request_id uuid, p_session_id uuid, p_state text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_set_maintenance_session_state(p_request_id uuid, p_session_id uuid, p_state text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_set_maintenance_session_state(p_request_id uuid, p_session_id uuid, p_state text) TO anon;
GRANT ALL ON FUNCTION public.garden_set_maintenance_session_state(p_request_id uuid, p_session_id uuid, p_state text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_set_maintenance_session_state(p_request_id uuid, p_session_id uuid, p_state text) TO service_role;


--
-- Name: FUNCTION garden_start_cycle(p_request_id uuid, p_position_id uuid, p_crop_name text, p_planted_on date, p_planted_on_precision text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_start_cycle(p_request_id uuid, p_position_id uuid, p_crop_name text, p_planted_on date, p_planted_on_precision text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_start_cycle(p_request_id uuid, p_position_id uuid, p_crop_name text, p_planted_on date, p_planted_on_precision text) TO anon;
GRANT ALL ON FUNCTION public.garden_start_cycle(p_request_id uuid, p_position_id uuid, p_crop_name text, p_planted_on date, p_planted_on_precision text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_start_cycle(p_request_id uuid, p_position_id uuid, p_crop_name text, p_planted_on date, p_planted_on_precision text) TO service_role;


--
-- Name: FUNCTION garden_start_maintenance_session(p_request_id uuid, p_garden_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_start_maintenance_session(p_request_id uuid, p_garden_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_start_maintenance_session(p_request_id uuid, p_garden_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.garden_start_maintenance_session(p_request_id uuid, p_garden_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.garden_start_maintenance_session(p_request_id uuid, p_garden_ids uuid[]) TO service_role;


--
-- Name: FUNCTION garden_update_garden_name(p_request_id uuid, p_garden_id uuid, p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_update_garden_name(p_request_id uuid, p_garden_id uuid, p_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_update_garden_name(p_request_id uuid, p_garden_id uuid, p_name text) TO anon;
GRANT ALL ON FUNCTION public.garden_update_garden_name(p_request_id uuid, p_garden_id uuid, p_name text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_update_garden_name(p_request_id uuid, p_garden_id uuid, p_name text) TO service_role;


--
-- Name: FUNCTION garden_update_import_candidate(p_request_id uuid, p_candidate_id uuid, p_grow_cycle_id uuid, p_occurred_on date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_update_import_candidate(p_request_id uuid, p_candidate_id uuid, p_grow_cycle_id uuid, p_occurred_on date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_update_import_candidate(p_request_id uuid, p_candidate_id uuid, p_grow_cycle_id uuid, p_occurred_on date) TO anon;
GRANT ALL ON FUNCTION public.garden_update_import_candidate(p_request_id uuid, p_candidate_id uuid, p_grow_cycle_id uuid, p_occurred_on date) TO authenticated;
GRANT ALL ON FUNCTION public.garden_update_import_candidate(p_request_id uuid, p_candidate_id uuid, p_grow_cycle_id uuid, p_occurred_on date) TO service_role;


--
-- Name: FUNCTION garden_update_layout_site(p_request_id uuid, p_site_id uuid, p_grid_x integer, p_grid_y integer, p_site_kind text, p_active boolean, p_label text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_update_layout_site(p_request_id uuid, p_site_id uuid, p_grid_x integer, p_grid_y integer, p_site_kind text, p_active boolean, p_label text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_update_layout_site(p_request_id uuid, p_site_id uuid, p_grid_x integer, p_grid_y integer, p_site_kind text, p_active boolean, p_label text) TO anon;
GRANT ALL ON FUNCTION public.garden_update_layout_site(p_request_id uuid, p_site_id uuid, p_grid_x integer, p_grid_y integer, p_site_kind text, p_active boolean, p_label text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_update_layout_site(p_request_id uuid, p_site_id uuid, p_grid_x integer, p_grid_y integer, p_site_kind text, p_active boolean, p_label text) TO service_role;


--
-- Name: FUNCTION garden_x_create_custom_system(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_definition_id uuid, p_name text, p_levels jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_create_custom_system(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_definition_id uuid, p_name text, p_levels jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_create_custom_system(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_definition_id uuid, p_name text, p_levels jsonb) TO anon;
GRANT ALL ON FUNCTION public.garden_x_create_custom_system(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_definition_id uuid, p_name text, p_levels jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_create_custom_system(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_definition_id uuid, p_name text, p_levels jsonb) TO service_role;


--
-- Name: FUNCTION garden_x_create_garden(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_name text, p_kind text, p_place text, p_note text, p_system_definition_key text, p_system_name text, p_position_capacity integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_create_garden(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_name text, p_kind text, p_place text, p_note text, p_system_definition_key text, p_system_name text, p_position_capacity integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_create_garden(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_name text, p_kind text, p_place text, p_note text, p_system_definition_key text, p_system_name text, p_position_capacity integer) TO anon;
GRANT ALL ON FUNCTION public.garden_x_create_garden(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_name text, p_kind text, p_place text, p_note text, p_system_definition_key text, p_system_name text, p_position_capacity integer) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_create_garden(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_name text, p_kind text, p_place text, p_note text, p_system_definition_key text, p_system_name text, p_position_capacity integer) TO service_role;


--
-- Name: FUNCTION garden_x_create_journal_moment(p_request_id uuid, p_grow_cycle_id uuid, p_occurred_on date, p_note text, p_milestone text, p_has_photo boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_create_journal_moment(p_request_id uuid, p_grow_cycle_id uuid, p_occurred_on date, p_note text, p_milestone text, p_has_photo boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_create_journal_moment(p_request_id uuid, p_grow_cycle_id uuid, p_occurred_on date, p_note text, p_milestone text, p_has_photo boolean) TO anon;
GRANT ALL ON FUNCTION public.garden_x_create_journal_moment(p_request_id uuid, p_grow_cycle_id uuid, p_occurred_on date, p_note text, p_milestone text, p_has_photo boolean) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_create_journal_moment(p_request_id uuid, p_grow_cycle_id uuid, p_occurred_on date, p_note text, p_milestone text, p_has_photo boolean) TO service_role;


--
-- Name: FUNCTION garden_x_create_library_plant(p_request_id uuid, p_plant_instance_id uuid, p_position_id uuid, p_library_plant_id text, p_nickname text, p_planted_on date, p_planted_on_precision text, p_origin_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_create_library_plant(p_request_id uuid, p_plant_instance_id uuid, p_position_id uuid, p_library_plant_id text, p_nickname text, p_planted_on date, p_planted_on_precision text, p_origin_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_create_library_plant(p_request_id uuid, p_plant_instance_id uuid, p_position_id uuid, p_library_plant_id text, p_nickname text, p_planted_on date, p_planted_on_precision text, p_origin_type text) TO anon;
GRANT ALL ON FUNCTION public.garden_x_create_library_plant(p_request_id uuid, p_plant_instance_id uuid, p_position_id uuid, p_library_plant_id text, p_nickname text, p_planted_on date, p_planted_on_precision text, p_origin_type text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_create_library_plant(p_request_id uuid, p_plant_instance_id uuid, p_position_id uuid, p_library_plant_id text, p_nickname text, p_planted_on date, p_planted_on_precision text, p_origin_type text) TO service_role;


--
-- Name: FUNCTION garden_x_create_observation(p_request_id uuid, p_grow_cycle_id uuid, p_occurred_on date, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_create_observation(p_request_id uuid, p_grow_cycle_id uuid, p_occurred_on date, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_create_observation(p_request_id uuid, p_grow_cycle_id uuid, p_occurred_on date, p_note text) TO anon;
GRANT ALL ON FUNCTION public.garden_x_create_observation(p_request_id uuid, p_grow_cycle_id uuid, p_occurred_on date, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_create_observation(p_request_id uuid, p_grow_cycle_id uuid, p_occurred_on date, p_note text) TO service_role;


--
-- Name: FUNCTION garden_x_create_plant(p_request_id uuid, p_plant_instance_id uuid, p_position_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text, p_planted_on date, p_planted_on_precision text, p_origin_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_create_plant(p_request_id uuid, p_plant_instance_id uuid, p_position_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text, p_planted_on date, p_planted_on_precision text, p_origin_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_create_plant(p_request_id uuid, p_plant_instance_id uuid, p_position_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text, p_planted_on date, p_planted_on_precision text, p_origin_type text) TO anon;
GRANT ALL ON FUNCTION public.garden_x_create_plant(p_request_id uuid, p_plant_instance_id uuid, p_position_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text, p_planted_on date, p_planted_on_precision text, p_origin_type text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_create_plant(p_request_id uuid, p_plant_instance_id uuid, p_position_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text, p_planted_on date, p_planted_on_precision text, p_origin_type text) TO service_role;


--
-- Name: FUNCTION garden_x_delete_garden(p_request_id uuid, p_garden_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_delete_garden(p_request_id uuid, p_garden_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_delete_garden(p_request_id uuid, p_garden_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_x_delete_garden(p_request_id uuid, p_garden_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_delete_garden(p_request_id uuid, p_garden_id uuid) TO service_role;


--
-- Name: FUNCTION garden_x_delete_photo(p_request_id uuid, p_photo_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_delete_photo(p_request_id uuid, p_photo_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_delete_photo(p_request_id uuid, p_photo_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_x_delete_photo(p_request_id uuid, p_photo_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_delete_photo(p_request_id uuid, p_photo_id uuid) TO service_role;


--
-- Name: FUNCTION garden_x_get_bootstrap(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_get_bootstrap() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_get_bootstrap() TO anon;
GRANT ALL ON FUNCTION public.garden_x_get_bootstrap() TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_get_bootstrap() TO service_role;


--
-- Name: FUNCTION garden_x_get_historical_photos(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_get_historical_photos() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_get_historical_photos() TO anon;
GRANT ALL ON FUNCTION public.garden_x_get_historical_photos() TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_get_historical_photos() TO service_role;


--
-- Name: FUNCTION garden_x_get_saved_films(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_get_saved_films() FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_get_saved_films() TO anon;
GRANT ALL ON FUNCTION public.garden_x_get_saved_films() TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_get_saved_films() TO service_role;


--
-- Name: FUNCTION garden_x_move_plant(p_request_id uuid, p_plant_instance_id uuid, p_target_position_id uuid, p_moved_on date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_move_plant(p_request_id uuid, p_plant_instance_id uuid, p_target_position_id uuid, p_moved_on date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_move_plant(p_request_id uuid, p_plant_instance_id uuid, p_target_position_id uuid, p_moved_on date) TO anon;
GRANT ALL ON FUNCTION public.garden_x_move_plant(p_request_id uuid, p_plant_instance_id uuid, p_target_position_id uuid, p_moved_on date) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_move_plant(p_request_id uuid, p_plant_instance_id uuid, p_target_position_id uuid, p_moved_on date) TO service_role;


--
-- Name: FUNCTION garden_x_prepare_event_photo(p_photo_id uuid, p_event_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint, p_captured_at timestamp with time zone, p_captured_at_precision text, p_checksum_sha256 text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_prepare_event_photo(p_photo_id uuid, p_event_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint, p_captured_at timestamp with time zone, p_captured_at_precision text, p_checksum_sha256 text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_prepare_event_photo(p_photo_id uuid, p_event_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint, p_captured_at timestamp with time zone, p_captured_at_precision text, p_checksum_sha256 text) TO anon;
GRANT ALL ON FUNCTION public.garden_x_prepare_event_photo(p_photo_id uuid, p_event_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint, p_captured_at timestamp with time zone, p_captured_at_precision text, p_checksum_sha256 text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_prepare_event_photo(p_photo_id uuid, p_event_id uuid, p_original_filename text, p_content_type text, p_byte_size bigint, p_captured_at timestamp with time zone, p_captured_at_precision text, p_checksum_sha256 text) TO service_role;


--
-- Name: FUNCTION garden_x_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_occurred_on date, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_occurred_on date, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_occurred_on date, p_note text) TO anon;
GRANT ALL ON FUNCTION public.garden_x_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_occurred_on date, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_record_harvest(p_request_id uuid, p_grow_cycle_id uuid, p_expected_revision integer, p_occurred_on date, p_note text) TO service_role;


--
-- Name: FUNCTION garden_x_record_system_maintenance(p_request_id uuid, p_garden_id uuid, p_action text, p_occurred_on date, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_record_system_maintenance(p_request_id uuid, p_garden_id uuid, p_action text, p_occurred_on date, p_note text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_record_system_maintenance(p_request_id uuid, p_garden_id uuid, p_action text, p_occurred_on date, p_note text) TO anon;
GRANT ALL ON FUNCTION public.garden_x_record_system_maintenance(p_request_id uuid, p_garden_id uuid, p_action text, p_occurred_on date, p_note text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_record_system_maintenance(p_request_id uuid, p_garden_id uuid, p_action text, p_occurred_on date, p_note text) TO service_role;


--
-- Name: FUNCTION garden_x_reorder_gardens(p_request_id uuid, p_garden_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_reorder_gardens(p_request_id uuid, p_garden_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_reorder_gardens(p_request_id uuid, p_garden_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.garden_x_reorder_gardens(p_request_id uuid, p_garden_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_reorder_gardens(p_request_id uuid, p_garden_ids uuid[]) TO service_role;


--
-- Name: FUNCTION garden_x_replace_library_plant(p_request_id uuid, p_old_plant_instance_id uuid, p_new_plant_instance_id uuid, p_nickname text, p_library_plant_id text, p_started_on date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_replace_library_plant(p_request_id uuid, p_old_plant_instance_id uuid, p_new_plant_instance_id uuid, p_nickname text, p_library_plant_id text, p_started_on date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_replace_library_plant(p_request_id uuid, p_old_plant_instance_id uuid, p_new_plant_instance_id uuid, p_nickname text, p_library_plant_id text, p_started_on date) TO anon;
GRANT ALL ON FUNCTION public.garden_x_replace_library_plant(p_request_id uuid, p_old_plant_instance_id uuid, p_new_plant_instance_id uuid, p_nickname text, p_library_plant_id text, p_started_on date) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_replace_library_plant(p_request_id uuid, p_old_plant_instance_id uuid, p_new_plant_instance_id uuid, p_nickname text, p_library_plant_id text, p_started_on date) TO service_role;


--
-- Name: FUNCTION garden_x_replace_plant(p_request_id uuid, p_old_plant_instance_id uuid, p_new_plant_instance_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text, p_started_on date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_replace_plant(p_request_id uuid, p_old_plant_instance_id uuid, p_new_plant_instance_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text, p_started_on date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_replace_plant(p_request_id uuid, p_old_plant_instance_id uuid, p_new_plant_instance_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text, p_started_on date) TO anon;
GRANT ALL ON FUNCTION public.garden_x_replace_plant(p_request_id uuid, p_old_plant_instance_id uuid, p_new_plant_instance_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text, p_started_on date) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_replace_plant(p_request_id uuid, p_old_plant_instance_id uuid, p_new_plant_instance_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text, p_started_on date) TO service_role;


--
-- Name: FUNCTION garden_x_save_film(p_request_id uuid, p_film_id uuid, p_plant_instance_id uuid, p_title text, p_photo_ids uuid[], p_music text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_save_film(p_request_id uuid, p_film_id uuid, p_plant_instance_id uuid, p_title text, p_photo_ids uuid[], p_music text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_save_film(p_request_id uuid, p_film_id uuid, p_plant_instance_id uuid, p_title text, p_photo_ids uuid[], p_music text) TO anon;
GRANT ALL ON FUNCTION public.garden_x_save_film(p_request_id uuid, p_film_id uuid, p_plant_instance_id uuid, p_title text, p_photo_ids uuid[], p_music text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_save_film(p_request_id uuid, p_film_id uuid, p_plant_instance_id uuid, p_title text, p_photo_ids uuid[], p_music text) TO service_role;


--
-- Name: FUNCTION garden_x_set_custom_system_photo(p_request_id uuid, p_definition_id uuid, p_photo_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_set_custom_system_photo(p_request_id uuid, p_definition_id uuid, p_photo_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_set_custom_system_photo(p_request_id uuid, p_definition_id uuid, p_photo_id uuid) TO anon;
GRANT ALL ON FUNCTION public.garden_x_set_custom_system_photo(p_request_id uuid, p_definition_id uuid, p_photo_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_set_custom_system_photo(p_request_id uuid, p_definition_id uuid, p_photo_id uuid) TO service_role;


--
-- Name: FUNCTION garden_x_sync_library_catalog(p_catalog jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_sync_library_catalog(p_catalog jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_sync_library_catalog(p_catalog jsonb) TO anon;
GRANT ALL ON FUNCTION public.garden_x_sync_library_catalog(p_catalog jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_sync_library_catalog(p_catalog jsonb) TO service_role;


--
-- Name: FUNCTION garden_x_update_custom_system_layout(p_request_id uuid, p_garden_id uuid, p_levels jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_update_custom_system_layout(p_request_id uuid, p_garden_id uuid, p_levels jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_update_custom_system_layout(p_request_id uuid, p_garden_id uuid, p_levels jsonb) TO anon;
GRANT ALL ON FUNCTION public.garden_x_update_custom_system_layout(p_request_id uuid, p_garden_id uuid, p_levels jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_update_custom_system_layout(p_request_id uuid, p_garden_id uuid, p_levels jsonb) TO service_role;


--
-- Name: FUNCTION garden_x_update_garden_settings(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_name text, p_kind text, p_place text, p_note text, p_system_name text, p_archived boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_update_garden_settings(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_name text, p_kind text, p_place text, p_note text, p_system_name text, p_archived boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_update_garden_settings(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_name text, p_kind text, p_place text, p_note text, p_system_name text, p_archived boolean) TO anon;
GRANT ALL ON FUNCTION public.garden_x_update_garden_settings(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_name text, p_kind text, p_place text, p_note text, p_system_name text, p_archived boolean) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_update_garden_settings(p_request_id uuid, p_garden_id uuid, p_system_instance_id uuid, p_name text, p_kind text, p_place text, p_note text, p_system_name text, p_archived boolean) TO service_role;


--
-- Name: FUNCTION garden_x_update_library_plant_identity(p_request_id uuid, p_plant_instance_id uuid, p_nickname text, p_library_plant_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_update_library_plant_identity(p_request_id uuid, p_plant_instance_id uuid, p_nickname text, p_library_plant_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_update_library_plant_identity(p_request_id uuid, p_plant_instance_id uuid, p_nickname text, p_library_plant_id text) TO anon;
GRANT ALL ON FUNCTION public.garden_x_update_library_plant_identity(p_request_id uuid, p_plant_instance_id uuid, p_nickname text, p_library_plant_id text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_update_library_plant_identity(p_request_id uuid, p_plant_instance_id uuid, p_nickname text, p_library_plant_id text) TO service_role;


--
-- Name: FUNCTION garden_x_update_plant_identity(p_request_id uuid, p_plant_instance_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.garden_x_update_plant_identity(p_request_id uuid, p_plant_instance_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.garden_x_update_plant_identity(p_request_id uuid, p_plant_instance_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text) TO anon;
GRANT ALL ON FUNCTION public.garden_x_update_plant_identity(p_request_id uuid, p_plant_instance_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text) TO authenticated;
GRANT ALL ON FUNCTION public.garden_x_update_plant_identity(p_request_id uuid, p_plant_instance_id uuid, p_nickname text, p_common_name text, p_scientific_name text, p_cultivar text, p_reference_key text) TO service_role;


--
-- Name: FUNCTION gardenpedia_research_begin(p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gardenpedia_research_begin(p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.gardenpedia_research_begin(p_request_id uuid) TO anon;
GRANT ALL ON FUNCTION public.gardenpedia_research_begin(p_request_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.gardenpedia_research_begin(p_request_id uuid) TO service_role;


--
-- Name: FUNCTION gardenpedia_research_failed(p_request_id uuid, p_error text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gardenpedia_research_failed(p_request_id uuid, p_error text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.gardenpedia_research_failed(p_request_id uuid, p_error text) TO anon;
GRANT ALL ON FUNCTION public.gardenpedia_research_failed(p_request_id uuid, p_error text) TO authenticated;
GRANT ALL ON FUNCTION public.gardenpedia_research_failed(p_request_id uuid, p_error text) TO service_role;


--
-- Name: FUNCTION gardenpedia_submit_proposal(p_request_id uuid, p_contract_name text, p_contract_version text, p_candidate_identity jsonb, p_proposed_data jsonb, p_evidence jsonb, p_confidence_status jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gardenpedia_submit_proposal(p_request_id uuid, p_contract_name text, p_contract_version text, p_candidate_identity jsonb, p_proposed_data jsonb, p_evidence jsonb, p_confidence_status jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.gardenpedia_submit_proposal(p_request_id uuid, p_contract_name text, p_contract_version text, p_candidate_identity jsonb, p_proposed_data jsonb, p_evidence jsonb, p_confidence_status jsonb) TO anon;
GRANT ALL ON FUNCTION public.gardenpedia_submit_proposal(p_request_id uuid, p_contract_name text, p_contract_version text, p_candidate_identity jsonb, p_proposed_data jsonb, p_evidence jsonb, p_confidence_status jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.gardenpedia_submit_proposal(p_request_id uuid, p_contract_name text, p_contract_version text, p_candidate_identity jsonb, p_proposed_data jsonb, p_evidence jsonb, p_confidence_status jsonb) TO service_role;


--
-- Name: TABLE ai_requests; Type: ACL; Schema: garden; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE garden.ai_requests TO authenticated;
GRANT ALL ON TABLE garden.ai_requests TO service_role;


-- Preserve the canonical queue boundary explicitly. No direct table access is
-- granted to PUBLIC, anon, or authenticated; backend/RPC paths remain intact.
ALTER TABLE garden.storage_cleanup_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE garden.storage_cleanup_queue FROM PUBLIC;
REVOKE ALL ON TABLE garden.storage_cleanup_queue FROM anon;
REVOKE ALL ON TABLE garden.storage_cleanup_queue FROM authenticated;


--
-- PostgreSQL database dump complete
--

\unrestrict M3r0BjXnhdIizWaT84KvdCAfpBEG6B4Zbn4TTjEJwoKdQz8bnvAYcjdfPoaKRIy
