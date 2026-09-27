import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import {
  inspectPhotoFolder,
  photoRenditionPath,
  selectBackfillPhotos,
} from "../_shared/photo-rendition-spec.mjs";
import {
  encodePhotoRendition,
  initializePhotoRenditionEncoder,
} from "../_shared/photo-rendition-image.ts";

const EXPECTED_PROJECT_REF = "sabulxbfdimoqnbgnmso";
const VERIFIED_OWNER_ID = "361520ad-09bf-4901-a391-871eeb704e37";
const BUCKET = "garden-originals";
const CONFIRMATION_ENV = "GARDEN_PHOTO_RENDITION_BACKFILL_CONFIRMATION";
const REQUIRED_CONFIRMATION =
  "run_user_zero_historical_photo_rendition_backfill";
const WEB_ORIGIN = "https://garden.getstreex.com";
const MAX_BATCH_SIZE = 3;
const DEFAULT_BATCH_SIZE = 1;
const MAX_MANIFEST_PHOTOS = 500;
const LIST_CONCURRENCY = 4;

type PhotoManifestEntry = {
  id: string;
  storage_path: string;
  upload_status: string;
  checksum_sha256?: string | null;
};

type InventoryEntry = {
  photo: PhotoManifestEntry;
  status: string;
  missingKinds?: string[];
  invalidKinds?: string[];
};
type GardenSupabaseClient = Pick<ReturnType<typeof createClient>, "storage">;

class BackfillFailure extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-garden-photo-backfill-confirmation",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  ...(origin === WEB_ORIGIN
    ? { "Access-Control-Allow-Origin": WEB_ORIGIN }
    : {}),
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  Vary: "Origin",
});

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

async function sameSecret(expected: string, supplied: string) {
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index]! ^ b[index]!;
  }
  return difference === 0;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  operation: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        results[index] = await operation(items[index]!);
      }
    }),
  );
  return results;
}

function parentPath(path: string) {
  return path.slice(0, path.lastIndexOf("/"));
}

function projectIsExpected(url: string) {
  try {
    return new URL(url).hostname === EXPECTED_PROJECT_REF + ".supabase.co";
  } catch {
    return false;
  }
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
  );
  return Array.from(
    new Uint8Array(digest),
    (value) => value.toString(16).padStart(2, "0"),
  ).join("");
}

async function refreshFolderInventory(
  adminClient: GardenSupabaseClient,
  photo: PhotoManifestEntry,
) {
  const { data, error } = await adminClient.storage.from(BUCKET).list(
    parentPath(photo.storage_path),
    {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    },
  );
  if (error) throw new BackfillFailure("storage_inventory_unavailable");
  return inspectPhotoFolder(photo, data ?? []);
}

async function uploadIfMissing(
  adminClient: GardenSupabaseClient,
  photo: PhotoManifestEntry,
  kind: string,
  bytes: Uint8Array,
) {
  const path = photoRenditionPath(photo.storage_path, kind);
  const { error } = await adminClient.storage.from(BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    cacheControl: "max-age=31536000, immutable",
    upsert: false,
  });
  if (!error) return;

  // A concurrent invocation may have created this exact sidecar. Never
  // overwrite it; accept the race only if Storage now reports a valid JPEG.
  const current = await refreshFolderInventory(adminClient, photo);
  if (
    current.status === "complete" ||
    (current.status === "needs_work" && !current.missingKinds?.includes(kind))
  ) return;
  throw new BackfillFailure(kind + "_upload_failed");
}

async function processPhoto(
  adminClient: GardenSupabaseClient,
  photo: PhotoManifestEntry,
  inventory: InventoryEntry,
) {
  if (inventory.status === "missing_original") {
    throw new BackfillFailure("original_missing");
  }
  if (inventory.status === "invalid_existing_rendition") {
    throw new BackfillFailure("existing_rendition_invalid_not_overwritten");
  }
  if (inventory.status !== "needs_work" || !inventory.missingKinds?.length) {
    throw new BackfillFailure("photo_not_eligible");
  }

  const { data: originalBlob, error } = await adminClient.storage.from(BUCKET)
    .download(photo.storage_path);
  if (error || !originalBlob) {
    throw new BackfillFailure("original_download_failed");
  }
  const original = new Uint8Array(await originalBlob.arrayBuffer());
  if (!original.byteLength) throw new BackfillFailure("original_empty");
  if (photo.checksum_sha256) {
    if (!/^[0-9a-f]{64}$/i.test(photo.checksum_sha256)) {
      throw new BackfillFailure("canonical_checksum_invalid");
    }
    if (
      (await sha256Hex(original)).toLowerCase() !==
        photo.checksum_sha256.toLowerCase()
    ) {
      throw new BackfillFailure("original_checksum_mismatch");
    }
  }

  await initializePhotoRenditionEncoder();
  const outputs = inventory.missingKinds.map((kind) => {
    try {
      return {
        kind,
        ...encodePhotoRendition(original, kind as "preview" | "display"),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("pixel limit")) {
        throw new BackfillFailure("image_exceeds_safe_pixel_limit");
      }
      if (error instanceof Error && error.message.includes("specification")) {
        throw new BackfillFailure("rendition_spec_missing");
      }
      if (error instanceof Error && error.message.includes("validation")) {
        throw new BackfillFailure("rendition_validation_failed");
      }
      throw new BackfillFailure("image_decode_or_encode_failed");
    }
  });

  // Do not write either object until every missing rendition has encoded and
  // validated. Partial Storage writes from transport failures remain resumable.
  for (const output of outputs) {
    await uploadIfMissing(adminClient, photo, output.kind, output.bytes);
  }
  const afterUpload = await refreshFolderInventory(adminClient, photo);
  if (afterUpload.status !== "complete") {
    throw new BackfillFailure("rendition_post_upload_validation_failed");
  }
  return outputs.map(({ kind, width, height, bytes }) => ({
    kind,
    width,
    height,
    bytes: bytes.byteLength,
  }));
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (origin && origin !== WEB_ORIGIN) {
    return json({ error: "origin_not_allowed" }, 403, origin);
  }
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, origin);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "authentication_required" }, 401, origin);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!projectIsExpected(supabaseUrl) || !anonKey || !serviceRoleKey) {
    return json(
      { error: "expected_project_or_server_configuration_unavailable" },
      503,
      origin,
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: userError } = await userClient.auth.getUser(
    token,
  );
  if (userError || userData.user?.id !== VERIFIED_OWNER_ID) {
    return json({ error: "verified_owner_only" }, 403, origin);
  }

  const configuredConfirmation = Deno.env.get(CONFIRMATION_ENV) ?? "";
  const suppliedConfirmation =
    request.headers.get("x-garden-photo-backfill-confirmation") ?? "";
  if (
    !configuredConfirmation ||
    !(await sameSecret(configuredConfirmation, suppliedConfirmation))
  ) {
    return json({ error: "administrative_confirmation_required" }, 403, origin);
  }

  let body: { action?: unknown; cursor?: unknown; limit?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ error: "invalid_request_body" }, 400, origin);
  }
  if (body.action !== REQUIRED_CONFIRMATION) {
    return json({ error: "explicit_backfill_action_required" }, 400, origin);
  }
  if (
    body.cursor !== undefined && body.cursor !== null && !isUuid(body.cursor)
  ) {
    return json({ error: "cursor_must_be_a_photo_uuid" }, 400, origin);
  }
  const limit = body.limit === undefined ? DEFAULT_BATCH_SIZE : body.limit;
  if (
    typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 ||
    limit > MAX_BATCH_SIZE
  ) {
    return json({ error: "limit_must_be_between_1_and_3" }, 400, origin);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as GardenSupabaseClient;
  try {
    // This narrow owner-scoped RPC returns only uploaded photo choices; unlike
    // the full owner export, it does not load unrelated gardens/events here.
    const { data: homeMedia, error: mediaError } = await userClient.rpc(
      "garden_get_home_media",
    );
    if (mediaError || !homeMedia || typeof homeMedia !== "object") {
      return json(
        { error: "owner_uploaded_photo_list_unavailable" },
        503,
        origin,
      );
    }
    const rawManifest =
      (homeMedia as Record<string, unknown>).home_hero_choices;
    const selected = selectBackfillPhotos(rawManifest, VERIFIED_OWNER_ID);
    if (selected.photos.length > MAX_MANIFEST_PHOTOS) {
      return json(
        { error: "owner_photo_manifest_exceeds_safe_scan_limit" },
        413,
        origin,
      );
    }

    // Scan only folders named by the owner-scoped canonical manifest. If any
    // listing fails, abort before writing any sidecars.
    const scanned = await mapWithConcurrency(
      selected.photos,
      LIST_CONCURRENCY,
      async (photo): Promise<InventoryEntry> => {
        const result = await refreshFolderInventory(adminClient, photo);
        return { photo, ...result };
      },
    );
    const candidates = scanned
      .filter((entry) => entry.status !== "complete")
      .sort((left, right) => left.photo.id.localeCompare(right.photo.id));
    const skipped = scanned.filter((entry) =>
      entry.status === "complete"
    ).length;
    const cursor = typeof body.cursor === "string"
      ? body.cursor.toLowerCase()
      : null;
    const afterCursor = cursor
      ? candidates.filter((entry) => entry.photo.id.localeCompare(cursor) > 0)
      : candidates;
    const batch = afterCursor.slice(0, limit);
    const failures: Array<{ photo_id: string; code: string }> = [];
    const completed: Array<{ photo_id: string; renditions: unknown[] }> = [];
    let nextCursor = cursor;

    for (const entry of batch) {
      try {
        const renditions = await processPhoto(adminClient, entry.photo, entry);
        completed.push({ photo_id: entry.photo.id, renditions });
        nextCursor = entry.photo.id;
      } catch (error) {
        failures.push({
          photo_id: entry.photo.id,
          code: error instanceof BackfillFailure
            ? error.code
            : "photo_processing_failed",
        });
        break;
      }
    }

    const remaining = Math.max(0, candidates.length - completed.length);
    const hasMoreAfterCursor = nextCursor
      ? candidates.some((entry) =>
        entry.photo.id.localeCompare(nextCursor!) > 0
      )
      : candidates.length > 0;
    return json(
      {
        inventory: {
          uploaded_manifest_photos: selected.photos.length,
          pending_filtered_by_owner_rpc: true,
          with_original: scanned.filter((entry) =>
            entry.status !== "missing_original"
          ).length,
          already_had_both_valid_renditions: skipped,
          missing_original: scanned.filter((entry) =>
            entry.status === "missing_original"
          ).length,
          invalid_existing_rendition: scanned.filter((entry) =>
            entry.status === "invalid_existing_rendition"
          ).length,
          needing_work_or_attention: candidates.length,
        },
        processed: completed.length,
        skipped,
        failed: failures.length,
        failures,
        remaining,
        next_cursor: nextCursor,
        has_more_after_cursor: hasMoreAfterCursor,
        restart_without_cursor_to_retry_earlier_failures: remaining > 0 &&
          !hasMoreAfterCursor,
        completed_photos: completed,
      },
      200,
      origin,
    );
  } catch (error) {
    const code = error instanceof BackfillFailure
      ? error.code
      : error instanceof Error && error.message.includes("fixed owner scope")
      ? "owner_manifest_scope_validation_failed"
      : error instanceof Error && error.message.includes("duplicate photo")
      ? "owner_manifest_duplicate_record"
      : "backfill_inventory_failed";
    return json({ error: code, writes_started: false }, 503, origin);
  }
});
