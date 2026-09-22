import { describe, expect, it } from "vitest";
import type { Photo, PlantEvent } from "./garden-data";
import {
  meaningfulChangeRequestKey,
  normalizeMeaningfulChangeResult,
  rankMeaningfulChanges,
  selectMeaningfulChangeCandidate,
  shouldGenerateMeaningfulChange,
} from "./meaningful-changes";

const photo = (id: string, capturedAt: string, cycle = "cycle-1"): Photo => ({
  id,
  plantId: "plant-1",
  backendGrowCycleId: cycle,
  backendStoragePath: `plant-1/${id}/original.jpg`,
  src: "",
  daysAgo: 0,
  capturedAt,
  caption: "Photo",
  metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
});

const plant = { id: "plant-1", backendGrowCycleId: "cycle-1", status: "steady" as const, statusNote: "" };

describe("Meaningful Changes candidate policy", () => {
  it("requires distinct evidence in the same cycle and orders before/after", () => {
    const candidate = selectMeaningfulChangeCandidate(plant, [photo("after", "2026-09-12"), photo("before", "2026-09-01")], []);
    expect(candidate?.beforePhotoId).toBe("before");
    expect(candidate?.afterPhotoId).toBe("after");
    expect(selectMeaningfulChangeCandidate(plant, [photo("same", "2026-09-01"), photo("same", "2026-09-12")], [])).toBeNull();
    expect(selectMeaningfulChangeCandidate(plant, [photo("other-cycle", "2026-09-01", "cycle-2"), photo("after", "2026-09-12")], [])).toBeNull();
  });

  it("allows a short interval when a recorded event explains it", () => {
    const event: PlantEvent = { id: "e1", plantId: "plant-1", daysAgo: 0, occurredAt: "2026-09-02", type: "note", title: "Observed new growth", provenance: "recorded" };
    expect(selectMeaningfulChangeCandidate(plant, [photo("before", "2026-09-01"), photo("after", "2026-09-02")], [event])?.contextFacts).toHaveLength(1);
    expect(selectMeaningfulChangeCandidate(plant, [photo("before", "2026-09-01"), photo("after", "2026-09-02")], [])).toBeNull();
  });

  it("does not regenerate a completed pair when only a later event is recorded", () => {
    const completed = {
      analysisVersion: "garden_meaningful_change_v1",
      comparisonStatus: "meaningful_change" as const,
      primaryVisualObservation: "Foliage appears denser",
      supportingVisualObservations: [],
      comparabilityNotes: [],
      interpretation: null,
      interpretationConfidence: null,
      relevantContextFacts: [],
      beforePhotoId: "before",
      afterPhotoId: "after",
      growCycleId: "cycle-1",
      plantInstanceId: "plant-1",
    };
    expect(selectMeaningfulChangeCandidate(plant, [photo("before", "2026-09-01"), photo("after", "2026-09-12")], [{ id: "later", plantId: "plant-1", daysAgo: 0, occurredAt: "2026-09-13", type: "note", title: "Later note", provenance: "recorded" }], [completed])).toBeNull();
  });

  it("triggers only for a newly persisted photo", () => {
    expect(shouldGenerateMeaningfulChange({ photoId: "photo-1" })).toBe(true);
    expect(shouldGenerateMeaningfulChange({})).toBe(false);
  });

  it("names the analysis version in the idempotency key", () => {
    const v1 = meaningfulChangeRequestKey("cycle", "before", "after", "en");
    const v2 = meaningfulChangeRequestKey("cycle", "before", "after", "en", "garden_meaningful_change_v2");
    expect(v1).toContain("garden_meaningful_change_v1");
    expect(v1).not.toBe(v2);
    expect(v1.length).toBeLessThanOrEqual(160);
  });

  it("does not treat a future analysis version as a completed V1 result", () => {
    const future = {
      analysisVersion: "garden_meaningful_change_v2",
      comparisonStatus: "meaningful_change" as const,
      primaryVisualObservation: "A change",
      supportingVisualObservations: [],
      comparabilityNotes: [],
      interpretation: null,
      interpretationConfidence: null,
      relevantContextFacts: [],
      beforePhotoId: "before",
      afterPhotoId: "after",
      growCycleId: "cycle-1",
      plantInstanceId: "plant-1",
    };
    expect(selectMeaningfulChangeCandidate(plant, [photo("before", "2026-09-01"), photo("after", "2026-09-12")], [], [future])).not.toBeNull();
  });
});

describe("Meaningful Changes contract", () => {
  it("rejects measurements, duplicate evidence, and preserves rich fields", () => {
    const value = {
      schema_version: "garden_meaningful_change_v1",
      comparison_status: "meaningful_change",
      primary_visual_observation: "Foliage appears denser",
      supporting_visual_observations: ["Several leaves appear larger"],
      comparability_notes: [],
      interpretation: "The change is consistent with continued growth.",
      interpretation_confidence: "medium",
      relevant_context_facts: ["Pruning was recorded between these photos."],
      before_photo_id: "before",
      after_photo_id: "after",
      grow_cycle_id: "cycle-1",
      plant_instance_id: "plant-1",
    };
    expect(normalizeMeaningfulChangeResult(value)?.interpretation).toContain("consistent");
    expect(normalizeMeaningfulChangeResult({ ...value, before_photo_id: "after" })).toBeNull();
    expect(normalizeMeaningfulChangeResult({ ...value, primary_visual_observation: "Grew 14 cm" })).toBeNull();
  });
});

describe("Meaningful Changes ranking", () => {
  it("prefers meaningful changes and attention plants without generating new analysis", () => {
    const base = { analysisVersion: "garden_meaningful_change_v1", supportingVisualObservations: [], comparabilityNotes: [], interpretation: null, interpretationConfidence: null, relevantContextFacts: [], beforePhotoId: "b", afterPhotoId: "a", growCycleId: "c", plantInstanceId: "p", primaryVisualObservation: "change" } as const;
    const ranked = rankMeaningfulChanges([
      { ...base, comparisonStatus: "no_meaningful_change", plantInstanceId: "steady", createdAt: "2026-09-12" },
      { ...base, comparisonStatus: "meaningful_change", plantInstanceId: "watching", createdAt: "2026-09-01" },
    ], [{ id: "steady", status: "steady" }, { id: "watching", status: "watching" }]);
    expect(ranked.map((item) => item.plantInstanceId)).toEqual(["watching", "steady"]);
  });
});
