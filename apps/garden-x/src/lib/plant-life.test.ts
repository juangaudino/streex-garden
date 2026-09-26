import { describe, expect, it } from "vitest";
import type { Plant, PlantEvent } from "./garden-data";
import {
  contextualLifeEventSuggestions,
  LIFE_EVENT_DEFINITIONS,
  lifeEventIsRepeatable,
  normalizeLifeEvent,
  otherMomentLifeEvents,
  originType,
  PLANT_ORIGINS,
} from "./plant-life";

const plant: Plant = {
  id: "plant-1",
  gardenId: "garden-1",
  name: "Lettuce",
  species: "Lettuce",
  scientific: "Lactuca sativa",
  variety: "",
  knowledgeId: "",
  plantedDaysAgo: 10,
  status: "steady",
  statusNote: "",
  heroPhotoId: "",
  identityConfirmed: false,
};

function event(lifeEvent: NonNullable<PlantEvent["lifeEvent"]>, daysAgo: number): PlantEvent {
  return {
    id: `${lifeEvent}-${daysAgo}`,
    plantId: plant.id,
    daysAgo,
    type: "note",
    title: lifeEvent,
    lifeEvent,
    provenance: "recorded",
  };
}

describe("F1B plant life facts", () => {
  it("keeps origin IDs stable, normalizes missing old-cycle values, and separates them from labels", () => {
    expect(PLANT_ORIGINS).toEqual([
      "unknown",
      "seed",
      "bare_root",
      "cutting",
      "seedling",
      "transplant",
    ]);
    expect(originType(undefined)).toBe("unknown");
    expect(originType("bare_root")).toBe("bare_root");
    expect(originType("not-a-contract-value")).toBe("unknown");
  });

  it("treats F1 milestone identifiers as the same facts without rewriting their stored values", () => {
    expect(normalizeLifeEvent("flowering")).toBe("flowered");
    expect(normalizeLifeEvent("fruiting")).toBe("fruited");
    expect(normalizeLifeEvent("harvest")).toBe("harvested");
    expect(normalizeLifeEvent("germinated")).toBe("germinated");
    expect(normalizeLifeEvent("unknown-event")).toBeNull();
  });

  it("suggests germination only for seed origin, then sprouting after recorded germination", () => {
    const seed = { ...plant, originType: "seed" as const };
    expect(contextualLifeEventSuggestions({ plant: seed, history: [] })).toEqual([
      "growth_observed",
      "germinated",
    ]);
    expect(
      contextualLifeEventSuggestions({
        plant: seed,
        history: [event("germinated", 4)],
      }),
    ).toEqual(["growth_observed", "sprouted"]);
  });

  it("does not require germination for bare-root plants and keeps other events available under More", () => {
    const strawberry = { ...plant, originType: "bare_root" as const, species: "Strawberry" };
    const suggestions = contextualLifeEventSuggestions({ plant: strawberry, history: [] });
    expect(suggestions).toEqual(["growth_observed"]);
    expect(suggestions).not.toContain("germinated");
    expect(otherMomentLifeEvents(suggestions)).toContain("flowered");
    expect(otherMomentLifeEvents(suggestions)).toContain("harvested");
  });

  it("allows nonlinear seed-grown fruiting and repeated harvest facts", () => {
    const history = [
      event("germinated", 20),
      event("sprouted", 18),
      event("flowered", 12),
      event("fruited", 8),
      event("harvested", 5),
      event("flowered", 3),
      event("fruited", 2),
      event("harvested", 0),
    ];
    const suggestions = contextualLifeEventSuggestions({
      plant: { ...plant, originType: "seed" },
      history,
    });
    expect(suggestions).toEqual(["growth_observed", "harvested", "flowered"]);
    expect(history.filter((item) => item.lifeEvent === "harvested")).toHaveLength(2);
  });

  it("keeps repeatability semantic, not a linear state machine or uniqueness constraint", () => {
    for (const repeatable of [
      "growth_observed",
      "flowered",
      "fruited",
      "harvested",
      "regrowth",
      "propagated",
      "moved",
    ] as const) {
      expect(lifeEventIsRepeatable(repeatable)).toBe(true);
    }
    for (const normallyUnique of ["germinated", "sprouted", "ended"] as const) {
      expect(lifeEventIsRepeatable(normallyUnique)).toBe(false);
    }
    expect(LIFE_EVENT_DEFINITIONS.map((item) => item.id)).not.toContain("xp");
  });

  it("accepts leafy-green and herb histories without imposing one biological order", () => {
    const leafyHistory = ["growth_observed", "harvested", "flowered", "harvested", "ended"];
    const herbHistory = ["growth_observed", "harvested", "regrowth", "harvested"];
    expect(leafyHistory.map(normalizeLifeEvent)).toEqual(leafyHistory);
    expect(herbHistory.map(normalizeLifeEvent)).toEqual(herbHistory);
    expect(lifeEventIsRepeatable("harvested")).toBe(true);
    expect(LIFE_EVENT_DEFINITIONS.find((item) => item.id === "flowered")).not.toHaveProperty(
      "success",
    );
  });

  it("keeps moved as a repeatable historical fact handled by the existing move command", () => {
    expect(normalizeLifeEvent("moved")).toBe("moved");
    expect(lifeEventIsRepeatable("moved")).toBe(true);
    expect(LIFE_EVENT_DEFINITIONS.find((item) => item.id === "moved")?.recordedBy).toBe(
      "cycle_move",
    );
  });

  it("suggests a prior repeatable fact again without hiding unexpected facts", () => {
    const history = [event("flowered", 2), event("harvested", 0)];
    const suggestions = contextualLifeEventSuggestions({ plant, history });
    expect(suggestions).toContain("harvested");
    expect(otherMomentLifeEvents(suggestions)).toContain("regrowth");
  });

  it("keeps cycle close and physical move on their existing canonical paths", () => {
    expect(LIFE_EVENT_DEFINITIONS.find((item) => item.id === "ended")?.recordedBy).toBe(
      "cycle_close",
    );
    expect(LIFE_EVENT_DEFINITIONS.find((item) => item.id === "moved")?.recordedBy).toBe(
      "cycle_move",
    );
  });
});
