-- Phase 5: the Product Contract sets 30 MB as the initial limit for a new
-- original. Keep any legacy record valid while enforcing the new limit for
-- all future writes both in Storage and in the private metadata table.
alter table garden.photos drop constraint if exists photos_byte_size_check;
alter table garden.photos add constraint photos_byte_size_check
  check (byte_size > 0 and byte_size <= 31457280) not valid;

update storage.buckets
set file_size_limit = 31457280
where id = 'garden-originals';
