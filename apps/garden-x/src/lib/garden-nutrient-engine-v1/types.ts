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
  publication?: string | undefined;
  revision?: string | undefined;
  region?: string | undefined;
  documentCode?: string | undefined;
  retrievedAt: string;
  contentHash?: string | undefined;
}

export interface EvidenceObservation {
  id: string;
  metric: "EC" | "PH";
  cropIdentity?: string | undefined;
  cultivar?: string | undefined;
  stageApplicability: StageApplicability;
  hydroponicSystem: HydroponicSystem;
  measurementScope: MeasurementScope;
  scopeBasis: ScopeBasis;
  environment?: string | undefined;
  source: SourceRef;
  verificationStatus: VerificationStatus;
  evidenceState: EvidenceState;
  publication?: string | undefined;
  observedRange?: { min: number; max: number; unit: "mS/cm" | "pH" } | undefined;
  observedValue?: number | undefined;
  notes?: string | undefined;
}

export interface MeasurementContext {
  scope: MeasurementScope;
  scopeBasis: ScopeBasis;
  temperatureC?: number | undefined;
  atcStatus?: ("ON" | "OFF" | "UNKNOWN") | undefined;
  meterReferenceTemperatureC?: number | undefined;
  phAdjustedBeforeMeasurement?: boolean | undefined;
}

export interface UserMeasurement {
  value: number;
  unit: "mS/cm" | "uS/cm" | "pH";
  context: MeasurementContext;
  meterResolution?: number | undefined;
  timestamp?: string | undefined;
}

export interface ProductIdentity {
  manufacturer: string;
  productFamily: string;
  exactProduct: string;
  formulationVersion?: string | undefined;
  region?: string | undefined;
  edition?: string | undefined;
}

export interface RecipeComponent {
  id: string;
  label: string;
  role?: string | undefined;
  npk?: string | undefined;
}

export interface RecipeStep {
  stage: string;
  feedingIndex?: number | undefined;
  label: string;
  doses: Record<string, number>;
  doseUnit: "mL/L" | "mL/gal" | "mL";
  expectedEc?: { min: number; max: number; unit: "mS/cm" } | undefined;
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
  notes?: string[] | undefined;
  podCountGroups?: number[] | undefined;
}

export interface CalibrationObservation {
  id: string;
  productIdentity: ProductIdentity;
  formulationVersion?: string | undefined;
  lot?: string | undefined;
  componentRatioOrRecipeSignature: string;
  /** Manufacturer recipe context and the actual measured mix are separate. */
  recipeContextSignature?: string | undefined;
  componentDosesMl?: Record<string, number> | undefined;
  baselineEc: number;
  deltaEc: number;
  resultingEc: number;
  doseAppliedMl: number;
  reservoirVolumeL: number;
  temperatureC?: number | undefined;
  atcStatus?: ("ON" | "OFF" | "UNKNOWN") | undefined;
  meterIdentity?: string | undefined;
  meterResolution?: number | undefined;
  timestamp: string;
}

export interface CalibrationModel {
  productIdentity: ProductIdentity;
  formulationVersion?: string | undefined;
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
  value?: (string | number) | undefined;
  epistemic: EpistemicClass;
  evidenceState?: EvidenceState | undefined;
  derivedFrom: string[];
  sourceIds?: string[] | undefined;
  experimentalPolicy?: boolean | undefined;
  note?: string | undefined;
}

export interface EngineWarning {
  code: string;
  message: string;
  epistemic: EpistemicClass;
  derivedFrom: string[];
  experimentalPolicy?: boolean | undefined;
}

export interface EngineError {
  code: string;
  message: string;
  missing?: string[] | undefined;
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
  cultivar?: string | undefined;
  phenologicalStage?: StageApplicability | undefined;
  hydroponicSystem?: HydroponicSystem | undefined;
  measurementScope?: MeasurementScope | undefined;
}

export interface RangeSelection {
  cropIdentity: string;
  ec?: { min: number; max: number; unit: "mS/cm" } | undefined;
  ph?: { min: number; max: number; unit: "pH" } | undefined;
  evidenceState: EvidenceState;
  observations: EvidenceObservation[];
}

export interface PolycultureRange {
  status: "COMMON_OPTIMUM_RANGE" | "NO_COMMON_OPTIMUM_RANGE" | "INSUFFICIENT";
  range?: { min: number; max: number; unit: "mS/cm" } | undefined;
  cropRanges: RangeSelection[];
  limitingCrops: string[];
  deviations?: { cropIdentity: string; deviation: number }[] | undefined;
  separationRecommended?: boolean | undefined;
  rationale?: string | undefined;
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
  volumeL?: number | undefined;
  podCount?: number | undefined;
  feedingIndex?: number | undefined;
  parts: DosePart[];
  manufacturerRecipeExpectation?: { min: number; max: number; unit: "mS/cm" } | undefined;
  cropCompatibility?: RangeSelection[] | undefined;
  evidenceState: EvidenceState;
  warnings: EngineWarning[];
  claims: Claim[];
}

export interface EcTargetResult {
  mode: "FRESH_TARGET_EC";
  target: { min: number; max: number; unit: "mS/cm" };
  suggestedStartingPoint?: number | undefined;
  evidenceState: EvidenceState;
  warnings: EngineWarning[];
  claims: Claim[];
}

export interface FreshTargetDoseResult {
  mode: "FRESH_TARGET_EC";
  direction: "ADD_NUTRIENT" | "NO_CHANGE";
  targetEc: number;
  sourceEc: number;
  reservoirVolumeL: number;
  doseMl?: number | undefined;
  requiresMeasurement: true;
  evidenceState: EvidenceState;
  warnings: EngineWarning[];
  claims: Claim[];
}

export interface CorrectionResult {
  mode: "EC_CORRECTION";
  direction: "ADD_NUTRIENT" | "ADD_WATER" | "NO_CHANGE";
  doseMl?: number | undefined;
  waterMl?: number | undefined;
  firstStepDoseMl?: number | undefined;
  requiresRemeasurement: true;
  evidenceState: EvidenceState;
  warnings: EngineWarning[];
  claims: Claim[];
}

export interface TopUpResult {
  mode: "TOP_UP_MAINTENANCE";
  replacementWaterMl: number;
  nutrientDoseMl?: number | undefined;
  resultingVolumeL: number;
  afterWaterEc: number;
  dilutionWaterMl?: number | undefined;
  approximation: true;
  evidenceState: EvidenceState;
  warnings: EngineWarning[];
  claims: Claim[];
}

export interface EnginePolicy {
  firstStepFraction?: number | undefined;
  enableCumulativeTopUpHeuristic?: boolean | undefined;
  cumulativeTopUpLiters?: number | undefined;
  meterResolution?: number | undefined;
  dosingEquipmentResolutionMl?: number | undefined;
}
