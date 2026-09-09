-- Historical Photos v1 preparation only.
-- This migration is intentionally not applied by this task.
-- It extends the existing private originals model without creating events.
begin;

alter table garden.photos
  drop constraint if exists photos_media_scope_check;

alter table garden.photos
  add constraint photos_media_scope_check
  check (media_scope in ('cycle_evidence', 'garden_cover', 'garden_general', 'home_hero'));

alter table garden.photos
  add column if not exists import_version text,
  add column if not exists import_key text,
  add column if not exists import_provenance jsonb not null default '{}'::jsonb;

alter table garden.photos
  add constraint photos_import_identity_check
  check (
    (import_version is null and import_key is null)
    or (
      import_version is not null
      and char_length(trim(import_version)) between 1 and 80
      and import_key is not null
      and char_length(trim(import_key)) between 1 and 240
    )
  );

alter table garden.photos
  add constraint photos_import_provenance_object_check
  check (jsonb_typeof(import_provenance) = 'object');

create unique index if not exists photos_owner_import_identity
  on garden.photos(owner_id, import_version, import_key)
  where import_version is not null and import_key is not null;

create index if not exists photos_owner_import_version
  on garden.photos(owner_id, import_version)
  where import_version is not null;

create index if not exists photos_garden_general
  on garden.photos(owner_id, garden_id, created_at desc)
  where media_scope = 'garden_general';

commit;
