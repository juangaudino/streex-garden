-- Run after 20260907115658_phase5_photo_sync_limit.sql.
-- Expected: 30 MB in both rows; the metadata constraint is present and
-- validated=false so legacy records are retained while new writes are checked.
select
  (select file_size_limit from storage.buckets where id = 'garden-originals') as bucket_limit_bytes,
  (select convalidated from pg_constraint where conrelid = 'garden.photos'::regclass and conname = 'photos_byte_size_check') as metadata_constraint_validated;
