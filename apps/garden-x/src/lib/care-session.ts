export type CareSessionAction = "skipForNow" | "nextPlant";

/** A review advances only after the user records something and explicitly chooses to continue. */
export function careSessionAction(recordedForReview: boolean): CareSessionAction {
  return recordedForReview ? "nextPlant" : "skipForNow";
}

export const careSessionToolKeys = ["observe", "careAction", "followUpAction", "more"] as const;

export const askGardenAccentClassName =
  "border-inference/30 bg-inference/10 text-inference hover:bg-inference/15";

export interface CareSessionSearchSnapshot {
  queue: string[];
  index: number;
  recordedForReview: boolean;
  reviewed: number;
  observations: number;
  care: number;
  followups: number;
}

export function parseCareSessionQueue(value: string | undefined) {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

export function reorderCareGarden<T>(items: T[], fromId: string, toId: string, getId: (item: T) => string) {
  const from = items.findIndex((item) => getId(item) === fromId);
  const to = items.findIndex((item) => getId(item) === toId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (!moved) return items;
  next.splice(to, 0, moved);
  return next;
}

export function toggleCareGardenSelection(selectedIds: string[], gardenId: string) {
  return selectedIds.includes(gardenId)
    ? selectedIds.filter((id) => id !== gardenId)
    : [...selectedIds, gardenId];
}

export function buildCarePlantQueue<T extends { id: string; gardenId: string; backendPositionId?: string; slot?: string; name: string }>(
  gardens: Array<{ id: string }>,
  plants: T[],
  orderedGardenIds: string[],
  selectedGardenIds: string[],
  positionNumberById: Map<string, number>,
) {
  const selected = new Set(selectedGardenIds);
  const gardenOrder = orderedGardenIds.filter((id, index) => selected.has(id) && orderedGardenIds.indexOf(id) === index);
  const validGardenIds = new Set(gardens.map((garden) => garden.id));
  const queue = gardenOrder
    .filter((gardenId) => validGardenIds.has(gardenId))
    .flatMap((gardenId) => plants
      .filter((plant) => plant.gardenId === gardenId)
      .slice()
      .sort((a, b) => {
        const aPosition = a.backendPositionId ? positionNumberById.get(a.backendPositionId) : undefined;
        const bPosition = b.backendPositionId ? positionNumberById.get(b.backendPositionId) : undefined;
        const slotNumber = (slot?: string) => Number(slot?.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);
        return (aPosition ?? slotNumber(a.slot)) - (bPosition ?? slotNumber(b.slot))
          || a.name.localeCompare(b.name)
          || a.id.localeCompare(b.id);
      }))
    .map((plant) => plant.id);
  return queue;
}

export function careReviewPhotoKey(plantId: string, growCycleId?: string | null) {
  return `${plantId}:${growCycleId ?? "no-cycle"}`;
}

export function canRunCareAiCheck(growCycleId: string | null | undefined, reviewPhoto: string | null | undefined) {
  return Boolean(growCycleId && reviewPhoto);
}

export function careReviewContextMessage(input: {
  plantId: string;
  plantName: string;
  growCycleId: string;
  gardenName: string;
  positionLabel?: string | undefined;
  sessionItem: number;
  sessionTotal: number;
  photoSelected: boolean;
  headline: string;
  observations: string[];
  interpretations: string[];
  uncertainty: string[];
}) {
  const question = "Current Care Session review context";
  const answer = [
    `Care Session item: ${input.sessionItem} of ${input.sessionTotal}`,
    `Garden/system: ${input.gardenName}${input.positionLabel ? `; position: ${input.positionLabel}` : ""}`,
    `Plant Instance: ${input.plantName} (${input.plantId})`,
    `Grow cycle: ${input.growCycleId}`,
    `Current review photo: ${input.photoSelected ? "selected and used for the current AI Check; not saved as canonical evidence" : "none"}`,
    `AI Check: ${input.headline}`,
    ...input.observations.map((item) => `Visual observation: ${item}`),
    ...input.interpretations.map((item) => `Interpretation: ${item}`),
    ...input.uncertainty.map((item) => `Uncertainty: ${item}`),
  ].join("; ").slice(0, 500);
  return { question, answer };
}

export function parseCareSessionNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseCareSessionBoolean(value: unknown) {
  return value === true || value === "true" || value === "1";
}

export function careSessionSearch(snapshot: CareSessionSearchSnapshot) {
  return {
    careQueue: snapshot.queue.join(","),
    careIndex: snapshot.index,
    careRecorded: snapshot.recordedForReview,
    careReviewed: snapshot.reviewed,
    careObservations: snapshot.observations,
    careActions: snapshot.care,
    careFollowups: snapshot.followups,
  };
}

export type RecordMomentGroupLabel = "recordSomething" | "managePlant";

export const recordMomentGroups: Array<{
  labelKey: RecordMomentGroupLabel;
  flowKeys: Array<
    "observation" | "care" | "followup" | "planting" | "move" | "close" | "replace" | "other"
  >;
}> = [
  { labelKey: "recordSomething", flowKeys: ["observation", "care", "followup", "other"] },
  { labelKey: "managePlant", flowKeys: ["planting", "move", "close", "replace"] },
];
