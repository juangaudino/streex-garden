-- Garden Media V1 keeps the browser on the authenticated RPC path and the
-- media gateway on the server-controlled R2 path. These functions still
-- require auth.uid(), but anonymous EXECUTE is no longer needed.
REVOKE ALL ON FUNCTION public.garden_x_prepare_event_photo(uuid, uuid, text, text, bigint, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garden_x_prepare_event_photo(uuid, uuid, text, text, bigint, timestamptz, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.garden_x_delete_photo(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garden_x_delete_photo(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.garden_x_delete_garden(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.garden_x_delete_garden(uuid, uuid) TO authenticated, service_role;

-- Finalization is server-only. Revoke PUBLIC explicitly because revoking
-- only from anon/authenticated would leave the default PUBLIC EXECUTE path.
REVOKE ALL ON FUNCTION public.garden_mark_photo_uploaded(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garden_mark_photo_uploaded(uuid, text, integer, integer) TO service_role;
