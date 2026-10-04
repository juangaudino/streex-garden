/**
 * Pure calculation engine for hydroponic nutrient dosing.
 *
 * No React, no fetch, no platform APIs: safe to copy into any runtime.
 * Dose tables are conservative, home-grower oriented adaptations of the
 * published feeding charts for each product line.
 */

import { donorPlants as plants } from "./canonical-adapter";
import type {
  CropProfile,
  DosePart,
  DoseResult,
  FormulaId,
  GrowthPhase,
  NutrientFormula,
} from "./hydro-calculator.types";

/**
 * Canonical V1 entry points live outside this legacy donor-compatible facade.
 * The existing Calculator UI keeps its old shape until the parallel UX work
 * consumes the machine-readable V1 contract; no V1 calculation may be added
 * here as a second implementation.
 */
export {
  AEROGARDEN_RECIPE,
  CROP_EVIDENCE,
  FLORA_RECIPE,
  MANUFACTURER_RECIPES,
  NUTRIENT_SOURCES,
} from "@/lib/garden-nutrient-engine-v1";
export {
  assertNoFalseCertainty,
  buildCalibrationModel,
  calculateEcCorrection,
  calculateFreshTargetEc,
  calculatePolycultureRange,
  calculateTopUpMaintenance,
  executeFreshRecipe,
  evaluateSourceWater,
  getReplacementGuidance,
  learnFromObservation,
  selectApplicable,
  toMsPerCm,
  toUsPerCm,
} from "@/lib/garden-nutrient-engine-v1";

export const PHASE_LABELS: Record<GrowthPhase, string> = {
  seedling: "Plántula / trasplante",
  vegetative: "Crecimiento vegetativo",
  flowering: "Floración y fruto",
};

export const PHASE_HINTS: Record<GrowthPhase, string> = {
  seedling: "Dosis suave para raíces jóvenes",
  vegetative: "Dosis estándar para hoja y aroma",
  flowering: "Dosis madura para flor y fruto",
};

export const VOLUME_PRESETS = [1, 2, 3, 4, 5, 8, 10].map((liters) => ({
  liters,
  label: `${liters} L`,
  note: `${liters} litros de agua`,
}));

export const FORMULAS: NutrientFormula[] = [
  {
    id: "aerogarden",
    name: "AeroGarden Liquid Nutrients",
    vendor: "AeroGarden",
    philosophy:
      "Fórmula única patentada (4-3-6) con amortiguadores de pH incluidos. Máxima simplicidad.",
    parts: [
      {
        id: "single",
        label: "Nutriente líquido",
        npk: "4-3-6",
        role: "Todo en uno con buffer de pH",
      },
    ],
    dosePerLiter: {
      seedling: { single: 1 },
      vegetative: { single: 2.3 },
      flowering: { single: 2.8 },
    },
    ecPerMlPerLiter: 0.57,
    mixingSteps: [
      "Agita el frasco con fuerza durante 5 segundos: los micronutrientes sedimentan.",
      "Vierte la dosis directamente en el tanque con el agua ya cargada.",
      "Haz circular la bomba 2 minutos antes de colocar las canastillas.",
    ],
    criticalWarning:
      "No la combines con otras marcas: ya trae buffer de pH y mezclarla descontrola la lectura.",
    capSizeMl: 8,
  },
  {
    id: "ab",
    name: "Fórmula A + B universal",
    vendor: "URUQ · Ahopegarden · LetPot y similares",
    philosophy:
      "Bicomponente concentrado: A aporta calcio y hierro, B aporta fósforo, potasio y magnesio.",
    parts: [
      { id: "a", label: "Solución A", role: "Nitrato de calcio y hierro quelatado" },
      { id: "b", label: "Solución B", role: "Fósforo, potasio, magnesio y micros" },
    ],
    dosePerLiter: {
      seedling: { a: 2, b: 2 },
      vegetative: { a: 4, b: 4 },
      flowering: { a: 5, b: 5 },
    },
    ecPerMlPerLiter: 0.175,
    mixingSteps: [
      "Llena el tanque con el agua a temperatura ambiente.",
      "Añade toda la Solución A y agita o deja circular 1 minuto.",
      "Solo entonces añade la Solución B y vuelve a homogeneizar.",
    ],
    criticalWarning:
      "Nunca mezcles A y B concentrados entre sí: precipita fosfato de calcio y pierdes el calcio de forma irreversible.",
    capSizeMl: 5,
  },
  {
    id: "flora",
    name: "General Hydroponics FloraSeries",
    vendor: "General Hydroponics",
    descriptor: "FloraSeries",
    philosophy:
      "Tricomponente profesional: ajustas nitrógeno o fósforo según la etapa del cultivo.",
    parts: [
      {
        id: "micro",
        label: "FloraMicro",
        npk: "5-0-1",
        role: "Nitrógeno, calcio y micros quelatados",
      },
      { id: "gro", label: "FloraGro", npk: "2-1-6", role: "Follaje, tallo y estructura" },
      { id: "bloom", label: "FloraBloom", npk: "0-5-4", role: "Flor, fruto y aroma" },
    ],
    dosePerLiter: {
      seedling: { micro: 0.6, gro: 0.6, bloom: 0.6 },
      vegetative: { micro: 1.5, gro: 2.2, bloom: 0.8 },
      flowering: { micro: 1.5, gro: 0.8, bloom: 2.2 },
    },
    ecPerMlPerLiter: 0.31,
    mixingSteps: [
      "Primero FloraMicro en el agua y agita bien hasta disolver por completo.",
      "Después FloraGro y vuelve a homogeneizar.",
      "Por último FloraBloom. Comprueba el pH al final de la mezcla.",
    ],
    criticalWarning:
      "El orden es obligatorio. Si FloraBloom entra antes que FloraMicro, el calcio se bloquea y aparecen sales en el fondo.",
    capSizeMl: 5,
  },
];

export function getFormula(id: FormulaId): NutrientFormula {
  return FORMULAS.find((formula) => formula.id === id) ?? FORMULAS[1]!;
}

/** EC/pH windows by botanical category, with per-variety overrides. */
const CATEGORY_RANGES: Record<
  string,
  { ecMin: number; ecMax: number; phMin: number; phMax: number }
> = {
  herbs: { ecMin: 1.0, ecMax: 1.6, phMin: 5.5, phMax: 6.5 },
  "leafy greens": { ecMin: 0.8, ecMax: 1.2, phMin: 5.5, phMax: 6.2 },
  fruiting: { ecMin: 1.8, ecMax: 2.5, phMin: 5.8, phMax: 6.3 },
  fruits: { ecMin: 1.8, ecMax: 2.5, phMin: 5.8, phMax: 6.3 },
  vegetables: { ecMin: 1.2, ecMax: 1.8, phMin: 5.8, phMax: 6.3 },
  alliums: { ecMin: 1.2, ecMax: 1.8, phMin: 6.0, phMax: 6.5 },
  "root vegetables": { ecMin: 1.4, ecMax: 2.0, phMin: 5.8, phMax: 6.4 },
  flowers: { ecMin: 1.5, ecMax: 2.0, phMin: 5.8, phMax: 6.4 },
};

const VARIETY_OVERRIDES: Record<string, { ecMin: number; ecMax: number }> = {
  "genovese-basil": { ecMin: 1.2, ecMax: 1.6 },
  "sweet-basil": { ecMin: 1.2, ecMax: 1.6 },
  "cherry-tomato": { ecMin: 1.8, ecMax: 2.4 },
};

const DEFAULT_RANGE = { ecMin: 1.0, ecMax: 1.6, phMin: 5.5, phMax: 6.5 };

export function getCropProfile(plantId: string): CropProfile {
  const plant = plants.find((item) => item.id === plantId);
  const base = (plant && CATEGORY_RANGES[plant.category]) ?? DEFAULT_RANGE;
  const override = VARIETY_OVERRIDES[plantId];
  return {
    id: plantId,
    spanishName: plant?.spanishName ?? plantId,
    emoji: plant?.emoji ?? "🌿",
    ecMin: override?.ecMin ?? base.ecMin,
    ecMax: override?.ecMax ?? base.ecMax,
    phMin: base.phMin,
    phMax: base.phMax,
  };
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function equivalence(ml: number, capSizeMl: number) {
  if (ml < 1) return "usa jeringa o cuentagotas";
  const caps = ml / capSizeMl;
  if (caps < 0.4) return `menos de ½ tapón de ${capSizeMl} mL`;
  return `≈ ${round(caps)} tapones de ${capSizeMl} mL`;
}

/** Phase EC the undiluted chart dose is designed to reach. */
function phaseReferenceEc(formula: NutrientFormula, phase: GrowthPhase) {
  const total = Object.values(formula.dosePerLiter[phase]).reduce((sum, value) => sum + value, 0);
  return total * formula.ecPerMlPerLiter;
}

function buildParts(
  formula: NutrientFormula,
  phase: GrowthPhase,
  liters: number,
  scale: number,
): DosePart[] {
  return formula.parts.map((part) => {
    const perLiter = formula.dosePerLiter[phase][part.id] ?? 0;
    const ml = round(perLiter * liters * scale);
    return {
      partId: part.id,
      label: part.label,
      ml,
      equivalence: equivalence(ml, formula.capSizeMl),
    };
  });
}

/**
 * Dose for a reservoir growing a single variety.
 */
export function calculateSingleCropDose(input: {
  plantId: string;
  formulaId: FormulaId;
  phase: GrowthPhase;
  liters: number;
}): DoseResult {
  const formula = getFormula(input.formulaId);
  const crop = getCropProfile(input.plantId);
  const referenceEc = phaseReferenceEc(formula, input.phase);
  const midTarget = (crop.ecMin + crop.ecMax) / 2;

  // Keep the chart dose when it lands inside the crop window; otherwise scale it.
  const insideWindow = referenceEc >= crop.ecMin && referenceEc <= crop.ecMax;
  const scale = insideWindow ? 1 : midTarget / referenceEc;
  const parts = buildParts(formula, input.phase, input.liters, scale);
  const estimatedEc = round(referenceEc * scale, 2);

  return {
    formulaId: formula.id,
    phase: input.phase,
    liters: input.liters,
    parts,
    estimatedEc,
    targetEc: { min: crop.ecMin, max: crop.ecMax },
    targetPh: { min: crop.phMin, max: crop.phMax },
    status: insideWindow ? "ok" : "adjusted",
    diagnosis: insideWindow
      ? `Dosis de tabla dentro del rango óptimo de ${crop.spanishName} (${crop.ecMin}–${crop.ecMax} mS/cm).`
      : scale < 1
        ? `Dosis reducida un ${Math.round((1 - scale) * 100)}% respecto a la tabla: ${crop.spanishName} se estresa por encima de ${crop.ecMax} mS/cm.`
        : `Dosis reforzada un ${Math.round((scale - 1) * 100)}% respecto a la tabla para alcanzar el mínimo de ${crop.ecMin} mS/cm que pide ${crop.spanishName}.`,
    crops: [crop],
  };
}

/**
 * Dose for a shared reservoir with several varieties.
 *
 * Rule of the shared tank: the most salt-sensitive crop sets the ceiling.
 * FloraSeries additionally rebalances Gro/Bloom according to how much leaf vs
 * fruit the tray is carrying.
 */
export function calculatePolycultureCompromise(input: {
  plantIds: string[];
  formulaId: FormulaId;
  phase: GrowthPhase;
  liters: number;
}): DoseResult {
  const unique = Array.from(new Set(input.plantIds));
  if (unique.length === 0) {
    return calculateSingleCropDose({ ...input, plantId: "genovese-basil" });
  }
  if (unique.length === 1) {
    return calculateSingleCropDose({ ...input, plantId: unique[0]! });
  }

  const formula = getFormula(input.formulaId);
  const crops = unique.map(getCropProfile);

  const floorEc = Math.max(...crops.map((crop) => crop.ecMin));
  const ceilingEc = Math.min(...crops.map((crop) => crop.ecMax));
  const limitingCrop = crops.reduce(
    (lowest, crop) => (crop.ecMax < lowest.ecMax ? crop : lowest),
    crops[0]!,
  );
  const conflict = floorEc > ceilingEc;

  // With a conflict the sensitive ceiling wins; otherwise aim at the overlap.
  const targetMin = conflict ? round(ceilingEc - 0.2, 2) : round(floorEc, 2);
  const targetMax = conflict ? round(ceilingEc, 2) : round(ceilingEc, 2);
  const target = (targetMin + targetMax) / 2;

  const referenceEc = phaseReferenceEc(formula, input.phase);
  const scale = target / referenceEc;

  let parts = buildParts(formula, input.phase, input.liters, scale);

  if (formula.id === "flora") {
    // Shift Gro/Bloom toward whatever the tray is mostly carrying.
    const fruiting = crops.filter((crop) => crop.ecMax >= 1.8).length;
    const leafBias = 1 - fruiting / crops.length;
    parts = parts.map((part) => {
      if (part.partId === "gro") return { ...part, ml: round(part.ml * (0.85 + leafBias * 0.45)) };
      if (part.partId === "bloom") return { ...part, ml: round(part.ml * (1.3 - leafBias * 0.45)) };
      return part;
    });
    parts = parts.map((part) => ({
      ...part,
      equivalence: equivalence(part.ml, formula.capSizeMl),
    }));
  }

  const phMin = round(Math.max(...crops.map((crop) => crop.phMin)), 1);
  const phMax = round(Math.min(...crops.map((crop) => crop.phMax)), 1);

  return {
    formulaId: formula.id,
    phase: input.phase,
    liters: input.liters,
    parts,
    estimatedEc: round(target, 2),
    targetEc: { min: targetMin, max: targetMax },
    targetPh: { min: Math.min(phMin, phMax), max: Math.max(phMin, phMax) },
    status: conflict ? "conflict" : "ok",
    diagnosis: conflict
      ? `Dosis calibrada protegiendo ${limitingCrop.spanishName}, el cultivo más sensible del tanque. Los cultivos de fruto producirán más despacio para evitar quemaduras en hoja.`
      : `Ventana común de ${targetMin}–${targetMax} mS/cm para las ${crops.length} variedades activas. Techo marcado por ${limitingCrop.spanishName}.`,
    crops,
    limitingCrop,
  };
}
