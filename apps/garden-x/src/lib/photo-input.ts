export const SUPPORTED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
] as const;

export const PHOTO_ACCEPT = SUPPORTED_PHOTO_MIME_TYPES.join(",");

const supportedPhotoMimeTypes = new Set<string>(SUPPORTED_PHOTO_MIME_TYPES);

export function isSupportedPhotoFile(file: Pick<File, "type">) {
  return supportedPhotoMimeTypes.has(file.type.toLowerCase());
}

/** A local identity used only to prevent one drop event being handled twice. */
export function photoFileSignature(file: Pick<File, "name" | "size" | "lastModified">) {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}
