import {
  buildCalibrationModel,
  calculateEcCorrection,
  calculateFreshTargetEc,
  calculatePolycultureRange,
  calculateTopUpMaintenance,
  executeFreshRecipe,
  learnFromObservation,
} from "@/lib/garden-nutrient-engine-v1/engine";
import { CROP_EVIDENCE, MANUFACTURER_RECIPES } from "@/lib/garden-nutrient-engine-v1/data";
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
export type Intensity = "light" | "medium" | "aggressive";

export type DemoCrop = {
  id: string;
  emoji: string;
  name: Record<Lang, string>;
};

export type DemoProduct = {
  id: string;
  name: string;
  basis: "liters" | "pods";
  parts: { id: string; label: string }[];
  hasRecipeStages?: boolean;
};

export const DEMO_CROPS: DemoCrop[] = [
  { id: "genovese-basil", emoji: "🌿", name: { es: "Albahaca genovesa", en: "Genovese basil" } },
  { id: "bibb-lettuce", emoji: "🥬", name: { es: "Lechuga Bibb", en: "Bibb lettuce" } },
  { id: "cherry-tomato", emoji: "🍅", name: { es: "Tomate cherry", en: "Cherry tomato" } },
  { id: "common-mint", emoji: "🌱", name: { es: "Menta", en: "Mint" } },
];

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: "gh-flora",
    name: "GH FloraSeries",
    basis: "liters",
    hasRecipeStages: true,
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
    parts: [{ id: "single", label: "Liquid Plant Food" }],
  },
  {
    id: "custom-ab",
    name: "A + B (calibrado)",
    basis: "liters",
    parts: [
      { id: "a", label: "Parte A" },
      { id: "b", label: "Parte B" },
    ],
  },
];

export const DEMO_STAGES = [
  { id: "w1", feedingIndex: 1, label: { es: "Semana 1 · Plántula", en: "Week 1 · Seedling" } },
  { id: "w3", feedingIndex: 2, label: { es: "Semana 2 · Crecimiento", en: "Week 2 · Growth" } },
  {
    id: "w6",
    feedingIndex: 4,
    label: { es: "Semana 4 · Crecimiento tardío", en: "Week 4 · Late growth" },
  },
];

export type SavedSystem = {
  id: string;
  name: string;
  crops: Record<string, number>;
  liters: number;
  productId: string;
  water: { label: Record<Lang, string>; ec: number };
  meter: string;
  calibration?: { learned: number; readings: number };
  lastEc?: number;
};

/** The dock is intentionally local-only until a canonical saved-system contract is approved. */
export const DEMO_SYSTEMS: SavedSystem[] = [];

export type CalcInput = {
  mode: Mode;
  crops: Record<string, number>;
  liters: number;
  productId: string;
  stageId: string;
  intensity: Intensity;
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
  | { kind: "needs"; missing: string[]; message?: string }
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
      expectedEc?: number;
    };

const RECIPE_IDS: Record<string, string | undefined> = {
  "gh-flora": "general-hydroponics-floraseries-3part-2026-07-07",
  aerogarden: "aerogarden-liquid-plant-food-4-3-6",
};

function evidenceLabel(state: EvidenceState): Evidence {
  return state.toLowerCase() as Evidence;
}

function cropIdentity(id: string): string {
  if (id.includes("basil")) return "basil";
  if (id.includes("lettuce")) return "lettuce";
  if (id.includes("tomato")) return "tomato";
  if (id.includes("mint")) return "mint";
  return id;
}

function contextFor(
  crops: Record<string, number>,
  productId: string,
  stageId: string,
): CropContext[] {
  const stage = stageId === "w1" ? "SEEDLING" : stageId === "w6" ? "FLOWERING" : "VEGETATIVE";
  const system = productId === "aerogarden" ? "COUNTERTOP_POD" : "GENERAL_HYDROPONIC";
  return Object.keys(crops).map((id) => ({
    cropIdentity: cropIdentity(id),
    phenologicalStage: stage,
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

function productIdentity(productId: string) {
  return MANUFACTURER_RECIPES.find((recipe) => RECIPE_IDS[productId] === recipe.id)?.product;
}

function recipeSignatureFor(productId: string, stageId: string, liters: number, pods: number) {
  const recipeId = RECIPE_IDS[productId];
  if (!recipeId) return undefined;
  const stage = DEMO_STAGES.find((item) => item.id === stageId);
  const recipe = executeFreshRecipe({
    recipeId,
    feedingIndex: productId === "aerogarden" ? 1 : stage?.feedingIndex,
    podCount: productId === "aerogarden" ? pods : undefined,
    volumeL: productId === "aerogarden" ? undefined : liters,
  });
  return recipe.ok && recipe.value
    ? recipe.value.parts
        .map((part) => `${part.componentId}:${part.ml}`)
        .sort()
        .join("|")
    : undefined;
}

function actualDoseTotal(doses: Record<string, string>): number | undefined {
  const values = Object.values(doses).map((value) => Number(value.replace(",", ".")));
  if (!values.length || values.some((value) => !Number.isFinite(value) || value <= 0))
    return undefined;
  return values.reduce((sum, value) => sum + value, 0);
}

export function calculateGardenResult(input: CalcInput): CalcResult {
  const contexts = contextFor(input.crops, input.productId, input.stageId);
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
    const stage = DEMO_STAGES.find((item) => item.id === input.stageId);
    const recipe = executeFreshRecipe({
      recipeId,
      volumeL: input.productId === "aerogarden" ? undefined : input.liters,
      podCount: input.productId === "aerogarden" ? input.pods : undefined,
      feedingIndex: input.productId === "aerogarden" ? 1 : stage?.feedingIndex,
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
      expectedEc: recipe.value.manufacturerRecipeExpectation?.min,
    };
  }

  if (input.mode === "target") {
    if (!targetEngine.ok || !targetEngine.value || targetValue === undefined) {
      return engineNeeds(
        targetEngine.errors[0]?.message ?? "Elige un objetivo o aporta evidencia aplicable.",
      );
    }
    return {
      kind: "ok",
      provenance: input.userTarget !== null ? "user" : "garden",
      action: "add",
      doses: [],
      target: { value: targetValue, provenance: input.userTarget !== null ? "user" : "garden" },
      range,
      evidence: evidenceLabel(targetEngine.value.evidenceState),
      evidenceNote,
      outsideEvidence,
      sources,
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
      expectedEc:
        input.currentEc + (value.doseMl ? calibration.value.factorEcPerMl * value.doseMl : 0),
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
    expectedEc: targetValue,
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
