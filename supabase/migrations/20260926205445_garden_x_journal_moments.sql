-- F1 Journal Entry: store optional structured milestone metadata on the
-- existing observation event. Photos continue through the existing event
-- attachment pipeline; no second timeline or photo store is introduced.
begin;

create or replace function public.garden_x_create_journal_moment(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_occurred_on date,
  p_note text default null,
  p_milestone text default null,
  p_has_photo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := public.garden_owner_id();
  v_payload jsonb;
  v_response jsonb;
  v_garden_id uuid;
  v_event_id uuid;
begin
  if v_owner is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_occurred_on is null then raise exception 'Moment date is required'; end if;
  if p_milestone is not null and p_milestone not in ('germinated', 'sprouted', 'flowering', 'fruiting', 'harvest') then
    raise exception 'Unsupported journal milestone';
  end if;
  if char_length(coalesce(trim(p_note), '')) > 1000 then raise exception 'Moment note is too long'; end if;
  if nullif(trim(p_note), '') is null and p_milestone is null and not coalesce(p_has_photo, false) then
    raise exception 'A moment needs a photo, note, or milestone';
  end if;

  v_payload := jsonb_build_object(
    'grow_cycle_id', p_grow_cycle_id,
    'occurred_on', p_occurred_on,
    'note', nullif(trim(p_note), ''),
    'milestone', p_milestone,
    'has_photo', coalesce(p_has_photo, false)
  );
  v_response := garden.command_response(v_owner, p_request_id, 'garden_x_create_journal_moment', v_payload);
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
    v_owner,
    v_garden_id,
    p_grow_cycle_id,
    'observation',
    (p_occurred_on::timestamp + interval '12 hours') at time zone 'UTC',
    nullif(trim(p_note), ''),
    jsonb_build_object(
      'source', 'garden_x_journal',
      'occurred_on', p_occurred_on,
      'occurred_at_precision', 'date',
      'journal_milestone', p_milestone,
      'photo_expected', coalesce(p_has_photo, false)
    )
  )
  returning id into v_event_id;

  v_response := jsonb_build_object('event_id', v_event_id);
  perform garden.store_command_response(v_owner, p_request_id, 'garden_x_create_journal_moment', v_payload, v_response);
  return v_response;
end;
$$;

revoke all on function public.garden_x_create_journal_moment(uuid, uuid, date, text, text, boolean) from public;
grant execute on function public.garden_x_create_journal_moment(uuid, uuid, date, text, text, boolean) to authenticated;

commit;
