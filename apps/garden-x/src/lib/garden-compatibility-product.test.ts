import { describe, expect, it } from "vitest";
import type { Garden } from "./garden-data";
import {
  buildEmptyGardenPositionInput,
  evaluateEmptyGardenPosition,
} from "./garden-compatibility-engine";
import { gardenLibraryManifest } from "../generated/garden-library-manifest";
import type { CompatibilityEvidence, GardenLibraryEntry } from "./garden-library";
import { projectEmptyPositionCandidates } from "./garden-compatibility-product";

const pilot = gardenLibraryManifest.entries.filter(
  (entry) => entry.compatibilityProfile?.profileVersion === 1,
);
const byId = (id: string) => pilot.find((entry) => entry.libraryPlantId === id)!;

function garden(overrides: Partial<Garden> = {}): Garden {
  return {
    id: "garden-a",
    name: "Garden A",
    kind: "hydroponic",
    cultivationMethod: "hydroponic",
    cover: "",
    place: "",
    note: "",
    machine: { name: "Aera One", pods: 4 },
    backendSystemInstanceId: "system-a",
    systemDefinitionKey: "aera-one-v1",
    backendPositions: [
      { id: "p1", number: 1, active: true, levelNumber: 1, rowNumber: 1, columnNumber: 1 },
      { id: "p2", number: 2, active: true, levelNumber: 1, rowNumber: 1, columnNumber: 2 },
      { id: "p3", number: 3, active: true, levelNumber: 1, rowNumber: 2, columnNumber: 1 },
      { id: "p4", number: 4, active: true, levelNumber: 1, rowNumber: 2, columnNumber: 2 },
    ],
    systemLayoutLevels: [{ levelNumber: 1, rows: 2, columns: 2 }],
    ...overrides,
  };
}

function evaluateEntries(
  entries: readonly GardenLibraryEntry[],
  currentGarden: Garden = garden(),
  plants: Parameters<typeof buildEmptyGardenPositionInput>[2] = [],
  facts: Parameters<typeof buildEmptyGardenPositionInput>[4] = {},
) {
  const input = buildEmptyGardenPositionInput(currentGarden, "p1", plants, entries, facts);
  return evaluateEmptyGardenPosition(input, entries);
}

function project(
  entries: readonly GardenLibraryEntry[],
  currentGarden: Garden = garden(),
  plants: Parameters<typeof buildEmptyGardenPositionInput>[2] = [],
  facts: Parameters<typeof buildEmptyGardenPositionInput>[4] = {},
) {
  return projectEmptyPositionCandidates(
    evaluateEntries(entries, currentGarden, plants, facts),
    entries,
    {
      cultivationMethod: currentGarden.cultivationMethod ?? null,
      systemName: currentGarden.machine?.name ?? null,
    },
  );
}

describe("B3.6 empty-position product contract", () => {
  it("keeps documented cultivation support separate from unknown physical fit", () => {
    const result = project([byId("buttercrunch-lettuce")]).candidates[0]!;
    expect(result.cultivationCompatibility).toEqual({ method: "hydroponic", state: "compatible" });
    expect(result.systemFit).toEqual({ systemName: "Aera One", state: "unknown" });
    expect(result.physicalFit.state).toBe("unknown");
    expect(result.requiresVerificationBeforePlanting).toBe(true);
  });

  it("keeps an unmet documented system condition conditional, not incompatible", () => {
    const result = project([byId("cascading-petunia")]).candidates[0]!;
    expect(result.cultivationCompatibility.state).toBe("conditional");
    expect(result.systemFit.state).toBe("conditional");
    expect(result.physicalFit.state).toBe("unknown");
    expect(result.factualReasons[0]?.statement).toContain("AeroGarden");
  });

  it("preserves unknown cultivation evidence without converting it to exclusion", () => {
    const result = project([byId("common-mint")]).candidates[0]!;
    expect(result.cultivationCompatibility.state).toBe("unknown");
    expect(result.requiresVerificationBeforePlanting).toBe(true);
    expect(
      result.missingInformation.some((item) => item.property === "cultivation_suitability"),
    ).toBe(true);
  });

  it("projects explicit incompatibility with its source-backed reason", () => {
    const source = byId("buttercrunch-lettuce");
    const evidence = source.compatibilityProfile!.hydroponicSuitability.evidence!;
    const incompatible: GardenLibraryEntry = {
      ...source,
      compatibilityProfile: {
        ...source.compatibilityProfile!,
        hydroponicSuitability: { status: "incompatible", evidence },
      },
    };
    const result = project([incompatible]).candidates[0]!;
    expect(result.cultivationCompatibility.state).toBe("incompatible");
    expect(result.factualReasons[0]).toMatchObject({
      property: "cultivation_suitability",
      evidence: [expect.objectContaining({ sourceId: evidence[0]!.sourceIds[0] })],
    });
  });

  it("reports physical support only when documented size matches comparable recorded clearance", () => {
    const source = byId("buttercrunch-lettuce");
    const sizeEvidence: readonly CompatibilityEvidence[] = [
      {
        sourceIds: ["test-documented-height"],
        evidenceType: "source_backed",
        confidence: "high",
        taxonomicScope: { level: "identity" },
      },
    ];
    const measured: GardenLibraryEntry = {
      ...source,
      compatibilityProfile: {
        ...source.compatibilityProfile!,
        matureSize: {
          height: {
            status: "known",
            value: { minCm: 10, maxCm: 14, context: "hydroponic" },
            evidence: sizeEvidence,
          },
          spread: source.compatibilityProfile!.matureSize.spread,
        },
      },
    };
    const result = project([measured], garden(), [], {
      clearance: { heightCm: 20, context: "hydroponic" },
    }).candidates[0]!;
    expect(result.physicalFit.state).toBe("supported");
    expect(
      result.factualReasons.find((reason) => reason.property === "mature_height")?.evidence[0]
        ?.sourceId,
    ).toBe("test-documented-height");
  });

  it("retains multiple neighboring occupants without exposing companion-planting claims", () => {
    const plants = [
      {
        id: "neighbor-a",
        gardenId: "garden-a",
        backendPositionId: "p2",
        backendGrowCycleId: "cycle-a",
        name: "A",
        species: "",
        scientific: "",
        variety: "",
        knowledgeId: "common-mint",
        libraryPlantId: "common-mint",
        plantedDaysAgo: 0,
        status: "steady" as const,
        statusNote: "",
        heroPhotoId: "",
        identityConfirmed: true,
      },
      {
        id: "neighbor-b",
        gardenId: "garden-a",
        backendPositionId: "p2",
        backendGrowCycleId: "cycle-b",
        name: "B",
        species: "",
        scientific: "",
        variety: "",
        knowledgeId: "common-mint",
        libraryPlantId: "common-mint",
        plantedDaysAgo: 0,
        status: "steady" as const,
        statusNote: "",
        heroPhotoId: "",
        identityConfirmed: true,
      },
    ];
    const results = evaluateEntries([byId("common-mint")], garden(), plants);
    const input = buildEmptyGardenPositionInput(garden(), "p1", plants, pilot);
    expect(input.positions.find((position) => position.id === "p2")?.occupants).toHaveLength(2);
    expect(
      results[0]!.rankingSignals.some((signal) => signal.code === "adjacent_occupancy_known"),
    ).toBe(true);
    const result = projectEmptyPositionCandidates(results, [byId("common-mint")], {
      cultivationMethod: "hydroponic",
      systemName: "Aera One",
    }).candidates[0]!;
    expect(JSON.stringify(result)).not.toMatch(/companion|rankingSignals|score/i);
  });

  it("preserves Tiny Tim identity-specific evidence without leaking it to Cherry Tomato", () => {
    const results = evaluateEntries([byId("tiny-tim-tomato"), byId("cherry-tomato")]);
    const set = projectEmptyPositionCandidates(results, pilot, {
      cultivationMethod: "hydroponic",
      systemName: "Aera One",
    });
    const tiny = set.candidates.find((item) => item.plant.libraryPlantId === "tiny-tim-tomato")!;
    const cherry = set.candidates.find((item) => item.plant.libraryPlantId === "cherry-tomato")!;
    const tinyHabit = tiny.factualReasons.find((reason) => reason.property === "growth_habit");
    expect(tinyHabit?.evidence.some((item) => item.taxonomicScope.level === "identity")).toBe(true);
    expect(cherry.factualReasons.some((reason) => reason.property === "growth_habit")).toBe(false);
    expect(
      cherry.factualReasons
        .flatMap((reason) => reason.evidence)
        .some((item) =>
          tinyHabit?.evidence.some((tinyEvidence) => tinyEvidence.sourceId === item.sourceId),
        ),
    ).toBe(false);
  });

  it("retains property-specific taxonomic scope and source IDs", () => {
    const result = project([byId("buttercrunch-lettuce")]).candidates[0]!;
    const hydroReason = result.factualReasons.find(
      (reason) => reason.property === "cultivation_suitability",
    )!;
    expect(hydroReason.evidence).toEqual([
      expect.objectContaining({
        sourceId: "uf-hydro-lettuce",
        property: "cultivation_suitability",
        taxonomicScope: { level: "species", taxon: "Lactuca sativa" },
      }),
    ]);
  });

  it("filters irrelevant engine unknowns into a small set of decision-relevant gaps", () => {
    const result = project([byId("buttercrunch-lettuce")]).candidates[0]!;
    expect(result.missingInformation.map((item) => item.property)).toEqual([
      "specific_system_fit",
      "physical_clearance",
    ]);
    expect(result.missingInformation).toHaveLength(2);
  });

  it("uses stable alphabetical display order with no winner/rank semantics", () => {
    const results = evaluateEntries(pilot);
    const first = projectEmptyPositionCandidates(results, pilot, {
      cultivationMethod: "hydroponic",
      systemName: "Aera One",
    });
    const second = projectEmptyPositionCandidates(results, pilot, {
      cultivationMethod: "hydroponic",
      systemName: "Aera One",
    });
    expect(first).toEqual(second);
    expect(first.order).toBe("common_name_alphabetical");
    expect(first.candidates.map((item) => item.plant.commonName)).toEqual(
      [...first.candidates.map((item) => item.plant.commonName)].sort((a, b) => a.localeCompare(b)),
    );
    expect(first.candidates[0]).not.toHaveProperty("rank");
    expect(first.candidates[0]).not.toHaveProperty("score");
  });

  it("keeps unknown garden context useful without claiming physical fit", () => {
    const noMethodGarden = garden({
      cultivationMethod: null,
      machine: { name: "Unknown system", pods: 4 },
    });
    const result = project([byId("buttercrunch-lettuce")], noMethodGarden).candidates[0]!;
    expect(result.cultivationCompatibility).toEqual({ method: null, state: "unknown" });
    expect(result.physicalFit.state).toBe("unknown");
    expect(result.missingInformation.map((item) => item.property)).toContain(
      "cultivation_suitability",
    );
    expect(result.requiresVerificationBeforePlanting).toBe(true);
  });
});
