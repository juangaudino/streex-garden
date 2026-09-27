import { describe, expect, it } from "vitest";
import type { Plant, PlantEvent } from "./garden-data";
import { buildPlantLifeHighlights } from "./plant-life-highlights";

const plant: Plant = {
  id: "plant-1",
  gardenId: "garden-1",
  name: "Tomato",
  species: "Tomato",
  scientific: "Solanum lycopersicum",
  variety: "",
  knowledgeId: "",
  plantedDaysAgo: 57,
  plantedDatePrecision: "exact",
  originType: "seed",
  status: "steady",
  statusNote: "",
  heroPhotoId: "",
  identityConfirmed: true,
};

function event(
  id: string,
  lifeEvent: NonNullable<PlantEvent["lifeEvent"]>,
  daysAgo: number,
  occurredAt?: string,
): PlantEvent {
  return {
    id,
    plantId: plant.id,
    daysAgo,
    occurredAt,
    type: "note",
    title: lifeEvent,
    lifeEvent,
    provenance: "recorded",
  };
}

describe("Plant Journal Life Highlights", () => {
  it("shows only known foundation facts for a young plant without empty fillers", () => {
    expect(buildPlantLifeHighlights(plant, [])).toEqual([{ kind: "planted", daysAgo: 57 }]);
  });

  it("does not invent a planted date when the canonical cycle marks its precision unknown", () => {
    expect(buildPlantLifeHighlights({ ...plant, plantedDatePrecision: "unknown" }, [])).toEqual([]);
  });

  it("uses the first canonical occurrence for sprout, flower, and fruit facts", () => {
    const highlights = buildPlantLifeHighlights(plant, [
      event("flower-later", "flowered", 4, "2026-09-20T12:00:00Z"),
      event("sprout", "sprouted", 40, "2026-08-15T12:00:00Z"),
      event("fruit", "fruited", 2, "2026-09-23T12:00:00Z"),
      event("flower-first", "flowered", 30, "2026-08-25T12:00:00Z"),
    ]);
    expect(highlights).toEqual([
      { kind: "planted", daysAgo: 57 },
      { kind: "sprouted", daysAgo: 40 },
      { kind: "firstFlower", daysAgo: 30 },
      { kind: "firstFruit", daysAgo: 2 },
    ]);
  });

  it("counts repeated harvests and keeps first/last dates and significant facts deterministic", () => {
    const highlights = buildPlantLifeHighlights({ ...plant, plantedDatePrecision: "unknown" }, [
      event("harvest-2", "harvested", 3, "2026-09-22T12:00:00Z"),
      event("recovered", "recovered", 10, "2026-09-15T12:00:00Z"),
      event("harvest-1", "harvested", 21, "2026-09-04T12:00:00Z"),
      event("propagated", "propagated", 8, "2026-09-17T12:00:00Z"),
    ]);
    expect(highlights).toEqual([
      { kind: "firstHarvest", daysAgo: 21 },
      { kind: "harvestCount", count: 2 },
      { kind: "lastHarvest", daysAgo: 3 },
      { kind: "recovered", daysAgo: 10 },
      { kind: "propagated", daysAgo: 8 },
    ]);
  });

  it("ignores maintenance metrics, unclassified notes, and inferred life-event claims", () => {
    const maintenance: PlantEvent = {
      id: "water-change",
      plantId: plant.id,
      daysAgo: 2,
      type: "maintenance",
      title: "Water change",
      provenance: "recorded",
    };
    const inferred = {
      ...event("inferred-flower", "flowered", 1),
      provenance: "inferred" as const,
    };
    expect(buildPlantLifeHighlights(plant, [maintenance, inferred])).toEqual([
      { kind: "planted", daysAgo: 57 },
    ]);
  });

  it("caps the highlights at six without padding the remaining slots", () => {
    const all = [
      event("sprout", "sprouted", 40),
      event("flower", "flowered", 30),
      event("fruit", "fruited", 20),
      event("harvest-1", "harvested", 12),
      event("harvest-2", "harvested", 8),
      event("recovered", "recovered", 4),
      event("propagated", "propagated", 2),
    ];
    expect(buildPlantLifeHighlights(plant, all)).toHaveLength(6);
  });
});
