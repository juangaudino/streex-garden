export type PhotoRenditionBytes = {
  preview?: Uint8Array;
  display?: Uint8Array;
};

export type PreparedPhotoRenditions = {
  width: number;
  height: number;
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

async function jpegRendition(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number,
  originalByteLength: number,
): Promise<Uint8Array | undefined> {
  const size = dimensionsWithin(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return undefined;
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob || blob.size === 0 || blob.size >= originalByteLength) return undefined;
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Creates private display sidecars without changing the uploaded original.
 * Unsupported browser decoders or canvas encoders simply keep the original-only
 * path, which remains valid for Garden's existing photo resolver.
 */
export async function preparePhotoRenditions(
  bytes: Uint8Array,
  mime: string,
): Promise<PreparedPhotoRenditions | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(new Blob([bytes.slice().buffer], { type: mime }));
  } catch {
    return null;
  }
  try {
    const [preview, display] = await Promise.all([
      jpegRendition(bitmap, 640, 0.68, bytes.byteLength),
      jpegRendition(bitmap, 1600, 0.78, bytes.byteLength),
    ]);
    return {
      width: bitmap.width,
      height: bitmap.height,
      renditions: {
        ...(preview ? { preview } : {}),
        ...(display ? { display } : {}),
      },
    };
  } catch {
    return { width: bitmap.width, height: bitmap.height, renditions: {} };
  } finally {
    bitmap?.close();
  }
}
