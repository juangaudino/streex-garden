import { describe, expect, it } from "vitest";
import type { Garden, Plant } from "./garden-data";
import {
  buildEmptyGardenPositionInput,
  evaluateEmptyGardenPosition,
  formatCompatibilityDiagnostics,
  verifiedMachineContextForGarden,
} from "./garden-compatibility-engine";
import { gardenLibraryManifest } from "../generated/garden-library-manifest";
import type { GardenLibraryEntry } from "./garden-library";

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

function plant(
  id: string,
  positionId: string,
  libraryPlantId: string,
  growCycleId = `cycle-${id}`,
  overrides: Partial<Plant> = {},
): Plant {
  return {
    id,
    gardenId: "garden-a",
    backendPositionId: positionId,
    backendGrowCycleId: growCycleId,
    name: id,
    species: "",
    scientific: "",
    variety: "",
    knowledgeId: libraryPlantId,
    libraryPlantId,
    plantedDaysAgo: 0,
    status: "steady",
    statusNote: "",
    heroPhotoId: "",
    identityConfirmed: true,
    ...overrides,
  };
}

function evaluate(
  currentGarden = garden(),
  targetPositionId = "p1",
  plants: readonly Plant[] = [],
  facts: Parameters<typeof buildEmptyGardenPositionInput>[4] = {},
) {
  const input = buildEmptyGardenPositionInput(
    currentGarden,
    targetPositionId,
    plants,
    pilot,
    facts,
  );
  return { input, results: evaluateEmptyGardenPosition(input, pilot) };
}

describe("Garden X B3.3 deterministic compatibility engine", () => {
  it("A — keeps documented hydroponic candidates and unknown/pending candidates eligible", () => {
    const { results } = evaluate();
    expect(results).toHaveLength(43);
    expect(results.every((result) => result.eligibility === "eligible")).toBe(true);
    expect(
      results.find((result) => result.candidate.libraryPlantId === "buttercrunch-lettuce")
        ?.systemFit,
    ).toBe("unknown");
    expect(
      results.find((result) => result.candidate.libraryPlantId === "common-mint")?.compatibility,
    ).toBe("unknown");
    expect(
      results.find(
        (result) => result.candidate.libraryPlantId === "evergreen-bunching-onion-nabuka",
      )?.compatibility,
    ).toBe("unknown");
    expect(
      results.find((result) => result.candidate.libraryPlantId === "cascading-petunia")
        ?.compatibility,
    ).toBe("conditional");
    expect(formatCompatibilityDiagnostics(results)).toContain("Common Mint — unknown (eligible)");
  });

  it("excludes only an explicit, evidence-backed hydroponic incompatibility", () => {
    const source = byId("buttercrunch-lettuce");
    const explicitIncompatibility: GardenLibraryEntry = {
      ...source,
      compatibilityProfile: {
        ...source.compatibilityProfile!,
        hydroponicSuitability: {
          status: "incompatible",
          evidence:
            source.compatibilityProfile!.hydroponicSuitability.status === "compatible"
              ? source.compatibilityProfile!.hydroponicSuitability.evidence
              : [],
        },
      },
    };
    const { input } = evaluate();
    const [result] = evaluateEmptyGardenPosition(input, [explicitIncompatibility]);
    expect(result).toMatchObject({ compatibility: "incompatible", eligibility: "excluded" });
    expect(result.exclusions[0]?.sourceIds).toContain("uf-hydro-lettuce");
  });

  it("B — uses explicit comparable centimeters as a soft ranking signal, never as an unknown-size failure", () => {
    const facts = { clearance: { heightCm: 35, context: "hydroponic" as const } };
    const { results } = evaluate(
      garden({ machine: { name: "AeroGarden", pods: 4 } }),
      "p1",
      [],
      facts,
    );
    const petunia = results.find(
      (result) => result.candidate.libraryPlantId === "cascading-petunia",
    )!;
    expect(petunia.rankingSignals).toContainEqual(
      expect.objectContaining({ code: "known_height_fits", effect: "supports_context" }),
    );
    expect(petunia.unknowns.some((unknown) => unknown.property === "mature_spread")).toBe(true);
    expect(petunia.eligibility).toBe("eligible");
    expect(formatCompatibilityDiagnostics([petunia])).toContain(
      "within the explicitly recorded height clearance of 35 cm",
    );
  });

  it("preserves uncertainty when a one-sided mature-size bound cannot establish physical fit", () => {
    const { results } = evaluate(garden({ machine: { name: "AeroGarden", pods: 4 } }), "p1", [], {
      clearance: { heightCm: 25, context: "hydroponic" },
    });
    const petunia = results.find(
      (result) => result.candidate.libraryPlantId === "cascading-petunia",
    )!;
    expect(petunia.unknowns).toContainEqual(
      expect.objectContaining({
        property: "mature_height_fit",
        reason: expect.stringContaining("does not establish whether the plant fits"),
      }),
    );
    expect(petunia.eligibility).toBe("eligible");
    expect(petunia.exclusions).toHaveLength(0);
    expect(petunia.rankingSignals.some((signal) => signal.code === "known_height_fits")).toBe(
      false,
    );
  });

  it("C — detects the geometric perimeter but does not infer space beyond it for trailing plants", () => {
    const { input, results } = evaluate(garden({ machine: { name: "AeroGarden", pods: 4 } }), "p1");
    const petunia = results.find(
      (result) => result.candidate.libraryPlantId === "cascading-petunia",
    )!;
    expect(input.target.isPerimeter).toBe(true);
    expect(input.target.verifiedFacts.clearBeyondPerimeter).toBeUndefined();
    expect(petunia.rankingSignals.some((signal) => signal.code.includes("perimeter"))).toBe(false);
    expect(petunia.reasons.some((reason) => reason.code.includes("perimeter"))).toBe(false);
    const withKnownExtension = evaluate(
      garden({ machine: { name: "AeroGarden", pods: 4 } }),
      "p1",
      [],
      { clearBeyondPerimeter: true },
    ).results.find((result) => result.candidate.libraryPlantId === "cascading-petunia")!;
    expect(withKnownExtension.rankingSignals).toContainEqual(
      expect.objectContaining({
        code: "documented_expansive_habit_has_clear_perimeter_space",
        effect: "supports_context",
      }),
    );
  });

  it("D — preserves every adjacent occupant and cycle without inferring companion-planting biology", () => {
    const plants = [
      plant("basil-a", "p2", "genovese-basil", "cycle-basil-a"),
      plant("mint-b", "p2", "common-mint", "cycle-mint-b"),
    ];
    const { input, results } = evaluate(garden(), "p1", plants);
    expect(
      input.positions
        .find((position) => position.id === "p2")
        ?.occupants.map((occupant) => occupant.growCycleId),
    ).toEqual(["cycle-basil-a", "cycle-mint-b"]);
    expect(input.positions.find((position) => position.id === "p2")?.occupants).toHaveLength(2);
    expect(
      results.every((result) =>
        result.rankingSignals.some((signal) => signal.code === "adjacent_occupancy_known"),
      ),
    ).toBe(true);
    expect(
      results
        .flatMap((result) => result.reasons)
        .some((reason) => /companion|pairing|beneficial/i.test(reason.statement)),
    ).toBe(false);
    expect(formatCompatibilityDiagnostics(results)).toContain(
      "2 active Plant Instance(s) occupy 1 adjacent physical position(s)",
    );
  });

  it("E — returns candidates with sparse context and reports missing facts without exclusions", () => {
    const sparseGarden = garden({
      kind: "backyard",
      cultivationMethod: null,
      machine: undefined,
      systemLayoutLevels: undefined,
    });
    const { results } = evaluate(sparseGarden);
    expect(results).toHaveLength(43);
    expect(results.every((result) => result.eligibility === "eligible")).toBe(true);
    const cherry = results.find((result) => result.candidate.libraryPlantId === "cherry-tomato")!;
    expect(cherry.compatibility).toBe("unknown");
    expect(cherry.unknowns.map((unknown) => unknown.property)).toContain("light");
    expect(cherry.unknowns.map((unknown) => unknown.property)).toContain("spacing");
    expect(formatCompatibilityDiagnostics([cherry])).toContain(
      "Cherry Tomato — unknown (eligible)",
    );
  });

  it("F — keeps Tiny Tim's cultivar-scoped habit and dimensions out of generic Cherry Tomato", () => {
    const { results } = evaluate();
    const tinyTim = results.find(
      (result) => result.candidate.libraryPlantId === "tiny-tim-tomato",
    )!;
    const cherry = results.find((result) => result.candidate.libraryPlantId === "cherry-tomato")!;
    expect(
      tinyTim.reasons.find((reason) => reason.property === "growth_habit")?.statement,
    ).toContain("bushy");
    expect(
      tinyTim.reasons.find((reason) => reason.property === "growth_habit")?.taxonomicScopes,
    ).toEqual(["identity"]);
    expect(cherry.reasons.some((reason) => reason.property === "growth_habit")).toBe(false);
    expect(cherry.unknowns.some((unknown) => unknown.property === "growth_habit")).toBe(true);
    expect(cherry.reasons.some((reason) => reason.sourceIds.includes("rhs-tiny-tim"))).toBe(false);
  });

  it("G — resolves a system-specific condition only from the stable system identity, not its editable name", () => {
    const candidate = byId("cascading-petunia");
    const aero = evaluate(
      garden({
        machine: { name: "Aera One", pods: 6 },
        systemDefinitionKey: "aerogarden-harvest-v1",
      }),
    ).results.find((result) => result.candidate.libraryPlantId === candidate.libraryPlantId)!;
    const renamedSystem = evaluate(
      garden({
        machine: { name: "AeroGarden Harvest", pods: 6 },
        systemDefinitionKey: "aera-one-v1",
      }),
    ).results.find((result) => result.candidate.libraryPlantId === candidate.libraryPlantId)!;
    expect(aero.compatibility).toBe("compatible");
    expect(aero.systemFit).toBe("documented_condition_met");
    expect(aero.reasons.some((reason) => reason.code === "documented_system_condition_met")).toBe(
      true,
    );
    expect(renamedSystem.compatibility).toBe("conditional");
    expect(renamedSystem.systemFit).toBe("unknown");
    expect(renamedSystem.eligibility).toBe("eligible");
    expect(renamedSystem.exclusions).toHaveLength(0);
  });

  it.each([
    ["hydroponic", "hydroponic"],
    ["soil", "soil"],
    ["container", "container"],
  ] as const)(
    "uses an explicit %s cultivation method independently of Garden kind",
    (method, expected) => {
      const { input } = evaluate(garden({ kind: "indoor", cultivationMethod: method }));
      expect(input.target.cultivationContext).toBe(expected);
    },
  );

  it("does not infer cultivation method from Garden kind or treat hydroponic evidence as soil/container fit", () => {
    for (const method of ["soil", "container"] as const) {
      const { results } = evaluate(
        garden({ kind: method === "soil" ? "backyard" : "balcony", cultivationMethod: method }),
      );
      const buttercrunch = results.find(
        (result) => result.candidate.libraryPlantId === "buttercrunch-lettuce",
      )!;
      expect(buttercrunch.compatibility).toBe("unknown");
      expect(buttercrunch.systemFit).toBe("unknown");
      expect(buttercrunch.eligibility).toBe("eligible");
      expect(buttercrunch.exclusions).toHaveLength(0);
    }
    const unknown = evaluate(garden({ kind: "hydroponic", cultivationMethod: null })).results.find(
      (result) => result.candidate.libraryPlantId === "buttercrunch-lettuce",
    )!;
    expect(unknown.compatibility).toBe("unknown");
    expect(
      unknown.unknowns.some((item) => item.reason.includes("no explicit cultivation method")),
    ).toBe(true);
  });

  it("does not apply explicit hydroponic incompatibility to a soil Garden", () => {
    const entry = byId("buttercrunch-lettuce");
    const explicitlyHydroIncompatible: GardenLibraryEntry = {
      ...entry,
      compatibilityProfile: {
        ...entry.compatibilityProfile!,
        hydroponicSuitability: {
          status: "incompatible",
          evidence:
            entry.compatibilityProfile!.hydroponicSuitability.status === "compatible"
              ? entry.compatibilityProfile!.hydroponicSuitability.evidence
              : [],
        },
      },
    };
    const { input } = evaluate(garden({ kind: "backyard", cultivationMethod: "soil" }));
    const [result] = evaluateEmptyGardenPosition(input, [explicitlyHydroIncompatible]);
    expect(result).toMatchObject({ compatibility: "unknown", eligibility: "eligible" });
    expect(result.exclusions).toHaveLength(0);
  });

  it("keeps method suitability distinct from a named-system match and physical fit", () => {
    const tinyTim = evaluate(garden({ cultivationMethod: "hydroponic" })).results.find(
      (result) => result.candidate.libraryPlantId === "tiny-tim-tomato",
    )!;
    expect(tinyTim.compatibility).toBe("compatible");
    expect(tinyTim.systemFit).toBe("unknown");
    expect(tinyTim.unknowns.some((item) => item.property === "mature_height_fit")).toBe(true);
    expect(tinyTim.unknowns.some((item) => item.property === "mature_spread_fit")).toBe(true);
  });

  it("H — keeps pending Common Mint eligible and surfaces spreading near occupied positions as a consideration", () => {
    const { results } = evaluate(garden(), "p1", [plant("mint", "p2", "common-mint")]);
    const mint = results.find((result) => result.candidate.libraryPlantId === "common-mint")!;
    expect(mint.compatibility).toBe("unknown");
    expect(mint.eligibility).toBe("eligible");
    expect(
      mint.rankingSignals.some(
        (signal) =>
          signal.code === "expansive_habit_clearance_unresolved" &&
          signal.effect === "needs_review",
      ),
    ).toBe(true);
    expect(mint.exclusions).toHaveLength(0);
    expect(formatCompatibilityDiagnostics([mint])).toContain(
      "no measured clearance to determine whether the habit has room",
    );
  });

  it("never compares outdoor plant spacing to hydroponic pod spacing", () => {
    const input = buildEmptyGardenPositionInput(garden(), "p1", [], pilot, {
      positionSpacing: { distanceCm: 28, context: "hydroponic" },
    });
    const buttercrunch = evaluateEmptyGardenPosition(input, pilot).find(
      (result) => result.candidate.libraryPlantId === "buttercrunch-lettuce",
    )!;
    expect(buttercrunch.reasons.some((reason) => reason.property === "spacing")).toBe(false);
    expect(buttercrunch.unknowns.some((unknown) => unknown.property === "applicable_spacing")).toBe(
      true,
    );
  });

  it("rejects invalid or occupied target positions instead of evaluating them as empty", () => {
    const invalid = buildEmptyGardenPositionInput(garden(), "missing", [], pilot);
    expect(() => evaluateEmptyGardenPosition(invalid, pilot)).toThrow(/structurally valid/);
    const occupied = buildEmptyGardenPositionInput(
      garden(),
      "p1",
      [plant("plant", "p1", "genovese-basil")],
      pilot,
    );
    expect(() => evaluateEmptyGardenPosition(occupied, pilot)).toThrow(/must be empty/);
  });

  it("excludes closed cycles from position occupancy and ignores plants from other Gardens", () => {
    const plants = [
      plant("closed", "p2", "genovese-basil", "old-cycle", { cycleClosed: true }),
      plant("other-garden", "p2", "common-mint", "cycle-other", { gardenId: "garden-b" }),
    ];
    const { input } = evaluate(garden(), "p1", plants);
    expect(input.positions.find((position) => position.id === "p2")?.occupants).toHaveLength(0);
  });
});

describe("B3 Phase 2 canonical machine and neighbor facts", () => {
  it("uses only exact system-definition links for documented URUQ grow heights", () => {
    const uruQ8 = verifiedMachineContextForGarden({ systemDefinitionKey: "uruq_8_v1" });
    const uruQ12 = verifiedMachineContextForGarden({ systemDefinitionKey: "uruq_12_v1" });
    const customH4 = verifiedMachineContextForGarden({ systemDefinitionKey: "custom:ahopegarden" });
    const customH5 = verifiedMachineContextForGarden({ systemDefinitionKey: "custom:uruq" });
    const unknownKey = verifiedMachineContextForGarden({ systemDefinitionKey: "toString" });

    expect(uruQ8.verifiedFacts.clearance).toEqual({
      heightCm: 40,
      context: "hydroponic",
      kind: "documented_grow_height_limit",
    });
    expect(uruQ8.machineFact?.modelNumber).toBe("HP-GC001");
    expect(uruQ12.verifiedFacts.clearance).toEqual({
      heightCm: 53.3,
      context: "hydroponic",
      kind: "documented_grow_height_limit",
    });
    expect(customH4.machineFact).toBeNull();
    expect(customH5.machineFact).toBeNull();
    expect(unknownKey.machineFact).toBeNull();
  });

  it("automatically adds only comparable machine clearance and keeps custom dimensions unknown", () => {
    const exactMachine = garden({ systemDefinitionKey: "uruq_8_v1" });
    const customMachine = garden({
      systemDefinitionKey: "custom:uruq",
      machine: { name: "Uruq", pods: 8 },
    });
    const exactInput = buildEmptyGardenPositionInput(exactMachine, "p1", [], pilot);
    const customInput = buildEmptyGardenPositionInput(customMachine, "p1", [], pilot);
    expect(exactInput.target.verifiedFacts.clearance?.heightCm).toBe(40);
    expect(customInput.target.verifiedFacts.clearance).toBeUndefined();

    const petunia = evaluateEmptyGardenPosition(exactInput, [byId("cascading-petunia")])[0]!;
    expect(petunia.compatibility).toBe("conditional");
    expect(petunia.systemFit).toBe("unknown");
    expect(petunia.rankingSignals.some((signal) => signal.code === "known_height_fits")).toBe(true);
  });

  it("uses actual diagonal neighbor occupancy and documented neighbor habit without inferring biology", () => {
    const currentGarden = garden({
      systemDefinitionKey: "uruq_8_v1",
      backendPositions: [
        { id: "target", number: 1, active: true, levelNumber: 1, rowNumber: 1, columnNumber: 1 },
        { id: "neighbor", number: 2, active: true, levelNumber: 1, rowNumber: 2, columnNumber: 2 },
      ],
      systemLayoutLevels: [{ levelNumber: 1, rows: 2, columns: 2 }],
    });
    const neighbor = plant("neighbor-instance", "neighbor", "monterey-strawberry");
    const input = buildEmptyGardenPositionInput(currentGarden, "target", [neighbor], pilot);
    expect(input.adjacentPositionIds).toEqual(["neighbor"]);
    expect(input.positions.find((position) => position.id === "neighbor")?.occupants).toHaveLength(
      1,
    );

    const noNeighbor = evaluateEmptyGardenPosition(
      buildEmptyGardenPositionInput(currentGarden, "target", [], pilot),
      [byId("monterey-strawberry")],
    )[0]!;
    const withNeighbor = evaluateEmptyGardenPosition(input, [byId("monterey-strawberry")])[0]!;
    expect(
      noNeighbor.rankingSignals.some(
        (signal) => signal.code === "documented_expansive_neighbor_fit_needs_review",
      ),
    ).toBe(false);
    expect(
      withNeighbor.rankingSignals.some(
        (signal) => signal.code === "documented_expansive_neighbor_fit_needs_review",
      ),
    ).toBe(true);
    expect(withNeighbor.eligibility).toBe("eligible");
    expect(withNeighbor.exclusions).toHaveLength(0);
  });

  it("produces equivalent results when two positions have equivalent facts and no relevant neighbor difference", () => {
    const symmetric = garden({
      backendPositions: [
        { id: "p1", number: 1, active: true, levelNumber: 1, rowNumber: 1, columnNumber: 1 },
        { id: "p2", number: 2, active: true, levelNumber: 1, rowNumber: 1, columnNumber: 2 },
        { id: "p3", number: 3, active: true, levelNumber: 1, rowNumber: 2, columnNumber: 1 },
        { id: "p4", number: 4, active: true, levelNumber: 1, rowNumber: 2, columnNumber: 2 },
      ],
    });
    const p1 = evaluateEmptyGardenPosition(
      buildEmptyGardenPositionInput(symmetric, "p1", [], pilot),
      pilot,
    );
    const p4 = evaluateEmptyGardenPosition(
      buildEmptyGardenPositionInput(symmetric, "p4", [], pilot),
      pilot,
    );
    expect(p1).toEqual(p4);
  });

  it("keeps H1, H4, and H5 cultivation evidence independent from machine measurements", () => {
    const controls = [
      garden({ id: "f11d29ca-f971-4a13-8a38-0e10fdf0740e", systemDefinitionKey: "uruq_8_v1" }),
      garden({
        id: "h4-fixture",
        cultivationMethod: "hydroponic",
        systemDefinitionKey: "custom:246a11e4-407d-4d27-bcdf-cd753d741174",
        customSystemDefinitionId: "246a11e4-407d-4d27-bcdf-cd753d741174",
      }),
      garden({
        id: "h5-fixture",
        cultivationMethod: "hydroponic",
        systemDefinitionKey: "custom:8c9295a0-5580-46e6-8a29-4cfd7c8d2416",
        customSystemDefinitionId: "8c9295a0-5580-46e6-8a29-4cfd7c8d2416",
      }),
    ];
    for (const currentGarden of controls) {
      const input = buildEmptyGardenPositionInput(currentGarden, "p1", [], pilot);
      expect(input.target.cultivationContext).toBe("hydroponic");
      const results = evaluateEmptyGardenPosition(input, [
        byId("bibb-lettuce"),
        byId("buttercrunch-lettuce"),
        byId("cherry-tomato"),
      ]);
      expect(results.map((result) => result.compatibility)).toEqual([
        "compatible",
        "compatible",
        "compatible",
      ]);
    }
    expect(
      controls.map(
        (currentGarden) => verifiedMachineContextForGarden(currentGarden).machineFact !== null,
      ),
    ).toEqual([true, false, false]);
  });

  it("keeps H5 P1 and P6 equivalent when their actual adjacent facts do not establish a crowding conflict", () => {
    const h5 = garden({
      id: "h5-fixture",
      systemDefinitionKey: "custom:8c9295a0-5580-46e6-8a29-4cfd7c8d2416",
      backendPositions: [
        { id: "p1", number: 1, active: true, levelNumber: 1, rowNumber: 1, columnNumber: 2 },
        { id: "p3", number: 3, active: true, levelNumber: 1, rowNumber: 2, columnNumber: 1 },
        { id: "p5", number: 5, active: true, levelNumber: 1, rowNumber: 2, columnNumber: 5 },
        { id: "p6", number: 6, active: true, levelNumber: 1, rowNumber: 1, columnNumber: 6 },
      ],
      systemLayoutLevels: [{ levelNumber: 1, rows: 4, columns: 7 }],
    });
    const occupancy = [
      plant("bibb-h5", "p3", "bibb-lettuce", "cycle-bibb", { gardenId: h5.id }),
      plant("garlic-chives-h5", "p5", "garlic-chives", "cycle-garlic", { gardenId: h5.id }),
    ];
    const p1 = evaluate(h5, "p1", occupancy).results;
    const p6 = evaluate(h5, "p6", occupancy).results;
    expect(p1).toEqual(p6);
    expect(
      p1
        .find((item) => item.candidate.libraryPlantId === "buttercrunch-lettuce")
        ?.rankingSignals.some((signal) => signal.effect === "needs_review"),
    ).toBe(false);
  });

  it("uses a documented spreading neighbor to request review without inferring current size or incompatibility", () => {
    const h4 = garden({
      id: "h4-fixture",
      systemDefinitionKey: "custom:246a11e4-407d-4d27-bcdf-cd753d741174",
      customSystemDefinitionId: "246a11e4-407d-4d27-bcdf-cd753d741174",
    });
    const neighbor = plant("strawberry-h4", "p2", "monterey-strawberry", "cycle-strawberry", {
      gardenId: h4.id,
    });
    const { results, input } = evaluate(h4, "p1", [neighbor]);
    const buttercrunch = results.find(
      (item) => item.candidate.libraryPlantId === "buttercrunch-lettuce",
    )!;
    expect(input.adjacentPositionIds).toContain("p2");
    expect(buttercrunch.compatibility).toBe("compatible");
    expect(buttercrunch.eligibility).toBe("eligible");
    expect(buttercrunch.exclusions).toHaveLength(0);
    expect(
      buttercrunch.rankingSignals.some(
        (signal) => signal.code === "documented_expansive_neighbor_fit_needs_review",
      ),
    ).toBe(true);
  });
});
