-- Garden Media V1: server-mediated authorization for new R2 media.
-- Historical photo rows, legacy cleanup rows, Auth, and Supabase Storage are
-- intentionally outside this migration.

CREATE OR REPLACE FUNCTION public.garden_media_authorize_photo(
  p_photo_id uuid,
  p_operation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, auth, garden
AS $$
DECLARE
  v_photo garden.photos%ROWTYPE;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_operation NOT IN ('upload', 'read', 'delete') THEN
    RAISE EXCEPTION 'Unsupported media operation' USING ERRCODE = '22023';
  END IF;

  SELECT p.*
  INTO v_photo
  FROM garden.photos AS p
  WHERE p.id = p_photo_id
    AND p.owner_id = v_user_id
    AND (
      p.garden_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM garden.gardens AS g
        WHERE g.id = p.garden_id
          AND g.owner_id = v_user_id
      )
    )
    AND (
      p.event_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM garden.events AS e
        JOIN garden.gardens AS eg ON eg.id = e.garden_id
        WHERE e.id = p.event_id
          AND eg.owner_id = v_user_id
      )
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Photo is not available to this user' USING ERRCODE = '42501';
  END IF;
  IF p_operation = 'upload' AND v_photo.upload_status <> 'pending' THEN
    RAISE EXCEPTION 'Photo is not pending upload' USING ERRCODE = '40901';
  END IF;
  IF p_operation = 'read' AND v_photo.upload_status <> 'uploaded' THEN
    RAISE EXCEPTION 'Photo media is not finalized' USING ERRCODE = '40901';
  END IF;
  IF p_operation = 'delete' AND v_photo.upload_status NOT IN ('pending', 'uploaded') THEN
    RAISE EXCEPTION 'Photo cannot be deleted in its current state' USING ERRCODE = '40901';
  END IF;

  RETURN jsonb_build_object(
    'photo_id', v_photo.id,
    'owner_id', v_photo.owner_id,
    'storage_path', v_photo.storage_path,
    'event_id', v_photo.event_id,
    'garden_id', v_photo.garden_id,
    'content_type', v_photo.content_type,
    'byte_size', v_photo.byte_size,
    'checksum_sha256', v_photo.checksum_sha256,
    'upload_status', v_photo.upload_status,
    'width', v_photo.width,
    'height', v_photo.height,
    'media_scope', v_photo.media_scope
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.garden_media_finalize_photo(
  p_photo_id uuid,
  p_checksum_sha256 text,
  p_width integer,
  p_height integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, auth, garden
AS $$
DECLARE
  v_photo garden.photos%ROWTYPE;
BEGIN
  IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_checksum_sha256 IS NULL OR p_checksum_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid photo checksum' USING ERRCODE = '22023';
  END IF;
  IF p_width IS NULL OR p_width < 1 OR p_height IS NULL OR p_height < 1 THEN
    RAISE EXCEPTION 'Invalid photo dimensions' USING ERRCODE = '22023';
  END IF;

  SELECT p.*
  INTO v_photo
  FROM garden.photos AS p
  WHERE p.id = p_photo_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Photo not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_photo.upload_status <> 'pending' THEN
    IF v_photo.upload_status = 'uploaded' AND v_photo.checksum_sha256 = p_checksum_sha256 THEN
      RETURN jsonb_build_object('photo_id', v_photo.id, 'upload_status', v_photo.upload_status);
    END IF;
    RAISE EXCEPTION 'Photo is not pending upload' USING ERRCODE = '40901';
  END IF;
  IF v_photo.checksum_sha256 IS DISTINCT FROM p_checksum_sha256 THEN
    RAISE EXCEPTION 'Photo checksum does not match canonical metadata' USING ERRCODE = '22023';
  END IF;

  UPDATE garden.photos
  SET upload_status = 'uploaded', width = p_width, height = p_height
  WHERE id = p_photo_id;

  RETURN jsonb_build_object(
    'photo_id', p_photo_id,
    'upload_status', 'uploaded',
    'width', p_width,
    'height', p_height
  );
END;
$$;

REVOKE ALL ON FUNCTION public.garden_media_authorize_photo(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.garden_media_authorize_photo(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.garden_media_authorize_photo(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.garden_media_finalize_photo(uuid, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.garden_media_finalize_photo(uuid, text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.garden_media_finalize_photo(uuid, text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.garden_media_finalize_photo(uuid, text, integer, integer) TO service_role;

-- Browser clients must no longer be able to finalize a photo directly.
REVOKE ALL ON FUNCTION public.garden_mark_photo_uploaded(uuid, text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garden_mark_photo_uploaded(uuid, text, integer, integer) TO service_role;
