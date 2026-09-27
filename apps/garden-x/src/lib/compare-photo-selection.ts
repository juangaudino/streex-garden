import type { Photo } from "./garden-data";

export interface ComparePhotoSearch {
  from: "garden-ai" | undefined;
  beforePhotoId?: string;
  afterPhotoId?: string;
}

export function validateComparePhotoSearch(search: Record<string, unknown>): ComparePhotoSearch {
  const photoId = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0 && value.length <= 200
      ? value.trim()
      : undefined;
  const beforePhotoId = photoId(search["beforePhotoId"]);
  const afterPhotoId = photoId(search["afterPhotoId"]);
  return {
    from: search["from"] === "garden-ai" ? "garden-ai" : undefined,
    ...(beforePhotoId ? { beforePhotoId } : {}),
    ...(afterPhotoId ? { afterPhotoId } : {}),
  };
}

/** Only select requested frames from the loaded history for this plant and cycle. */
export function requestedComparePhotoPair(
  photos: Photo[],
  plantId: string,
  growCycleId: string | undefined,
  beforePhotoId?: string,
  afterPhotoId?: string,
): { before: Photo; after: Photo } | null {
  if (!beforePhotoId || !afterPhotoId || beforePhotoId === afterPhotoId) return null;
  const belongsToCurrentHistory = (photo: Photo) =>
    photo.plantId === plantId && (!growCycleId || photo.backendGrowCycleId === growCycleId);
  const before = photos.find(
    (photo) => photo.id === beforePhotoId && belongsToCurrentHistory(photo),
  );
  const after = photos.find((photo) => photo.id === afterPhotoId && belongsToCurrentHistory(photo));
  return before && after ? { before, after } : null;
}
