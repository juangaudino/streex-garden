import { describe, expect, it } from "vitest";
import { careSessionAction, careSessionToolKeys, recordMomentGroups } from "./care-session";

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
});
