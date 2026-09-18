begin;
create temp table machine_performance_projection_check(ok boolean primary key default true);
do $$
declare v jsonb;
begin
  -- Unknown UUID must not leak another owner's data and must resolve to null.
  select public.garden_get_machine_performance(gen_random_uuid()) into v;
  if v is not null then raise exception 'Unknown garden projection must be null'; end if;
end $$;
insert into machine_performance_projection_check values(true);
select * from machine_performance_projection_check;
rollback;
