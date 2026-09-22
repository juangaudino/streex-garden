export type CareSessionAction = "skipForNow" | "nextPlant";

/** A review advances only after the user records something and explicitly chooses to continue. */
export function careSessionAction(recordedForReview: boolean): CareSessionAction {
  return recordedForReview ? "nextPlant" : "skipForNow";
}

export const careSessionToolKeys = ["observe", "careAction", "followUpAction", "more"] as const;

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
