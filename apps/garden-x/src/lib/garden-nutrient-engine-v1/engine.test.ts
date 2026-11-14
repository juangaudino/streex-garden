import { describe, expect, it } from "vitest";

import {
  AEROGARDEN_RECIPE,
  CROP_EVIDENCE,
  CROP_STUDY_REFERENCES,
  FLORA_RECIPE,
  NUTRIENT_SOURCES,
} from "./data";
import {
  buildCalibrationModel,
  calculateEcCorrection,
  calculateFreshTargetEcDose,
  calculateFreshTargetEc,
  calculatePolycultureRange,
  calculateTopUpMaintenance,
  calculateTopUpToCapacity,
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
  it("preserves Hydrocrop beetroot guidance as crop-level and excludes seedlings", () => {
    const context: CropContext = { cropIdentity: "beetroot", measurementScope: "NUTRIENT_SOLUTION" };
    const result = selectCropRange(context).ec;
    expect(result.ec).toEqual({ min: 1.4, max: 2.4, unit: "mS/cm" });
    expect(result.observations[0]?.source.id).toBe("hydrocrop-hydrosol-crop-ec-guide");
    expect(result.observations[0]?.notes).toContain("HydroSol");
    expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toBeUndefined();
  });
  it("keeps fenugreek and borage supplier values contextual and excludes seedlings", () => {
    for (const [cropIdentity, min, max] of [["fenugreek", 1.2, 2.4], ["borage", 1.4, 2.2]] as const) {
      const context: CropContext = { cropIdentity, measurementScope: "NUTRIENT_SOLUTION" };
      const result = selectCropRange(context).ec;
      expect(result.ec).toEqual({ min, max, unit: "mS/cm" });
      expect(result.observations[0]?.scopeBasis).toBe("INFERRED");
      expect(result.observations[0]?.notes).toContain("mS/cm");
      expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toBeUndefined();
    }
  });
  it("preserves Calendula officinalis guidance separately from Tagetes", () => {
    const context: CropContext = { cropIdentity: "calendula", measurementScope: "NUTRIENT_SOLUTION" };
    const result = selectCropRange(context).ec;
    expect(result.ec).toEqual({ min: 1.2, max: 1.8, unit: "mS/cm" });
    expect(result.observations[0]?.source.id).toBe("lanitex-hydroponic-calendula-guide");
    expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toBeUndefined();
    expect(selectCropRange({ ...context, cropIdentity: "tagetes" }).ec.ec).toBeUndefined();
  });
  it("retains petunia and English lavender source context and stage limits", () => {
    const petunia: CropContext = { cropIdentity: "petunia", measurementScope: "NUTRIENT_SOLUTION" };
    expect(selectCropRange(petunia).ec.ec).toEqual({ min: 1.2, max: 2.5, unit: "mS/cm" });
    expect(selectCropRange({ ...petunia, phenologicalStage: "SEEDLING" }).ec.ec).toBeUndefined();
    const lavender: CropContext = { cropIdentity: "english-lavender", measurementScope: "NUTRIENT_SOLUTION" };
    expect(selectCropRange(lavender).ec.ec).toBeUndefined();
    expect(selectCropRange({ ...lavender, phenologicalStage: "SEEDLING" }).ec.ec).toEqual({ min: 0.7, max: 0.9, unit: "mS/cm" });
    expect(selectCropRange({ ...lavender, phenologicalStage: "MATURE" }).ec.ec).toEqual({ min: 1.2, max: 1.5, unit: "mS/cm" });
  });
  it("keeps holy basil seedling and growth guidance distinct from maturity", () => {
    const context: CropContext = { cropIdentity: "holy-basil", measurementScope: "NUTRIENT_SOLUTION" };
    expect(selectCropRange(context).ec.ec).toBeUndefined();
    expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toEqual({ min: 0.7, max: 0.9, unit: "mS/cm" });
    expect(selectCropRange({ ...context, phenologicalStage: "VEGETATIVE" }).ec.ec).toEqual({ min: 0.9, max: 1.2, unit: "mS/cm" });
    expect(selectCropRange({ ...context, phenologicalStage: "MATURE" }).ec.ec).toEqual({ min: 1.6, max: 2.1, unit: "mS/cm" });
    expect(selectCropRange({ ...context, phenologicalStage: "FLOWERING" }).ec.ec).toBeUndefined();
  });
  it("preserves non-bulbing bunching onion guidance without promoting it to seedlings", () => {
    const context: CropContext = { cropIdentity: "bunching-onion", measurementScope: "NUTRIENT_SOLUTION", phenologicalStage: "UNSPECIFIED" };
    const result = selectCropRange(context).ec;
    expect(result.ec).toEqual({ min: 1.8, max: 2.4, unit: "mS/cm" });
    expect(result.observations[0]?.notes).toContain("does not identify a botanical species");
    expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toBeUndefined();
  });
  it("preserves sunflower and kohlrabi supplier ranges without applying them to seedlings", () => {
    for (const [cropIdentity, min, max] of [["sunflower", 1.2, 1.8], ["kohlrabi", 1.8, 2.4]] as const) {
      const context: CropContext = { cropIdentity, phenologicalStage: "UNSPECIFIED", measurementScope: "NUTRIENT_SOLUTION" };
      const result = selectCropRange(context).ec;
      expect(result.ec).toEqual({ min, max, unit: "mS/cm" });
      expect(result.evidenceState).toBe("MODERATE");
      expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toBeUndefined();
    }
    expect(selectCropRange({ cropIdentity: "sunflower", phenologicalStage: "VEGETATIVE", measurementScope: "NUTRIENT_SOLUTION" }).ec.ec).toEqual({ min: 1.2, max: 1.6, unit: "mS/cm" });
  });
  it("keeps chervil grower guidance separate from seedling guidance", () => {
    const context: CropContext = {
      cropIdentity: "chervil",
      phenologicalStage: "UNSPECIFIED",
      measurementScope: "NUTRIENT_SOLUTION",
    };
    const result = selectCropRange(context).ec;
    expect(result.ec).toEqual({ min: 0.8, max: 1.8, unit: "mS/cm" });
    expect(result.evidenceState).toBe("MODERATE");
    expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toBeUndefined();
  });
  it("uses general dill guidance without treating it as a seedling or cultivar-specific rule", () => {
    const context: CropContext = {
      cropIdentity: "dill",
      phenologicalStage: "UNSPECIFIED",
      measurementScope: "NUTRIENT_SOLUTION",
    };
    const result = selectCropRange(context).ec;
    expect(result.ec).toEqual({ min: 1, max: 1.6, unit: "mS/cm" });
    expect(result.evidenceState).toBe("MODERATE");
    expect(result.observations[0]?.source.id).toBe("igworks-hydroponic-dill-guide");
    expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toBeUndefined();
  });
  it("applies system-specific evidence only to NFT and never to a seedling or unknown system", () => {
    for (const cropIdentity of ["tatsoi", "flowering-choy-sum"]) {
      const context: CropContext = {
        cropIdentity,
        phenologicalStage: "UNSPECIFIED",
        hydroponicSystem: "NFT",
        measurementScope: "NUTRIENT_SOLUTION",
      };
      const observation = selectCropRange(context).ec;
      expect(observation.ec).toEqual({ min: 1.5, max: 2.5, unit: "mS/cm" });
      expect(observation.observations[0]?.source.id).toBe("nsw-asian-vegetables-nft-2011");
      expect(selectCropRange({ ...context, hydroponicSystem: "UNKNOWN" }).ec.ec).toBeUndefined();
      expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toBeUndefined();
    }
  });
  it("applies cilantro general guidance separately from NFT guidance", () => {
    const context: CropContext = { cropIdentity: "cilantro", phenologicalStage: "UNSPECIFIED", measurementScope: "NUTRIENT_SOLUTION" };
    expect(selectCropRange(context).ec.ec).toEqual({ min: 1.3, max: 1.8, unit: "mS/cm" });
    expect(selectCropRange({ ...context, hydroponicSystem: "NFT" }).ec.ec).toEqual({ min: 1.5, max: 1.8, unit: "mS/cm" });
    expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toBeUndefined();
  });
  it("uses garlic chive stage-specific guidance only for the specified stage", () => {
    const context: CropContext = { cropIdentity: "garlic-chives", measurementScope: "NUTRIENT_SOLUTION" };
    expect(selectCropRange(context).ec.ec).toBeUndefined();
    expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toEqual({ min: 1, max: 1.3, unit: "mS/cm" });
    expect(selectCropRange({ ...context, phenologicalStage: "VEGETATIVE" }).ec.ec).toEqual({ min: 1, max: 1.5, unit: "mS/cm" });
    expect(selectCropRange({ ...context, phenologicalStage: "MATURE" }).ec.ec).toEqual({ min: 1.5, max: 1.8, unit: "mS/cm" });
    expect(selectCropRange({ ...context, phenologicalStage: "FLOWERING" }).ec.ec).toBeUndefined();
  });
  it("uses rosemary supplier guidance as a moderate reported range, not a seedling rule", () => {
    const context: CropContext = {
      cropIdentity: "rosemary",
      phenologicalStage: "UNSPECIFIED",
      measurementScope: "NUTRIENT_SOLUTION",
    };
    const result = selectCropRange(context).ec;
    expect(result.ec).toEqual({ min: 1, max: 1.6, unit: "mS/cm" });
    expect(result.evidenceState).toBe("MODERATE");
    expect(result.observations[0]?.source.id).toBe("hydroponic-xpress-ec-ph-guide");
    expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toBeUndefined();
  });
  it("keeps research-only herb observations out of automatic ranges", () => {
    expect(
      CROP_STUDY_REFERENCES.some((reference) =>
        reference.plantIds.some((id: string) => id === "cilantro"),
      ),
    ).toBe(true);
    for (const cropIdentity of ["dill-bouquet", "evergreen-bunching-onion-nabuka"]) {
      expect(
        selectCropRange({
          cropIdentity,
          phenologicalStage: "UNSPECIFIED",
          measurementScope: "NUTRIENT_SOLUTION",
        }).ec.ec,
      ).toBeUndefined();
    }
  });
  it("keeps HydroSol manufacturer crop guidance contextual and excludes seedlings", () => {
    for (const [cropIdentity, min, max] of [
      ["radish", 1.6, 2.2],
      ["thyme", 0.8, 1.6],
      ["marjoram", 1.6, 2],
      ["watercress", 0.4, 1.8],
    ] as const) {
      const context: CropContext = {
        cropIdentity,
        phenologicalStage: "UNSPECIFIED",
        measurementScope: "NUTRIENT_SOLUTION",
      };
      const result = selectCropRange(context).ec;
      expect(result.ec).toEqual({ min, max, unit: "mS/cm" });
      expect(result.evidenceState).toBe("MODERATE");
      expect(result.observations[0]?.source.id).toBe("hydrocrop-hydrosol-crop-ec-guide");
      expect(result.observations[0]?.notes).toContain("not proof of an optimum");
      expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toBeUndefined();
    }
  });
  it("preserves CAFRE graphical crop ranges and does not apply unspecified-stage evidence to seedlings", () => {
    for (const [cropIdentity, min, max] of [
      ["chard", 1.8, 2.4],
      ["kale", 1.8, 3],
      ["mizuna", 0.8, 1.4],
      ["mustard-greens", 1.2, 2.4],
      ["oregano", 1.6, 2.2],
      ["mint", 2.2, 2.8],
      ["chives", 1.8, 2.2],
    ] as const) {
      const context: CropContext = {
        cropIdentity,
        phenologicalStage: "UNSPECIFIED",
        measurementScope: "NUTRIENT_SOLUTION",
      };
      const result = selectCropRange(context);
      expect(result.ec.ec).toEqual({ min, max, unit: "mS/cm" });
      expect(result.ec.evidenceState).toBe("MODERATE");
      expect(result.ec.observations[0]?.source.id).toBe("cafre-hydroponic-leafy-salads-herbs");
      expect(result.ec.observations[0]?.scopeBasis).toBe("INFERRED");
      expect(selectCropRange({ ...context, phenologicalStage: "SEEDLING" }).ec.ec).toBeUndefined();
    }
  });
  it("preserves conflicting credible evidence rather than calling it merely insufficient", () => {
    const original = CROP_EVIDENCE.find(
      (item) => item.cropIdentity === "basil" && item.metric === "EC",
    )!;
    const contradictory = {
      ...original,
      id: "independent-conflicting-basil",
      observedRange: { min: 2.0, max: 2.5, unit: "mS/cm" as const },
    };
    const result = calculatePolycultureRange([basil], [original, contradictory]);
    expect(result.status).toBe("INSUFFICIENT");
    expect(result.evidenceState).toBe("CONFLICTING");
    expect(result.range).toBeUndefined();
    const automatic = calculateFreshTargetEc({
      contexts: [basil],
      observations: [original, contradictory],
    });
    expect(automatic.ok).toBe(false);
    expect(automatic.value).toBeUndefined();
    const selected = calculateFreshTargetEc({
      contexts: [basil],
      observations: [original, contradictory],
      userSelectedTarget: 1.2,
    });
    expect(selected.value?.evidenceState).toBe("CONFLICTING");
    expect(selected.value?.target.min).toBe(1.2);
  });
  it("never treats a pH reading as conductivity in dosing or water evaluation", () => {
    const { product, observations } = calibrationInput();
    const calibration = buildCalibrationModel({
      productIdentity: product,
      formulationVersion: product.formulationVersion,
      recipeSignature: observations[0]!.componentRatioOrRecipeSignature,
      observations,
    }).value!;
    const solutionPh: UserMeasurement = { ...measurement(6, "NUTRIENT_SOLUTION"), unit: "pH" };
    const waterPh: UserMeasurement = { ...measurement(6, "SOURCE_WATER"), unit: "pH" };
    expect(
      calculateFreshTargetEcDose({
        sourceWaterEc: waterPh,
        targetEc: 1.2,
        reservoirVolumeL: 4,
        calibration,
      }).errors[0]?.code,
    ).toBe("EC_UNIT_REQUIRED");
    expect(
      calculateEcCorrection({ currentEc: solutionPh, targetEc: 1.2, reservoirVolumeL: 4 }).errors[0]
        ?.code,
    ).toBe("EC_UNIT_REQUIRED");
    expect(
      calculateEcCorrection({
        currentEc: measurement(1.5, "NUTRIENT_SOLUTION"),
        dilutionWaterEc: waterPh,
        targetEc: 1.2,
        reservoirVolumeL: 4,
      }).errors[0]?.code,
    ).toBe("EC_UNIT_REQUIRED");
    expect(
      calculateTopUpMaintenance({
        currentVolumeL: 2.5,
        nominalVolumeL: 4,
        replacementWaterL: 1,
        currentEc: solutionPh,
        replacementWaterEc: measurement(0.2, "SOURCE_WATER"),
        targetEc: 1.2,
      }).errors[0]?.code,
    ).toBe("EC_UNIT_REQUIRED");
    expect(
      calculateTopUpMaintenance({
        currentVolumeL: 2.5,
        nominalVolumeL: 4,
        replacementWaterL: 1,
        currentEc: measurement(1.2, "NUTRIENT_SOLUTION"),
        replacementWaterEc: waterPh,
        targetEc: 1.2,
      }).errors[0]?.code,
    ).toBe("EC_UNIT_REQUIRED");
    expect(evaluateSourceWater({ sourceEc: waterPh, targetEc: 1.2 }).errors[0]?.code).toBe(
      "EC_UNIT_REQUIRED",
    );
  });

  it("requires measured source-water EC for a top-up that adds water", () => {
    const base = {
      currentVolumeL: 2.5,
      nominalVolumeL: 4,
      replacementWaterL: 1,
      currentEc: measurement(1.2, "NUTRIENT_SOLUTION"),
      targetEc: 1.2,
    };
    expect(calculateTopUpMaintenance(base).errors[0]?.code).toBe("SOURCE_WATER_EC_REQUIRED");
    expect(calculateTopUpMaintenance({ ...base, replacementWaterL: 0 }).ok).toBe(true);
    const needsDilution = { ...base, currentEc: measurement(1.5, "NUTRIENT_SOLUTION"), replacementWaterL: 0 };
    expect(calculateTopUpMaintenance(needsDilution).errors[0]?.code).toBe("SOURCE_WATER_EC_REQUIRED");
    const measuredDilution = calculateTopUpMaintenance({
      ...needsDilution,
      replacementWaterEc: measurement(0.2, "SOURCE_WATER"),
    });
    expect(measuredDilution.ok).toBe(true);
    expect(measuredDilution.value?.dilutionWaterMl).toBeCloseTo(750);
    expect(
      calculateTopUpMaintenance({
        ...base,
        replacementWaterEc: measurement(0.2, "SOURCE_WATER"),
      }).errors.some((item) => item.code === "SOURCE_WATER_EC_REQUIRED"),
    ).toBe(false);
  });

  it("plans water to leave room for calibrated nutrients instead of overfilling", () => {
    const { product, observations } = calibrationInput();
    const calibration = buildCalibrationModel({
      productIdentity: product,
      formulationVersion: product.formulationVersion,
      recipeSignature: "micro:gro:bloom=1:1:1",
      observations,
    }).value!;
    const input = {
      currentVolumeL: 2.5,
      capacityL: 3.5,
      currentEc: measurement(0.8, "NUTRIENT_SOLUTION"),
      replacementWaterEc: measurement(0.2, "SOURCE_WATER"),
      targetEc: 1.2,
      calibration,
    };
    const planned = calculateTopUpToCapacity(input);
    expect(planned.ok).toBe(true);
    expect(planned.value!.waterToAddL).toBeGreaterThan(0);
    expect(planned.value!.waterToAddL).toBeLessThan(1);
    expect(planned.value!.nutrientDoseMl).toBeGreaterThan(0);
    // Independent balance: calibration response is 1 EC·L/mL, so 0.998 L
    // of water requires 1.998 mL of nutrients to reach the selected EC.
    expect(planned.value!.waterToAddL).toBe(0.998);
    expect(planned.value!.nutrientDoseMl).toBeCloseTo(1.998, 8);
    expect(planned.value!.finalVolumeL).toBeLessThanOrEqual(3.5);
    expect(3.5 - planned.value!.finalVolumeL).toBeLessThan(0.0011);
    const verified = calculateTopUpMaintenance({
      currentVolumeL: input.currentVolumeL,
      nominalVolumeL: input.capacityL,
      replacementWaterL: planned.value!.waterToAddL,
      currentEc: input.currentEc,
      replacementWaterEc: input.replacementWaterEc,
      targetEc: input.targetEc,
      calibration,
    });
    expect(verified.ok).toBe(true);
    expect(verified.value!.nutrientDoseMl).toBeCloseTo(planned.value!.nutrientDoseMl);
    expect(calculateTopUpToCapacity({ ...input, calibration: undefined }).errors[0]?.code).toBe(
      "CALIBRATION_REQUIRED",
    );
    expect(
      calculateTopUpToCapacity({ ...input, currentEc: measurement(3, "NUTRIENT_SOLUTION") })
        .errors[0]?.code,
    ).toBe("DILUTION_EXCEEDS_CAPACITY");
    expect(
      calculateTopUpToCapacity({
        ...input,
        currentVolumeL: 1,
        capacityL: 1.001,
        currentEc: measurement(0.1, "NUTRIENT_SOLUTION"),
        targetEc: 2,
      }).errors[0]?.code,
    ).toBe("CAPACITY_TARGET_UNREACHABLE");
    const waterOnly = calculateTopUpToCapacity({
      currentVolumeL: 2,
      capacityL: 4,
      currentEc: measurement(1, "NUTRIENT_SOLUTION"),
      replacementWaterEc: measurement(0.5, "SOURCE_WATER"),
      targetEc: 0.75,
    });
    expect(waterOnly.ok).toBe(true);
    expect(waterOnly.value?.waterToAddL).toBe(2);
    expect(waterOnly.value?.nutrientDoseMl).toBe(0);
    const floatingPointWaterOnly = calculateTopUpToCapacity({
      currentVolumeL: 2,
      capacityL: 4,
      currentEc: measurement(0.8, "NUTRIENT_SOLUTION"),
      replacementWaterEc: measurement(0.4, "SOURCE_WATER"),
      targetEc: 0.6,
    });
    expect(floatingPointWaterOnly.ok).toBe(true);
    expect(floatingPointWaterOnly.value?.nutrientDoseMl).toBe(0);
  });
  it("does not flag equal calibrated responses as outliers merely because tank volumes differ", () => {
    const { product, observations } = calibrationInput();
    const sample = observations[0]!;
    const scaled = [
      {
        ...sample,
        id: "one-liter",
        reservoirVolumeL: 1,
        doseAppliedMl: 1,
        deltaEc: 1,
        resultingEc: sample.baselineEc + 1,
      },
      {
        ...sample,
        id: "ten-liters",
        reservoirVolumeL: 10,
        doseAppliedMl: 1,
        deltaEc: 0.1,
        resultingEc: sample.baselineEc + 0.1,
      },
    ];
    const result = buildCalibrationModel({
      productIdentity: product,
      formulationVersion: product.formulationVersion,
      recipeSignature: sample.componentRatioOrRecipeSignature,
      observations: scaled,
    });
    expect(result.value?.potentialOutlierIds).toEqual([]);
    expect(result.value?.observations).toHaveLength(2);
  });
  it("preserves different stages of the same crop regardless of input order", () => {
    const seedling: CropContext = { ...basil, phenologicalStage: "SEEDLING" };
    for (const contexts of [
      [basil, seedling],
      [seedling, basil],
    ]) {
      const result = calculatePolycultureRange(contexts);
      expect(result.status).toBe("INSUFFICIENT");
      expect(result.cropRanges).toHaveLength(2);
    }
  });
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
      ...CROP_EVIDENCE.find((item) => item.cropIdentity === "basil" && item.metric === "EC")!,
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
      ...CROP_EVIDENCE.find((item) => item.cropIdentity === "basil" && item.metric === "PH")!,
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
      ...CROP_EVIDENCE.find((item) => item.cropIdentity === "basil" && item.metric === "EC")!,
      id: "unknown-scope",
      measurementScope: "UNKNOWN",
      scopeBasis: "UNKNOWN",
    };
    expect(selectApplicable([unknown], basil)).toHaveLength(0);
  });

  it("does not combine unknown or unrequested measurement contexts into a crop target", () => {
    const ec = CROP_EVIDENCE.find((item) => item.cropIdentity === "basil" && item.metric === "EC")!;
    const root = { ...ec, id: "root", measurementScope: "ROOT_ZONE" as const };
    const unknown = {
      ...ec,
      id: "unknown",
      measurementScope: "UNKNOWN" as const,
      scopeBasis: "UNKNOWN" as const,
    };
    for (const measurementScope of [undefined, "UNKNOWN"] as const) {
      const context = { ...basil, measurementScope };
      expect(selectApplicable([ec, root, unknown], context)).toHaveLength(0);
      const result = calculateFreshTargetEc({
        contexts: [context],
        observations: [ec, root, unknown],
      });
      expect(result.ok).toBe(false);
      expect(result.value).toBeUndefined();
    }
  });

  it("does not apply system-specific evidence when the growing system is unknown", () => {
    const ec = CROP_EVIDENCE.find((item) => item.cropIdentity === "basil" && item.metric === "EC")!;
    const nft = { ...ec, id: "nft-only", hydroponicSystem: "NFT" as const };
    expect(selectApplicable([ec, nft], basil).map((item) => item.id)).toEqual([ec.id]);
    expect(
      selectApplicable([ec, nft], { ...basil, hydroponicSystem: "NFT" }).map((item) => item.id),
    ).toEqual([ec.id, nft.id]);
  });

  it("never intersects ranges across different measurement scopes in a mixed planting", () => {
    const tomatoEc = CROP_EVIDENCE.find(
      (item) => item.cropIdentity === "tomato" && item.metric === "EC",
    )!;
    const tomatoRoot = { ...tomatoEc, id: "tomato-root", measurementScope: "ROOT_ZONE" as const };
    const result = calculatePolycultureRange(
      [basil, { ...tomato, measurementScope: "ROOT_ZONE" }],
      [...CROP_EVIDENCE, tomatoRoot],
    );
    expect(result.cropRanges.every((item) => item.ec)).toBe(true);
    expect(result.status).toBe("INSUFFICIENT");
    expect(result.range).toBeUndefined();
    expect(result.claims.some((item) => item.id === "polyculture-incompatible-scopes")).toBe(true);
  });

  it("does not create automatic targets from Tier E/F evidence", () => {
    const low: EvidenceObservation = {
      ...CROP_EVIDENCE.find((item) => item.cropIdentity === "basil" && item.metric === "EC")!,
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

  it("calculates a fresh target dose from exact calibration and scales it by volume", () => {
    const { product, observations } = calibrationInput();
    const model = buildCalibrationModel({
      productIdentity: product,
      formulationVersion: product.formulationVersion,
      recipeSignature: "micro:gro:bloom=1:1:1",
      observations,
    });
    const sourceWater = measurement(0.2, "SOURCE_WATER");
    const fourLiters = calculateFreshTargetEcDose({
      sourceWaterEc: sourceWater,
      targetEc: 1.2,
      reservoirVolumeL: 4,
      calibration: model.value!,
    });
    const tenLiters = calculateFreshTargetEcDose({
      sourceWaterEc: sourceWater,
      targetEc: 1.2,
      reservoirVolumeL: 10,
      calibration: model.value!,
    });
    expect(fourLiters.value?.doseMl).toBeCloseTo(4);
    expect(tenLiters.value?.doseMl).toBeCloseTo(10);
  });

  it("checks source water against the target before requiring calibration", () => {
    const run = (ec: number) =>
      calculateFreshTargetEcDose({
        sourceWaterEc: measurement(ec, "SOURCE_WATER"),
        targetEc: 1.2,
        reservoirVolumeL: 4,
      });
    expect(run(1.3).errors[0]?.code).toBe("SOURCE_WATER_ABOVE_TARGET");
    expect(run(1.2).errors[0]?.code).toBe("SOURCE_WATER_AT_TARGET");
    expect(run(0.2).errors[0]?.code).toBe("CALIBRATION_REQUIRED");
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
    expect(result.rationale).toContain("reported EC ranges do not overlap");
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

  it("checks the actual next correction dose against the available reservoir capacity", () => {
    const { product, observations } = calibrationInput();
    const calibration = buildCalibrationModel({
      productIdentity: product,
      formulationVersion: product.formulationVersion,
      recipeSignature: "micro:gro:bloom=1:1:1",
      observations,
    }).value!;
    const base = {
      currentEc: measurement(0.4, "NUTRIENT_SOLUTION"),
      targetEc: 0.8,
      reservoirVolumeL: 10,
      calibration,
    };
    const full = calculateEcCorrection({ ...base, reservoirCapacityL: 10 });
    expect(full.errors[0]?.code).toBe("CORRECTION_EXCEEDS_CAPACITY");
    const staged = calculateEcCorrection({
      ...base,
      reservoirCapacityL: 10.0025,
      policy: { firstStepFraction: 0.25 },
    });
    expect(staged.ok).toBe(true);
    expect(staged.value?.firstStepDoseMl).toBeCloseTo(1);
    expect(staged.value?.requiresRemeasurement).toBe(true);
    const tooLarge = calculateEcCorrection({ ...base, reservoirCapacityL: 10.0025 });
    expect(tooLarge.errors[0]?.code).toBe("CORRECTION_EXCEEDS_CAPACITY");
  });

  it("uses measured source-water EC for correction dilution", () => {
    const { product, observations } = calibrationInput();
    const calibration = buildCalibrationModel({
      productIdentity: product,
      formulationVersion: product.formulationVersion,
      recipeSignature: "micro:gro:bloom=1:1:1",
      observations,
    });
    const result = calculateEcCorrection({
      currentEc: measurement(1.8, "NUTRIENT_SOLUTION"),
      dilutionWaterEc: measurement(0.2, "SOURCE_WATER"),
      targetEc: 1,
      reservoirVolumeL: 10,
      calibration: calibration.value!,
    });
    expect(result.value?.direction).toBe("ADD_WATER");
    if (result.value?.direction === "ADD_WATER") expect(result.value.waterMl).toBeCloseTo(10000);
  });

  it("calculates hold and dilution without nutrient calibration, but still requires measured water and capacity", () => {
    const base = {
      currentEc: measurement(1.4, "NUTRIENT_SOLUTION"),
      targetEc: 1.2,
      reservoirVolumeL: 3,
      reservoirCapacityL: 5,
    };
    expect(
      calculateEcCorrection({ ...base, currentEc: measurement(1.2, "NUTRIENT_SOLUTION") }).value
        ?.direction,
    ).toBe("NO_CHANGE");
    expect(calculateEcCorrection(base).errors[0]?.code).toBe("SOURCE_WATER_EC_REQUIRED");
    const diluted = calculateEcCorrection({
      ...base,
      dilutionWaterEc: measurement(0.2, "SOURCE_WATER"),
    });
    expect(diluted.value?.direction).toBe("ADD_WATER");
    expect(diluted.value?.waterMl).toBeCloseTo(600);
    expect(diluted.warnings.some((item) => item.code === "CALIBRATION_EXTRAPOLATION")).toBe(false);
    expect(
      calculateEcCorrection({
        ...base,
        reservoirCapacityL: 3.2,
        dilutionWaterEc: measurement(0.2, "SOURCE_WATER"),
      }).errors[0]?.code,
    ).toBe("DILUTION_EXCEEDS_CAPACITY");
    expect(
      calculateEcCorrection({ ...base, currentEc: measurement(0.8, "NUTRIENT_SOLUTION") }).errors[0]
        ?.code,
    ).toBe("CALIBRATION_REQUIRED");
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
      replacementWaterEc: measurement(0.2, "SOURCE_WATER"),
    });
    expect(result.value?.approximation).toBe(true);
    expect(result.warnings.some((item) => item.code === "LINEAR_MIXING_APPROXIMATION")).toBe(true);
    expect(JSON.stringify(result)).toMatch(/restored nutrient balance/i);
  });

  it("includes measured source-water EC in top-up mixing", () => {
    const { product, observations } = calibrationInput();
    const calibration = buildCalibrationModel({
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
      replacementWaterEc: measurement(0.2, "SOURCE_WATER"),
      targetEc: 1.2,
      calibration: calibration.value,
    });
    expect(
      result.value?.claims.find((item) => item.id === "top-up-after-water-ec")?.value,
    ).toBeCloseTo((1 * 8 + 0.2) / 9);
    expect(result.value?.claims.find((item) => item.id === "top-up-dose")).toBeDefined();
  });

  it("warns when a positive top-up dose is below the user's equipment resolution", () => {
    const { product, observations } = calibrationInput();
    const calibration = buildCalibrationModel({
      productIdentity: product,
      formulationVersion: product.formulationVersion,
      recipeSignature: "micro:gro:bloom=1:1:1",
      observations,
    }).value!;
    const input = {
      currentVolumeL: 8,
      nominalVolumeL: 10,
      replacementWaterL: 1,
      currentEc: measurement(1, "NUTRIENT_SOLUTION"),
      replacementWaterEc: measurement(0.2, "SOURCE_WATER"),
      targetEc: 1.2,
      calibration,
    };
    const baseline = calculateTopUpMaintenance(input);
    expect(baseline.ok).toBe(true);
    expect(baseline.value!.nutrientDoseMl).toBeGreaterThan(0);
    const warned = calculateTopUpMaintenance({
      ...input,
      policy: { dosingEquipmentResolutionMl: baseline.value!.nutrientDoseMl! * 2 },
    });
    expect(warned.value!.nutrientDoseMl).toBe(baseline.value!.nutrientDoseMl);
    expect(warned.warnings.some((item) => item.code === "DOSE_BELOW_EQUIPMENT_RESOLUTION")).toBe(true);
    expect(baseline.warnings.some((item) => item.code === "DOSE_BELOW_EQUIPMENT_RESOLUTION")).toBe(false);
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
