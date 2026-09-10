begin;

alter table garden.owner_settings add column if not exists home_headline text;
alter table garden.owner_settings drop constraint if exists owner_settings_home_headline_check;
alter table garden.owner_settings add constraint owner_settings_home_headline_check check (home_headline is null or char_length(trim(home_headline)) between 1 and 120);

create or replace function public.garden_set_home_headline(p_request_id uuid, p_home_headline text)
returns jsonb language plpgsql security definer set search_path = '' as $$
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

create or replace function public.garden_get_home_media()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'home_headline', coalesce(nullif(trim(s.home_headline), ''), 'Tu jardín, vivo.'),
    'home_hero_photo', case when ph.id is null then null else jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path, 'original_filename', ph.original_filename, 'content_type', ph.content_type, 'byte_size', ph.byte_size, 'checksum_sha256', ph.checksum_sha256, 'captured_at', ph.captured_at, 'captured_at_precision', ph.captured_at_precision, 'upload_status', ph.upload_status) end,
    'home_hero_choices', coalesce((select jsonb_agg(jsonb_build_object('id', choices.id, 'storage_path', choices.storage_path, 'original_filename', choices.original_filename, 'content_type', choices.content_type, 'byte_size', choices.byte_size, 'checksum_sha256', choices.checksum_sha256, 'captured_at', choices.captured_at, 'captured_at_precision', choices.captured_at_precision, 'upload_status', choices.upload_status) order by choices.created_at desc) from garden.photos choices where choices.owner_id = public.garden_owner_id() and choices.upload_status = 'uploaded' and choices.media_scope in ('home_hero','garden_cover','garden_general','cycle_evidence')), '[]'::jsonb)
  )
  from garden.owner_settings s left join garden.photos ph on ph.id = s.home_hero_photo_id and ph.owner_id = s.owner_id and ph.upload_status = 'uploaded'
  where s.owner_id = public.garden_owner_id();
$$;

create or replace function public.garden_update_garden_name(p_request_id uuid, p_garden_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
    'recent_changes', coalesce((select jsonb_agg(row_to_json(x) order by x.occurred_at desc) from (select e.id, e.grow_cycle_id, e.event_type, e.occurred_at, e.occurred_on, e.occurred_at_precision, e.event_data from garden.events e where e.owner_id = v_owner and e.invalidated_at is null order by e.occurred_at desc limit 30) x), '[]'::jsonb),
    'open_incidents', coalesce((select jsonb_agg(row_to_json(x) order by x.occurred_at desc) from (select e.id, e.grow_cycle_id, e.occurred_at, e.occurred_on, e.event_data from garden.events e where e.owner_id = v_owner and e.event_type = 'incident_opened' and e.invalidated_at is null and not exists (select 1 from garden.events r where r.owner_id=v_owner and r.event_type='incident_resolved' and r.invalidated_at is null and r.event_data->>'incident_event_id'=e.id::text)) x), '[]'::jsonb)
  );
end; $$;

create or replace function public.garden_get_ai_draft_cycle_context(p_grow_cycle_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_owner uuid := (select auth.uid()); v_context jsonb;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from garden.grow_cycles where id=p_grow_cycle_id and owner_id=v_owner) then raise exception 'Grow cycle not found'; end if;
  v_context := garden.resolve_cycle_evidence(v_owner, p_grow_cycle_id, now(), '{}'::uuid[], '{}'::uuid[]);
  return v_context || jsonb_build_object('context_schema_version', 'garden_ai_context_v1', 'selected_photo', jsonb_build_object('id','ephemeral-photo','source','pending_observation'));
end; $$;

revoke all on function public.garden_set_home_headline(uuid,text) from public, anon, service_role;
revoke all on function public.garden_update_garden_name(uuid,uuid,text) from public, anon, service_role;
revoke all on function public.garden_get_ai_ask_context() from public, anon, service_role;
revoke all on function public.garden_get_ai_draft_cycle_context(uuid) from public, anon, service_role;
revoke all on function public.garden_get_home_media() from public, anon, service_role;
grant execute on function public.garden_set_home_headline(uuid,text) to authenticated;
grant execute on function public.garden_update_garden_name(uuid,uuid,text) to authenticated;
grant execute on function public.garden_get_ai_ask_context() to authenticated;
grant execute on function public.garden_get_ai_draft_cycle_context(uuid) to authenticated;
grant execute on function public.garden_get_home_media() to authenticated;
-- Runtime v2 records the instruction-bearing prompt version while preserving the approved standard.
create or replace function public.garden_ai_start_request(p_request_key text, p_request_type text, p_evidence_refs jsonb, p_proposal_schema_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := (select auth.uid()); v_row garden.ai_requests;
begin
  if v_owner is null then raise exception 'Authentication required'; end if;
  if p_request_key is null or length(trim(p_request_key)) < 16 or length(trim(p_request_key)) > 160 then raise exception 'Invalid request key'; end if;
  if p_request_type not in ('ai_check', 'ask_garden') then raise exception 'Invalid request type'; end if;
  insert into garden.ai_requests(owner_id, request_key, request_type, evidence_refs, status, garden_ai_standard_version, context_schema_version, proposal_schema_version, prompt_version, provider_adapter_version)
  values (v_owner, trim(p_request_key), p_request_type, coalesce(p_evidence_refs, '[]'::jsonb), 'started', 'garden_ai_standard_v1', 'garden_ai_context_v1', coalesce(nullif(trim(p_proposal_schema_version), ''), 'garden_ai_ask_v1'), 'garden_ai_runtime_v2', 'openai_responses_v1')
  on conflict (owner_id, request_key) do nothing;
  select * into v_row from garden.ai_requests where owner_id=v_owner and request_key=trim(p_request_key);
  return jsonb_build_object('id',v_row.id,'status',v_row.status,'proposal',v_row.proposal,'model_identifier',v_row.model_identifier);
end; $$;
revoke all on function public.garden_ai_start_request(text,text,jsonb,text) from public, anon, service_role;
grant execute on function public.garden_ai_start_request(text,text,jsonb,text) to authenticated;

commit;
