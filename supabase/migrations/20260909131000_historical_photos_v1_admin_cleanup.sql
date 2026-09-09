-- Retire the temporary privileged bridge after Historical Photos v1 import.
begin;
drop function if exists public.garden_prepare_historical_photo_admin(uuid, text, uuid, text, text, text, text, text, bigint, timestamptz, text, text, jsonb);
drop function if exists public.garden_mark_historical_photo_uploaded_admin(uuid, uuid, text, integer, integer);
commit;
