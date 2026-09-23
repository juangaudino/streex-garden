import { describe, expect, it } from "vitest";
import {
  careSessionAction,
  careSessionSearch,
  careSessionToolKeys,
  parseCareSessionBoolean,
  parseCareSessionNumber,
  parseCareSessionQueue,
  recordMomentGroups,
  buildCarePlantQueue,
  canRunCareAiCheck,
  careReviewContextMessage,
  careReviewPhotoKey,
  reorderCareGarden,
  toggleCareGardenSelection,
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

describe("Care Session garden setup and current review context", () => {
  const gardens = [{ id: "garden-a" }, { id: "garden-b" }, { id: "garden-c" }];
  const plants = [
    { id: "b-p2", gardenId: "garden-b", backendPositionId: "b2", name: "B at 2" },
    { id: "a-p2", gardenId: "garden-a", backendPositionId: "a2", name: "A at 2" },
    { id: "a-p1", gardenId: "garden-a", backendPositionId: "a1", name: "A at 1" },
    { id: "a-p1-shared", gardenId: "garden-a", backendPositionId: "a1", name: "A shared position" },
    { id: "c-p1", gardenId: "garden-c", backendPositionId: "c1", name: "C at 1" },
  ];
  const positions = new Map([["a1", 1], ["a2", 2], ["b2", 2], ["c1", 1]]);

  it("selects only chosen gardens and traverses garden order, then deterministic positions", () => {
    expect(buildCarePlantQueue(gardens, plants, ["garden-b", "garden-a", "garden-c"], ["garden-a", "garden-b"], positions)).toEqual([
      "b-p2", "a-p1", "a-p1-shared", "a-p2",
    ]);
  });

  it("reorders gardens without dropping their selection", () => {
    const order = reorderCareGarden(gardens, "garden-c", "garden-a", (garden) => garden.id);
    expect(order.map((garden) => garden.id)).toEqual(["garden-c", "garden-a", "garden-b"]);
  });

  it("supports deselecting and reselecting an active garden", () => {
    const selected = ["garden-a", "garden-b"];
    expect(toggleCareGardenSelection(selected, "garden-a")).toEqual(["garden-b"]);
    expect(toggleCareGardenSelection(["garden-b"], "garden-a")).toEqual(["garden-b", "garden-a"]);
  });

  it("excludes unselected gardens while preserving position order and shared occupants", () => {
    expect(buildCarePlantQueue(gardens, plants, ["garden-a", "garden-b", "garden-c"], ["garden-a"], positions)).toEqual([
      "a-p1", "a-p1-shared", "a-p2",
    ]);
  });

  it("enables draft AI Check only with a current photo and grow cycle", () => {
    expect(canRunCareAiCheck("cycle-1", null)).toBe(false);
    expect(canRunCareAiCheck("cycle-1", "data:image/jpeg;base64,abc")).toBe(true);
    expect(canRunCareAiCheck(null, "data:image/jpeg;base64,abc")).toBe(false);
  });

  it("keys review photos by Plant Instance and cycle so they cannot leak", () => {
    expect(careReviewPhotoKey("plant-a", "cycle-a")).not.toBe(careReviewPhotoKey("plant-b", "cycle-b"));
    expect(careReviewPhotoKey("plant-a", "cycle-a")).not.toBe(careReviewPhotoKey("plant-a", "cycle-b"));
  });

  it("provides the selected photo and AI Check output as unconfirmed conversation context", () => {
    const context = careReviewContextMessage({
      plantId: "plant-a",
      plantName: "Mint",
      growCycleId: "cycle-a",
      gardenName: "Garden A",
      positionLabel: "Pod 4",
      sessionItem: 2,
      sessionTotal: 6,
      photoSelected: true,
      headline: "Visible leaf changes",
      observations: ["Several new leaves are visible"],
      interpretations: ["Growth may be progressing"],
      uncertainty: ["Lighting differs from the previous image"],
    });
    expect(context.question).toContain("Care Session");
    expect(context.answer).toContain("plant-a");
    expect(context.answer).toContain("cycle-a");
    expect(context.answer).toContain("Care Session item: 2 of 6");
    expect(context.answer).toContain("Garden A; position: Pod 4");
    expect(context.answer).toContain("current AI Check");
    expect(context.answer).toContain("not saved as canonical evidence");
    expect(context.answer).toContain("Several new leaves are visible");
    expect(context.answer.length).toBeLessThanOrEqual(500);
  });
});
