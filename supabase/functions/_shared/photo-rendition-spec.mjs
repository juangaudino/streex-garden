/**
 * Shared by the resumable local backfill and the temporary Edge Function.
 * Keep these values aligned with apps/garden-x/src/lib/photo-renditions.ts.
 */
export const PHOTO_RENDITION_SPECS = Object.freeze([
  Object.freeze({ kind: "preview", maxEdge: 640, quality: 68 }),
  Object.freeze({ kind: "display", maxEdge: 1600, quality: 78 }),
]);

export function photoRenditionPath(originalPath, kind) {
  const separator = originalPath.lastIndexOf("/");
  if (separator < 0) {
    throw new Error("Original path must include a parent directory.");
  }
  return originalPath.slice(0, separator) + "/" + kind + ".jpg";
}

export function photoRenditionDimensions(width, height, maxEdge) {
  if (
    !Number.isFinite(width) || !Number.isFinite(height) || width < 1 ||
    height < 1 || !Number.isFinite(maxEdge) || maxEdge < 1
  ) {
    throw new Error(
      "Image dimensions and maximum edge must be positive numbers.",
    );
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function isUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

export function isSafeOwnerOriginalPath(path, ownerId) {
  if (typeof path !== "string") return false;
  const parts = path.split("/");
  if (parts.length < 3 || parts[0] !== ownerId) return false;
  if (
    parts.some((part) =>
      !part || part === "." || part === ".." || part.includes("\\")
    )
  ) return false;
  return /^original\.(jpe?g|png|webp|heic|heif)$/i.test(
    parts[parts.length - 1],
  );
}

export function selectBackfillPhotos(manifest, ownerId) {
  if (!Array.isArray(manifest)) {
    throw new Error("Photo manifest is not an array.");
  }
  const photos = [];
  const ids = new Set();
  const paths = new Set();
  let pendingExcluded = 0;

  for (const photo of manifest) {
    if (!photo || typeof photo !== "object") {
      throw new Error("Photo manifest contains an invalid record.");
    }
    if (photo.upload_status === "pending") {
      pendingExcluded += 1;
      continue;
    }
    if (photo.upload_status !== "uploaded") continue;
    if (
      !isUuid(photo.id) || !isSafeOwnerOriginalPath(photo.storage_path, ownerId)
    ) {
      throw new Error(
        "Uploaded manifest contains a record outside the fixed owner scope.",
      );
    }
    if (ids.has(photo.id) || paths.has(photo.storage_path)) {
      throw new Error(
        "Uploaded manifest contains duplicate photo identity or path.",
      );
    }
    ids.add(photo.id);
    paths.add(photo.storage_path);
    photos.push(photo);
  }

  photos.sort((left, right) => left.id.localeCompare(right.id));
  return { photos, pendingExcluded };
}

function validJpegObject(object) {
  if (!object || typeof object !== "object") return false;
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object") return false;
  const mime = String(metadata.mimetype ?? metadata.contentType ?? "")
    .toLowerCase();
  const size = Number(metadata.size ?? metadata.contentLength);
  return mime === "image/jpeg" && Number.isFinite(size) && size > 0;
}

export function inspectPhotoFolder(photo, objects) {
  const originalName = photo.storage_path.slice(
    photo.storage_path.lastIndexOf("/") + 1,
  );
  const byName = new Map(
    (Array.isArray(objects) ? objects : [])
      .filter((object) => object && typeof object.name === "string")
      .map((object) => [object.name, object]),
  );
  if (!byName.has(originalName)) return { status: "missing_original" };

  const invalid = [];
  const missingKinds = [];
  for (const spec of PHOTO_RENDITION_SPECS) {
    const path = photoRenditionPath(photo.storage_path, spec.kind);
    const name = path.slice(path.lastIndexOf("/") + 1);
    const object = byName.get(name);
    if (!object) missingKinds.push(spec.kind);
    else if (!validJpegObject(object)) invalid.push(spec.kind);
  }
  if (invalid.length) {
    return { status: "invalid_existing_rendition", invalidKinds: invalid };
  }
  if (!missingKinds.length) return { status: "complete" };
  return { status: "needs_work", missingKinds };
}
