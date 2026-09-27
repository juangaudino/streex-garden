import { describe, expect, it } from "vitest";
import { gardenLibraryManifest } from "../generated/garden-library-manifest";
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

const libraryEntry = (id: string) =>
  gardenLibraryManifest.entries.find((entry) => entry.libraryPlantId === id)!;

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

  it("uses Monterey capabilities with bare-root origin and observed history without inventing stages", () => {
    const entry = libraryEntry("monterey-strawberry");
    const capabilities = entry.lifeCapabilities!;
    const strawberry = {
      ...plant,
      libraryPlantId: entry.libraryPlantId,
      originType: "bare_root" as const,
    };
    expect(capabilities.can_flower).toMatchObject({ status: "known", value: true });
    expect(capabilities.can_fruit).toMatchObject({ status: "known", value: true });
    expect(capabilities.harvestable_fruit).toMatchObject({ status: "known", value: true });
    expect(capabilities.can_propagate).toMatchObject({ status: "known", value: true });
    for (const capability of Object.values(capabilities)) {
      if (capability?.status !== "known") continue;
      for (const sourceId of capability.evidence.flatMap((item) => item.sourceIds)) {
        expect(entry.reference.sources.some((source) => source.id === sourceId)).toBe(true);
      }
    }

    const initial = contextualLifeEventSuggestions({
      plant: strawberry,
      history: [],
      capabilities,
    });
    expect(initial).toEqual(["growth_observed"]);
    expect(initial).not.toContain("germinated");
    expect(initial).not.toContain("sprouted");
    expect(otherMomentLifeEvents(initial)).toContain("flowered");

    expect(
      contextualLifeEventSuggestions({
        plant: strawberry,
        history: [event("growth_observed", 5)],
        capabilities,
      }),
    ).toContain("flowered");
    expect(
      contextualLifeEventSuggestions({
        plant: strawberry,
        history: [event("growth_observed", 5), event("flowered", 1)],
        capabilities,
      }),
    ).toContain("fruited");
    expect(
      contextualLifeEventSuggestions({
        plant: strawberry,
        history: [event("flowered", 5), event("fruited", 1)],
        capabilities,
      }),
    ).toContain("harvested");
  });

  it("prioritizes supported leafy harvest and regrowth without treating flowering as success", () => {
    const entry = libraryEntry("bibb-lettuce");
    const capabilities = entry.lifeCapabilities!;
    const lettuce = { ...plant, libraryPlantId: entry.libraryPlantId, originType: "seed" as const };
    expect(capabilities.harvestable_leaf).toMatchObject({ status: "known", value: true });
    expect(capabilities.can_regrow_after_harvest).toMatchObject({ status: "known", value: true });
    expect(capabilities.can_flower).toMatchObject({ status: "known", value: true });

    const mature = contextualLifeEventSuggestions({
      plant: lettuce,
      history: [event("growth_observed", 8)],
      capabilities,
    });
    expect(mature).toContain("growth_observed");
    expect(mature).toContain("harvested");
    expect(mature).not.toContain("flowered");
    expect(otherMomentLifeEvents(mature)).toContain("flowered");

    const afterHarvest = contextualLifeEventSuggestions({
      plant: lettuce,
      history: [event("growth_observed", 8), event("harvested", 0)],
      capabilities,
    });
    expect(afterHarvest).toContain("regrowth");
    expect(lifeEventIsRepeatable("harvested")).toBe(true);
  });

  it("uses fruiting-plant capabilities only with relevant observed context", () => {
    const entry = libraryEntry("cherry-tomato");
    const capabilities = entry.lifeCapabilities!;
    const tomato = {
      ...plant,
      libraryPlantId: entry.libraryPlantId,
      originType: "seed" as const,
    };
    expect(capabilities.can_flower).toMatchObject({ status: "known", value: true });
    expect(capabilities.can_fruit).toMatchObject({ status: "known", value: true });
    expect(capabilities.harvestable_fruit).toMatchObject({ status: "known", value: true });
    expect(
      contextualLifeEventSuggestions({ plant: tomato, history: [], capabilities }),
    ).not.toContain("fruited");
    expect(
      contextualLifeEventSuggestions({
        plant: tomato,
        history: [event("growth_observed", 3)],
        capabilities,
      }),
    ).toContain("flowered");
    expect(
      contextualLifeEventSuggestions({
        plant: tomato,
        history: [event("flowered", 0)],
        capabilities,
      }),
    ).toContain("fruited");
    expect(
      contextualLifeEventSuggestions({
        plant: tomato,
        history: [event("fruited", 0)],
        capabilities,
      }),
    ).toContain("harvested");
  });

  it("falls back to origin and history when capabilities are absent or unknown", () => {
    const seed = { ...plant, originType: "seed" as const };
    const unknownCapabilities = {
      can_fruit: { status: "unknown" as const, reason: "No applicable evidence." },
    };
    const expected = contextualLifeEventSuggestions({ plant: seed, history: [] });
    expect(
      contextualLifeEventSuggestions({
        plant: seed,
        history: [],
        capabilities: unknownCapabilities,
      }),
    ).toEqual(expected);
    expect(otherMomentLifeEvents(expected)).toContain("fruited");
    expect(
      contextualLifeEventSuggestions({
        plant: seed,
        history: [event("germinated", 1)],
        capabilities: unknownCapabilities,
      }),
    ).toEqual(["growth_observed", "sprouted"]);
  });

  it("lets a sourced propagation capability inform suggestions without restricting More", () => {
    const capabilities = {
      can_propagate: {
        status: "known" as const,
        value: true,
        evidence: [
          {
            sourceIds: ["usu-mint"],
            evidenceType: "source_backed" as const,
            confidence: "high" as const,
            taxonomicScope: { level: "genus" as const, taxon: "Mentha" },
            note: "Genus-level example used to test additive suggestion behavior.",
          },
        ],
      },
    };
    const suggestions = contextualLifeEventSuggestions({
      plant,
      history: [event("growth_observed", 1)],
      capabilities,
    });
    expect(suggestions).toContain("propagated");
    expect(otherMomentLifeEvents(suggestions)).toContain("damaged");
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
