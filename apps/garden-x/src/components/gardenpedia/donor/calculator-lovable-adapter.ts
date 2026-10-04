import {
  buildCalibrationModel,
  calculateEcCorrection,
  calculateFreshTargetEcDose,
  calculateFreshTargetEc,
  calculatePolycultureRange,
  calculateTopUpMaintenance,
  executeFreshRecipe,
  learnFromObservation,
} from "@/lib/garden-nutrient-engine-v1/engine";
import { CROP_EVIDENCE, MANUFACTURER_RECIPES } from "@/lib/garden-nutrient-engine-v1/data";
import { donorPlants, donorPlantsById } from "./canonical-adapter";
import type { DonorPlant } from "./canonical-adapter";
import type {
  CalibrationObservation,
  Claim,
  CropContext,
  EngineResult,
  EvidenceState,
  MeasurementScope,
  UserMeasurement,
} from "@/lib/garden-nutrient-engine-v1/types";

export type Lang = "es" | "en";
export type Mode = "recipe" | "target" | "adjust" | "topup";
export type Provenance = "official" | "garden" | "measured" | "user";
export type Evidence = Lowercase<EvidenceState>;
export type EcUnit = "mS" | "uS";
export type CalculatorPlant = {
  id: string;
  emoji: string;
  name: Record<Lang, string>;
  scientificName: string;
  cultivar: string | null;
  aliases: readonly string[];
};

export type CalculatorProduct = {
  id: string;
  name: string;
  basis: "liters" | "pods";
  parts: { id: string; label: string }[];
  hasRecipeStages?: boolean;
  recipeId?: string;
  recipeStages: CalculatorStage[];
  available: boolean;
};

export type CalculatorStage = {
  id: string;
  feedingIndex: number | undefined;
  label: Record<Lang, string>;
};

export const CALCULATOR_PLANTS: CalculatorPlant[] = donorPlants.map((plant) => ({
  id: plant.id,
  emoji: plant.emoji,
  name: { es: plant.spanishName, en: plant.name },
  scientificName: plant.scientificName,
  cultivar: plant.variety,
  aliases: plant.tags,
}));

function spanishRecipeLabel(label: string): string {
  return label
    .replace("Grow week", "Grow · Semana")
    .replace("Bloom week", "Bloom · Semana")
    .replace(" / ", " · ")
    .replace("Seedling-Clone", "Plántula/Clon")
    .replace("Early Growth", "Crecimiento temprano")
    .replace("Late Growth", "Crecimiento tardío")
    .replace("Early Bloom", "Floración temprana")
    .replace("Mid Bloom", "Floración media")
    .replace("Late Bloom", "Floración tardía")
    .replace("Ripen", "Maduración")
    .replace("6-pod Harvest feeding", "Alimentación Harvest · 6 pods")
    .replace("9-pod Bounty first or second feeding", "Alimentación Bounty 1/2 · 9 pods")
    .replace("9-pod Bounty later feeding", "Alimentación Bounty posterior · 9 pods");
}

function projectRecipeStages(recipeId: string): CalculatorStage[] {
  const recipe = MANUFACTURER_RECIPES.find((item) => item.id === recipeId);
  return (recipe?.steps ?? []).map((step) => ({
    id: `feeding-${step.feedingIndex ?? step.label}`,
    feedingIndex: step.feedingIndex,
    label: { es: spanishRecipeLabel(step.label), en: step.label },
  }));
}

const FLORA_RECIPE_ID = "general-hydroponics-floraseries-3part-2026-07-07";
const AEROGARDEN_RECIPE_ID = "aerogarden-liquid-plant-food-4-3-6";
const FLORA_STAGES = projectRecipeStages(FLORA_RECIPE_ID);
const AEROGARDEN_STAGES = projectRecipeStages(AEROGARDEN_RECIPE_ID);

export const CALCULATOR_PRODUCTS: CalculatorProduct[] = [
  {
    id: "gh-flora",
    name: "GH FloraSeries",
    basis: "liters",
    hasRecipeStages: true,
    recipeId: FLORA_RECIPE_ID,
    recipeStages: FLORA_STAGES,
    available: true,
    parts: [
      { id: "micro", label: "FloraMicro" },
      { id: "gro", label: "FloraGro" },
      { id: "bloom", label: "FloraBloom" },
    ],
  },
  {
    id: "aerogarden",
    name: "AeroGarden Liquid Plant Food",
    basis: "pods",
    recipeId: AEROGARDEN_RECIPE_ID,
    hasRecipeStages: true,
    recipeStages: AEROGARDEN_STAGES,
    available: true,
    parts: [{ id: "single", label: "Liquid Plant Food" }],
  },
  {
    id: "ab",
    name: "A + B",
    basis: "liters",
    available: false,
    recipeStages: [],
    parts: [
      { id: "a", label: "Parte A" },
      { id: "b", label: "Parte B" },
    ],
  },
];

export const CALCULATOR_STAGES = FLORA_STAGES;

const STAGE_ALIASES: Record<string, string> = {
  w1: "feeding-1",
  w3: "feeding-2",
  w6: "feeding-4",
};

function stageForId(stageId: string, productId = "gh-flora") {
  const product = CALCULATOR_PRODUCTS.find((item) => item.id === productId);
  return (product?.recipeStages ?? CALCULATOR_STAGES).find(
    (item) => item.id === (STAGE_ALIASES[stageId] ?? stageId),
  );
}

export type SavedSystem = {
  id: string;
  name: string;
  crops: Record<string, number>;
  liters: number;
  productId: string;
  water: { label: Record<Lang, string>; ec: number };
  meter: string;
  stageId: string;
  pods: number;
  unit: EcUnit;
  calibrationObservations?: CalibrationObservation[];
  calibration?: { learned: number; readings: number };
  lastEc?: number;
};

export const CALCULATOR_STORAGE_KEY = "gardenpedia.calculator.systems.v1";

export function loadSavedSystems(): SavedSystem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CALCULATOR_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Partial<SavedSystem> => Boolean(item && typeof item === "object"))
      .filter((item) => typeof item.id === "string" && typeof item.name === "string")
      .map((item) => ({
        id: item.id!,
        name: item.name!,
        crops: item.crops ?? {},
        liters: item.liters ?? 1,
        productId: item.productId ?? "gh-flora",
        water: item.water ?? { label: { es: "Grifo", en: "Tap" }, ec: 0 },
        meter: item.meter ?? "—",
        stageId: item.stageId ?? "feeding-2",
        pods: item.pods ?? 6,
        unit: item.unit === "uS" ? "uS" : "mS",
        calibrationObservations: item.calibrationObservations ?? [],
        calibration: item.calibration,
        lastEc: item.lastEc,
      }));
  } catch {
    return [];
  }
}

export function persistSavedSystems(systems: SavedSystem[]) {
  if (typeof window !== "undefined")
    window.localStorage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify(systems));
}

export type CalcInput = {
  mode: Mode;
  crops: Record<string, number>;
  liters: number;
  productId: string;
  stageId: string;
  pods: number;
  sourceEc: number;
  currentEc: number | null;
  currentLiters: number | null;
  waterAdded: number | null;
  userTarget: number | null;
  round: number;
  calibrationObservations?: CalibrationObservation[];
};

export type CalcResult =
  | {
      kind: "needs";
      missing: string[];
      message?: string;
      target?: { value: number; provenance: Provenance };
      range?: { min: number; max: number; common: boolean; limiting?: string };
      evidence?: Evidence;
      evidenceNote?: Record<Lang, string>;
      outsideEvidence?: boolean;
      sources?: string[];
    }
  | {
      kind: "ok";
      provenance: Provenance;
      action: "add" | "dilute" | "hold";
      doses: { label: string; amount: number; unit: "mL" | "L" }[];
      target?: { value: number; provenance: Provenance };
      range?: { min: number; max: number; common: boolean; limiting?: string };
      evidence: Evidence;
      evidenceNote: Record<Lang, string>;
      outsideEvidence?: boolean;
      sources: string[];
      expectedEc?:
        | { kind: "manufacturer"; min: number; max: number }
        | { kind: "calculated"; min: number; max: number };
    };

const RECIPE_IDS = Object.fromEntries(
  CALCULATOR_PRODUCTS.filter((product) => product.recipeId).map((product) => [
    product.id,
    product.recipeId,
  ]),
) as Record<string, string | undefined>;

const NUTRIENT_IDENTITY_MAP: Record<string, string> = {
  "cinnamon-basil": "basil",
  "genovese-basil": "basil",
  "italian-large-leaf-basil": "basil",
  "purple-basil": "basil",
  "sweet-basil": "basil",
  "thai-basil": "basil",
  "bibb-lettuce": "lettuce",
  "black-seeded-simpson": "lettuce",
  "buttercrunch-lettuce": "lettuce",
  "iceberg-lettuce": "lettuce",
  "little-gem-lettuce": "lettuce",
  "oakleaf-lettuce": "lettuce",
  "red-romaine-lettuce": "lettuce",
  "red-sail-lettuce": "lettuce",
  "beefsteak-tomato": "tomato",
  "black-cherry-tomato": "tomato",
  "black-krim-tomato": "tomato",
  "celebrity-tomato": "tomato",
  "cherry-bomb-tomato": "tomato",
  "cherry-tomato": "tomato",
  "grape-tomato": "tomato",
  "patio-tomato": "tomato",
  "roma-tomato": "tomato",
  "san-marzano-tomato": "tomato",
  "sun-gold-tomato": "tomato",
  "sunrise-sauce-tomato": "tomato",
  "supersweet-100-tomato": "tomato",
  "tiny-tim-tomato": "tomato",
  "yellow-brandywine-tomato": "tomato",
  "yellow-pear-tomato": "tomato",
  "chinese-light-green-celery": "celery",
  "anaheim-pepper": "pepper",
  "ancho-pepper": "pepper",
  "banana-pepper": "pepper",
  "cayenne-pepper": "pepper",
  "cubanelle-pepper": "pepper",
  "habanero-pepper": "pepper",
  "jalapeno-pepper": "pepper",
  "mini-bell-pepper": "pepper",
  "poblano-pepper": "pepper",
  "serrano-pepper": "pepper",
  "shishito-pepper": "pepper",
  "sweet-chocolate-pepper": "pepper",
  "monterey-strawberry": "strawberry",
  "baby-spinach": "spinach",
  "seaside-f1-spinach": "spinach",
  "flat-leaf-parsley": "parsley",
  "italian-giant-parsley": "parsley",
  "broadleaf-sage": "sage",
};

export function resolveNutrientCropIdentity(plantId: string): string | undefined {
  return NUTRIENT_IDENTITY_MAP[plantId];
}

export function calculatorPlantById(id: string): DonorPlant | undefined {
  return donorPlantsById.get(id);
}

function evidenceLabel(state: EvidenceState): Evidence {
  return state.toLowerCase() as Evidence;
}

export function contextFor(crops: Record<string, number>, productId: string): CropContext[] {
  const system = productId === "aerogarden" ? "COUNTERTOP_POD" : "GENERAL_HYDROPONIC";
  return Object.keys(crops).map((id) => ({
    cropIdentity: resolveNutrientCropIdentity(id) ?? id,
    // A manufacturer feeding step is not evidence of plant phenology.
    phenologicalStage: "UNSPECIFIED",
    hydroponicSystem: system,
    measurementScope: "NUTRIENT_SOLUTION",
  }));
}

function noteFor(state: EvidenceState): Record<Lang, string> {
  const notes: Record<EvidenceState, Record<Lang, string>> = {
    HIGH: {
      es: "La evidencia aplicable es consistente y está respaldada por fuentes verificadas.",
      en: "Applicable evidence is consistent and backed by verified sources.",
    },
    MODERATE: {
      es: "La evidencia es aplicable, aunque la combinación de cultivos requiere criterio.",
      en: "The evidence is applicable, although this crop combination requires judgment.",
    },
    LOW: {
      es: "La evidencia aplicable es limitada. Garden conserva la incertidumbre.",
      en: "Applicable evidence is limited. Garden preserves that uncertainty.",
    },
    CONFLICTING: {
      es: "Las observaciones comparables presentan conflicto material.",
      en: "Comparable observations contain a material conflict.",
    },
    INSUFFICIENT: {
      es: "No hay evidencia aplicable suficiente para afirmar un rango automático.",
      en: "There is not enough applicable evidence for an automatic range.",
    },
  };
  return notes[state];
}

function sourceTitles(claims: Claim[]): string[] {
  const ids = new Set(claims.flatMap((claim) => claim.sourceIds ?? []));
  return CROP_EVIDENCE.filter((item) => ids.has(item.source.id)).map((item) => item.source.title);
}

function rangeFor(contexts: CropContext[]) {
  const result = calculatePolycultureRange(contexts, CROP_EVIDENCE);
  if (result.status === "COMMON_OPTIMUM_RANGE" && result.range) {
    return { min: result.range.min, max: result.range.max, common: true };
  }
  return result.cropRanges.find((item) => item.ec)
    ? {
        min: result.cropRanges.find((item) => item.ec)!.ec!.min,
        max: result.cropRanges.find((item) => item.ec)!.ec!.max,
        common: false,
        limiting: result.limitingCrops[0],
      }
    : undefined;
}

function engineNeeds(message: string): CalcResult {
  return { kind: "needs", missing: [], message };
}

function makeMeasurement(value: number): UserMeasurement {
  return {
    value,
    unit: "mS/cm",
    context: {
      scope: "NUTRIENT_SOLUTION" as MeasurementScope,
      scopeBasis: "STATED",
    },
  };
}

function makeSourceWaterMeasurement(value: number): UserMeasurement {
  return {
    value,
    unit: "mS/cm",
    context: {
      scope: "SOURCE_WATER",
      scopeBasis: "STATED",
    },
  };
}

function combineEvidence(states: EvidenceState[]): EvidenceState {
  if (states.includes("CONFLICTING")) return "CONFLICTING";
  if (states.includes("INSUFFICIENT")) return "INSUFFICIENT";
  if (states.includes("LOW")) return "LOW";
  if (states.includes("MODERATE")) return "MODERATE";
  return "HIGH";
}

function productIdentity(productId: string) {
  return MANUFACTURER_RECIPES.find((recipe) => RECIPE_IDS[productId] === recipe.id)?.product;
}

function recipeSignatureFor(productId: string, stageId: string, liters: number, pods: number) {
  const recipeId = RECIPE_IDS[productId];
  if (!recipeId) return undefined;
  const stage = stageForId(stageId, productId);
  const recipe = executeFreshRecipe({
    recipeId,
    feedingIndex: stage?.feedingIndex,
    podCount: productId === "aerogarden" ? pods : undefined,
    // GH signatures describe the recipe ratio, not a particular reservoir
    // size. Volume is supplied separately to the calibration calculation.
    volumeL: productId === "aerogarden" ? undefined : 1,
  });
  return recipe.ok && recipe.value
    ? recipe.value.parts
        .map((part) => `${part.componentId}:${part.ml}`)
        .sort()
        .join("|")
    : undefined;
}

function dosePartsForTotal(productId: string, stageId: string, pods: number, totalMl: number) {
  const recipeId = RECIPE_IDS[productId];
  if (!recipeId || totalMl <= 0) return undefined;
  const stage = stageForId(stageId, productId);
  const recipe = executeFreshRecipe({
    recipeId,
    feedingIndex: stage?.feedingIndex,
    podCount: productId === "aerogarden" ? pods : undefined,
    volumeL: productId === "aerogarden" ? undefined : 1,
  });
  if (!recipe.ok || !recipe.value) return undefined;
  const base = recipe.value.parts.reduce((sum, part) => sum + part.ml, 0);
  if (base <= 0) return undefined;
  return recipe.value.parts.map((part) => ({
    label: part.label,
    amount: (totalMl * part.ml) / base,
    unit: "mL" as const,
  }));
}

function actualDoseTotal(doses: Record<string, string>): number | undefined {
  const values = Object.values(doses).map((value) => Number(value.replace(",", ".")));
  if (!values.length || values.some((value) => !Number.isFinite(value) || value < 0))
    return undefined;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total > 0 ? total : undefined;
}

export function calculateGardenResult(input: CalcInput): CalcResult {
  const contexts = contextFor(input.crops, input.productId);
  const range = rangeFor(contexts);
  const targetEngine = calculateFreshTargetEc({
    contexts,
    userSelectedTarget: input.userTarget ?? undefined,
    meterResolution: 0.1,
  });
  const targetValue = input.userTarget ?? targetEngine.value?.suggestedStartingPoint;
  const evidenceState = targetEngine.value?.evidenceState ?? "INSUFFICIENT";
  const evidenceNote = noteFor(evidenceState);
  const sources = sourceTitles(targetEngine.value?.claims ?? []);
  const outsideEvidence = Boolean(
    input.userTarget !== null &&
    range &&
    (input.userTarget < range.min || input.userTarget > range.max),
  );

  if (input.mode === "recipe") {
    const recipeId = RECIPE_IDS[input.productId];
    if (!recipeId) return engineNeeds("No existe una receta oficial para esta formulación exacta.");
    const stage = stageForId(input.stageId, input.productId);
    const recipe = executeFreshRecipe({
      recipeId,
      volumeL: input.productId === "aerogarden" ? undefined : input.liters,
      podCount: input.productId === "aerogarden" ? input.pods : undefined,
      feedingIndex: stage?.feedingIndex,
      contexts,
      dosingEquipmentResolutionMl: 0.5,
    });
    if (!recipe.ok || !recipe.value) {
      return engineNeeds(
        recipe.errors[0]?.message ?? "La receta oficial necesita más información.",
      );
    }
    return {
      kind: "ok",
      provenance: "official",
      action: "add",
      doses: recipe.value.parts.map((part) => ({
        label: part.label,
        amount: part.ml,
        unit: "mL" as const,
      })),
      range,
      evidence: evidenceLabel(recipe.value.evidenceState),
      evidenceNote: noteFor(recipe.value.evidenceState),
      sources: [recipe.value.recipe.source.title],
      expectedEc: recipe.value.manufacturerRecipeExpectation
        ? {
            kind: "manufacturer",
            min: recipe.value.manufacturerRecipeExpectation.min,
            max: recipe.value.manufacturerRecipeExpectation.max,
          }
        : undefined,
    };
  }

  if (input.mode === "target") {
    if (!targetEngine.ok || !targetEngine.value || targetValue === undefined) {
      return {
        kind: "needs",
        missing: [],
        message:
          targetEngine.errors[0]?.message ?? "Elige un objetivo o aporta evidencia aplicable.",
        range,
        evidence: evidenceLabel(evidenceState),
        evidenceNote,
        outsideEvidence,
        sources,
      };
    }
    const targetPresentation = {
      target: {
        value: targetValue,
        provenance: input.userTarget !== null ? ("user" as const) : ("garden" as const),
      },
      range,
      evidence: evidenceLabel(targetEngine.value.evidenceState),
      evidenceNote,
      outsideEvidence,
      sources,
    };
    const identity = productIdentity(input.productId);
    const signature = recipeSignatureFor(input.productId, input.stageId, input.liters, input.pods);
    if (!identity || !signature) {
      return {
        kind: "needs",
        missing: [],
        message: "Esta formulación exacta todavía no tiene una calibración compatible.",
        ...targetPresentation,
      };
    }
    const calibration = buildCalibrationModel({
      productIdentity: identity,
      formulationVersion: identity.formulationVersion,
      recipeSignature: signature,
      observations: input.calibrationObservations ?? [],
    });
    if (!calibration.ok || !calibration.value) {
      return {
        kind: "needs",
        missing: [],
        message:
          "Registra una medición real en este producto y receta para calcular una dosis por EC.",
        ...targetPresentation,
      };
    }
    const dose = calculateFreshTargetEcDose({
      sourceWaterEc: makeSourceWaterMeasurement(input.sourceEc),
      targetEc: targetValue,
      reservoirVolumeL: input.liters,
      calibration: calibration.value,
      policy: { dosingEquipmentResolutionMl: 0.5 },
    });
    if (!dose.ok || !dose.value) {
      return {
        kind: "needs",
        missing: [],
        message: dose.errors[0]?.message ?? "No se pudo calcular una dosis por EC.",
        ...targetPresentation,
      };
    }
    const doseValue = dose.value;
    const doses =
      doseValue.doseMl !== undefined
        ? (dosePartsForTotal(input.productId, input.stageId, input.pods, doseValue.doseMl) ?? [
            { label: "Mezcla nutritiva", amount: doseValue.doseMl, unit: "mL" as const },
          ])
        : [];
    return {
      kind: "ok",
      provenance: input.userTarget !== null ? "user" : "garden",
      action: doseValue.direction === "NO_CHANGE" ? "hold" : "add",
      doses,
      ...targetPresentation,
      evidence: evidenceLabel(
        combineEvidence([targetEngine.value.evidenceState, doseValue.evidenceState]),
      ),
      sources: [...new Set([...sources, ...calibration.value.claims.map((claim) => claim.label)])],
      expectedEc: { kind: "calculated", min: targetValue, max: targetValue },
    };
  }

  if (targetValue === undefined) return engineNeeds("Selecciona un objetivo EC para continuar.");
  const identity = productIdentity(input.productId);
  const signature = recipeSignatureFor(input.productId, input.stageId, input.liters, input.pods);
  if (!identity || !signature)
    return engineNeeds(
      "Este producto necesita una calibración exacta antes de corregir o rellenar.",
    );
  const calibration = buildCalibrationModel({
    productIdentity: identity,
    formulationVersion: identity.formulationVersion,
    recipeSignature: signature,
    observations: input.calibrationObservations ?? [],
  });
  if (!calibration.ok || !calibration.value)
    return engineNeeds("Registra una medición real para calibrar este producto y receta exactos.");

  if (input.mode === "adjust") {
    if (input.currentEc === null) return engineNeeds("el EC que mediste");
    const correction = calculateEcCorrection({
      currentEc: makeMeasurement(input.currentEc),
      targetEc: targetValue,
      reservoirVolumeL: input.liters,
      calibration: calibration.value,
      policy: { dosingEquipmentResolutionMl: 0.5 },
    });
    if (!correction.ok || !correction.value)
      return engineNeeds(correction.errors[0]?.message ?? "No se pudo calcular la corrección.");
    const value = correction.value;
    const doses =
      value.direction === "ADD_WATER" && value.waterMl !== undefined
        ? [{ label: "Agua", amount: value.waterMl / 1000, unit: "L" as const }]
        : value.doseMl !== undefined
          ? [{ label: "Mezcla nutritiva", amount: value.doseMl, unit: "mL" as const }]
          : [];
    return {
      kind: "ok",
      provenance: "measured",
      action:
        value.direction === "ADD_WATER"
          ? "dilute"
          : value.direction === "NO_CHANGE"
            ? "hold"
            : "add",
      doses,
      target: { value: targetValue, provenance: input.userTarget !== null ? "user" : "garden" },
      range,
      evidence: evidenceLabel(value.evidenceState),
      evidenceNote,
      outsideEvidence,
      sources: calibration.value.claims.map((claim) => claim.label),
      expectedEc: {
        kind: "calculated",
        min: input.currentEc + (value.doseMl ? calibration.value.factorEcPerMl * value.doseMl : 0),
        max: input.currentEc + (value.doseMl ? calibration.value.factorEcPerMl * value.doseMl : 0),
      },
    };
  }

  if (input.currentEc === null) return engineNeeds("el EC que mediste");
  if (input.currentLiters === null) return engineNeeds("cuántos litros quedan");
  if (input.waterAdded === null) return engineNeeds("cuánta agua añadiste");
  const topup = calculateTopUpMaintenance({
    currentVolumeL: input.currentLiters,
    nominalVolumeL: input.liters,
    replacementWaterL: input.waterAdded,
    currentEc: makeMeasurement(input.currentEc),
    targetEc: targetValue,
    calibration: calibration.value,
  });
  if (!topup.ok || !topup.value)
    return engineNeeds(topup.errors[0]?.message ?? "No se pudo calcular el relleno.");
  const value = topup.value;
  return {
    kind: "ok",
    provenance: "measured",
    action: value.nutrientDoseMl ? "add" : "hold",
    doses: value.nutrientDoseMl
      ? [{ label: "Mezcla nutritiva", amount: value.nutrientDoseMl, unit: "mL" as const }]
      : [],
    target: { value: targetValue, provenance: input.userTarget !== null ? "user" : "garden" },
    range,
    evidence: evidenceLabel(value.evidenceState),
    evidenceNote,
    outsideEvidence,
    sources: value.claims.map((claim) => claim.label),
    expectedEc: { kind: "calculated", min: targetValue, max: targetValue },
  };
}

export function recordActualDoses(input: {
  productId: string;
  stageId: string;
  liters: number;
  pods: number;
  baselineEc: number;
  resultingEc: number;
  actualDoses: Record<string, string>;
}): EngineResult<CalibrationObservation> {
  const identity = productIdentity(input.productId);
  const signature = recipeSignatureFor(input.productId, input.stageId, input.liters, input.pods);
  const doseAppliedMl = actualDoseTotal(input.actualDoses);
  if (!identity || !signature || doseAppliedMl === undefined) {
    return {
      ok: false,
      warnings: [],
      errors: [
        { code: "ACTUAL_DOSE_REQUIRED", message: "Actual positive component doses are required." },
      ],
      claims: [],
    };
  }
  return learnFromObservation({
    productIdentity: identity,
    formulationVersion: identity.formulationVersion,
    recipeSignature: signature,
    baselineEc: input.baselineEc,
    resultingEc: input.resultingEc,
    doseAppliedMl,
    reservoirVolumeL: input.liters,
    timestamp: new Date().toISOString(),
  });
}
