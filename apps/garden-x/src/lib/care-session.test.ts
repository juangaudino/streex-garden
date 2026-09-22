import { describe, expect, it } from "vitest";
import {
  careSessionAction,
  careSessionSearch,
  careSessionToolKeys,
  parseCareSessionBoolean,
  parseCareSessionNumber,
  parseCareSessionQueue,
  recordMomentGroups,
} from "./care-session";

describe("Care Session action hierarchy", () => {
  it("keeps Skip for now until a real record is saved", () => {
    expect(careSessionAction(false)).toBe("skipForNow");
    expect(careSessionAction(true)).toBe("nextPlant");
  });

  it("exposes exactly the four compact tools", () => {
    expect(careSessionToolKeys).toEqual(["observe", "careAction", "followUpAction", "more"]);
  });

  it("keeps all existing Record a Moment flows in two groups", () => {
    expect(recordMomentGroups[0]?.flowKeys).toEqual(["observation", "care", "followup", "other"]);
    expect(recordMomentGroups[1]?.flowKeys).toEqual(["planting", "move", "close", "replace"]);
    expect(recordMomentGroups.flatMap((group) => group.flowKeys)).toHaveLength(8);
  });

  it("serializes and restores review context for contextual back navigation", () => {
    const search = careSessionSearch({
      queue: ["plant-a", "plant-b"],
      index: 1,
      recordedForReview: true,
      reviewed: 1,
      observations: 1,
      care: 0,
      followups: 0,
    });
    expect(search).toEqual({
      careQueue: "plant-a,plant-b",
      careIndex: 1,
      careRecorded: true,
      careReviewed: 1,
      careObservations: 1,
      careActions: 0,
      careFollowups: 0,
    });
    expect(parseCareSessionQueue(search.careQueue)).toEqual(["plant-a", "plant-b"]);
    expect(parseCareSessionNumber("1")).toBe(1);
    expect(parseCareSessionBoolean("true")).toBe(true);
  });
});
