-- Garden X V1 — additive core identity/system foundation
-- Safe structural migration only. No production baseline data is moved or backfilled here.
begin;

create table if not exists garden.system_instances (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  garden_id uuid not null references garden.gardens(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  system_definition_key text,
  legacy_system_model text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists system_instances_owner_garden
  on garden.system_instances(owner_id, garden_id);
alter table garden.system_instances enable row level security;
drop policy if exists "owners read their system instances" on garden.system_instances;
create policy "owners read their system instances"
  on garden.system_instances for select to authenticated
  using ((select auth.uid()) = owner_id);

alter table garden.positions
  add column if not exists system_instance_id uuid
    references garden.system_instances(id) on delete restrict;
create index if not exists positions_system_instance
  on garden.positions(system_instance_id, position_number);

create table if not exists garden.plant_instances (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  nickname text,
  reference_key text,
  common_name text not null check (char_length(trim(common_name)) between 1 and 100),
  scientific_name text,
  cultivar text,
  status text not null default 'active' check (status in ('active','dormant','ended','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nickname is null or char_length(trim(nickname)) between 1 and 100)
);
create index if not exists plant_instances_owner_status
  on garden.plant_instances(owner_id, status);
alter table garden.plant_instances enable row level security;
drop policy if exists "owners read their plant instances" on garden.plant_instances;
create policy "owners read their plant instances"
  on garden.plant_instances for select to authenticated
  using ((select auth.uid()) = owner_id);

alter table garden.grow_cycles
  add column if not exists plant_instance_id uuid
    references garden.plant_instances(id) on delete restrict;
create index if not exists grow_cycles_plant_instance
  on garden.grow_cycles(plant_instance_id, created_at);

-- Layout remains operational under its legacy garden ownership during the compatibility phase.
-- This nullable link lets Garden X progressively bind geometry to a concrete system instance.
alter table garden.layout_sites
  add column if not exists system_instance_id uuid
    references garden.system_instances(id) on delete restrict;
create index if not exists layout_sites_system_instance
  on garden.layout_sites(system_instance_id, grid_y, grid_x);

comment on table garden.system_instances is
  'Concrete user-owned growing systems. Garden X V1 target: Garden -> System Instance -> Position.';
comment on table garden.plant_instances is
  'Persistent identity of one concrete plant, independent of position and grow-cycle history.';
comment on column garden.grow_cycles.plant_instance_id is
  'Additive Garden X V1 identity link. Nullable until explicit baseline migration/cutover.';
comment on column garden.positions.system_instance_id is
  'Additive Garden X V1 system link. Legacy garden_id remains during compatibility.';
comment on column garden.layout_sites.system_instance_id is
  'Additive Garden X V1 geometry ownership link. Legacy garden_id remains during compatibility.';

commit;
