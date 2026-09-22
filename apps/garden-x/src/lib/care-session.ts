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
