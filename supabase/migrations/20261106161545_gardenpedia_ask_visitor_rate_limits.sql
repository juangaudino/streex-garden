-- Visitor Ask Garden quotas. Only hashed network fingerprints and bounded
-- counters are stored; question text and model responses are never persisted.
create table garden.gardenpedia_ask_rate_limits (
  bucket_kind text not null check (bucket_kind in ('ip_hour', 'ip_day', 'global_day')),
  subject_hash text not null,
  window_start timestamptz not null,
  request_count smallint not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (bucket_kind, subject_hash, window_start)
);

create index gardenpedia_ask_rate_limits_window_start_idx
  on garden.gardenpedia_ask_rate_limits (window_start);

alter table garden.gardenpedia_ask_rate_limits enable row level security;
revoke all on table garden.gardenpedia_ask_rate_limits from public, anon, authenticated;
grant usage on schema garden to service_role;
grant select, insert, update, delete on table garden.gardenpedia_ask_rate_limits to service_role;

create or replace function public.gardenpedia_consume_visitor_quota(p_ip_fingerprint text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_hour timestamptz;
  v_day timestamptz;
  v_hour_count integer;
  v_ip_day_count integer;
  v_global_day_count integer;
  v_retry_after integer := 0;
begin
  if p_ip_fingerprint is null or p_ip_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid visitor fingerprint';
  end if;

  v_hour := date_trunc('hour', v_now at time zone 'UTC') at time zone 'UTC';
  v_day := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';

  delete from garden.gardenpedia_ask_rate_limits
  where window_start < v_day - interval '1 day';

  -- Once the site-wide LLM allowance is spent, avoid creating per-IP rows for
  -- further requests from new network addresses.
  select coalesce(max(request_count), 0)::integer
    into v_global_day_count
  from garden.gardenpedia_ask_rate_limits
  where bucket_kind = 'global_day'
    and subject_hash = 'global'
    and window_start = v_day;

  if v_global_day_count >= 150 then
    v_retry_after := ceil(extract(epoch from (v_day + interval '1 day' - v_now)))::integer;
    return jsonb_build_object(
      'allowed', false,
      'reason', 'site_daily_capacity',
      'hour_remaining', null,
      'day_remaining', null,
      'site_remaining', 0,
      'retry_after_seconds', greatest(1, v_retry_after)
    );
  end if;

  insert into garden.gardenpedia_ask_rate_limits as limits
    (bucket_kind, subject_hash, window_start, request_count)
  values ('ip_hour', p_ip_fingerprint, v_hour, 1)
  on conflict (bucket_kind, subject_hash, window_start) do update
    set request_count = least(limits.request_count + 1, 7),
        updated_at = v_now
  returning request_count into v_hour_count;

  insert into garden.gardenpedia_ask_rate_limits as limits
    (bucket_kind, subject_hash, window_start, request_count)
  values ('ip_day', p_ip_fingerprint, v_day, 1)
  on conflict (bucket_kind, subject_hash, window_start) do update
    set request_count = least(limits.request_count + 1, 21),
        updated_at = v_now
  returning request_count into v_ip_day_count;

  if v_hour_count > 6 or v_ip_day_count > 20 then
    v_retry_after := greatest(
      case when v_hour_count > 6
        then ceil(extract(epoch from (v_hour + interval '1 hour' - v_now)))::integer
        else 0 end,
      case when v_ip_day_count > 20
        then ceil(extract(epoch from (v_day + interval '1 day' - v_now)))::integer
        else 0 end
    );
    return jsonb_build_object(
      'allowed', false,
      'reason', case when v_ip_day_count > 20 then 'visitor_daily_limit' else 'visitor_hourly_limit' end,
      'hour_remaining', greatest(0, 6 - v_hour_count),
      'day_remaining', greatest(0, 20 - v_ip_day_count),
      'site_remaining', null,
      'retry_after_seconds', greatest(1, v_retry_after)
    );
  end if;

  insert into garden.gardenpedia_ask_rate_limits as limits
    (bucket_kind, subject_hash, window_start, request_count)
  values ('global_day', 'global', v_day, 1)
  on conflict (bucket_kind, subject_hash, window_start) do update
    set request_count = least(limits.request_count + 1, 151),
        updated_at = v_now
  returning request_count into v_global_day_count;

  if v_global_day_count > 150 then
    v_retry_after := ceil(extract(epoch from (v_day + interval '1 day' - v_now)))::integer;
    return jsonb_build_object(
      'allowed', false,
      'reason', 'site_daily_capacity',
      'hour_remaining', greatest(0, 6 - v_hour_count),
      'day_remaining', greatest(0, 20 - v_ip_day_count),
      'site_remaining', 0,
      'retry_after_seconds', greatest(1, v_retry_after)
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'hour_remaining', greatest(0, 6 - v_hour_count),
    'day_remaining', greatest(0, 20 - v_ip_day_count),
    'site_remaining', greatest(0, 150 - v_global_day_count),
    'retry_after_seconds', 0
  );
end;
$$;

revoke all on function public.gardenpedia_consume_visitor_quota(text) from public, anon, authenticated;
grant execute on function public.gardenpedia_consume_visitor_quota(text) to service_role;
