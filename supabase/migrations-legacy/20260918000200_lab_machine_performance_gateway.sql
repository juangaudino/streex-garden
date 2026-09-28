begin;
create or replace function public.garden_lab_service_get_machine_performance(p_owner uuid, p_garden_id uuid)
returns jsonb
language sql stable security definer set search_path=''
as $$
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
revoke all on function public.garden_lab_service_get_machine_performance(uuid,uuid) from public;
grant execute on function public.garden_lab_service_get_machine_performance(uuid,uuid) to service_role;
commit;