-- Record a Moment must use an unambiguous RPC when persisting a dated harvest.
-- The legacy garden_record_harvest overload remains for older callers, but
-- PostgREST overload resolution can otherwise select it and default occurred_at
-- to the ingestion time while the attached photo keeps the selected date.
begin;

create or replace function public.garden_x_record_harvest(
  p_request_id uuid,
  p_grow_cycle_id uuid,
  p_expected_revision integer,
  p_occurred_on date,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

revoke all on function public.garden_x_record_harvest(uuid, uuid, integer, date, text) from public;
grant execute on function public.garden_x_record_harvest(uuid, uuid, integer, date, text) to authenticated;

commit;
