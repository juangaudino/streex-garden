export const SUPPORTED_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
] as const;

export const PHOTO_ACCEPT = SUPPORTED_PHOTO_MIME_TYPES.join(",");

const supportedPhotoMimeTypes = new Set<string>(SUPPORTED_PHOTO_MIME_TYPES);
const supportedPhotoExtensions: Record<string, (typeof SUPPORTED_PHOTO_MIME_TYPES)[number]> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
};

/** Browsers may leave File.type empty for files dragged from Finder/Explorer. */
export function supportedPhotoMimeType(file: Pick<File, "type" | "name">) {
  const type = file.type.toLowerCase();
  if (supportedPhotoMimeTypes.has(type)) return type as (typeof SUPPORTED_PHOTO_MIME_TYPES)[number];
  if (type && type !== "application/octet-stream") return null;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return supportedPhotoExtensions[extension] ?? null;
}

export function isSupportedPhotoFile(file: Pick<File, "type" | "name">) {
  return supportedPhotoMimeType(file) !== null;
}

export function normalizePhotoFile(file: File) {
  const mime = supportedPhotoMimeType(file);
  if (!mime || file.type.toLowerCase() === mime) return file;
  return new File([file], file.name, { type: mime, lastModified: file.lastModified });
}

/** Keeps dragged files with an empty/generic browser MIME usable by the existing pipeline. */
export function normalizePhotoDataUrl(dataUrl: string, file: Pick<File, "type" | "name">) {
  const mime = supportedPhotoMimeType(file);
  if (!mime) return dataUrl;
  return dataUrl.replace(/^data:[^;,]+(?=;base64,)/, `data:${mime}`);
}

/** A local identity used only to prevent one drop event being handled twice. */
export function photoFileSignature(file: Pick<File, "name" | "size" | "lastModified">) {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}
