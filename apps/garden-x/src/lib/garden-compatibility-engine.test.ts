import { describe, expect, it } from "vitest";
import type { Garden, Plant } from "./garden-data";
import {
  buildEmptyGardenPositionInput,
  evaluateEmptyGardenPosition,
  formatCompatibilityDiagnostics,
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
    cover: "",
    place: "",
    note: "",
    machine: { name: "Aera One", pods: 4 },
    backendSystemInstanceId: "system-a",
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
    expect(results).toHaveLength(8);
    expect(results.every((result) => result.eligibility === "eligible")).toBe(true);
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
    expect(
      results.findIndex((result) => result.candidate.libraryPlantId === "cascading-petunia"),
    ).toBeLessThan(
      results.findIndex((result) => result.candidate.libraryPlantId === "buttercrunch-lettuce"),
    );
    expect(formatCompatibilityDiagnostics([petunia])).toContain(
      "within the explicitly recorded 35 cm clearance",
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
      machine: undefined,
      systemLayoutLevels: undefined,
    });
    const { results } = evaluate(sparseGarden);
    expect(results).toHaveLength(8);
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

  it("G — resolves the documented AeroGarden condition only for an explicitly named AeroGarden", () => {
    const candidate = byId("cascading-petunia");
    const aero = evaluate(
      garden({ machine: { name: "AeroGarden Harvest", pods: 6 } }),
    ).results.find((result) => result.candidate.libraryPlantId === candidate.libraryPlantId)!;
    const otherSystem = evaluate(garden({ machine: { name: "Aera One", pods: 6 } })).results.find(
      (result) => result.candidate.libraryPlantId === candidate.libraryPlantId,
    )!;
    expect(aero.compatibility).toBe("compatible");
    expect(aero.reasons.some((reason) => reason.code === "documented_system_condition_met")).toBe(
      true,
    );
    expect(otherSystem.compatibility).toBe("conditional");
    expect(otherSystem.eligibility).toBe("eligible");
    expect(otherSystem.exclusions).toHaveLength(0);
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
