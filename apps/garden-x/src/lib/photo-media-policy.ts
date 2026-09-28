/**
 * Conservative interim policy for newly ingested Garden media.
 * These values are deliberately not a product contract; compare them against
 * real User Zero photos in scripts/photo-media-experiment.html before tuning.
 */
export const GARDEN_PHOTO_MEDIA_POLICY = {
  version: "interim-v1",
  orientation: "from-image",
  master: { maxEdge: 2560, quality: 0.9 },
  display: { maxEdge: 1600, quality: 0.84 },
  preview: { maxEdge: 640, quality: 0.72 },
} as const;

export type GardenPhotoTier = "master" | "display" | "preview";
