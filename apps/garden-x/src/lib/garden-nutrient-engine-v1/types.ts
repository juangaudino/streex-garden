/**
 * Garden Nutrient Engine V1 contracts.
 *
 * This package is deliberately independent from React and from Garden X
 * persistence. It models source observations, manufacturer recipes, user
 * measurements and derived calculations without treating EC as nutrient
 * balance.
 */

export type OperatingMode =
  "FRESH_RECIPE" | "FRESH_TARGET_EC" | "EC_CORRECTION" | "TOP_UP_MAINTENANCE";

export type EpistemicClass =
  | "SOURCE_BACKED_FACT"
  | "MANUFACTURER_INSTRUCTION"
  | "USER_CALIBRATION"
  | "DETERMINISTIC_CALCULATION"
  | "ENGINE_INFERENCE"
  | "UNVALIDATED_ASSUMPTION"
  | "USER_SELECTED";

export type EvidenceState = "HIGH" | "MODERATE" | "LOW" | "CONFLICTING" | "INSUFFICIENT";

export type MeasurementScope =
  "NUTRIENT_SOLUTION" | "ROOT_ZONE" | "SOURCE_WATER" | "RUNOFF_OR_LEACHATE" | "UNKNOWN";

export type ScopeBasis = "STATED" | "INFERRED" | "UNKNOWN";

export type StageApplicability =
  "SEEDLING" | "VEGETATIVE" | "FLOWERING" | "FRUITING" | "ALL" | "UNSPECIFIED";

export type HydroponicSystem =
  "DWC" | "NFT" | "DRIP" | "AEROPONIC" | "COUNTERTOP_POD" | "GENERAL_HYDROPONIC" | "UNKNOWN";

export type SourceClass =
  "MANUFACTURER" | "UNIVERSITY_EXTENSION" | "SPECIALIST_GROWER" | "COMMUNITY" | "OTHER";

export type EvidenceTier = "A" | "B" | "C" | "D" | "E" | "F";

export type VerificationStatus = "VERIFIED" | "REPORTED" | "UNVERIFIED" | "CONFLICTING";

export interface SourceRef {
  id: string;
  publisher: string;
  title: string;
  url: string;
  sourceClass: SourceClass;
  tier: EvidenceTier;
  publication?: string;
  revision?: string;
  region?: string;
  documentCode?: string;
  retrievedAt: string;
  contentHash?: string;
}

export interface EvidenceObservation {
  id: string;
  metric: "EC" | "PH";
  cropIdentity?: string;
  cultivar?: string;
  stageApplicability: StageApplicability;
  hydroponicSystem: HydroponicSystem;
  measurementScope: MeasurementScope;
  scopeBasis: ScopeBasis;
  environment?: string;
  source: SourceRef;
  verificationStatus: VerificationStatus;
  evidenceState: EvidenceState;
  publication?: string;
  observedRange?: { min: number; max: number; unit: "mS/cm" | "pH" };
  observedValue?: number;
  notes?: string;
}

export interface MeasurementContext {
  scope: MeasurementScope;
  scopeBasis: ScopeBasis;
  temperatureC?: number;
  atcStatus?: "ON" | "OFF" | "UNKNOWN";
  meterReferenceTemperatureC?: number;
  phAdjustedBeforeMeasurement?: boolean;
}

export interface UserMeasurement {
  value: number;
  unit: "mS/cm" | "uS/cm" | "pH";
  context: MeasurementContext;
  meterResolution?: number;
  timestamp?: string;
}

export interface ProductIdentity {
  manufacturer: string;
  productFamily: string;
  exactProduct: string;
  formulationVersion?: string;
  region?: string;
  edition?: string;
}

export interface RecipeComponent {
  id: string;
  label: string;
  role?: string;
  npk?: string;
}

export interface RecipeStep {
  stage: string;
  feedingIndex?: number;
  label: string;
  doses: Record<string, number>;
  doseUnit: "mL/L" | "mL/gal" | "mL";
  expectedEc?: { min: number; max: number; unit: "mS/cm" };
  source: SourceRef;
  epistemic: "MANUFACTURER_INSTRUCTION";
}

export interface ManufacturerRecipe {
  id: string;
  product: ProductIdentity;
  components: RecipeComponent[];
  steps: RecipeStep[];
  mixingOrder: string[];
  source: SourceRef;
  executable: boolean;
  notes?: string[];
  podCountGroups?: number[];
}

export interface CalibrationObservation {
  id: string;
  productIdentity: ProductIdentity;
  formulationVersion?: string;
  lot?: string;
  componentRatioOrRecipeSignature: string;
  baselineEc: number;
  deltaEc: number;
  resultingEc: number;
  doseAppliedMl: number;
  reservoirVolumeL: number;
  temperatureC?: number;
  atcStatus?: "ON" | "OFF" | "UNKNOWN";
  meterIdentity?: string;
  meterResolution?: number;
  timestamp: string;
}

export interface CalibrationModel {
  productIdentity: ProductIdentity;
  formulationVersion?: string;
  recipeSignature: string;
  observations: CalibrationObservation[];
  validCalibrationRange: {
    minDoseMl: number;
    maxDoseMl: number;
    minVolumeL: number;
    maxVolumeL: number;
  };
  factorEcPerMl: number;
  evidenceState: EvidenceState;
  potentialOutlierIds: string[];
  claims: Claim[];
}

export interface Claim {
  id: string;
  label: string;
  value?: string | number;
  epistemic: EpistemicClass;
  evidenceState?: EvidenceState;
  derivedFrom: string[];
  sourceIds?: string[];
  experimentalPolicy?: boolean;
  note?: string;
}

export interface EngineWarning {
  code: string;
  message: string;
  epistemic: EpistemicClass;
  derivedFrom: string[];
  experimentalPolicy?: boolean;
}

export interface EngineError {
  code: string;
  message: string;
  missing?: string[];
}

export interface EngineResult<T> {
  ok: boolean;
  value?: T | undefined;
  warnings: EngineWarning[];
  errors: EngineError[];
  claims: Claim[];
}

export interface CropContext {
  cropIdentity: string;
  cultivar?: string;
  phenologicalStage?: StageApplicability;
  hydroponicSystem?: HydroponicSystem;
  measurementScope?: MeasurementScope;
}

export interface RangeSelection {
  cropIdentity: string;
  ec?: { min: number; max: number; unit: "mS/cm" };
  ph?: { min: number; max: number; unit: "pH" };
  evidenceState: EvidenceState;
  observations: EvidenceObservation[];
}

export interface PolycultureRange {
  status: "COMMON_OPTIMUM_RANGE" | "NO_COMMON_OPTIMUM_RANGE" | "INSUFFICIENT";
  range?: { min: number; max: number; unit: "mS/cm" };
  cropRanges: RangeSelection[];
  limitingCrops: string[];
  deviations?: { cropIdentity: string; deviation: number }[];
  separationRecommended?: boolean;
  rationale?: string;
  evidenceState: EvidenceState;
  claims: Claim[];
}

export interface DosePart {
  componentId: string;
  label: string;
  ml: number;
  measurable: boolean;
}

export interface RecipeResult {
  mode: "FRESH_RECIPE";
  recipe: ManufacturerRecipe;
  volumeL?: number;
  podCount?: number;
  feedingIndex?: number;
  parts: DosePart[];
  manufacturerRecipeExpectation?: { min: number; max: number; unit: "mS/cm" };
  cropCompatibility?: RangeSelection[];
  evidenceState: EvidenceState;
  warnings: EngineWarning[];
  claims: Claim[];
}

export interface EcTargetResult {
  mode: "FRESH_TARGET_EC";
  target: { min: number; max: number; unit: "mS/cm" };
  suggestedStartingPoint?: number;
  evidenceState: EvidenceState;
  warnings: EngineWarning[];
  claims: Claim[];
}

export interface CorrectionResult {
  mode: "EC_CORRECTION";
  direction: "ADD_NUTRIENT" | "ADD_WATER" | "NO_CHANGE";
  doseMl?: number;
  waterMl?: number;
  firstStepDoseMl?: number;
  requiresRemeasurement: true;
  evidenceState: EvidenceState;
  warnings: EngineWarning[];
  claims: Claim[];
}

export interface TopUpResult {
  mode: "TOP_UP_MAINTENANCE";
  replacementWaterMl: number;
  nutrientDoseMl?: number;
  resultingVolumeL: number;
  approximation: true;
  evidenceState: EvidenceState;
  warnings: EngineWarning[];
  claims: Claim[];
}

export interface EnginePolicy {
  firstStepFraction?: number;
  enableCumulativeTopUpHeuristic?: boolean;
  cumulativeTopUpLiters?: number;
  meterResolution?: number;
  dosingEquipmentResolutionMl?: number;
}
