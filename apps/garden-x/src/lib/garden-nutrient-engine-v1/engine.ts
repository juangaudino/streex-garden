import { CROP_EVIDENCE, MANUFACTURER_RECIPES } from "./data.ts";
import type {
  CalibrationModel,
  CalibrationObservation,
  Claim,
  CropContext,
  CorrectionResult,
  EngineError,
  EnginePolicy,
  EngineResult,
  EngineWarning,
  EvidenceObservation,
  EvidenceState,
  ManufacturerRecipe,
  MeasurementScope,
  PolycultureRange,
  RecipeResult,
  RangeSelection,
  ScopeBasis,
  TopUpResult,
  UserMeasurement,
  EcTargetResult,
  FreshTargetDoseResult,
} from "./types.ts";

const AUTOMATIC_TIERS = new Set(["A", "B", "C", "D"]);
const MILLIS_PER_LITER = 1000;

function claim(
  id: string,
  label: string,
  epistemic: Claim["epistemic"],
  derivedFrom: string[],
  options: Partial<Claim> = {},
): Claim {
  return { id, label, epistemic, derivedFrom, ...options };
}

function warning(
  code: string,
  message: string,
  derivedFrom: string[],
  epistemic: EngineWarning["epistemic"] = "ENGINE_INFERENCE",
  experimentalPolicy = false,
): EngineWarning {
  return { code, message, epistemic, derivedFrom, experimentalPolicy };
}

function error(code: string, message: string, missing?: string[]): EngineError {
  return { code, message, ...(missing ? { missing } : {}) };
}

function sameProductIdentity(
  left: ManufacturerRecipe["product"],
  right: CalibrationObservation["productIdentity"],
): boolean {
  return (
    left.manufacturer === right.manufacturer &&
    left.productFamily === right.productFamily &&
    left.exactProduct === right.exactProduct &&
    left.formulationVersion === right.formulationVersion &&
    left.region === right.region &&
    left.edition === right.edition
  );
}

function result<T>(
  value: undefined,
  warnings: EngineWarning[],
  errors: EngineError[],
  claims: Claim[],
): EngineResult<T>;
function result<T>(
  value: T,
  warnings: EngineWarning[],
  errors: EngineError[],
  claims: Claim[],
): EngineResult<T>;
function result<T>(
  value: T | undefined,
  warnings: EngineWarning[],
  errors: EngineError[],
  claims: Claim[],
): EngineResult<T> {
  return {
    ok: errors.length === 0,
    ...(value === undefined ? {} : { value }),
    warnings,
    errors,
    claims,
  };
}

export function toMsPerCm(value: number, unit: "mS/cm" | "uS/cm"): number {
  return unit === "uS/cm" ? value / 1000 : value;
}

export function toUsPerCm(value: number, unit: "mS/cm" | "uS/cm"): number {
  return unit === "mS/cm" ? value * 1000 : value;
}

export function scopesCompatible(
  left: { scope: MeasurementScope; scopeBasis: ScopeBasis },
  right: { scope: MeasurementScope; scopeBasis: ScopeBasis },
): boolean {
  if (left.scope === "UNKNOWN" || right.scope === "UNKNOWN") return left.scope === right.scope;
  if (left.scopeBasis === "UNKNOWN" || right.scopeBasis === "UNKNOWN") return false;
  return left.scope === right.scope;
}

function stageCompatible(observation: EvidenceObservation, context: CropContext): boolean {
  const requested = context.phenologicalStage;
  if (!requested || requested === "UNSPECIFIED")
    return (
      observation.stageApplicability === "UNSPECIFIED" || observation.stageApplicability === "ALL"
    );
  if (observation.stageApplicability === "UNSPECIFIED") return false;
  return observation.stageApplicability === "ALL" || observation.stageApplicability === requested;
}

function systemCompatible(observation: EvidenceObservation, context: CropContext): boolean {
  if (!context.hydroponicSystem || context.hydroponicSystem === "UNKNOWN") return true;
  return (
    observation.hydroponicSystem === "GENERAL_HYDROPONIC" ||
    observation.hydroponicSystem === context.hydroponicSystem
  );
}

function metricEvidence(
  observations: EvidenceObservation[],
  context: CropContext,
  metric: "EC" | "PH",
): EvidenceObservation[] {
  return observations.filter((observation) => {
    if (observation.metric !== metric) return false;
    if (observation.cropIdentity !== context.cropIdentity) return false;
    if (context.cultivar && observation.cultivar && observation.cultivar !== context.cultivar)
      return false;
    if (!stageCompatible(observation, context)) return false;
    if (!systemCompatible(observation, context)) return false;
    if (
      context.measurementScope &&
      !scopesCompatible(
        { scope: observation.measurementScope, scopeBasis: observation.scopeBasis },
        { scope: context.measurementScope, scopeBasis: "STATED" },
      )
    )
      return false;
    return true;
  });
}

function automaticEvidence(observations: EvidenceObservation[]): EvidenceObservation[] {
  return observations.filter(
    (observation) =>
      AUTOMATIC_TIERS.has(observation.source.tier) &&
      observation.evidenceState !== "LOW" &&
      observation.evidenceState !== "INSUFFICIENT",
  );
}

/** Selects comparable, contextually applicable observations without loose string matching. */
export function selectApplicable(
  observations: EvidenceObservation[],
  context: CropContext,
): EvidenceObservation[] {
  return automaticEvidence(
    observations.filter((observation) => {
      if (observation.cropIdentity !== context.cropIdentity) return false;
      if (!stageCompatible(observation, context)) return false;
      if (!systemCompatible(observation, context)) return false;
      if (
        context.measurementScope &&
        !scopesCompatible(
          { scope: observation.measurementScope, scopeBasis: observation.scopeBasis },
          { scope: context.measurementScope, scopeBasis: "STATED" },
        )
      )
        return false;
      return true;
    }),
  );
}

function rangeSelection(
  observations: EvidenceObservation[],
  cropIdentity: string,
  metric: "EC" | "PH",
): RangeSelection {
  const ranges = observations
    .map((observation) => observation.observedRange)
    .filter((range): range is NonNullable<EvidenceObservation["observedRange"]> => Boolean(range));
  const evidenceState = observations.some(
    (observation) => observation.evidenceState === "CONFLICTING",
  )
    ? "CONFLICTING"
    : observations.length > 0
      ? observations.reduce<EvidenceState>(
          (state, observation) =>
            state === "MODERATE" || observation.evidenceState === "MODERATE"
              ? "MODERATE"
              : observation.evidenceState,
          "HIGH",
        )
      : "INSUFFICIENT";
  const result: RangeSelection = { cropIdentity, evidenceState, observations };
  if (ranges.length > 0) {
    const min = Math.max(...ranges.map((range) => range.min));
    const max = Math.min(...ranges.map((range) => range.max));
    if (min <= max) {
      if (metric === "EC") result.ec = { min, max, unit: "mS/cm" };
      else result.ph = { min, max, unit: "pH" };
    } else {
      result.evidenceState = "CONFLICTING";
    }
  }
  return result;
}

export function selectCropRange(
  context: CropContext,
  observations: EvidenceObservation[] = CROP_EVIDENCE,
): { ec: RangeSelection; ph: RangeSelection } {
  return {
    ec: rangeSelection(
      metricEvidence(selectApplicable(observations, context), context, "EC"),
      context.cropIdentity,
      "EC",
    ),
    ph: rangeSelection(
      metricEvidence(selectApplicable(observations, context), context, "PH"),
      context.cropIdentity,
      "PH",
    ),
  };
}

export function calculatePolycultureRange(
  contexts: CropContext[],
  observations: EvidenceObservation[] = CROP_EVIDENCE,
): PolycultureRange {
  const unique = Array.from(
    new Map(contexts.map((context) => [context.cropIdentity, context])).values(),
  );
  const cropRanges = unique.map((context) => selectCropRange(context, observations).ec);
  const valid = cropRanges.filter((range) => range.ec && range.evidenceState !== "CONFLICTING");
  if (valid.length !== unique.length || valid.length === 0) {
    return {
      status: "INSUFFICIENT",
      cropRanges,
      limitingCrops: [],
      evidenceState: "INSUFFICIENT",
      claims: [
        claim(
          "polyculture-insufficient",
          "No comparable EC evidence for every crop and context",
          "DETERMINISTIC_CALCULATION",
          cropRanges.flatMap((range) => range.observations.map((item) => item.id)),
        ),
      ],
    };
  }
  const commonFloor = Math.max(...valid.map((range) => range.ec!.min));
  const commonCeiling = Math.min(...valid.map((range) => range.ec!.max));
  const limitingCrops = valid
    .filter((range) => range.ec!.max === commonCeiling || range.ec!.min === commonFloor)
    .map((range) => range.cropIdentity);
  const baseClaims = [
    claim(
      "polyculture-ranges",
      "Comparable crop ranges selected",
      "DETERMINISTIC_CALCULATION",
      valid.flatMap((range) => range.observations.map((item) => item.id)),
    ),
  ];
  if (commonFloor <= commonCeiling) {
    return {
      status: "COMMON_OPTIMUM_RANGE",
      range: { min: commonFloor, max: commonCeiling, unit: "mS/cm" },
      cropRanges,
      limitingCrops,
      evidenceState: valid.some((range) => range.evidenceState === "MODERATE")
        ? "MODERATE"
        : "HIGH",
      claims: [
        ...baseClaims,
        claim(
          "common-range",
          "Common optimum range",
          "DETERMINISTIC_CALCULATION",
          valid.map((range) => range.cropIdentity),
        ),
      ],
    };
  }
  return {
    status: "NO_COMMON_OPTIMUM_RANGE",
    cropRanges,
    limitingCrops,
    deviations: valid.map((range) => ({
      cropIdentity: range.cropIdentity,
      deviation: Math.max(0, commonFloor - range.ec!.max),
    })),
    separationRecommended: true,
    rationale: "The reported optimum ranges do not overlap.",
    evidenceState: valid.some((range) => range.evidenceState === "MODERATE") ? "MODERATE" : "HIGH",
    claims: [
      ...baseClaims,
      claim(
        "no-common-range",
        "The reported optimum ranges do not overlap",
        "DETERMINISTIC_CALCULATION",
        valid.map((range) => range.cropIdentity),
      ),
    ],
  };
}

function propagationState(states: EvidenceState[]): EvidenceState {
  if (states.includes("CONFLICTING")) return "CONFLICTING";
  if (states.includes("INSUFFICIENT")) return "INSUFFICIENT";
  if (states.includes("LOW")) return "LOW";
  if (states.includes("MODERATE")) return "MODERATE";
  return "HIGH";
}

export function deriveSuggestedStartingPoint(
  range: { min: number; max: number; unit: "mS/cm" },
  meterResolution?: number,
  derivedFrom: string[] = [],
): EngineResult<number> {
  const width = range.max - range.min;
  if (meterResolution !== undefined && width <= meterResolution) {
    return result(
      undefined,
      [
        warning(
          "STARTING_POINT_SUPPRESSED",
          "The evidence range is no wider than the meter resolution; Garden will not present false precision.",
          derivedFrom,
        ),
      ],
      [],
      [claim("supported-range", "Supported optimum range", "SOURCE_BACKED_FACT", derivedFrom)],
    );
  }
  const value = range.min + width * 0.25;
  return result(
    value,
    [
      warning(
        "STARTING_POINT_POLICY",
        "This is a provisional Garden starting policy, not a scientific target.",
        derivedFrom,
        "ENGINE_INFERENCE",
        true,
      ),
    ],
    [],
    [
      claim(
        "suggested-starting-point",
        "Suggested starting point",
        "ENGINE_INFERENCE",
        derivedFrom,
        { experimentalPolicy: true, value },
      ),
    ],
  );
}

export function calculateFreshTargetEc(input: {
  contexts: CropContext[];
  observations?: EvidenceObservation[];
  userSelectedTarget?: number;
  meterResolution?: number;
}): EngineResult<EcTargetResult> {
  const polyculture = calculatePolycultureRange(
    input.contexts,
    input.observations ?? CROP_EVIDENCE,
  );
  const warnings: EngineWarning[] = [];
  const claims: Claim[] = [];
  if (input.userSelectedTarget !== undefined) {
    const target = input.userSelectedTarget;
    claims.push(
      claim("user-target", "User-selected EC target", "USER_SELECTED", [], { value: target }),
    );
    const applicable = polyculture.range;
    if (applicable && (target < applicable.min || target > applicable.max)) {
      warnings.push(
        warning(
          "USER_TARGET_OUTSIDE_EVIDENCE",
          "The user-selected target is outside the applicable evidence range; it is preserved and not silently replaced.",
          ["user-target"],
          "USER_SELECTED",
        ),
      );
    } else if (!applicable) {
      warnings.push(
        warning(
          "USER_TARGET_WITHOUT_COMMON_EVIDENCE",
          "The user-selected target is preserved, but Garden could not establish a common applicable crop evidence range.",
          ["user-target"],
          "USER_SELECTED",
        ),
      );
    }
    return result(
      {
        mode: "FRESH_TARGET_EC",
        target: { min: target, max: target, unit: "mS/cm" },
        evidenceState: polyculture.evidenceState,
        warnings,
        claims,
      },
      warnings,
      [],
      claims,
    );
  }
  if (polyculture.status !== "COMMON_OPTIMUM_RANGE" || !polyculture.range) {
    return result(
      undefined,
      warnings,
      [
        error(
          "INSUFFICIENT_EC_EVIDENCE",
          polyculture.rationale ?? "No applicable comparable crop EC evidence is available.",
        ),
      ],
      [...polyculture.claims],
    );
  }
  const derived = deriveSuggestedStartingPoint(
    polyculture.range,
    input.meterResolution,
    polyculture.claims.flatMap((item) => item.derivedFrom),
  );
  claims.push(...polyculture.claims, ...derived.claims);
  return result(
    {
      mode: "FRESH_TARGET_EC",
      target: polyculture.range,
      suggestedStartingPoint: derived.value,
      evidenceState: propagationState([polyculture.evidenceState]),
      warnings: [...warnings, ...derived.warnings],
      claims,
    },
    [...warnings, ...derived.warnings],
    [],
    claims,
  );
}

/**
 * Calculates fresh-solution nutrient dose from a product-specific calibration.
 *
 * The calibration observations carry reservoir volume, so the EC response is
 * normalized to the requested volume before calculating a dose. This is not a
 * universal EC-to-mL constant: without an exact product/recipe calibration the
 * operation returns CALIBRATION_UNAVAILABLE.
 */
export function calculateFreshTargetEcDose(input: {
  sourceWaterEc: UserMeasurement;
  targetEc: number;
  reservoirVolumeL: number;
  calibration: CalibrationModel;
  policy?: EnginePolicy;
}): EngineResult<FreshTargetDoseResult> {
  const sourceEc = toMsPerCm(
    input.sourceWaterEc.value,
    input.sourceWaterEc.unit === "pH" ? "mS/cm" : input.sourceWaterEc.unit,
  );
  const claims: Claim[] = [
    claim("fresh-source-water-ec", "Measured source-water EC", "USER_SELECTED", [], {
      value: sourceEc,
    }),
    claim("fresh-target-ec", "Selected fresh-solution EC target", "USER_SELECTED", [], {
      value: input.targetEc,
    }),
    claim(
      "fresh-calibration-factor",
      "Volume-normalized product calibration factor",
      "USER_CALIBRATION",
      input.calibration.observations.map((item) => item.id),
      { value: input.calibration.factorEcPerMl },
    ),
  ];
  if (
    input.sourceWaterEc.context.scope !== "SOURCE_WATER" ||
    input.sourceWaterEc.context.scopeBasis === "UNKNOWN"
  )
    return result(
      undefined,
      [],
      [
        error(
          "SOURCE_WATER_SCOPE_REQUIRED",
          "Fresh target dosing requires an explicitly scoped SOURCE_WATER EC measurement.",
          ["sourceWaterEc"],
        ),
      ],
      claims,
    );
  if (!Number.isFinite(input.targetEc) || input.targetEc <= 0 || input.reservoirVolumeL <= 0)
    return result(
      undefined,
      [],
      [
        error(
          "INVALID_FRESH_TARGET_INPUT",
          "Fresh target EC and reservoir volume must be positive.",
        ),
      ],
      claims,
    );
  if (sourceEc > input.targetEc)
    return result(
      undefined,
      [],
      [
        error(
          "SOURCE_WATER_ABOVE_TARGET",
          "Source-water EC is already above the selected fresh-solution target; nutrient dosing cannot lower it.",
          ["fresh-source-water-ec", "fresh-target-ec"],
        ),
      ],
      claims,
    );
  if (Math.abs(sourceEc - input.targetEc) < Number.EPSILON)
    return result(
      {
        mode: "FRESH_TARGET_EC",
        direction: "NO_CHANGE",
        targetEc: input.targetEc,
        sourceEc,
        reservoirVolumeL: input.reservoirVolumeL,
        requiresMeasurement: true,
        evidenceState: input.calibration.evidenceState,
        warnings: [],
        claims,
      },
      [],
      [],
      claims,
    );

  const normalizedFactors = input.calibration.observations
    .filter((item) => item.doseAppliedMl > 0 && item.deltaEc > 0 && item.reservoirVolumeL > 0)
    .map(
      (item) =>
        (item.deltaEc / item.doseAppliedMl) * (item.reservoirVolumeL / input.reservoirVolumeL),
    );
  if (!normalizedFactors.length || !Number.isFinite(median(normalizedFactors)))
    return result(
      undefined,
      [],
      [
        error(
          "CALIBRATION_INVALID",
          "Fresh target dosing requires calibration observations with a positive EC response.",
        ),
      ],
      claims,
    );
  const factorAtVolume = median(normalizedFactors);
  const doseMl = (input.targetEc - sourceEc) / factorAtVolume;
  const warnings: EngineWarning[] = [];
  if (
    input.reservoirVolumeL < input.calibration.validCalibrationRange.minVolumeL ||
    input.reservoirVolumeL > input.calibration.validCalibrationRange.maxVolumeL ||
    doseMl < input.calibration.validCalibrationRange.minDoseMl ||
    doseMl > input.calibration.validCalibrationRange.maxDoseMl
  )
    warnings.push(
      warning(
        "CALIBRATION_EXTRAPOLATION",
        "The fresh target dose is outside the validated calibration volume or dose range.",
        ["fresh-calibration-factor"],
      ),
    );
  if (
    input.policy?.dosingEquipmentResolutionMl !== undefined &&
    doseMl > 0 &&
    doseMl < input.policy.dosingEquipmentResolutionMl
  )
    warnings.push(
      warning(
        "DOSE_BELOW_EQUIPMENT_RESOLUTION",
        "The required dose is positive but below the configured dosing resolution.",
        ["fresh-target-ec", "fresh-calibration-factor"],
      ),
    );
  const doseClaim = claim(
    "fresh-target-dose",
    "Calculated fresh target nutrient dose",
    "DETERMINISTIC_CALCULATION",
    ["fresh-source-water-ec", "fresh-target-ec", "fresh-calibration-factor"],
    { value: doseMl },
  );
  const allClaims = [...claims, doseClaim];
  return result(
    {
      mode: "FRESH_TARGET_EC",
      direction: "ADD_NUTRIENT",
      targetEc: input.targetEc,
      sourceEc,
      reservoirVolumeL: input.reservoirVolumeL,
      doseMl,
      requiresMeasurement: true,
      evidenceState: input.calibration.evidenceState,
      warnings,
      claims: allClaims,
    },
    warnings,
    [],
    allClaims,
  );
}

export function executeFreshRecipe(input: {
  recipeId: string;
  volumeL?: number;
  podCount?: number;
  feedingIndex?: number;
  contexts?: CropContext[];
  observations?: EvidenceObservation[];
  dosingEquipmentResolutionMl?: number;
}): EngineResult<RecipeResult> {
  const recipe = MANUFACTURER_RECIPES.find((item) => item.id === input.recipeId);
  if (!recipe)
    return result(
      undefined,
      [],
      [
        error(
          "RECIPE_UNAVAILABLE",
          "No manufacturer recipe exists for this exact product/formulation.",
          ["recipeId"],
        ),
      ],
      [],
    );
  let steps = recipe.steps;
  if (input.podCount !== undefined) {
    if (!recipe.podCountGroups?.includes(input.podCount)) {
      return result(
        undefined,
        [],
        [
          error(
            "UNSUPPORTED_POD_COUNT",
            "The manufacturer recipe does not document this pod count; Garden will not interpolate it.",
            ["podCount"],
          ),
        ],
        [],
      );
    }
    steps = steps.filter(
      (step) =>
        step.stage === `POD_GROUP_${input.podCount === 6 || input.podCount === 7 ? "6_7" : "9"}`,
    );
  }
  if (input.feedingIndex !== undefined)
    steps = steps.filter((step) => step.feedingIndex === input.feedingIndex);
  if (steps.length !== 1)
    return result(
      undefined,
      [],
      [
        error("RECIPE_STAGE_REQUIRED", "A single manufacturer feeding stage must be selected.", [
          "feedingIndex",
        ]),
      ],
      [],
    );
  const step = steps[0]!;
  if (step.doseUnit === "mL/L" && input.volumeL === undefined)
    return result(
      undefined,
      [],
      [
        error(
          "VOLUME_REQUIRED",
          "This manufacturer recipe is expressed per liter and requires an explicit solution volume.",
          ["volumeL"],
        ),
      ],
      [],
    );
  if (input.volumeL !== undefined && input.volumeL <= 0)
    return result(
      undefined,
      [],
      [error("INVALID_VOLUME", "Recipe volume must be positive.", ["volumeL"])],
      [],
    );
  const volume = input.volumeL ?? 1;
  const parts: RecipeResult["parts"] = Object.entries(step.doses).map(([componentId, perUnit]) => {
    const ml = step.doseUnit === "mL/L" ? perUnit * volume : perUnit;
    const resolution = input.dosingEquipmentResolutionMl;
    return {
      componentId,
      label: recipe.components.find((part) => part.id === componentId)?.label ?? componentId,
      ml,
      measurable: resolution === undefined || ml >= resolution,
    };
  });
  const warnings: EngineWarning[] = [];
  for (const part of parts) {
    if (!part.measurable && part.ml > 0)
      warnings.push(
        warning(
          "DOSE_BELOW_EQUIPMENT_RESOLUTION",
          `${part.label} dose is positive but below the configured equipment resolution.`,
          [step.label],
        ),
      );
  }
  let cropCompatibility: RangeSelection[] | undefined;
  let evidenceState: EvidenceState = "HIGH";
  if (input.contexts) {
    cropCompatibility = input.contexts.map(
      (context) => selectCropRange(context, input.observations ?? CROP_EVIDENCE).ec,
    );
    evidenceState = propagationState(cropCompatibility.map((item) => item.evidenceState));
    if (evidenceState === "INSUFFICIENT")
      warnings.push(
        warning(
          "CROP_COMPATIBILITY_UNCERTAIN",
          "The manufacturer recipe is executable, but crop compatibility cannot be evaluated with high confidence.",
          cropCompatibility.flatMap((item) =>
            item.observations.map((observation) => observation.id),
          ),
        ),
      );
    if (evidenceState === "CONFLICTING")
      warnings.push(
        warning(
          "CROP_COMPATIBILITY_CONFLICTING",
          "The manufacturer recipe is executable, but comparable crop evidence contains a material conflict.",
          cropCompatibility.flatMap((item) =>
            item.observations.map((observation) => observation.id),
          ),
        ),
      );
    if (step.expectedEc) {
      const disagreement = cropCompatibility.some(
        (item) =>
          item.ec && (step.expectedEc!.max < item.ec.min || step.expectedEc!.min > item.ec.max),
      );
      if (disagreement)
        warnings.push(
          warning(
            "MANUFACTURER_CROP_EC_DISAGREEMENT",
            "The manufacturer expected EC and applicable crop evidence do not overlap; neither is silently ranked as the truth.",
            [
              step.label,
              ...cropCompatibility.flatMap((item) =>
                item.observations.map((observation) => observation.id),
              ),
            ],
          ),
        );
    }
  }
  const claims: Claim[] = [
    claim(
      "manufacturer-dose",
      "Manufacturer recipe dose",
      "MANUFACTURER_INSTRUCTION",
      [recipe.source.id],
      { sourceIds: [recipe.source.id] },
    ),
  ];
  if (step.expectedEc)
    claims.push(
      claim(
        "manufacturer-expected-ec",
        "Manufacturer expected EC",
        "MANUFACTURER_INSTRUCTION",
        [step.label],
        {
          value: `${step.expectedEc.min}-${step.expectedEc.max} mS/cm`,
          sourceIds: [step.source.id],
        },
      ),
    );
  return result(
    {
      mode: "FRESH_RECIPE",
      recipe,
      volumeL: input.volumeL,
      podCount: input.podCount,
      feedingIndex: input.feedingIndex,
      parts,
      manufacturerRecipeExpectation: step.expectedEc,
      cropCompatibility,
      evidenceState,
      warnings,
      claims,
    },
    warnings,
    [],
    claims,
  );
}

function calibrationRatios(observations: CalibrationObservation[]): number[] {
  return observations
    .filter((item) => item.doseAppliedMl > 0 && item.deltaEc >= 0)
    .map((item) => item.deltaEc / item.doseAppliedMl);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

export function buildCalibrationModel(input: {
  productIdentity: CalibrationObservation["productIdentity"];
  formulationVersion?: string;
  recipeSignature: string;
  observations: CalibrationObservation[];
}): EngineResult<CalibrationModel> {
  const applicable = input.observations.filter(
    (item) =>
      sameProductIdentity(input.productIdentity, item.productIdentity) &&
      item.formulationVersion === input.formulationVersion &&
      item.componentRatioOrRecipeSignature === input.recipeSignature,
  );
  if (applicable.length === 0)
    return result(
      undefined,
      [],
      [
        error(
          "CALIBRATION_UNAVAILABLE",
          "No calibration observations match the exact product, formulation version and recipe signature.",
        ),
      ],
      [],
    );
  const ratios = calibrationRatios(applicable);
  if (ratios.length === 0)
    return result(
      undefined,
      [],
      [
        error(
          "CALIBRATION_INVALID",
          "Calibration observations must include the actual positive dose applied and a non-negative EC delta.",
        ),
      ],
      [],
    );
  const factor = median(ratios);
  const potentialOutlierIds = applicable
    .filter(
      (item) => Math.abs(item.deltaEc / item.doseAppliedMl - factor) > Math.max(factor * 0.5, 0.05),
    )
    .map((item) => item.id);
  const model: CalibrationModel = {
    productIdentity: input.productIdentity,
    formulationVersion: input.formulationVersion,
    recipeSignature: input.recipeSignature,
    observations: applicable,
    validCalibrationRange: {
      minDoseMl: Math.min(...applicable.map((item) => item.doseAppliedMl)),
      maxDoseMl: Math.max(...applicable.map((item) => item.doseAppliedMl)),
      minVolumeL: Math.min(...applicable.map((item) => item.reservoirVolumeL)),
      maxVolumeL: Math.max(...applicable.map((item) => item.reservoirVolumeL)),
    },
    factorEcPerMl: factor,
    evidenceState: applicable.length >= 5 ? "MODERATE" : "LOW",
    potentialOutlierIds,
    claims: [
      claim(
        "calibration-factor",
        "User calibration factor",
        "USER_CALIBRATION",
        applicable.map((item) => item.id),
        {
          value: factor,
          note:
            applicable.length < 5
              ? "Small sample preserved; potential outliers are flagged, not discarded."
              : undefined,
        },
      ),
    ],
  };
  return result(
    model,
    potentialOutlierIds.length
      ? [
          warning(
            "POTENTIAL_CALIBRATION_OUTLIERS",
            "Potential calibration outliers were preserved and flagged.",
            potentialOutlierIds,
          ),
        ]
      : [],
    [],
    model.claims,
  );
}

export function learnFromObservation(input: {
  productIdentity: CalibrationObservation["productIdentity"];
  formulationVersion?: string;
  recipeSignature: string;
  baselineEc: number;
  resultingEc: number;
  doseAppliedMl?: number;
  reservoirVolumeL: number;
  timestamp: string;
}): EngineResult<CalibrationObservation> {
  if (!input.doseAppliedMl || input.doseAppliedMl <= 0)
    return result(
      undefined,
      [],
      [
        error(
          "ACTUAL_DOSE_REQUIRED",
          "Calibration learning requires the actual dose applied; it never assumes 100% of a recommendation.",
          ["doseAppliedMl"],
        ),
      ],
      [],
    );
  const observation: CalibrationObservation = {
    id: `calibration-${input.timestamp}-${input.doseAppliedMl}`,
    productIdentity: input.productIdentity,
    formulationVersion: input.formulationVersion,
    componentRatioOrRecipeSignature: input.recipeSignature,
    baselineEc: input.baselineEc,
    deltaEc: input.resultingEc - input.baselineEc,
    resultingEc: input.resultingEc,
    doseAppliedMl: input.doseAppliedMl,
    reservoirVolumeL: input.reservoirVolumeL,
    timestamp: input.timestamp,
  };
  return result(
    observation,
    [],
    [],
    [
      claim("observed-calibration", "Recorded user calibration observation", "USER_CALIBRATION", [
        observation.id,
      ]),
    ],
  );
}

export function calculateEcCorrection(input: {
  currentEc: UserMeasurement;
  targetEc: number;
  reservoirVolumeL: number;
  calibration: CalibrationModel;
  policy?: EnginePolicy;
}): EngineResult<CorrectionResult> {
  const warnings: EngineWarning[] = [];
  const currentEc = toMsPerCm(
    input.currentEc.value,
    input.currentEc.unit === "pH" ? "mS/cm" : input.currentEc.unit,
  );
  const claims: Claim[] = [
    claim("current-ec", "Measured current EC", "USER_SELECTED", [], { value: currentEc }),
    claim("target-ec", "Selected EC target", "USER_SELECTED", [], { value: input.targetEc }),
    claim(
      "calibration-factor",
      "Calibration factor",
      "USER_CALIBRATION",
      input.calibration.observations.map((item) => item.id),
      { value: input.calibration.factorEcPerMl },
    ),
  ];
  if (
    input.currentEc.context.scope !== "NUTRIENT_SOLUTION" ||
    input.currentEc.context.scopeBasis === "UNKNOWN"
  )
    return result(
      undefined,
      [],
      [
        error(
          "INCOMPATIBLE_MEASUREMENT_SCOPE",
          "EC correction requires a nutrient-solution measurement; other scopes are not silently converted.",
        ),
      ],
      claims,
    );
  const difference = input.targetEc - currentEc;
  if (Math.abs(difference) < Number.EPSILON)
    return result(
      {
        mode: "EC_CORRECTION",
        direction: "NO_CHANGE",
        requiresRemeasurement: true,
        evidenceState: input.calibration.evidenceState,
        warnings,
        claims,
      },
      warnings,
      [],
      claims,
    );
  const doseMl = Math.abs(difference) / input.calibration.factorEcPerMl;
  if (
    doseMl < input.calibration.validCalibrationRange.minDoseMl ||
    doseMl > input.calibration.validCalibrationRange.maxDoseMl
  )
    warnings.push(
      warning(
        "CALIBRATION_EXTRAPOLATION",
        "The correction dose is outside the validated calibration range.",
        ["calibration-factor"],
        "ENGINE_INFERENCE",
      ),
    );
  const resolution = input.policy?.dosingEquipmentResolutionMl;
  if (resolution !== undefined && doseMl > 0 && doseMl < resolution)
    warnings.push(
      warning(
        "DOSE_BELOW_EQUIPMENT_RESOLUTION",
        "The required dose is positive but below the configured dosing resolution.",
        ["current-ec", "target-ec"],
      ),
    );
  if (difference < 0) {
    const waterMl = input.reservoirVolumeL * MILLIS_PER_LITER * (1 - input.targetEc / currentEc);
    return result(
      {
        mode: "EC_CORRECTION",
        direction: "ADD_WATER",
        waterMl,
        requiresRemeasurement: true,
        evidenceState: input.calibration.evidenceState,
        warnings,
        claims: [
          ...claims,
          claim("dilution-water", "Calculated dilution water", "DETERMINISTIC_CALCULATION", [
            "current-ec",
            "target-ec",
          ]),
        ],
      },
      warnings,
      [],
      claims,
    );
  }
  const fraction = input.policy?.firstStepFraction;
  const firstStepDoseMl = fraction && fraction > 0 && fraction < 1 ? doseMl * fraction : undefined;
  if (firstStepDoseMl !== undefined)
    warnings.push(
      warning(
        "PARTIAL_DOSE_POLICY",
        "A partial first dose is an experimental operating policy; mix, stabilize and remeasure before continuing.",
        ["calibration-factor"],
        "ENGINE_INFERENCE",
        true,
      ),
    );
  if (firstStepDoseMl !== undefined && resolution !== undefined && firstStepDoseMl < resolution)
    warnings.push(
      warning(
        "PARTIAL_DOSE_BELOW_RESOLUTION",
        "The staged first dose is below the configured measurable resolution.",
        ["PARTIAL_DOSE_POLICY"],
      ),
    );
  return result(
    {
      mode: "EC_CORRECTION",
      direction: "ADD_NUTRIENT",
      doseMl,
      firstStepDoseMl,
      requiresRemeasurement: true,
      evidenceState: input.calibration.evidenceState,
      warnings,
      claims: [
        ...claims,
        claim(
          "correction-dose",
          "Calculated correction dose",
          "DETERMINISTIC_CALCULATION",
          ["current-ec", "target-ec", "calibration-factor"],
          { value: doseMl },
        ),
      ],
    },
    warnings,
    [],
    claims,
  );
}

export function calculateTopUpMaintenance(input: {
  currentVolumeL?: number;
  nominalVolumeL: number;
  replacementWaterL: number;
  currentEc: UserMeasurement;
  targetEc: number;
  calibration?: CalibrationModel;
  policy?: EnginePolicy;
}): EngineResult<TopUpResult> {
  const currentEc = toMsPerCm(
    input.currentEc.value,
    input.currentEc.unit === "pH" ? "mS/cm" : input.currentEc.unit,
  );
  const claims: Claim[] = [
    claim("top-up-current-ec", "Measured current EC", "USER_SELECTED", [], { value: currentEc }),
    claim("top-up-water", "Replacement water amount", "USER_SELECTED", [], {
      value: input.replacementWaterL,
    }),
  ];
  if (input.currentVolumeL === undefined)
    return result(
      undefined,
      [],
      [
        error(
          "CURRENT_VOLUME_REQUIRED",
          "Current reservoir volume is required; nominal capacity cannot be used as a proxy for current volume.",
          ["currentVolumeL"],
        ),
      ],
      claims,
    );
  if (input.currentVolumeL <= 0 || input.replacementWaterL < 0)
    return result(
      undefined,
      [],
      [
        error(
          "INVALID_RESERVOIR_VOLUME",
          "Reservoir volumes must be positive and replacement water cannot be negative.",
        ),
      ],
      claims,
    );
  if (
    input.currentVolumeL > input.nominalVolumeL ||
    input.currentVolumeL + input.replacementWaterL > input.nominalVolumeL
  )
    return result(
      undefined,
      [],
      [error("RESERVOIR_CAPACITY_EXCEEDED", "The top-up would exceed known reservoir capacity.")],
      claims,
    );
  if (
    input.currentEc.context.scope !== "NUTRIENT_SOLUTION" ||
    input.currentEc.context.scopeBasis === "UNKNOWN"
  )
    return result(
      undefined,
      [],
      [
        error(
          "INCOMPATIBLE_MEASUREMENT_SCOPE",
          "Top-up maintenance requires a nutrient-solution measurement.",
        ),
      ],
      claims,
    );
  const resultingVolumeL = input.currentVolumeL + input.replacementWaterL;
  const afterWaterEc = (currentEc * input.currentVolumeL) / resultingVolumeL;
  let nutrientDoseMl: number | undefined;
  const warnings: EngineWarning[] = [
    warning(
      "LINEAR_MIXING_APPROXIMATION",
      "This linear EC model is an approximation; restored EC does not prove restored nutrient balance.",
      ["top-up-current-ec", "top-up-water"],
    ),
  ];
  if (afterWaterEc < input.targetEc) {
    if (!input.calibration)
      return result(
        undefined,
        warnings,
        [
          error(
            "CALIBRATION_REQUIRED",
            "A product-specific calibration is required to calculate nutrient addition after top-up.",
          ),
        ],
        claims,
      );
    nutrientDoseMl = (input.targetEc - afterWaterEc) / input.calibration.factorEcPerMl;
    if (
      nutrientDoseMl < input.calibration.validCalibrationRange.minDoseMl ||
      nutrientDoseMl > input.calibration.validCalibrationRange.maxDoseMl
    )
      warnings.push(
        warning(
          "CALIBRATION_EXTRAPOLATION",
          "The top-up dose is outside the validated calibration range.",
          ["calibration-factor"],
        ),
      );
  }
  if (
    input.policy?.enableCumulativeTopUpHeuristic &&
    input.policy.cumulativeTopUpLiters !== undefined &&
    input.policy.cumulativeTopUpLiters >= input.nominalVolumeL
  )
    warnings.push(
      warning(
        "CUMULATIVE_TOP_UP_REPLACEMENT_GUIDANCE",
        "Cumulative replacement has reached the nominal volume; consider a complete change as experimental policy, not a universal threshold.",
        ["cumulativeTopUpLiters"],
        "ENGINE_INFERENCE",
        true,
      ),
    );
  return result(
    {
      mode: "TOP_UP_MAINTENANCE",
      replacementWaterMl: input.replacementWaterL * MILLIS_PER_LITER,
      nutrientDoseMl,
      resultingVolumeL,
      approximation: true,
      evidenceState: input.calibration?.evidenceState ?? "MODERATE",
      warnings,
      claims: [
        ...claims,
        claim(
          "top-up-after-water-ec",
          "EC after replacement water",
          "DETERMINISTIC_CALCULATION",
          ["top-up-current-ec", "top-up-water"],
          { value: afterWaterEc },
        ),
        ...(nutrientDoseMl === undefined
          ? []
          : [
              claim(
                "top-up-dose",
                "Calculated nutrient dose after top-up",
                "DETERMINISTIC_CALCULATION",
                ["top-up-after-water-ec"],
              ),
            ]),
      ],
    },
    warnings,
    [],
    claims,
  );
}

export function evaluateSourceWater(input: {
  sourceEc: UserMeasurement;
  targetEc: number;
}): EngineResult<{ sourceEc: number; sourceToTargetRatio?: number; targetMinusSource?: number }> {
  const sourceEc = toMsPerCm(
    input.sourceEc.value,
    input.sourceEc.unit === "pH" ? "mS/cm" : input.sourceEc.unit,
  );
  const claims = [
    claim("source-water-ec", "Measured source-water EC", "USER_SELECTED", [], { value: sourceEc }),
    claim("target-ec", "Selected target EC", "USER_SELECTED", [], { value: input.targetEc }),
  ];
  if (
    input.sourceEc.context.scope !== "SOURCE_WATER" ||
    input.sourceEc.context.scopeBasis === "UNKNOWN"
  )
    return result(
      undefined,
      [],
      [
        error(
          "SOURCE_WATER_SCOPE_REQUIRED",
          "The source measurement must be explicitly scoped as SOURCE_WATER.",
        ),
      ],
      claims,
    );
  if (input.targetEc <= 0) return result({ sourceEc }, [], [], claims);
  return result(
    {
      sourceEc,
      sourceToTargetRatio: sourceEc / input.targetEc,
      targetMinusSource: input.targetEc - sourceEc,
    },
    [],
    [],
    claims,
  );
}

export function getReplacementGuidance(): EngineResult<{
  sourceId: string;
  approximateIntervalDays: number;
  experimentalPolicy: false;
}> {
  const sourceId = "okstate-ecph";
  const claims = [
    claim(
      "replacement-guidance",
      "OSU recommends complete replacement approximately every two weeks in its guidance",
      "SOURCE_BACKED_FACT",
      [sourceId],
      { sourceIds: [sourceId], value: "approximately 14 days" },
    ),
  ];
  return result(
    { sourceId, approximateIntervalDays: 14, experimentalPolicy: false },
    [],
    [],
    claims,
  );
}

export function assertNoFalseCertainty(claims: Claim[]): boolean {
  const ranks: Record<Claim["epistemic"], number> = {
    SOURCE_BACKED_FACT: 3,
    MANUFACTURER_INSTRUCTION: 3,
    USER_CALIBRATION: 3,
    DETERMINISTIC_CALCULATION: 2,
    ENGINE_INFERENCE: 1,
    UNVALIDATED_ASSUMPTION: 0,
    USER_SELECTED: 3,
  };
  return claims.every(
    (item) =>
      item.derivedFrom.length > 0 ||
      item.epistemic === "USER_SELECTED" ||
      item.epistemic === "UNVALIDATED_ASSUMPTION",
  );
}
