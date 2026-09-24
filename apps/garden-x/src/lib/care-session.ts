import type { AiCheckProposal } from "./garden-backend";

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

export interface SavedCareSession extends CareSessionSearchSnapshot {
  gardenOrder: string[];
  selectedGardenIds: string[];
}

export const careSessionStorageKey = "garden-x-care-session-v1";

export function saveCareSession(snapshot: SavedCareSession) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(careSessionStorageKey, JSON.stringify(snapshot));
  } catch {
    // Care remains usable if local storage is unavailable.
  }
}

export function loadCareSession(): SavedCareSession | null {
  try {
    if (typeof window === "undefined") return null;
    const value = window.localStorage.getItem(careSessionStorageKey);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<SavedCareSession>;
    if (!Array.isArray(parsed.queue) || !parsed.queue.every((id) => typeof id === "string") || !parsed.queue.length) return null;
    if (!Array.isArray(parsed.gardenOrder) || !parsed.gardenOrder.every((id) => typeof id === "string")) return null;
    if (!Array.isArray(parsed.selectedGardenIds) || !parsed.selectedGardenIds.every((id) => typeof id === "string")) return null;
    const numeric = [parsed.index, parsed.reviewed, parsed.observations, parsed.care, parsed.followups];
    if (numeric.some((item) => typeof item !== "number" || !Number.isFinite(item) || item < 0)) return null;
    if (typeof parsed.recordedForReview !== "boolean") return null;
    return {
      queue: parsed.queue,
      index: Math.min(parsed.index!, parsed.queue.length - 1),
      recordedForReview: parsed.recordedForReview,
      reviewed: parsed.reviewed!,
      observations: parsed.observations!,
      care: parsed.care!,
      followups: parsed.followups!,
      gardenOrder: parsed.gardenOrder,
      selectedGardenIds: parsed.selectedGardenIds,
    };
  } catch {
    return null;
  }
}

export function clearCareSession() {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(careSessionStorageKey);
  } catch {
    // Care remains usable if local storage is unavailable.
  }
}

export function careSessionHasProgress(snapshot: SavedCareSession) {
  return snapshot.index > 0 || snapshot.reviewed > 0 || snapshot.observations > 0 || snapshot.care > 0 || snapshot.followups > 0 || snapshot.recordedForReview;
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

export interface CareInspectionState {
  key: string;
  workingPhoto?: string;
  checkPhase: "idle" | "scanning" | "done" | "error";
  checkProposal: AiCheckProposal | null;
  checkRequestId: string | null;
  requestGuardId: string | null;
  conversation: Array<{ question: string; answer: string; facts: string[]; imageDataUrl?: string }>;
}

export function createCareInspectionState(key: string): CareInspectionState {
  return { key, checkPhase: "idle", checkProposal: null, checkRequestId: null, requestGuardId: null, conversation: [] };
}

export function careInspectionForKey(state: CareInspectionState | null | undefined, key: string) {
  return state?.key === key ? state : undefined;
}

export function canRunCareAiCheck(growCycleId: string | null | undefined, reviewPhoto: string | null | undefined) {
  return Boolean(growCycleId && reviewPhoto);
}

export function careFlowCanReuseReviewPhoto(flow?: string | undefined) {
  return flow === "observation" || flow === "care" || flow === "followup";
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
  checkProposal: AiCheckProposal;
  recentHistory: string[];
}) {
  const question = "Current Care Session review context";
  const answer = [
    `Care Session item: ${input.sessionItem} of ${input.sessionTotal}`,
    `Garden/system: ${input.gardenName}${input.positionLabel ? `; position: ${input.positionLabel}` : ""}`,
    `Plant Instance: ${input.plantName} (${input.plantId})`,
    `Grow cycle: ${input.growCycleId}`,
    `Current review photo: ${input.photoSelected ? "attached to this follow-up and used for the current AI Check; temporary, not canonical evidence" : "none"}`,
    `AI Check headline: ${input.checkProposal.headline}`,
    `AI Check summary: ${input.checkProposal.summary}`,
    `AI Check confidence: ${input.checkProposal.confidence}`,
    `Harvest readiness: ${input.checkProposal.possible_harvest_readiness ?? "not provided"}`,
    `Visible state: ${input.checkProposal.overall_visible_state ?? "not provided"}`,
    ...input.checkProposal.observations.map((item) => `Visual observation: ${item}`),
    ...input.checkProposal.interpretations.map((item) => `Unconfirmed interpretation: ${item}`),
    ...(input.checkProposal.development_recommendations ?? []).map((item) => `Unconfirmed ${item.kind} guidance (${item.recommendation}): ${item.rationale}`),
    ...(input.checkProposal.suggested_next_actions ?? []).map((item) => `Unconfirmed next-step guidance (${item.kind}): ${item.rationale}`),
    ...input.checkProposal.uncertainty.map((item) => `Uncertainty: ${item}`),
    ...(input.recentHistory ?? []).map((item) => `Canonical plant history: ${item}`),
  ].join("\n").slice(0, 9000);
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
