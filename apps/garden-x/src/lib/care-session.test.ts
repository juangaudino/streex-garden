// @vitest-environment jsdom
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
  careFlowCanReuseReviewPhoto,
  canRunCareAiCheck,
  careReviewContextMessage,
  careReviewPhotoKey,
  careInspectionForKey,
  createCareInspectionState,
  reorderCareGarden,
  toggleCareGardenSelection,
  careSessionHasProgress,
  clearCareSession,
  loadCareSession,
  parseSavedCareSession,
  resolveCareSession,
  saveCareSession,
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

  it("persists and restores an unfinished workflow snapshot locally, including selection, order and next item", () => {
    const snapshot = {
      queue: ["plant-a", "plant-b", "plant-c"],
      index: 2,
      recordedForReview: false,
      reviewed: 2,
      observations: 1,
      care: 1,
      followups: 0,
      gardenOrder: ["garden-b", "garden-a"],
      selectedGardenIds: ["garden-b", "garden-a"],
    };
    clearCareSession();
    saveCareSession(snapshot);
    expect(loadCareSession()).toEqual(snapshot);
    expect(careSessionHasProgress(snapshot)).toBe(true);
    clearCareSession();
    expect(loadCareSession()).toBeNull();
  });

  it.each([
    ["corrupt JSON", "{"],
    ["old partial state", JSON.stringify({ queue: ["plant-a"], index: 0 })],
    ["fractional current index", JSON.stringify({ queue: ["plant-a"], index: 0.5, recordedForReview: false, reviewed: 0, observations: 0, care: 0, followups: 0, gardenOrder: ["garden-a"], selectedGardenIds: ["garden-a"] })],
    ["empty/duplicate plant identities", JSON.stringify({ queue: ["", "plant-a", "plant-a"], index: 0, recordedForReview: false, reviewed: 0, observations: 0, care: 0, followups: 0, gardenOrder: ["garden-a"], selectedGardenIds: ["garden-a"] })],
  ])("discards %s without making it resumable", (_label, value) => {
    localStorage.setItem("garden-x-care-session-v1", value);
    expect(loadCareSession()).toBeNull();
    expect(localStorage.getItem("garden-x-care-session-v1")).toBeNull();
  });

  it("rejects incomplete and stale serialized snapshots before rendering consumes them", () => {
    expect(parseSavedCareSession({ queue: ["plant-a"], index: 1, recordedForReview: false, reviewed: 0, observations: 0, care: 0, followups: 0, gardenOrder: ["garden-a"], selectedGardenIds: ["garden-a"] })).toBeNull();
    expect(parseSavedCareSession({ queue: ["plant-a"], index: 0, recordedForReview: false, reviewed: 0, observations: 0, care: 0, followups: 0, gardenOrder: ["garden-a"], selectedGardenIds: ["garden-b"] })).toBeNull();
  });

  it("discards a stale queue if any saved plant or garden can no longer be resolved", () => {
    const snapshot = {
      queue: ["plant-a", "plant-b", "plant-c"],
      index: 2,
      recordedForReview: false,
      reviewed: 1,
      observations: 0,
      care: 0,
      followups: 0,
      gardenOrder: ["garden-a", "garden-deleted"],
      selectedGardenIds: ["garden-a"],
    };
    expect(resolveCareSession(snapshot, [
      { id: "plant-a", gardenId: "garden-a" },
      { id: "plant-c", gardenId: "garden-a" },
      { id: "plant-deleted-garden", gardenId: "garden-deleted" },
    ], [{ id: "garden-a" }])).toBeNull();
    expect(resolveCareSession(snapshot, [{ id: "plant-a", gardenId: "garden-a" }], [{ id: "garden-a" }])).toBeNull();
  });

  it("discards a queue whose plants do not belong to the saved garden selection", () => {
    const snapshot = {
      queue: ["plant-a"], index: 0, recordedForReview: false,
      reviewed: 0, observations: 0, care: 0, followups: 0,
      gardenOrder: ["garden-a", "garden-b"], selectedGardenIds: ["garden-a"],
    };
    expect(resolveCareSession(snapshot, [{ id: "plant-a", gardenId: "garden-b" }], [{ id: "garden-a" }, { id: "garden-b" }])).toBeNull();
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

  it("reuses the temporary review photo only for Observe, Care, and Follow-up", () => {
    expect(careFlowCanReuseReviewPhoto("observation")).toBe(true);
    expect(careFlowCanReuseReviewPhoto("care")).toBe(true);
    expect(careFlowCanReuseReviewPhoto("followup")).toBe(true);
    expect(careFlowCanReuseReviewPhoto(undefined)).toBe(false);
    expect(careFlowCanReuseReviewPhoto("move")).toBe(false);
  });

  it("keys review photos by Plant Instance and cycle so they cannot leak", () => {
    expect(careReviewPhotoKey("plant-a", "cycle-a")).not.toBe(careReviewPhotoKey("plant-b", "cycle-b"));
    expect(careReviewPhotoKey("plant-a", "cycle-a")).not.toBe(careReviewPhotoKey("plant-a", "cycle-b"));
  });

  it("restores only the inspection state for the exact plant and cycle", () => {
    const state = { ...createCareInspectionState(careReviewPhotoKey("plant-a", "cycle-a")), workingPhoto: "data:image/jpeg;base64,a" };
    expect(careInspectionForKey(state, careReviewPhotoKey("plant-a", "cycle-a"))?.workingPhoto).toBe(state.workingPhoto);
    expect(careInspectionForKey(state, careReviewPhotoKey("plant-b", "cycle-b"))).toBeUndefined();
    expect(careInspectionForKey(state, careReviewPhotoKey("plant-a", "cycle-b"))).toBeUndefined();
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
      checkProposal: {
        headline: "Visible leaf changes",
        summary: "A current visual check.",
        confidence: "medium",
        observations: ["Several new leaves are visible"],
        interpretations: ["Growth may be progressing"],
        uncertainty: ["Lighting differs from the previous image"],
        development_recommendations: [{ kind: "pruning", recommendation: "no_action", rationale: "No pruning is indicated today.", confidence: "medium" }],
        possible_harvest_readiness: "possible_evaluate",
        suggested_next_actions: [{ kind: "evaluate_harvest_readiness", rationale: "Check whether outer leaves are ready for a selective harvest." }],
      },
      recentHistory: ["Water change · 2026-09-15"],
    });
    expect(context.question).toContain("Care Session");
    expect(context.answer).toContain("plant-a");
    expect(context.answer).toContain("cycle-a");
    expect(context.answer).toContain("Care Session item: 2 of 6");
    expect(context.answer).toContain("Garden A; position: Pod 4");
    expect(context.answer).toContain("attached to this follow-up");
    expect(context.answer).toContain("temporary, not canonical evidence");
    expect(context.answer).toContain("Several new leaves are visible");
    expect(context.answer).toContain("outer leaves are ready");
    expect(context.answer).toContain("Water change · 2026-09-15");
    expect(context.answer.length).toBeLessThanOrEqual(9000);
  });
});
