import { describe, expect, it } from "vitest";
import type { Garden } from "./garden-data";
import {
  buildEmptyGardenPositionInput,
  evaluateEmptyGardenPosition,
  verifiedMachineContextForGarden,
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
      machineFact: verifiedMachineContextForGarden(currentGarden).machineFact,
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
    expect(result.tier).toBe("excluded");
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
    expect(result.tier).toBe("recommended");
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

  it("preserves the deterministic engine order without adding winner/rank semantics", () => {
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
    expect(first.order).toBe("engine_deterministic");
    const reversed = projectEmptyPositionCandidates([...results].reverse(), pilot, {
      cultivationMethod: "hydroponic",
      systemName: "Aera One",
    });
    expect(reversed.candidates.map((item) => item.plant.libraryPlantId)).toEqual(
      [...first.candidates].reverse().map((item) => item.plant.libraryPlantId),
    );
    expect(first.candidates[0]).not.toHaveProperty("rank");
    expect(first.candidates[0]).not.toHaveProperty("score");
  });

  it("keeps unknown candidates in the secondary evidence tier rather than promoting them", () => {
    const result = project([byId("common-mint")]).candidates[0]!;
    expect(result.cultivationCompatibility.state).toBe("unknown");
    expect(result.tier).toBe("insufficient_evidence");
  });

  it("does not promote giant sunflowers with unknown hydroponic suitability", () => {
    const entries = gardenLibraryManifest.entries.filter((entry) =>
      ["sunflower-american-giant-hybrid", "sunflower-autumn-beauty"].includes(entry.libraryPlantId),
    );
    const results = evaluateEntries(entries);
    const projected = projectEmptyPositionCandidates(results, entries, {
      cultivationMethod: "hydroponic",
      systemName: "Aera One",
    });
    expect(projected.candidates).toHaveLength(2);
    expect(
      projected.candidates.every((candidate) => candidate.tier === "insufficient_evidence"),
    ).toBe(true);
    expect(
      projected.candidates.every(
        (candidate) => candidate.cultivationCompatibility.state === "unknown",
      ),
    ).toBe(true);
  });

  it("tiers documented, conditional, and unknown candidates without changing their evidence states", () => {
    const entries = [byId("buttercrunch-lettuce"), byId("cascading-petunia"), byId("common-mint")];
    const result = project(entries);
    expect(
      result.candidates.find(
        (candidate) => candidate.plant.libraryPlantId === "buttercrunch-lettuce",
      )?.tier,
    ).toBe("check_first");
    expect(
      result.candidates.find((candidate) => candidate.plant.libraryPlantId === "cascading-petunia")
        ?.tier,
    ).toBe("check_first");
    expect(
      result.candidates.find((candidate) => candidate.plant.libraryPlantId === "common-mint")?.tier,
    ).toBe("insufficient_evidence");
  });

  it("shows exact-model machine facts and keeps Cascading Petunia conditional outside AeroGarden", () => {
    const uruQ8 = garden({ systemDefinitionKey: "uruq_8_v1" });
    const result = project([byId("cascading-petunia")], uruQ8);
    const petunia = result.candidates[0]!;
    expect(result.machineFact).toMatchObject({ modelNumber: "HP-GC001", maxGrowHeightCm: 40 });
    expect(result.machineFact?.source.url).toContain("snapklik.com");
    expect(petunia.cultivationCompatibility.state).toBe("conditional");
    expect(petunia.systemFit.state).toBe("conditional");
    expect(petunia.physicalFit.state).toBe("supported");
    expect(petunia.tier).toBe("check_first");
  });

  it("promotes a satisfied system condition only when the position has no review signal", () => {
    const aeroGarden = garden({
      machine: { name: "Custom label", pods: 6 },
      systemDefinitionKey: "aerogarden-harvest-v1",
    });
    const result = project([byId("cascading-petunia")], aeroGarden).candidates[0]!;
    expect(result.cultivationCompatibility.state).toBe("compatible");
    expect(result.systemFit.state).toBe("documented");
    expect(result.physicalFit.state).toBe("unknown");
    expect(result.tier).toBe("recommended");
  });

  it("keeps the H1/H4/H5 controls grounded in their explicit machine keys and H5 hydroponic method", () => {
    const h1 = garden({
      id: "f11d29ca-f971-4a13-8a38-0e10fdf0740e",
      systemDefinitionKey: "uruq_8_v1",
    });
    const h4 = garden({
      id: "h4-fixture",
      systemDefinitionKey: "custom:246a11e4-407d-4d27-bcdf-cd753d741174",
      customSystemDefinitionId: "246a11e4-407d-4d27-bcdf-cd753d741174",
    });
    const h5 = garden({
      id: "h5-fixture",
      systemDefinitionKey: "custom:8c9295a0-5580-46e6-8a29-4cfd7c8d2416",
      customSystemDefinitionId: "8c9295a0-5580-46e6-8a29-4cfd7c8d2416",
      machine: { name: "Uruq", pods: 12 },
    });
    const h1Input = buildEmptyGardenPositionInput(h1, "p1", [], pilot);
    const h4Input = buildEmptyGardenPositionInput(h4, "p1", [], pilot);
    const h5Input = buildEmptyGardenPositionInput(h5, "p1", [], pilot);
    expect(h1Input.target.verifiedFacts.clearance?.heightCm).toBe(40);
    expect(h4Input.target.verifiedFacts.clearance).toBeUndefined();
    expect(h5Input.target.verifiedFacts.clearance).toBeUndefined();
    expect(h5Input.target.cultivationContext).toBe("hydroponic");

    const sunflowerResults = project(
      [
        gardenLibraryManifest.entries.find(
          (entry) => entry.libraryPlantId === "sunflower-american-giant-hybrid",
        )!,
        gardenLibraryManifest.entries.find(
          (entry) => entry.libraryPlantId === "sunflower-autumn-beauty",
        )!,
      ],
      h5,
    );
    expect(
      sunflowerResults.candidates.every((candidate) => candidate.tier === "insufficient_evidence"),
    ).toBe(true);
    expect(
      sunflowerResults.candidates.every(
        (candidate) => candidate.cultivationCompatibility.state === "unknown",
      ),
    ).toBe(true);
  });

  it("preserves source links for a documented expansive neighbor review", () => {
    const currentGarden = garden();
    const strawberry = {
      id: "neighbor-strawberry",
      gardenId: currentGarden.id,
      backendPositionId: "p2",
      backendGrowCycleId: "cycle-strawberry",
      name: "Strawberry",
      species: "",
      scientific: "",
      variety: "",
      knowledgeId: "monterey-strawberry",
      libraryPlantId: "monterey-strawberry",
      plantedDaysAgo: 0,
      status: "steady" as const,
      statusNote: "",
      heroPhotoId: "",
      identityConfirmed: true,
    };
    const entries = [byId("buttercrunch-lettuce"), byId("monterey-strawberry")];
    const candidate = project(entries, currentGarden, [strawberry]).candidates.find(
      (item) => item.plant.libraryPlantId === "buttercrunch-lettuce",
    )!;
    const neighborReason = candidate.factualReasons.find(
      (reason) => reason.property === "growth_habit",
    );
    expect(candidate.physicalFit.state).toBe("needs_review");
    expect(neighborReason?.evidence.length).toBeGreaterThan(0);
    expect(neighborReason?.evidence.some((item) => item.sourceUrl && item.sourceTitle)).toBe(true);
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
