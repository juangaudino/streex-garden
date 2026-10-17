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
import {
  CROP_EVIDENCE,
  MANUFACTURER_RECIPES,
  NUTRIENT_SOURCES,
} from "@/lib/garden-nutrient-engine-v1/data";
import { donorPlants, donorPlantsById } from "./canonical-adapter";
import type { DonorPlant } from "./canonical-adapter";
import type {
  CalibrationObservation,
  CalibrationModel,
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
  hasRecipeStages?: boolean | undefined;
  recipeId?: string | undefined;
  recipeStages: CalculatorStage[];
  podGroups?: readonly number[] | undefined;
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

const FLORA_RECIPE_ID = "general-hydroponics-floraseries-3part-2026-07-07";
const AEROGARDEN_RECIPE_ID = "aerogarden-liquid-plant-food-4-3-6";

function projectRecipeStages(recipeId: string): CalculatorStage[] {
  const recipe = MANUFACTURER_RECIPES.find((item) => item.id === recipeId);
  const seenFeedingIndexes = new Set<number>();
  return (recipe?.steps ?? [])
    .filter((step) => {
      if (recipeId !== AEROGARDEN_RECIPE_ID || step.feedingIndex === undefined) return true;
      if (seenFeedingIndexes.has(step.feedingIndex)) return false;
      seenFeedingIndexes.add(step.feedingIndex);
      return true;
    })
    .map((step) => ({
      id: `feeding-${step.feedingIndex ?? step.label}`,
      feedingIndex: step.feedingIndex,
      label: {
        es:
          recipeId === AEROGARDEN_RECIPE_ID
            ? step.feedingIndex === 1
              ? "Primera alimentación · Bounty · 9 pods"
              : step.feedingIndex === 2
                ? "Segunda alimentación · Bounty · 9 pods"
                : "Tercera y siguientes · Bounty · 9 pods"
            : spanishRecipeLabel(step.label),
        en:
          recipeId === AEROGARDEN_RECIPE_ID
            ? step.feedingIndex === 1
              ? "First feeding · Bounty · 9 pods"
              : step.feedingIndex === 2
                ? "Second feeding · Bounty · 9 pods"
                : "Third and later feedings · Bounty · 9 pods"
            : step.label,
      },
    }));
}

const FLORA_STAGES = projectRecipeStages(FLORA_RECIPE_ID);
const AEROGARDEN_STAGES = projectRecipeStages(AEROGARDEN_RECIPE_ID);

export function recipeStageLabel(
  stage: CalculatorStage,
  productId: string,
  pods: number,
  lang: Lang,
): string {
  if (productId !== "aerogarden") return stage.label[lang];
  if (stage.feedingIndex === 1 && pods === 9) {
    return lang === "es"
      ? "Primera alimentación · Bounty · 9 pods"
      : "First feeding · Bounty · 9 pods";
  }
  if (stage.feedingIndex === 2) {
    return lang === "es"
      ? "Segunda alimentación · Bounty · 9 pods"
      : "Second feeding · Bounty · 9 pods";
  }
  if (stage.feedingIndex === 3) {
    return lang === "es"
      ? "Tercera y siguientes · Bounty · 9 pods"
      : "Third and later feedings · Bounty · 9 pods";
  }
  return lang === "es"
    ? "En cada alimentación · Harvest · 6/7 pods"
    : "At each feeding · Harvest · 6/7 pods";
}

export function manufacturerDoseDefaults(input: {
  productId: string;
  stageId: string;
  liters: number;
  pods: number;
}): { id: string; label: string; amount: number }[] {
  const recipeId = RECIPE_IDS[input.productId];
  if (!recipeId) return [];
  const stage = stageForId(input.stageId, input.productId);
  const recipe = executeFreshRecipe({
    recipeId,
    ...(input.productId === "aerogarden" ? { podCount: input.pods } : { volumeL: input.liters }),
    ...(stage?.feedingIndex === undefined ? {} : { feedingIndex: stage.feedingIndex }),
  });
  return recipe.ok && recipe.value
    ? recipe.value.parts.map((part) => ({
        id: part.componentId,
        label: part.label,
        amount: part.ml,
      }))
    : [];
}

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
    podGroups: [6, 7, 9],
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
  calibrationObservations?: CalibrationObservation[] | undefined;
  calibration?: { learned: number; readings: number } | undefined;
  lastEc?: number | undefined;
  mode?: Mode | undefined;
  userTarget?: (number | null) | undefined;
  currentEc?: (number | null) | undefined;
  currentLiters?: (number | null) | undefined;
  capacityLiters?: number | null | undefined;
  waterAdded?: (number | null) | undefined;
  dosingResolutionMl?: number | undefined;
  sourceEcKnown?: boolean | undefined;
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
        water: item.water ?? { label: { es: "Agua de origen", en: "Source water" }, ec: 0 },
        meter: item.meter ?? "—",
        stageId: item.stageId ?? "feeding-2",
        pods: item.pods ?? 6,
        unit: item.unit === "uS" ? "uS" : "mS",
        calibrationObservations: item.calibrationObservations ?? [],
        calibration: item.calibration,
        lastEc: item.lastEc,
        mode: item.mode ?? "recipe",
        userTarget: item.userTarget ?? null,
        currentEc: item.currentEc ?? null,
        currentLiters: item.currentLiters ?? null,
        capacityLiters: item.capacityLiters ?? null,
        waterAdded: item.waterAdded ?? null,
        dosingResolutionMl: item.dosingResolutionMl ?? 0.5,
        sourceEcKnown: item.sourceEcKnown ?? true,
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
  language?: Lang | undefined;
  invalidFields?: string[] | undefined;
  mode: Mode;
  crops: Record<string, number>;
  liters: number;
  productId: string;
  stageId: string;
  pods: number;
  sourceEc: number;
  currentEc: number | null;
  currentLiters: number | null;
  capacityLiters?: number | null | undefined;
  waterAdded: number | null;
  userTarget: number | null;
  round: number;
  calibrationObservations?: CalibrationObservation[] | undefined;
  dosingResolutionMl?: number | undefined;
};

export type CalcResult =
  | {
      kind: "needs";
      missing: string[];
      message?: string | undefined;
      calibrationRequired?: boolean | undefined;
      target?: { value: number; provenance: Provenance } | undefined;
      range?:
        { min: number; max: number; common: boolean; limiting?: string | undefined } | undefined;
      evidence?: Evidence | undefined;
      evidenceNote?: Record<Lang, string> | undefined;
      outsideEvidence?: boolean | undefined;
      sources?: string[] | undefined;
      compatibility?: ReturnType<typeof calculatePolycultureRange> | undefined;
    }
  | {
      kind: "ok";
      provenance: Provenance;
      action: "add" | "dilute" | "hold";
      doses: { label: string; amount: number; unit: "mL" | "L" }[];
      target?: { value: number; provenance: Provenance } | undefined;
      range?:
        { min: number; max: number; common: boolean; limiting?: string | undefined } | undefined;
      evidence: Evidence;
      evidenceNote: Record<Lang, string>;
      outsideEvidence?: boolean | undefined;
      sources: string[];
      compatibility?: ReturnType<typeof calculatePolycultureRange> | undefined;
      warnings?: string[] | undefined;
      expectedEc?:
        | { kind: "manufacturer"; min: number; max: number }
        | { kind: "calculated"; min: number; max: number }
        | undefined;
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

export type CropEvidenceCoverageClass =
  "SUPPORTED_DIRECT" | "SUPPORTED_VIA_DEFENSIBLE_MAPPING" | "INSUFFICIENT" | "NOT_APPLICABLE";

export type CropEvidenceCoverageRow = {
  plantId: string;
  classification: CropEvidenceCoverageClass;
  evidenceIdentity?: string | undefined;
};

export type CropEvidenceCoverageReport = {
  totals: Record<CropEvidenceCoverageClass, number>;
  rows: CropEvidenceCoverageRow[];
};

export function resolveNutrientCropIdentity(plantId: string): string | undefined {
  return NUTRIENT_IDENTITY_MAP[plantId];
}

/**
 * Whether this published identity has applicable crop-level EC evidence for
 * the embedded Plant Detail calculator. Unknown identities must not inherit
 * the legacy calculator's broad category defaults.
 */
export function hasApplicableCropNutrientEvidence(plantId: string): boolean {
  if (CROP_EVIDENCE.some((item) => item.cropIdentity === plantId)) return true;
  if (!resolveNutrientCropIdentity(plantId)) return false;

  const result = calculatePolycultureRange(contextFor({ [plantId]: 1 }, "gh-flora"), CROP_EVIDENCE);
  return result.status !== "INSUFFICIENT";
}

/**
 * Audits every published Gardenpedia identity against the explicit nutrient
 * evidence boundary. Unknown identities stay insufficient; no name matching
 * or category guessing is used here.
 */
export function buildCropEvidenceCoverage(): CropEvidenceCoverageReport {
  const rows = CALCULATOR_PLANTS.map(({ id }) => {
    const evidenceIdentity = resolveNutrientCropIdentity(id);
    const hasDirectEvidence = CROP_EVIDENCE.some((item) => item.cropIdentity === id);
    if (hasDirectEvidence) {
      return { plantId: id, classification: "SUPPORTED_DIRECT" as const, evidenceIdentity: id };
    }
    if (!evidenceIdentity) return { plantId: id, classification: "INSUFFICIENT" as const };

    return !hasApplicableCropNutrientEvidence(id)
      ? { plantId: id, classification: "INSUFFICIENT" as const, evidenceIdentity }
      : {
          plantId: id,
          classification: "SUPPORTED_VIA_DEFENSIBLE_MAPPING" as const,
          evidenceIdentity,
        };
  });
  const totals: Record<CropEvidenceCoverageClass, number> = {
    SUPPORTED_DIRECT: 0,
    SUPPORTED_VIA_DEFENSIBLE_MAPPING: 0,
    INSUFFICIENT: 0,
    NOT_APPLICABLE: 0,
  };
  for (const row of rows) totals[row.classification] += 1;
  return { totals, rows };
}

export function calculatorPlantById(id: string): DonorPlant | undefined {
  return donorPlantsById.get(id);
}

export function calculatorSourceUrl(title: string): string | undefined {
  return Object.values(NUTRIENT_SOURCES).find((source) => source.title === title)?.url;
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
  if (result.status === "INSUFFICIENT") return undefined;
  if (result.status === "COMMON_OPTIMUM_RANGE" && result.range) {
    return { min: result.range.min, max: result.range.max, common: true };
  }
  // Never present one crop's range as the whole reservoir's range when
  // the selected crops have no common optimum.
  return undefined;
}

function engineNeeds(
  message: string,
  details: Partial<Extract<CalcResult, { kind: "needs" }>> = {},
): CalcResult {
  return { kind: "needs", missing: [], message, ...details };
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

function dosePartsForTotal(
  productId: string,
  stageId: string,
  pods: number,
  totalMl: number,
  calibration?: CalibrationModel,
) {
  const measuredParts = calibration?.observations[0]?.componentDosesMl;
  if (measuredParts) {
    const product = CALCULATOR_PRODUCTS.find((item) => item.id === productId);
    const sum = Object.values(measuredParts).reduce((total, value) => total + value, 0);
    if (!product || sum <= 0) return undefined;
    return product.parts.map((part) => ({
      label: part.label,
      amount: (totalMl * measuredParts[part.id]!) / sum,
      unit: "mL" as const,
    }));
  }
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
  if (Object.values(doses).some((value) => value.trim() === "")) return undefined;
  const values = Object.values(doses).map((value) => Number(value.replace(",", ".")));
  if (!values.length || values.some((value) => !Number.isFinite(value) || value < 0))
    return undefined;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total > 0 ? total : undefined;
}

export function calculateGardenResult(input: CalcInput): CalcResult {
  const calculated = calculateResult(input);
  if (
    calculated.kind === "ok" &&
    calculated.doses.some((dose) => !Number.isFinite(dose.amount) || dose.amount < 0)
  )
    return engineNeeds(
      "These values exceed numeric calculation limits. Check the measurements and volumes.",
    );
  if (calculated.kind === "ok" && input.dosingResolutionMl !== undefined) {
    const unmeasurable = calculated.doses.filter(
      (dose) => dose.unit === "mL" && dose.amount > 0 && dose.amount < input.dosingResolutionMl!,
    );
    if (unmeasurable.length)
      calculated.warnings = [
        ...(calculated.warnings ?? []),
        `Below your dosing resolution (${input.dosingResolutionMl} mL): ${unmeasurable.map((dose) => dose.label).join(", ")}. Use suitable equipment; do not round a required dose to zero.`,
      ];
  }
  const lang = input.language ?? "es";
  if (calculated.kind === "needs" && calculated.message)
    calculated.message = presentationMessage(calculated.message, lang);
  if (calculated.kind === "ok")
    calculated.warnings = calculated.warnings?.map((message) => presentationMessage(message, lang));
  return calculated;
}

function presentationMessage(message: string, lang: Lang): string {
  const pairs: [string, string][] = [
    [
      "Añade al menos una planta para aplicar evidencia EC.",
      "Add at least one plant to apply crop EC evidence.",
    ],
    [
      "Registra una medición real en este producto y receta para calcular una dosis por EC.",
      "Record a real measurement of this product and mixture to calculate EC-based doses.",
    ],
    [
      "Registra una medición real para calibrar este producto y receta exactos.",
      "Record a real measurement to calibrate this exact product and mixture.",
    ],
    ["Selecciona un objetivo EC para continuar.", "Select an EC target to continue."],
    ["el EC que mediste", "the EC you measured"],
    ["cuántos litros quedan", "the actual liters remaining"],
    ["cuánta agua añadiste", "the replacement water amount"],
    [
      "No hay evidencia EC aplicable y comparable para todos los cultivos. Elige un objetivo explícito solo si puedes justificarlo.",
      "No applicable comparable crop EC evidence is available.",
    ],
    [
      "Los rangos publicados no se solapan. Define un objetivo explícito o separa los cultivos.",
      "The reported optimum ranges do not overlap.",
    ],
    [
      "El agua de origen ya supera el objetivo; añadir nutrientes no puede reducir su EC.",
      "Source-water EC is already above the selected fresh-solution target; nutrient dosing cannot lower it.",
    ],
    [
      "El relleno superaría la capacidad del tanque.",
      "The top-up would exceed known reservoir capacity.",
    ],
    [
      "Deja espacio para el concentrado además del agua de reposición; las cantidades calculadas superan la capacidad conocida.",
      "Leave room for the nutrient stock as well as replacement water; the calculated additions exceed known capacity.",
    ],
    [
      "La dilución adicional superaría la capacidad. Retira o sustituye solución y recalcula con el volumen restante real.",
      "Further dilution would exceed capacity. Remove or replace solution before recalculating with the actual remaining volume.",
    ],
    [
      "Este agua no puede diluir la solución hasta el objetivo seleccionado.",
      "The selected source water EC is at or above the target and cannot dilute the solution to that target.",
    ],
    [
      "La mezcla lineal de EC es aproximada. Recuperar el EC no demuestra recuperar el equilibrio de nutrientes.",
      "This linear EC model is an approximation; restored EC does not prove restored nutrient balance.",
    ],
    [
      "La dosis está fuera del rango de volumen/dosis observado en tu calibración. Añade con cuidado y vuelve a medir.",
      "The fresh target dose is outside the validated calibration volume or dose range.",
    ],
    [
      "La corrección está fuera del rango observado en tu calibración. Vuelve a medir después de añadir.",
      "The correction dose is outside the validated calibration range.",
    ],
    [
      "El relleno está fuera del rango observado en tu calibración. Vuelve a medir después de añadir.",
      "The top-up dose is outside the validated calibration range.",
    ],
    [
      "AeroGarden por EC no está soportado en esta interfaz todavía. Usa la Receta oficial verificada; Garden no infiere volumen ni respuesta EC.",
      "AeroGarden EC dosing is not supported by this interface yet. Use the verified manufacturer Recipe; no reservoir volume or response coefficient is inferred.",
    ],
    [
      "Usa mediciones EC finitas no negativas, y un volumen y objetivo positivos.",
      "Use finite non-negative EC measurements and positive volume/target values.",
    ],
  ];
  const pair = pairs.find((item) => item.includes(message));
  if (pair) return pair[lang === "es" ? 0 : 1];
  if (lang === "es" && message.startsWith("Below your dosing resolution"))
    return message
      .replace("Below your dosing resolution", "Por debajo de tu resolución de dosificación")
      .replace(
        "Use suitable equipment; do not round a required dose to zero.",
        "Usa equipo adecuado; no redondees una dosis necesaria a cero.",
      );
  return message;
}

function calculateResult(input: CalcInput): CalcResult {
  if (input.productId === "aerogarden" && input.mode !== "recipe")
    return engineNeeds(
      "AeroGarden EC dosing is not supported by this interface yet. Use the verified manufacturer Recipe; no reservoir volume or response coefficient is inferred.",
    );
  if (input.invalidFields?.length) return { kind: "needs", missing: input.invalidFields };
  if (
    ![
      input.liters,
      input.sourceEc,
      input.userTarget ?? 1,
      input.currentEc ?? 0,
      input.currentLiters ?? 1,
      input.waterAdded ?? 0,
    ].every(Number.isFinite) ||
    input.liters <= 0 ||
    input.sourceEc < 0 ||
    (input.userTarget !== null && input.userTarget <= 0) ||
    (input.currentEc !== null && input.currentEc < 0)
  )
    return engineNeeds(
      "Use finite non-negative EC measurements and positive volume/target values.",
    );
  const contexts = contextFor(input.crops, input.productId);
  const compatibility = calculatePolycultureRange(contexts, CROP_EVIDENCE);
  const range = rangeFor(contexts);
  if (input.mode !== "recipe" && contexts.length === 0) {
    return engineNeeds("Añade al menos una planta para aplicar evidencia EC.");
  }
  const targetEngine = calculateFreshTargetEc({
    contexts,
    userSelectedTarget: input.userTarget ?? undefined,
    meterResolution: 0.1,
  });
  const targetValue = input.userTarget ?? targetEngine.value?.suggestedStartingPoint;
  const evidenceState = targetEngine.value?.evidenceState ?? "INSUFFICIENT";
  const evidenceNote = noteFor(evidenceState);
  const sources = [
    ...new Set([
      ...sourceTitles(targetEngine.value?.claims ?? []),
      ...compatibility.cropRanges.flatMap((crop) =>
        crop.observations.map((observation) => observation.source.title),
      ),
    ]),
  ];
  const outsideEvidence = Boolean(
    input.userTarget !== null &&
    range &&
    (input.userTarget < range.min || input.userTarget > range.max),
  );
  const targetPresentation = {
    ...(targetValue === undefined
      ? {}
      : {
          target: {
            value: targetValue,
            provenance: input.userTarget !== null ? ("user" as const) : ("garden" as const),
          },
        }),
    ...(range ? { range } : {}),
    evidence: evidenceLabel(evidenceState),
    evidenceNote,
    outsideEvidence,
    sources,
    compatibility,
  };

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
      dosingEquipmentResolutionMl: input.dosingResolutionMl,
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
      sources: [...new Set([recipe.value.recipe.source.title, ...sources])],
      compatibility,
      warnings: recipe.warnings.map((item) => item.message),
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
      return engineNeeds(
        targetEngine.errors[0]?.message ?? "Elige un objetivo o aporta evidencia aplicable.",
        targetPresentation,
      );
    }
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
    const calibration = applicableCalibration(input, identity, signature);
    if (!calibration.ok || !calibration.value) {
      return {
        kind: "needs",
        missing: [],
        message:
          "Registra una medición real en este producto y receta para calcular una dosis por EC.",
        calibrationRequired: true,
        ...targetPresentation,
      };
    }
    const dose = calculateFreshTargetEcDose({
      sourceWaterEc: makeSourceWaterMeasurement(input.sourceEc),
      targetEc: targetValue,
      reservoirVolumeL: input.liters,
      calibration: calibration.value,
      policy: { dosingEquipmentResolutionMl: input.dosingResolutionMl },
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
        ? (dosePartsForTotal(
            input.productId,
            input.stageId,
            input.pods,
            doseValue.doseMl,
            calibration.value,
          ) ?? [{ label: "Mezcla nutritiva", amount: doseValue.doseMl, unit: "mL" as const }])
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
      evidenceNote: noteFor(
        combineEvidence([targetEngine.value.evidenceState, doseValue.evidenceState]),
      ),
      sources: [...new Set([...sources, ...calibration.value.claims.map((claim) => claim.label)])],
      expectedEc: { kind: "calculated", min: targetValue, max: targetValue },
      warnings: dose.warnings.map((item) => item.message),
    };
  }

  if (targetValue === undefined)
    return engineNeeds("Selecciona un objetivo EC para continuar.", targetPresentation);
  const identity = productIdentity(input.productId);
  const signature = recipeSignatureFor(input.productId, input.stageId, input.liters, input.pods);
  if (!identity || !signature)
    return engineNeeds(
      "Este producto necesita una calibración exacta antes de corregir o rellenar.",
      targetPresentation,
    );
  const calibration = applicableCalibration(input, identity, signature);
  if (!calibration.ok || !calibration.value)
    return engineNeeds("Registra una medición real para calibrar este producto y receta exactos.", {
      ...targetPresentation,
      calibrationRequired: true,
    });

  if (input.mode === "adjust") {
    if (input.currentEc === null) return engineNeeds("el EC que mediste", targetPresentation);
    if (input.currentLiters === null)
      return engineNeeds("cuántos litros quedan", targetPresentation);
    const correction = calculateEcCorrection({
      currentEc: makeMeasurement(input.currentEc),
      dilutionWaterEc: makeSourceWaterMeasurement(input.sourceEc),
      targetEc: targetValue,
      reservoirVolumeL: input.currentLiters,
      reservoirCapacityL: input.capacityLiters ?? undefined,
      calibration: calibration.value,
      policy: { dosingEquipmentResolutionMl: input.dosingResolutionMl },
    });
    if (!correction.ok || !correction.value)
      return engineNeeds(
        correction.errors[0]?.message ?? "No se pudo calcular la corrección.",
        targetPresentation,
      );
    const value = correction.value;
    const doses =
      value.direction === "ADD_WATER" && value.waterMl !== undefined
        ? [{ label: "Agua", amount: value.waterMl / 1000, unit: "L" as const }]
        : value.doseMl !== undefined
          ? (dosePartsForTotal(
              input.productId,
              input.stageId,
              input.pods,
              value.doseMl,
              calibration.value,
            ) ?? [{ label: "Mezcla nutritiva", amount: value.doseMl, unit: "mL" as const }])
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
      evidence: evidenceLabel(combineEvidence([evidenceState, value.evidenceState])),
      evidenceNote: noteFor(combineEvidence([evidenceState, value.evidenceState])),
      outsideEvidence,
      sources: [...new Set([...sources, ...calibration.value.claims.map((claim) => claim.label)])],
      compatibility,
      warnings: correction.warnings.map((item) => item.message),
      expectedEc: {
        kind: "calculated",
        min: targetValue,
        max: targetValue,
      },
    };
  }

  if (input.currentEc === null) return engineNeeds("el EC que mediste", targetPresentation);
  if (input.currentLiters === null) return engineNeeds("cuántos litros quedan", targetPresentation);
  if (input.waterAdded === null) return engineNeeds("cuánta agua añadiste", targetPresentation);
  if (input.capacityLiters === null)
    return engineNeeds("Reservoir capacity is required before adding water.", targetPresentation);
  const topup = calculateTopUpMaintenance({
    currentVolumeL: input.currentLiters,
    nominalVolumeL: input.capacityLiters ?? input.liters,
    replacementWaterL: input.waterAdded,
    currentEc: makeMeasurement(input.currentEc),
    replacementWaterEc: makeSourceWaterMeasurement(input.sourceEc),
    targetEc: targetValue,
    calibration: calibration.value,
  });
  if (!topup.ok || !topup.value)
    return engineNeeds(topup.errors[0]?.message ?? "No se pudo calcular el relleno.", {
      ...targetPresentation,
      calibrationRequired: topup.errors.some((item) => item.code === "CALIBRATION_REQUIRED"),
    });
  const value = topup.value;
  return {
    kind: "ok",
    provenance: "measured",
    action:
      value.nutrientDoseMl || input.waterAdded > 0
        ? "add"
        : value.dilutionWaterMl
          ? "dilute"
          : "hold",
    doses: [
      ...(input.waterAdded > 0
        ? [{ label: "Replacement water", amount: input.waterAdded, unit: "L" as const }]
        : []),
      ...(value.nutrientDoseMl
        ? (dosePartsForTotal(
            input.productId,
            input.stageId,
            input.pods,
            value.nutrientDoseMl,
            calibration.value,
          ) ?? [{ label: "Mezcla nutritiva", amount: value.nutrientDoseMl, unit: "mL" as const }])
        : value.dilutionWaterMl
          ? [{ label: "Water", amount: value.dilutionWaterMl / 1000, unit: "L" as const }]
          : []),
    ],
    target: { value: targetValue, provenance: input.userTarget !== null ? "user" : "garden" },
    range,
    evidence: evidenceLabel(combineEvidence([evidenceState, value.evidenceState])),
    evidenceNote: noteFor(combineEvidence([evidenceState, value.evidenceState])),
    outsideEvidence,
    sources: [...new Set([...sources, ...calibration.value.claims.map((claim) => claim.label)])],
    compatibility,
    warnings: topup.warnings.map((item) => item.message),
    expectedEc: { kind: "calculated", min: targetValue, max: targetValue },
  };
}

function applicableCalibration(
  input: CalcInput,
  identity: CalibrationObservation["productIdentity"],
  context: string,
) {
  const observations = input.calibrationObservations ?? [];
  const matching = observations.filter(
    (item) => item.recipeContextSignature === context && item.componentDosesMl,
  );
  const latest = matching.at(-1);
  return buildCalibrationModel({
    productIdentity: identity,
    formulationVersion: identity.formulationVersion,
    recipeSignature: latest?.componentRatioOrRecipeSignature ?? context,
    // Old observations without actual per-component amounts cannot prove a mixture.
    observations: matching,
  });
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
  const components = CALCULATOR_PRODUCTS.find((item) => item.id === input.productId)?.parts ?? [];
  if (
    !identity ||
    !signature ||
    doseAppliedMl === undefined ||
    Object.keys(input.actualDoses).length !== components.length ||
    components.some((part) => !(part.id in input.actualDoses))
  ) {
    return {
      ok: false,
      warnings: [],
      errors: [
        { code: "ACTUAL_DOSE_REQUIRED", message: "Actual positive component doses are required." },
      ],
      claims: [],
    };
  }
  const componentDosesMl = Object.fromEntries(
    components.map((part) => [part.id, Number(input.actualDoses[part.id]!.replace(",", "."))]),
  );
  const measuredSignature = components
    .map((part) => `${part.id}:${(componentDosesMl[part.id]! / doseAppliedMl).toPrecision(12)}`)
    .sort()
    .join("|");
  const observation = learnFromObservation({
    productIdentity: identity,
    formulationVersion: identity.formulationVersion,
    recipeSignature: `${signature};observed=${measuredSignature}`,
    baselineEc: input.baselineEc,
    resultingEc: input.resultingEc,
    doseAppliedMl,
    reservoirVolumeL: input.liters,
    timestamp: new Date().toISOString(),
  });
  if (observation.value) {
    observation.value.recipeContextSignature = signature;
    observation.value.componentDosesMl = componentDosesMl;
  }
  return observation;
}
