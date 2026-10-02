/**
 * Contracts for the hydroponic nutrient calculator.
 *
 * Everything here is provider-agnostic and framework-free so the engine can be
 * lifted into another project (Next.js on Vercel, a Supabase edge function,
 * etc.) without touching the UI.
 */

export type GrowthPhase = "seedling" | "vegetative" | "flowering";

export type FormulaId = "aerogarden" | "ab" | "flora";

/** A single bottle/part of a nutrient line. */
export interface NutrientPart {
  /** Stable key, used for React keys and result lookups. */
  id: string;
  /** User-facing bottle name, e.g. "FloraMicro". */
  label: string;
  /** NPK printed on the label, when the manufacturer publishes one. */
  npk?: string;
  /** Short role of this bottle in the mix. */
  role: string;
}

export interface NutrientFormula {
  id: FormulaId;
  name: string;
  vendor: string;
  /** Compact UI descriptor for the product line, when needed. */
  descriptor?: string;
  /** One-line positioning of the product line. */
  philosophy: string;
  parts: NutrientPart[];
  /** mL per litre of water, per part id, per phase. */
  dosePerLiter: Record<GrowthPhase, Record<string, number>>;
  /** Approximate mS/cm gained per (mL/L) of total product. Used to estimate EC. */
  ecPerMlPerLiter: number;
  /** Ordered mixing instructions from the manufacturer. */
  mixingSteps: string[];
  /** The one mistake that ruins the batch. Rendered as a warning. */
  criticalWarning: string;
  /** Size of the measuring cap that ships with the product, in mL. */
  capSizeMl: number;
}

/** Target ranges for a crop sharing a reservoir. */
export interface CropProfile {
  /** Plant id from plants.json. */
  id: string;
  spanishName: string;
  emoji: string;
  ecMin: number;
  ecMax: number;
  phMin: number;
  phMax: number;
}

export interface DosePart {
  partId: string;
  label: string;
  /** Total mL for the whole batch. */
  ml: number;
  /** Human-readable equivalence, e.g. "2.5 tapones de 5 mL". */
  equivalence: string;
}

export type DoseStatus = "ok" | "adjusted" | "conflict";

export interface DoseResult {
  formulaId: FormulaId;
  phase: GrowthPhase;
  liters: number;
  parts: DosePart[];
  /** Estimated EC of the resulting solution, mS/cm. */
  estimatedEc: number;
  /** Target EC window the dose aims for. */
  targetEc: { min: number; max: number };
  /** Target pH window. */
  targetPh: { min: number; max: number };
  status: DoseStatus;
  /** Agronomic explanation of the dose, in Spanish. */
  diagnosis: string;
  /** Crops the dose was balanced for (single crop = one entry). */
  crops: CropProfile[];
  /** Crop that caps the ceiling, when the mix had to be reduced. */
  limitingCrop?: CropProfile;
}
