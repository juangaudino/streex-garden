-- Keep benchmark audit costs owner-scoped without changing the existing finish RPC signature.
begin;

create or replace function public.garden_ai_record_cost(
  p_request_id uuid,
  p_estimated_cost_usd numeric
) returns void
language plpgsql
security definer
set search_path = ''
as $$
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

revoke all on function public.garden_ai_record_cost(uuid, numeric) from public, anon;
grant execute on function public.garden_ai_record_cost(uuid, numeric) to authenticated;

commit;
