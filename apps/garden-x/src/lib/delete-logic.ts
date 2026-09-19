export type EventEvidence = { id: string; backendEventId?: string };

export interface EventDeletePlan {
  strategy: "invalidate";
  eventId: string;
  evidencePhotoIds: string[];
  evidencePreserved: boolean;
}

export function planEventDeletion(eventId: string, photos: EventEvidence[]): EventDeletePlan {
  const evidencePhotoIds = photos
    .filter((photo) => photo.backendEventId === eventId)
    .map((photo) => photo.id);
  return {
    strategy: "invalidate",
    eventId,
    evidencePhotoIds,
    evidencePreserved: evidencePhotoIds.length > 0,
  };
}

export function photoStoragePaths(storagePath: string): string[] {
  const separator = storagePath.lastIndexOf("/");
  if (separator < 0) return [storagePath];
  const folder = storagePath.slice(0, separator);
  return [storagePath, `${folder}/preview.jpg`, `${folder}/display.jpg`];
}

export interface PhotoDeletePlan {
  photoId: string;
  linkedEventId: string | null;
  preserveEvent: boolean;
  recalculateCover: boolean;
  storagePaths: string[];
}

export function planPhotoDeletion(
  photo: { id: string; backendEventId?: string; backendStoragePath?: string },
  currentCoverPhotoId?: string | null,
): PhotoDeletePlan {
  return {
    photoId: photo.id,
    linkedEventId: photo.backendEventId ?? null,
    preserveEvent: Boolean(photo.backendEventId),
    recalculateCover: currentCoverPhotoId === photo.id,
    storagePaths: photo.backendStoragePath ? photoStoragePaths(photo.backendStoragePath) : [],
  };
}
