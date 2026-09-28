import { GARDEN_PHOTO_MEDIA_POLICY } from "./photo-media-policy";

export type PhotoRenditionBytes = {
  preview?: Uint8Array;
  display?: Uint8Array;
};

export type PreparedGardenPhotoMedia = {
  width: number;
  height: number;
  contentType: "image/jpeg";
  master: Uint8Array;
  renditions: PhotoRenditionBytes;
};

export function photoRenditionStoragePaths(originalPath: string) {
  const separator = originalPath.lastIndexOf("/");
  if (separator < 0) return null;
  const parent = originalPath.slice(0, separator);
  return {
    preview: `${parent}/preview.jpg`,
    display: `${parent}/display.jpg`,
  };
}

function dimensionsWithin(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function jpeg(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Uint8Array> {
  const size = dimensionsWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Photo canvas is unavailable.");
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob || blob.size === 0 || blob.type !== "image/jpeg") {
    throw new Error("Photo JPEG encoding failed.");
  }
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Normalizes a phone image once into the Garden master and its display tiers.
 * createImageBitmap applies the source orientation before drawing to canvas;
 * canvas encoding strips EXIF/GPS and other source metadata.
 */
export async function prepareGardenPhotoMedia(
  bytes: Uint8Array,
  mime: string,
): Promise<PreparedGardenPhotoMedia | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(new Blob([bytes.slice().buffer], { type: mime }), {
      imageOrientation: GARDEN_PHOTO_MEDIA_POLICY.orientation,
    });
  } catch {
    return null;
  }
  try {
    // Encode tiers serially so a high-resolution phone image does not create
    // three full canvas surfaces at once on memory-constrained devices.
    const master = await jpeg(
      bitmap,
      GARDEN_PHOTO_MEDIA_POLICY.master.maxEdge,
      GARDEN_PHOTO_MEDIA_POLICY.master.quality,
    );
    const display = await jpeg(
      bitmap,
      GARDEN_PHOTO_MEDIA_POLICY.display.maxEdge,
      GARDEN_PHOTO_MEDIA_POLICY.display.quality,
    );
    const preview = await jpeg(
      bitmap,
      GARDEN_PHOTO_MEDIA_POLICY.preview.maxEdge,
      GARDEN_PHOTO_MEDIA_POLICY.preview.quality,
    );
    return {
      width: dimensionsWithin(bitmap.width, bitmap.height, GARDEN_PHOTO_MEDIA_POLICY.master.maxEdge)
        .width,
      height: dimensionsWithin(
        bitmap.width,
        bitmap.height,
        GARDEN_PHOTO_MEDIA_POLICY.master.maxEdge,
      ).height,
      contentType: "image/jpeg",
      master,
      renditions: {
        preview,
        display,
      },
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error("Photo media processing failed.");
  } finally {
    bitmap?.close();
  }
}
