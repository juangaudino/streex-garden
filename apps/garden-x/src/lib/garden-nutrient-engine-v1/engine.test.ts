import { describe, expect, it } from "vitest";

import { AEROGARDEN_RECIPE, CROP_EVIDENCE, FLORA_RECIPE, NUTRIENT_SOURCES } from "./data";
import {
  buildCalibrationModel,
  calculateEcCorrection,
  calculateFreshTargetEc,
  calculatePolycultureRange,
  calculateTopUpMaintenance,
  executeFreshRecipe,
  evaluateSourceWater,
  getReplacementGuidance,
  learnFromObservation,
  assertNoFalseCertainty,
  selectApplicable,
  selectCropRange,
  toMsPerCm,
} from "./engine";
import type { CropContext, EvidenceObservation, ProductIdentity, UserMeasurement } from "./types";

const basil: CropContext = {
  cropIdentity: "basil",
  phenologicalStage: "UNSPECIFIED",
  measurementScope: "NUTRIENT_SOLUTION",
};
const tomato: CropContext = {
  cropIdentity: "tomato",
  phenologicalStage: "UNSPECIFIED",
  measurementScope: "NUTRIENT_SOLUTION",
};

function measurement(value: number, scope: UserMeasurement["context"]["scope"]): UserMeasurement {
  return { value, unit: "mS/cm", context: { scope, scopeBasis: "STATED", atcStatus: "UNKNOWN" } };
}

function calibrationInput() {
  const product: ProductIdentity = {
    manufacturer: "General Hydroponics",
    productFamily: "FloraSeries",
    exactProduct: "FloraSeries 3-Part Nutrient System",
    formulationVersion: "2026-07-07-US-3PART",
  };
  const observations = [1, 2, 3, 4, 5].map((n) => ({
    id: `cal-${n}`,
    productIdentity: product,
    formulationVersion: product.formulationVersion,
    componentRatioOrRecipeSignature: "micro:gro:bloom=1:1:1",
    baselineEc: 0.4,
    deltaEc: n * 0.1,
    resultingEc: 0.4 + n * 0.1,
    doseAppliedMl: n,
    reservoirVolumeL: 10,
    meterResolution: 0.1,
    timestamp: `2026-10-0${n}`,
  }));
  return { product, observations };
}

describe("Garden Nutrient Engine V1", () => {
  it("does not apply unspecified crop evidence to an explicit seedling stage", () => {
    const result = calculateFreshTargetEc({
      contexts: [{ ...basil, phenologicalStage: "SEEDLING" }],
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("INSUFFICIENT_EC_EVIDENCE");
  });

  it("executes a manufacturer seedling recipe despite insufficient crop compatibility", () => {
    const result = executeFreshRecipe({
      recipeId: FLORA_RECIPE.id,
      volumeL: 10,
      feedingIndex: 1,
      contexts: [{ ...basil, phenologicalStage: "SEEDLING" }],
    });
    expect(result.ok).toBe(true);
    expect(result.value?.parts.map((part) => part.ml)).toEqual([4.7551, 4.7551, 4.7551]);
    expect(
      result.value?.warnings.some((item) => item.code === "CROP_COMPATIBILITY_UNCERTAIN"),
    ).toBe(true);
  });

  it("does not intersect incompatible EC or pH measurement scopes", () => {
    const rootZone: EvidenceObservation = {
      ...CROP_EVIDENCE[0]!,
      id: "basil-root-zone-ec",
      measurementScope: "ROOT_ZONE",
    };
    const result = calculatePolycultureRange([basil], [...CROP_EVIDENCE, rootZone]);
    expect(result.status).toBe("COMMON_OPTIMUM_RANGE");
    expect(
      result.cropRanges[0]?.observations.every(
        (item) => item.measurementScope === "NUTRIENT_SOLUTION",
      ),
    ).toBe(true);
    const rootZonePh: EvidenceObservation = {
      ...CROP_EVIDENCE[1]!,
      id: "basil-root-zone-ph",
      measurementScope: "ROOT_ZONE",
    };
    const phOnly = calculateFreshTargetEc({ contexts: [basil], observations: [rootZonePh] });
    expect(phOnly.ok).toBe(false);
    const phSelection = selectCropRange(basil, [rootZonePh]);
    expect(phSelection.ph.observations).toHaveLength(0);
  });

  it("does not promote UNKNOWN scope to nutrient solution", () => {
    const unknown: EvidenceObservation = {
      ...CROP_EVIDENCE[0]!,
      id: "unknown-scope",
      measurementScope: "UNKNOWN",
      scopeBasis: "UNKNOWN",
    };
    expect(selectApplicable([unknown], basil)).toHaveLength(0);
  });

  it("does not create automatic targets from Tier E/F evidence", () => {
    const low: EvidenceObservation = {
      ...CROP_EVIDENCE[0]!,
      id: "tier-f",
      source: { ...NUTRIENT_SOURCES.okstateEcPh, id: "reported-f", tier: "F" },
      evidenceState: "LOW",
      verificationStatus: "REPORTED",
    };
    const result = calculateFreshTargetEc({ contexts: [basil], observations: [low] });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("INSUFFICIENT_EC_EVIDENCE");
  });

  it("preserves a user-selected target and warns when it is outside evidence", () => {
    const result = calculateFreshTargetEc({ contexts: [basil], userSelectedTarget: 2.1 });
    expect(result.ok).toBe(true);
    expect(result.value?.target.min).toBe(2.1);
    expect(result.warnings.some((item) => item.code === "USER_TARGET_OUTSIDE_EVIDENCE")).toBe(true);
  });

  it("preserves a user-selected target when no common evidence exists and says so", () => {
    const result = calculateFreshTargetEc({
      contexts: [{ cropIdentity: "unknown-crop", measurementScope: "NUTRIENT_SOLUTION" }],
      userSelectedTarget: 1.2,
    });
    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((item) => item.code === "USER_TARGET_WITHOUT_COMMON_EVIDENCE"),
    ).toBe(true);
  });

  it("suppresses a starting point when the range is no wider than meter resolution", () => {
    const result = calculateFreshTargetEc({
      contexts: [{ ...basil }],
      observations: CROP_EVIDENCE.map((item) =>
        item.id.endsWith("-ec")
          ? { ...item, observedRange: { min: 1.2, max: 1.25, unit: "mS/cm" } }
          : item,
      ),
      meterResolution: 0.1,
    });
    expect(result.value?.suggestedStartingPoint).toBeUndefined();
    expect(result.warnings.some((item) => item.code === "STARTING_POINT_SUPPRESSED")).toBe(true);
  });

  it("uses NO_COMMON_OPTIMUM_RANGE without inventing incompatible-plants language", () => {
    const result = calculatePolycultureRange([basil, tomato]);
    expect(result.status).toBe("NO_COMMON_OPTIMUM_RANGE");
    expect(result.rationale).toContain("reported optimum ranges do not overlap");
  });

  it("does not change a target based on plant counts", () => {
    const one = calculatePolycultureRange([basil, tomato]);
    const repeated = calculatePolycultureRange([
      basil,
      basil,
      basil,
      tomato,
      tomato,
      tomato,
      tomato,
      tomato,
      tomato,
      tomato,
      tomato,
    ]);
    expect(repeated.range).toEqual(one.range);
    expect(repeated.status).toBe(one.status);
  });

  it("executes exact Flora manufacturer data and does not use equal-thirds fallback", () => {
    const result = executeFreshRecipe({ recipeId: FLORA_RECIPE.id, volumeL: 3, feedingIndex: 5 });
    expect(result.ok).toBe(true);
    expect(result.value?.parts[0]?.ml).toBeCloseTo(6.023124, 6);
    expect(result.value?.parts[1]?.ml).toBeCloseTo(5.230608, 6);
    expect(result.value?.parts[2]?.ml).toBeCloseTo(6.736386, 6);
    expect(result.value?.recipe.mixingOrder).toEqual(["micro", "gro", "bloom"]);
  });

  it("requires volume for per-liter recipes and preserves the Hardwater product gap", () => {
    const missingVolume = executeFreshRecipe({ recipeId: FLORA_RECIPE.id, feedingIndex: 1 });
    expect(missingVolume.ok).toBe(false);
    expect(missingVolume.errors[0]?.code).toBe("VOLUME_REQUIRED");
    expect(FLORA_RECIPE.notes?.some((note) => note.includes("Hardwater"))).toBe(true);
  });

  it("supports verified AeroGarden groups and rejects unsupported interpolation", () => {
    const supported = executeFreshRecipe({
      recipeId: AEROGARDEN_RECIPE.id,
      podCount: 9,
      feedingIndex: 1,
    });
    expect(supported.ok).toBe(true);
    expect(supported.value?.parts[0]?.ml).toBe(8);
    const unsupported = executeFreshRecipe({
      recipeId: AEROGARDEN_RECIPE.id,
      podCount: 4,
      feedingIndex: 1,
    });
    expect(unsupported.ok).toBe(false);
    expect(unsupported.errors[0]?.code).toBe("UNSUPPORTED_POD_COUNT");
  });

  it("does not require reservoir volume for an AeroGarden recipe that does not use it", () => {
    const result = executeFreshRecipe({
      recipeId: AEROGARDEN_RECIPE.id,
      podCount: 9,
      feedingIndex: 1,
    });
    expect(result.ok).toBe(true);
    expect(result.value?.volumeL).toBeUndefined();
  });

  it("preserves n<5 calibration observations and flags potential outliers", () => {
    const { product, observations } = calibrationInput();
    const result = buildCalibrationModel({
      productIdentity: product,
      formulationVersion: product.formulationVersion,
      recipeSignature: "micro:gro:bloom=1:1:1",
      observations: observations.slice(0, 3),
    });
    expect(result.ok).toBe(true);
    expect(result.value?.observations).toHaveLength(3);
    expect(result.value?.evidenceState).toBe("LOW");
  });

  it("uses robust median behavior for n>=5 and rejects formulation mismatch", () => {
    const { product, observations } = calibrationInput();
    const model = buildCalibrationModel({
      productIdentity: product,
      formulationVersion: product.formulationVersion,
      recipeSignature: "micro:gro:bloom=1:1:1",
      observations,
    });
    expect(model.value?.factorEcPerMl).toBe(0.1);
    const mismatch = buildCalibrationModel({
      productIdentity: product,
      formulationVersion: "old",
      recipeSignature: "micro:gro:bloom=1:1:1",
      observations,
    });
    expect(mismatch.ok).toBe(false);
  });

  it("requires the actual dose when learning calibration", () => {
    const { product } = calibrationInput();
    const result = learnFromObservation({
      productIdentity: product,
      formulationVersion: product.formulationVersion,
      recipeSignature: "ratio",
      baselineEc: 0.4,
      resultingEc: 0.8,
      reservoirVolumeL: 10,
      timestamp: "2026-10-03",
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("ACTUAL_DOSE_REQUIRED");
  });

  it("returns calibration extrapolation and measurable-dose warnings", () => {
    const { product, observations } = calibrationInput();
    const model = buildCalibrationModel({
      productIdentity: product,
      formulationVersion: product.formulationVersion,
      recipeSignature: "micro:gro:bloom=1:1:1",
      observations,
    });
    const result = calculateEcCorrection({
      currentEc: measurement(0.4, "NUTRIENT_SOLUTION"),
      targetEc: 2,
      reservoirVolumeL: 10,
      calibration: model.value!,
      policy: { dosingEquipmentResolutionMl: 1, firstStepFraction: 0.01 },
    });
    expect(result.value?.requiresRemeasurement).toBe(true);
    expect(result.warnings.some((item) => item.code === "CALIBRATION_EXTRAPOLATION")).toBe(true);
    expect(result.warnings.some((item) => item.code === "PARTIAL_DOSE_BELOW_RESOLUTION")).toBe(
      true,
    );
  });

  it("blocks top-up when current volume is missing and checks reservoir capacity", () => {
    const missing = calculateTopUpMaintenance({
      nominalVolumeL: 10,
      replacementWaterL: 1,
      currentEc: measurement(1, "NUTRIENT_SOLUTION"),
      targetEc: 1.2,
    });
    expect(missing.errors[0]?.code).toBe("CURRENT_VOLUME_REQUIRED");
    const full = calculateTopUpMaintenance({
      currentVolumeL: 9.5,
      nominalVolumeL: 10,
      replacementWaterL: 1,
      currentEc: measurement(1, "NUTRIENT_SOLUTION"),
      targetEc: 1.2,
    });
    expect(full.errors[0]?.code).toBe("RESERVOIR_CAPACITY_EXCEEDED");
  });

  it("labels top-up as approximation and never as restored nutrient balance", () => {
    const { product, observations } = calibrationInput();
    const model = buildCalibrationModel({
      productIdentity: product,
      formulationVersion: product.formulationVersion,
      recipeSignature: "micro:gro:bloom=1:1:1",
      observations,
    });
    const result = calculateTopUpMaintenance({
      currentVolumeL: 8,
      nominalVolumeL: 10,
      replacementWaterL: 1,
      currentEc: measurement(1, "NUTRIENT_SOLUTION"),
      targetEc: 1.2,
      calibration: model.value,
    });
    expect(result.value?.approximation).toBe(true);
    expect(result.warnings.some((item) => item.code === "LINEAR_MIXING_APPROXIMATION")).toBe(true);
    expect(JSON.stringify(result)).toMatch(/restored nutrient balance/i);
  });

  it("reports deterministic source-water values without a universal threshold", () => {
    const result = evaluateSourceWater({
      sourceEc: measurement(0.5, "SOURCE_WATER"),
      targetEc: 1.5,
    });
    expect(result.value).toEqual({
      sourceEc: 0.5,
      sourceToTargetRatio: 1 / 3,
      targetMinusSource: 1,
    });
    const atTarget = evaluateSourceWater({
      sourceEc: measurement(1.5, "SOURCE_WATER"),
      targetEc: 1.5,
    });
    expect(atTarget.ok).toBe(true);
    expect(atTarget.errors).toHaveLength(0);
  });

  it("does not automatically temperature-normalize readings and converts EC units deterministically", () => {
    expect(toMsPerCm(1200, "uS/cm")).toBe(1.2);
    const calibration = calibrationInput();
    const model = buildCalibrationModel({
      productIdentity: calibration.product,
      formulationVersion: calibration.product.formulationVersion,
      recipeSignature: "micro:gro:bloom=1:1:1",
      observations: calibration.observations,
    });
    const result = calculateEcCorrection({
      currentEc: { ...measurement(1200, "NUTRIENT_SOLUTION"), unit: "uS/cm" },
      targetEc: 1.2,
      reservoirVolumeL: 10,
      calibration: model.value!,
    });
    expect(result.value?.direction).toBe("NO_CHANGE");
  });

  it("keeps manufacturer expected EC separate from crop evidence and exposes replacement guidance", () => {
    const recipe = executeFreshRecipe({
      recipeId: FLORA_RECIPE.id,
      volumeL: 4,
      feedingIndex: 1,
      contexts: [{ ...basil, phenologicalStage: "SEEDLING" }],
    });
    expect(recipe.value?.manufacturerRecipeExpectation).toEqual({
      min: 0.4,
      max: 0.5,
      unit: "mS/cm",
    });
    expect(
      recipe.value?.claims.some(
        (item) =>
          item.id === "manufacturer-expected-ec" && item.epistemic === "MANUFACTURER_INSTRUCTION",
      ),
    ).toBe(true);
    expect(getReplacementGuidance().value?.approximateIntervalDays).toBe(14);
  });

  it("surfaces disagreement between manufacturer expectation and crop evidence", () => {
    const result = executeFreshRecipe({
      recipeId: FLORA_RECIPE.id,
      volumeL: 4,
      feedingIndex: 5,
      contexts: [basil],
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.some((item) => item.code === "MANUFACTURER_CROP_EC_DISAGREEMENT")).toBe(
      true,
    );
  });

  it("requires provenance dependencies for derived claims", () => {
    const result = calculateFreshTargetEc({ contexts: [basil] });
    expect(assertNoFalseCertainty(result.value?.claims ?? [])).toBe(true);
    expect(
      result.value?.claims.find((item) => item.id === "suggested-starting-point")?.epistemic,
    ).toBe("ENGINE_INFERENCE");
  });
});
