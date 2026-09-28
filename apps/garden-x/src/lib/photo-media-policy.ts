/** User Zero approved initial Garden Media V1 policy for newly ingested photos. */
export const GARDEN_PHOTO_MEDIA_POLICY = {
  version: "garden-media-v1",
  orientation: "from-image",
  master: { maxEdge: 2304, quality: 0.86 },
  display: { maxEdge: 1440, quality: 0.8 },
  preview: { maxEdge: 600, quality: 0.68 },
} as const;

export type GardenPhotoTier = "master" | "display" | "preview";
