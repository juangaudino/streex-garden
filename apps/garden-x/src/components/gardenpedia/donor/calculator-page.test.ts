import { describe, expect, it, vi } from "vitest";

import { AEROGARDEN_RECIPE, FLORA_RECIPE } from "@/lib/garden-nutrient-engine-v1/data";
import {
  buildCalibrationModel,
  calculateEcCorrection,
  calculateFreshTargetEc,
  calculateTopUpMaintenance,
  executeFreshRecipe,
  learnFromObservation,
} from "@/lib/garden-nutrient-engine-v1/engine";
import { donorPlants } from "./canonical-adapter";
import { MODE_TO_ENGINE, recipeSignature } from "./calculator-v1-adapter";
import {
  CALCULATOR_PLANTS,
  CALCULATOR_STAGES,
  calculateGardenResult,
  loadSavedSystems,
  persistSavedSystems,
  recordActualDoses,
  resolveNutrientCropIdentity,
} from "./calculator-lovable-adapter";

describe("Gardenpedia Calculator V1 integration", () => {
  it("uses the canonical 214-identity catalog", () => {
    expect(donorPlants).toHaveLength(214);
    expect(CALCULATOR_PLANTS).toHaveLength(214);
    expect(donorPlants.map((plant) => plant.id)).toContain("genovese-basil");
  });

  it("resolves only explicitly verified Gardenpedia identity mappings", () => {
    expect(resolveNutrientCropIdentity("genovese-basil")).toBe("basil");
    expect(resolveNutrientCropIdentity("common-mint")).toBeUndefined();
  });

  it("maps each UX mode to exactly one V1 operating mode", () => {
    expect(MODE_TO_ENGINE).toEqual({
      recipe: "FRESH_RECIPE",
      target: "FRESH_TARGET_EC",
      correction: "EC_CORRECTION",
      topup: "TOP_UP_MAINTENANCE",
    });
  });

  it("renders the official Flora recipe as three real components", () => {
    const result = executeFreshRecipe({ recipeId: FLORA_RECIPE.id, volumeL: 2, feedingIndex: 2 });
    expect(result.ok).toBe(true);
    expect(result.value?.parts.map((part) => part.label)).toEqual([
      "FloraMicro",
      "FloraGro",
      "FloraBloom",
    ]);
    expect(result.value?.recipe.mixingOrder).toEqual(["micro", "gro", "bloom"]);
  });

  it("projects every verified FloraSeries feeding step without inventing plant phenology", () => {
    expect(CALCULATOR_STAGES.map((stage) => stage.feedingIndex)).toEqual([1, 2, 4, 5, 7, 10, 12]);
    const result = calculateGardenResult({
      mode: "recipe",
      crops: { "genovese-basil": 1 },
      liters: 2,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.expectedEc).toEqual({ kind: "manufacturer", min: 0.9, max: 1.1 });
      expect(result.evidence).toBe("high");
    }
  });

  it("keeps an unmapped published identity insufficient instead of guessing a crop", () => {
    const result = calculateGardenResult({
      mode: "recipe",
      crops: { "common-mint": 1 },
      liters: 2,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.evidence).toBe("insufficient");
  });

  it("uses supported AeroGarden pod/feed semantics without volume or interpolation", () => {
    const supported = executeFreshRecipe({
      recipeId: AEROGARDEN_RECIPE.id,
      podCount: 9,
      feedingIndex: 1,
    });
    expect(supported.ok).toBe(true);
    expect(supported.value?.parts[0]?.ml).toBe(8);
    const unsupported = executeFreshRecipe({
      recipeId: AEROGARDEN_RECIPE.id,
      podCount: 12,
      feedingIndex: 1,
    });
    expect(unsupported.ok).toBe(false);
    expect(unsupported.errors[0]?.code).toBe("UNSUPPORTED_POD_COUNT");
  });

  it("preserves an edited EC target and warns instead of replacing it", () => {
    const result = calculateFreshTargetEc({
      contexts: [
        {
          cropIdentity: "basil",
          phenologicalStage: "UNSPECIFIED",
          measurementScope: "NUTRIENT_SOLUTION",
        },
      ],
      userSelectedTarget: 2.1,
    });
    expect(result.ok).toBe(true);
    expect(result.value?.target).toEqual({ min: 2.1, max: 2.1, unit: "mS/cm" });
    expect(result.warnings.some((warning) => warning.code === "USER_TARGET_OUTSIDE_EVIDENCE")).toBe(
      true,
    );
  });

  it("records actual multi-component applied doses rather than assuming the recommendation", () => {
    const signature = recipeSignature({ micro: 1.8, gro: 1.8, bloom: 1.8 });
    const observation = learnFromObservation({
      productIdentity: FLORA_RECIPE.product,
      formulationVersion: FLORA_RECIPE.product.formulationVersion,
      recipeSignature: signature,
      baselineEc: 0.4,
      resultingEc: 0.8,
      doseAppliedMl: 7.1,
      reservoirVolumeL: 2,
      timestamp: "2026-10-03T00:00:00.000Z",
    });
    expect(observation.ok).toBe(true);
    expect(observation.value?.doseAppliedMl).toBe(7.1);
    expect(observation.errors).toHaveLength(0);
  });

  it("keeps correction iterative and requires a matching calibration", () => {
    const signature = recipeSignature({ micro: 1.8, gro: 1.8, bloom: 1.8 });
    const observations = [1, 2, 3].map((n) => ({
      id: `cal-${n}`,
      productIdentity: FLORA_RECIPE.product,
      formulationVersion: FLORA_RECIPE.product.formulationVersion,
      componentRatioOrRecipeSignature: signature,
      baselineEc: 0.4,
      deltaEc: n * 0.1,
      resultingEc: 0.4 + n * 0.1,
      doseAppliedMl: n,
      reservoirVolumeL: 2,
      timestamp: `2026-10-0${n}`,
    }));
    const calibration = buildCalibrationModel({
      productIdentity: FLORA_RECIPE.product,
      formulationVersion: FLORA_RECIPE.product.formulationVersion,
      recipeSignature: signature,
      observations,
    });
    expect(calibration.value).toBeDefined();
    const correction = calculateEcCorrection({
      currentEc: {
        value: 0.5,
        unit: "mS/cm",
        context: { scope: "NUTRIENT_SOLUTION", scopeBasis: "STATED" },
      },
      targetEc: 0.8,
      reservoirVolumeL: 2,
      calibration: calibration.value!,
      policy: { firstStepFraction: 0.5, dosingEquipmentResolutionMl: 0.5 },
    });
    expect(correction.value?.requiresRemeasurement).toBe(true);
    expect(correction.value?.firstStepDoseMl).toBeDefined();
  });

  it("blocks top-up without current volume and enforces reservoir capacity", () => {
    const base = {
      nominalVolumeL: 4,
      replacementWaterL: 1,
      currentEc: {
        value: 1,
        unit: "mS/cm" as const,
        context: { scope: "NUTRIENT_SOLUTION" as const, scopeBasis: "STATED" as const },
      },
      targetEc: 1.2,
    };
    expect(calculateTopUpMaintenance(base).errors[0]?.code).toBe("CURRENT_VOLUME_REQUIRED");
    expect(calculateTopUpMaintenance({ ...base, currentVolumeL: 4 }).errors[0]?.code).toBe(
      "RESERVOIR_CAPACITY_EXCEEDED",
    );
  });

  it("connects the transplanted Lovable recipe surface to real Flora components", () => {
    const result = calculateGardenResult({
      mode: "recipe",
      crops: { "genovese-basil": 2 },
      liters: 2,
      productId: "gh-flora",
      stageId: "w3",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.provenance).toBe("official");
      expect(result.doses.map((dose) => dose.label)).toEqual([
        "FloraMicro",
        "FloraGro",
        "FloraBloom",
      ]);
    }
  });

  it("keeps a user EC target in the Lovable presentation model", () => {
    const result = calculateGardenResult({
      mode: "target",
      crops: { "genovese-basil": 2 },
      liters: 2,
      productId: "gh-flora",
      stageId: "w3",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: 2.1,
      round: 1,
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.target?.value).toBe(2.1);
      expect(result.provenance).toBe("user");
      expect(result.target?.provenance).toBe("user");
    }
  });

  it("keeps unsupported AeroGarden states explicit instead of interpolating", () => {
    const result = calculateGardenResult({
      mode: "recipe",
      crops: { "genovese-basil": 1 },
      liters: 2,
      productId: "aerogarden",
      stageId: "w1",
      pods: 12,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(result.kind).toBe("needs");
    if (result.kind === "needs") expect(result.message).toContain("will not interpolate");
  });

  it("captures actual component doses through the engine calibration contract", () => {
    const result = recordActualDoses({
      productId: "gh-flora",
      stageId: "w3",
      liters: 2,
      pods: 6,
      baselineEc: 0.4,
      resultingEc: 0.8,
      actualDoses: { micro: "4.8", gro: "4.0", bloom: "3.2" },
    });
    expect(result.ok).toBe(true);
    expect(result.value?.doseAppliedMl).toBe(12);
  });

  it("does not invent canonical saved systems for the transplanted dock", () => {
    expect(loadSavedSystems()).toEqual([]);
  });

  it("persists and restores local saved-system configuration without a canonical write", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    const saved = {
      id: "local-test-system",
      name: "Test system",
      crops: { "genovese-basil": 2 },
      liters: 4,
      productId: "gh-flora",
      water: { label: { es: "Grifo", en: "Tap" }, ec: 0.2 },
      meter: "Pocket meter",
      stageId: "feeding-2",
      pods: 6,
      unit: "mS" as const,
      calibrationObservations: [],
    };
    persistSavedSystems([saved]);
    expect(loadSavedSystems()).toEqual([saved]);
    vi.unstubAllGlobals();
  });
});
