import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Gauge,
  Leaf,
  Minus,
  Plus,
  Save,
  Sliders,
  Sprout,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  buildCalibrationModel,
  calculateEcCorrection,
  calculateFreshTargetEc,
  calculateTopUpMaintenance,
  executeFreshRecipe,
  learnFromObservation,
  selectCropRange,
} from "@/lib/garden-nutrient-engine-v1/engine";
import { CROP_EVIDENCE, MANUFACTURER_RECIPES } from "@/lib/garden-nutrient-engine-v1/data";
import type {
  CalibrationModel,
  CalibrationObservation,
  Claim,
  EngineError,
  EngineWarning,
  EngineResult,
  RecipeResult,
  UserMeasurement,
} from "@/lib/garden-nutrient-engine-v1/types";
import { cn } from "@/lib/utils";

import { donorPlants as plants } from "./canonical-adapter";
import {
  buildCropContexts,
  cropIdentityForPlant,
  MODE_TO_ENGINE,
  recipeIdForProduct,
  recipeSignature,
  sumComponentDoses,
  type CalculatorMode,
  type CalculatorPhase,
  type CalculatorProduct,
} from "./calculator-v1-adapter";

type Language = "es" | "en";
type MixState = {
  name: string;
  crops: Record<string, number>;
  volumeL: number;
  phase: CalculatorPhase;
  product: CalculatorProduct;
  feedingIndex: number;
  podCount: number;
  targetEc?: number;
  currentEc?: number;
  currentVolumeL?: number;
  replacementWaterL?: number;
  nominalVolumeL?: number;
};
type SavedSystem = MixState & { id: string };

const LITER_CHIPS = [1, 2, 3, 4, 6.5, 10];
const PHASES: CalculatorPhase[] = ["seedling", "vegetative", "flowering"];
const MODE_ORDER: CalculatorMode[] = ["recipe", "target", "correction", "topup"];
const PRODUCT_ORDER: CalculatorProduct[] = ["flora", "aerogarden", "ab"];

const COPY = {
  es: {
    calculator: "Calculadora",
    quickMix: "Mezcla rápida",
    plantsShare: "Plantas que comparten el agua",
    plants: "plantas",
    choosePlant: "Elige una planta…",
    addPlant: "Añadir planta",
    waterLiters: "Litros de agua",
    formulaStage: "Producto y etapa",
    unsaved: "Sin guardar",
    saveAs: "Guardar como sistema",
    remove: "Eliminar",
    recommendedDose: "Dosis recomendada",
    targetEc: "EC objetivo",
    reportedRange: "Rango reportado",
    suggested: "Punto de partida sugerido",
    calculated: "Calculado por Garden",
    mixOrder: "Orden de mezcla",
    measured: "Qué obtuviste",
    measuredEc: "EC medida (mS/cm)",
    baselineEc: "EC antes de añadir",
    actualDose: "Lo que añadiste realmente",
    resultEc: "EC después de mezclar",
    calibration: "Calibrar este sistema",
    confirmActual: "Confirmo que estas son las dosis realmente aplicadas",
    record: "Registrar medición",
    noCalibration: "Se necesita una calibración de este producto y receta exactos.",
    addPlantFirst: "Añade al menos una planta para calcular.",
    newSystem: "Nuevo sistema",
    saveChanges: "Guardar cambios",
    delete: "Eliminar",
    noSaved: "Aún no hay sistemas guardados",
    saved: "Sistemas guardados",
    targetHint:
      "El objetivo es una entrada. El punto sugerido es una política provisional de Garden, no un EC ideal.",
    correctionHint:
      "Mide → calcula → añade una dosis parcial si corresponde → mezcla, circula y estabiliza → vuelve a medir.",
    topupHint:
      "El modelo lineal es una aproximación: restaurar el EC no demuestra restaurar el equilibrio de nutrientes.",
    unsupported: "Este producto o combinación no tiene una receta V1 ejecutable todavía.",
    evidence: "Evidencia y procedencia",
    claims: "Qué respalda este resultado",
    nextMeasure: "Qué medir después",
    sourceRecipe: "Receta oficial del fabricante",
    sourceGarden: "Cálculo de Garden",
    sourceUser: "Objetivo definido por el usuario",
    sourceMeasurement: "Basado en tus mediciones",
    product: "Producto",
    stage: "Etapa / alimentación",
    podCount: "Pods",
    currentEc: "EC actual",
    currentVolume: "Volumen actual",
    waterAdded: "Agua añadida",
    reservoir: "Capacidad del tanque",
    selected: "Seleccionado",
    noChange: "No se requiere cambio",
    addNutrient: "Añadir nutriente",
    addWater: "Añadir agua",
    partial: "Primera dosis parcial",
    remeasure: "Vuelve a medir después de mezclar y estabilizar",
    saveLocal: "Se guarda solo en este dispositivo",
    actualRequired: "Confirma las dosis reales antes de registrar.",
    officialExpected: "EC esperado por el fabricante",
    cropEvidence: "Evidencia aplicable del cultivo",
    noRange: "Sin rango aplicable suficiente",
    approximation: "Aproximación",
    modeRecipe: "RECETA",
    modeTarget: "POR EC",
    modeCorrection: "CORREGIR",
    modeTopup: "RELLENAR",
  },
  en: {
    calculator: "Calculator",
    quickMix: "Quick Mix",
    plantsShare: "Plants sharing the water",
    plants: "plants",
    choosePlant: "Choose a plant…",
    addPlant: "Add plant",
    waterLiters: "Water volume",
    formulaStage: "Product and stage",
    unsaved: "Unsaved",
    saveAs: "Save as system",
    remove: "Delete",
    recommendedDose: "Recommended dose",
    targetEc: "Target EC",
    reportedRange: "Reported optimum range",
    suggested: "Suggested starting point",
    calculated: "Calculated by Garden",
    mixOrder: "Mixing order",
    measured: "What you obtained",
    measuredEc: "Measured EC (mS/cm)",
    baselineEc: "EC before adding",
    actualDose: "What you actually added",
    resultEc: "EC after mixing",
    calibration: "Calibrate this system",
    confirmActual: "I confirm these are the doses actually applied",
    record: "Record measurement",
    noCalibration: "A calibration for this exact product and recipe is required.",
    addPlantFirst: "Add at least one plant to calculate.",
    newSystem: "New system",
    saveChanges: "Save changes",
    delete: "Delete",
    noSaved: "No saved systems yet",
    saved: "Saved systems",
    targetHint:
      "The target is an input. The suggested point is a provisional Garden policy, not an ideal EC.",
    correctionHint:
      "Measure → calculate → apply a partial dose when appropriate → mix, circulate and stabilize → measure again.",
    topupHint:
      "The linear model is an approximation: restoring EC does not prove restored nutrient balance.",
    unsupported: "This product or combination does not have an executable V1 recipe yet.",
    evidence: "Evidence and provenance",
    claims: "What supports this result",
    nextMeasure: "What to measure next",
    sourceRecipe: "Official manufacturer recipe",
    sourceGarden: "Garden calculation",
    sourceUser: "User-defined target",
    sourceMeasurement: "Based on your measurements",
    product: "Product",
    stage: "Stage / feeding",
    podCount: "Pods",
    currentEc: "Current EC",
    currentVolume: "Current volume",
    waterAdded: "Water added",
    reservoir: "Reservoir capacity",
    selected: "Selected",
    noChange: "No change required",
    addNutrient: "Add nutrient",
    addWater: "Add water",
    partial: "Partial first dose",
    remeasure: "Measure again after mixing and stabilizing",
    saveLocal: "Saved only on this device",
    actualRequired: "Confirm actual doses before recording.",
    officialExpected: "Manufacturer expected EC",
    cropEvidence: "Applicable crop evidence",
    noRange: "No sufficient applicable range",
    approximation: "Approximation",
    modeRecipe: "RECIPE",
    modeTarget: "BY EC",
    modeCorrection: "CORRECT",
    modeTopup: "TOP UP",
  },
} as const;

type Copy = typeof COPY.es;
const MODE_LABEL_KEY: Record<CalculatorMode, keyof Copy> = {
  recipe: "modeRecipe",
  target: "modeTarget",
  correction: "modeCorrection",
  topup: "modeTopup",
};

const modeDescription = {
  es: {
    recipe: "Prepara agua nueva siguiendo la receta oficial del producto.",
    target: "Prepara agua nueva para alcanzar un EC objetivo.",
    correction: "Ajusta el EC de una solución que ya preparaste.",
    topup: "Repón agua en un tanque que ya está en uso.",
  },
  en: {
    recipe: "Prepare fresh water using the product's official recipe.",
    target: "Prepare fresh water toward a target EC.",
    correction: "Adjust the EC of a solution already prepared.",
    topup: "Replace water in a reservoir already in use.",
  },
} as const;

function initialMix(): MixState {
  return {
    name: "",
    crops: plants[0] ? { [plants[0].id]: 1 } : {},
    volumeL: 1,
    phase: "vegetative",
    product: "flora",
    feedingIndex: 2,
    podCount: 6,
  };
}

function parseNumber(value: string): number | undefined {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatNumber(value: number | undefined, digits = 2): string {
  return value === undefined ? "—" : value.toFixed(digits);
}

function productLabel(product: CalculatorProduct): string {
  return product === "flora"
    ? "FloraSeries"
    : product === "aerogarden"
      ? "AeroGarden"
      : "A+B exact product";
}

function localizeCode(code: string, language: Language, fallback: string): string {
  const es: Record<string, string> = {
    RECIPE_UNAVAILABLE: "No existe una receta oficial para esta formulación exacta.",
    UNSUPPORTED_POD_COUNT:
      "El fabricante no documenta este número de pods; Garden no lo interpola.",
    RECIPE_STAGE_REQUIRED: "Selecciona una sola etapa de alimentación del fabricante.",
    VOLUME_REQUIRED: "Esta receta requiere un volumen explícito.",
    INVALID_VOLUME: "El volumen debe ser positivo.",
    INSUFFICIENT_EC_EVIDENCE:
      "No hay evidencia comparable suficiente para establecer un objetivo automático.",
    USER_TARGET_OUTSIDE_EVIDENCE:
      "Tu objetivo está fuera del rango aplicable y se conserva sin reemplazarlo.",
    USER_TARGET_WITHOUT_COMMON_EVIDENCE:
      "Tu objetivo se conserva, pero no se pudo establecer un rango común aplicable.",
    CROP_COMPATIBILITY_UNCERTAIN:
      "La receta es ejecutable, pero la compatibilidad del cultivo no puede evaluarse con alta confianza.",
    CROP_COMPATIBILITY_CONFLICTING:
      "La receta es ejecutable, pero hay evidencia comparable en conflicto.",
    MANUFACTURER_CROP_EC_DISAGREEMENT:
      "El EC esperado por el fabricante y la evidencia del cultivo no se solapan.",
    CALIBRATION_REQUIRED:
      "Se necesita una calibración específica del producto para calcular la dosis.",
    CALIBRATION_EXTRAPOLATION: "La dosis queda fuera del rango validado de calibración.",
    CURRENT_VOLUME_REQUIRED:
      "El volumen actual del tanque es obligatorio; no se usa la capacidad nominal como sustituto.",
    RESERVOIR_CAPACITY_EXCEEDED: "El llenado superaría la capacidad conocida del tanque.",
    INCOMPATIBLE_MEASUREMENT_SCOPE:
      "La medición debe ser de la solución nutritiva; no se convierten otros ámbitos en silencio.",
    DOSE_BELOW_EQUIPMENT_RESOLUTION:
      "La dosis es positiva pero menor que la resolución del equipo.",
    PARTIAL_DOSE_POLICY:
      "La primera dosis parcial es una política experimental: mezcla, estabiliza y vuelve a medir.",
    PARTIAL_DOSE_BELOW_RESOLUTION:
      "La primera dosis parcial está por debajo de la resolución medible.",
    LINEAR_MIXING_APPROXIMATION:
      "El modelo lineal es una aproximación; restaurar EC no prueba restaurar el equilibrio de nutrientes.",
  };
  const en: Record<string, string> = {
    RECIPE_UNAVAILABLE: "No official recipe exists for this exact formulation.",
    UNSUPPORTED_POD_COUNT:
      "The manufacturer does not document this pod count; Garden will not interpolate it.",
    RECIPE_STAGE_REQUIRED: "Select one manufacturer feeding stage.",
    VOLUME_REQUIRED: "This recipe requires an explicit volume.",
    INVALID_VOLUME: "Volume must be positive.",
    INSUFFICIENT_EC_EVIDENCE: "There is not enough comparable evidence for an automatic target.",
    USER_TARGET_OUTSIDE_EVIDENCE:
      "Your target is outside applicable evidence and is preserved without replacement.",
    USER_TARGET_WITHOUT_COMMON_EVIDENCE:
      "Your target is preserved, but no common applicable range was established.",
    CROP_COMPATIBILITY_UNCERTAIN:
      "The recipe is executable, but crop compatibility cannot be evaluated with high confidence.",
    CROP_COMPATIBILITY_CONFLICTING: "The recipe is executable, but comparable evidence conflicts.",
    MANUFACTURER_CROP_EC_DISAGREEMENT: "Manufacturer expected EC and crop evidence do not overlap.",
    CALIBRATION_REQUIRED: "An exact-product calibration is required to calculate the dose.",
    CALIBRATION_EXTRAPOLATION: "The dose is outside the validated calibration range.",
    CURRENT_VOLUME_REQUIRED:
      "Current reservoir volume is required; nominal capacity is not used as a proxy.",
    RESERVOIR_CAPACITY_EXCEEDED: "The fill would exceed known reservoir capacity.",
    INCOMPATIBLE_MEASUREMENT_SCOPE:
      "The measurement must be from nutrient solution; other scopes are not silently converted.",
    DOSE_BELOW_EQUIPMENT_RESOLUTION: "The dose is positive but below equipment resolution.",
    PARTIAL_DOSE_POLICY:
      "The partial first dose is an experimental policy: mix, stabilize and measure again.",
    PARTIAL_DOSE_BELOW_RESOLUTION: "The partial first dose is below measurable resolution.",
    LINEAR_MIXING_APPROXIMATION:
      "The linear model is an approximation; restoring EC does not prove restored nutrient balance.",
  };
  return (language === "es" ? es : en)[code] ?? fallback;
}

function epLabel(epistemic: Claim["epistemic"], language: Language): string {
  const labels =
    language === "es"
      ? {
          SOURCE_BACKED_FACT: "Hecho respaldado por fuente",
          MANUFACTURER_INSTRUCTION: "Instrucción del fabricante",
          USER_CALIBRATION: "Calibración del usuario",
          DETERMINISTIC_CALCULATION: "Cálculo determinista de Garden",
          ENGINE_INFERENCE: "Inferencia acotada de Garden",
          UNVALIDATED_ASSUMPTION: "Supuesto no validado",
          USER_SELECTED: "Seleccionado por el usuario",
        }
      : {
          SOURCE_BACKED_FACT: "Source-backed fact",
          MANUFACTURER_INSTRUCTION: "Manufacturer instruction",
          USER_CALIBRATION: "User calibration",
          DETERMINISTIC_CALCULATION: "Deterministic Garden calculation",
          ENGINE_INFERENCE: "Bounded Garden inference",
          UNVALIDATED_ASSUMPTION: "Unvalidated assumption",
          USER_SELECTED: "User selected",
        };
  return labels[epistemic];
}

function NoticeList({
  warnings,
  errors,
  language,
}: {
  warnings: EngineWarning[];
  errors: EngineError[];
  language: Language;
}) {
  if (warnings.length === 0 && errors.length === 0) return null;
  return (
    <div className="space-y-2" aria-live="polite">
      {[
        ...errors.map((item) => ({ ...item, error: true })),
        ...warnings.map((item) => ({ ...item, error: false })),
      ].map((item, index) => (
        <div
          key={`${item.code}-${index}`}
          className={cn(
            "flex min-w-0 gap-2 rounded-xl border px-3 py-2 text-xs leading-5",
            item.error
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-amber-500/30 bg-amber-500/5 text-foreground",
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">
            {localizeCode(item.code, language, item.message)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ClaimsDisclosure({ claims, language }: { claims: Claim[]; language: Language }) {
  if (!claims.length) return null;
  return (
    <details className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium">{COPY[language].claims}</summary>
      <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
        {claims.slice(0, 8).map((claim) => (
          <li key={claim.id} className="flex min-w-0 flex-wrap gap-2">
            <span className="font-medium text-foreground">{claim.label}</span>
            <span className="rounded-full border border-border px-2 py-0.5">
              {epLabel(claim.epistemic, language)}
            </span>
            {claim.experimentalPolicy ? (
              <span className="rounded-full border border-amber-500/40 px-2 py-0.5">
                experimental policy
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "0.1",
  min = "0",
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
  min?: string;
  suffix?: string;
}) {
  return (
    <label className="block min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <Input
          inputMode="decimal"
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0"
        />
        {suffix ? <span className="shrink-0">{suffix}</span> : null}
      </span>
    </label>
  );
}

export function CalculatorPageV1({ language = "es" }: { language?: Language }) {
  const copy: Copy = COPY[language] as Copy;
  const [mode, setMode] = useState<CalculatorMode>("recipe");
  const [mix, setMix] = useState<MixState>(initialMix);
  const [savedSystems, setSavedSystems] = useState<SavedSystem[]>([]);
  const [activeSystemId, setActiveSystemId] = useState<string | null>(null);
  const [actualDoses, setActualDoses] = useState<Record<string, string>>({});
  const [baselineEc, setBaselineEc] = useState("");
  const [resultEc, setResultEc] = useState("");
  const [actualConfirmed, setActualConfirmed] = useState(false);
  const [calibrationObservations, setCalibrationObservations] = useState<CalibrationObservation[]>(
    [],
  );

  const plantsById = useMemo(() => new Map(plants.map((plant) => [plant.id, plant])), []);
  const contexts = useMemo(
    () => buildCropContexts(mix.crops, plantsById, mix.phase, mix.product),
    [mix.crops, mix.phase, mix.product, plantsById],
  );
  const selectedRecipe = useMemo(() => {
    const recipeId = recipeIdForProduct(mix.product);
    if (!recipeId) return null;
    const input = {
      recipeId,
      feedingIndex: mix.feedingIndex,
      contexts,
      dosingEquipmentResolutionMl: 0.5,
    } as Parameters<typeof executeFreshRecipe>[0];
    if (mix.product === "flora") input.volumeL = mix.volumeL;
    if (mix.product === "aerogarden") input.podCount = mix.podCount;
    return executeFreshRecipe(input);
  }, [contexts, mix.feedingIndex, mix.podCount, mix.product, mix.volumeL]);
  const targetPreview = useMemo(
    () => calculateFreshTargetEc({ contexts, meterResolution: 0.1 }),
    [contexts],
  );
  const targetResult = useMemo(() => {
    if (mode !== "target") return null;
    const input = { contexts, meterResolution: 0.1 } as Parameters<
      typeof calculateFreshTargetEc
    >[0];
    if (mix.targetEc !== undefined) input.userSelectedTarget = mix.targetEc;
    return calculateFreshTargetEc(input);
  }, [contexts, mix.targetEc, mode]);
  const productRecipe = useMemo(
    () => MANUFACTURER_RECIPES.find((recipe) => recipe.id === recipeIdForProduct(mix.product)),
    [mix.product],
  );
  const recipeStepSignature = useMemo(() => {
    const step = productRecipe?.steps.find(
      (item) =>
        item.feedingIndex === mix.feedingIndex &&
        (mix.product !== "aerogarden" ||
          item.stage === `POD_GROUP_${mix.podCount === 6 || mix.podCount === 7 ? "6_7" : "9"}`),
    );
    return step ? recipeSignature(step.doses) : undefined;
  }, [mix.feedingIndex, mix.podCount, mix.product, productRecipe]);
  const calibrationModel = useMemo<EngineResult<CalibrationModel> | null>(() => {
    if (!productRecipe || !recipeStepSignature || !calibrationObservations.length) return null;
    const input = {
      productIdentity: productRecipe.product,
      recipeSignature: recipeStepSignature,
      observations: calibrationObservations,
    } as Parameters<typeof buildCalibrationModel>[0];
    if (productRecipe.product.formulationVersion)
      input.formulationVersion = productRecipe.product.formulationVersion;
    return buildCalibrationModel(input);
  }, [calibrationObservations, productRecipe, recipeStepSignature]);
  const correctionResult = useMemo(() => {
    if (
      mode !== "correction" ||
      mix.currentEc === undefined ||
      !calibrationModel?.value ||
      mix.currentVolumeL === undefined
    )
      return null;
    return calculateEcCorrection({
      currentEc: {
        value: mix.currentEc,
        unit: "mS/cm",
        context: { scope: "NUTRIENT_SOLUTION", scopeBasis: "STATED" },
      },
      targetEc: mix.targetEc ?? targetPreview.value?.suggestedStartingPoint ?? 0,
      reservoirVolumeL: mix.currentVolumeL,
      calibration: calibrationModel.value,
      policy: { firstStepFraction: 0.5, dosingEquipmentResolutionMl: 0.5 },
    });
  }, [
    calibrationModel,
    mix.currentEc,
    mix.currentVolumeL,
    mix.targetEc,
    mode,
    targetPreview.value?.suggestedStartingPoint,
  ]);
  const topupResult = useMemo(() => {
    if (
      mode !== "topup" ||
      mix.currentEc === undefined ||
      mix.currentVolumeL === undefined ||
      mix.replacementWaterL === undefined ||
      mix.nominalVolumeL === undefined
    )
      return null;
    const input = {
      currentVolumeL: mix.currentVolumeL,
      nominalVolumeL: mix.nominalVolumeL,
      replacementWaterL: mix.replacementWaterL,
      currentEc: {
        value: mix.currentEc,
        unit: "mS/cm" as const,
        context: { scope: "NUTRIENT_SOLUTION" as const, scopeBasis: "STATED" as const },
      },
      targetEc: mix.targetEc ?? targetPreview.value?.suggestedStartingPoint ?? 0,
      policy: { enableCumulativeTopUpHeuristic: false, dosingEquipmentResolutionMl: 0.5 },
    } as Parameters<typeof calculateTopUpMaintenance>[0];
    if (calibrationModel?.value) input.calibration = calibrationModel.value;
    return calculateTopUpMaintenance(input);
  }, [
    calibrationModel,
    mix.currentEc,
    mix.currentVolumeL,
    mix.nominalVolumeL,
    mix.replacementWaterL,
    mix.targetEc,
    mode,
    targetPreview.value?.suggestedStartingPoint,
  ]);

  const updateMix = <K extends keyof MixState>(key: K, value: MixState[K]) =>
    setMix((current) => ({ ...current, [key]: value }));
  const updateNumber = (key: keyof MixState, value: string) => {
    const parsed = parseNumber(value);
    setMix((current) => {
      const next = { ...current };
      if (parsed === undefined) delete next[key];
      else (next as Record<string, unknown>)[key] = parsed;
      return next;
    });
  };
  const selectedPlantIds = Object.keys(mix.crops);
  const addPlant = (id: string) => {
    if (!id) return;
    updateMix("crops", { ...mix.crops, [id]: 1 });
  };
  const removePlant = (id: string) => {
    const next = { ...mix.crops };
    delete next[id];
    updateMix("crops", next);
  };
  const saveSystem = () => {
    const id = `local-${Date.now()}`;
    setSavedSystems((systems) => [
      ...systems,
      { ...mix, id, name: mix.name.trim() || `${productLabel(mix.product)} ${systems.length + 1}` },
    ]);
    setActiveSystemId(id);
  };
  const recordCalibration = () => {
    if (
      !selectedRecipe?.value ||
      !productRecipe ||
      !recipeStepSignature ||
      !baselineEc ||
      !resultEc ||
      !actualConfirmed
    )
      return;
    const doses = Object.fromEntries(
      selectedRecipe.value.parts.map((part) => [
        part.componentId,
        parseNumber(actualDoses[part.componentId] ?? String(part.ml)) ?? 0,
      ]),
    );
    if (Object.values(doses).some((dose) => dose <= 0)) return;
    const input = {
      productIdentity: productRecipe.product,
      recipeSignature: recipeStepSignature,
      baselineEc: parseNumber(baselineEc) ?? 0,
      resultingEc: parseNumber(resultEc) ?? 0,
      doseAppliedMl: sumComponentDoses(doses),
      reservoirVolumeL: mix.volumeL,
      timestamp: new Date().toISOString(),
    } as Parameters<typeof learnFromObservation>[0];
    if (productRecipe.product.formulationVersion)
      input.formulationVersion = productRecipe.product.formulationVersion;
    const observation = learnFromObservation(input);
    if (observation.value) setCalibrationObservations((items) => [...items, observation.value!]);
    setActualConfirmed(false);
  };
  const selectedEc =
    mix.targetEc ?? targetPreview.value?.suggestedStartingPoint ?? targetPreview.value?.target.min;
  const displayResult =
    mode === "recipe"
      ? selectedRecipe
      : mode === "target"
        ? targetResult
        : mode === "correction"
          ? correctionResult
          : topupResult;
  const displayValue = displayResult?.value;
  const displayWarnings = displayResult?.warnings ?? [];
  const displayErrors = displayResult?.errors ?? [];
  const displayClaims =
    displayResult?.claims ?? (displayValue && "claims" in displayValue ? displayValue.claims : []);
  const cropRanges = contexts.map((context) => selectCropRange(context).ec);

  return (
    <main className="mx-auto w-full max-w-6xl min-w-0 px-4 pb-16 pt-4 sm:px-6 lg:px-8">
      <div className="mb-5 flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Gardenpedia
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Gauge className="h-6 w-6 shrink-0 text-primary" />
            {copy.calculator}
          </h1>
        </div>
        <div className="hidden rounded-full border border-border px-3 py-1 text-xs text-muted-foreground sm:block">
          {MODE_TO_ENGINE[mode]}
        </div>
      </div>
      <section className="mb-6 min-w-0 rounded-3xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{copy.saved}</p>
            <p className="text-xs text-muted-foreground">{copy.saveLocal}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent"
            onClick={saveSystem}
          >
            <Save className="mr-2 h-4 w-4" />
            {copy.saveAs}
          </button>
        </div>
        <div
          className="flex min-w-0 gap-3 overflow-x-auto px-1 py-2 [scroll-padding-inline:0.5rem]"
          aria-label={copy.saved}
        >
          {savedSystems.length === 0 ? (
            <div className="shrink-0 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              {copy.noSaved}
            </div>
          ) : (
            savedSystems.map((system) => (
              <button
                type="button"
                key={system.id}
                onClick={() => {
                  setMix(system);
                  setActiveSystemId(system.id);
                }}
                className={cn(
                  "shrink-0 rounded-2xl border bg-background px-4 py-3 text-left text-sm transition hover:border-primary",
                  activeSystemId === system.id ? "ring-2 ring-inset ring-primary" : "border-border",
                )}
              >
                <span className="block font-semibold">{system.name}</span>
                <span className="text-xs text-muted-foreground">
                  {productLabel(system.product)} · {system.volumeL} L
                </span>
              </button>
            ))
          )}
          <span aria-hidden="true" className="block w-2 shrink-0" />
        </div>
      </section>
      <div className="mb-6 grid min-w-0 grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-muted/30 p-2 md:grid-cols-4">
        {MODE_ORDER.map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => setMode(item)}
            aria-pressed={mode === item}
            className={cn(
              "min-w-0 rounded-xl px-2 py-3 text-center text-xs font-semibold transition sm:text-sm",
              mode === item
                ? "border border-primary bg-primary/10 text-primary shadow-sm"
                : "border border-transparent text-muted-foreground hover:bg-background",
            )}
          >
            <span className="block">{copy[MODE_LABEL_KEY[item]]}</span>
            <span className="mt-1 block text-[11px] font-normal leading-4">
              {modeDescription[language][item]}
            </span>
          </button>
        ))}
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="min-w-0 space-y-5 rounded-3xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {copy.quickMix}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{copy.formulaStage}</h2>
            </div>
            <Sliders className="h-5 w-5 text-primary" />
          </div>
          <Input
            value={mix.name}
            onChange={(event) => updateMix("name", event.target.value)}
            placeholder={copy.newSystem}
            aria-label={copy.newSystem}
          />
          <div className="space-y-2">
            <p className="text-sm font-medium">{copy.product}</p>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
              {PRODUCT_ORDER.map((product) => (
                <button
                  type="button"
                  key={product}
                  onClick={() => updateMix("product", product)}
                  aria-pressed={mix.product === product}
                  className={cn(
                    "min-w-0 rounded-xl border px-3 py-2 text-left text-sm",
                    mix.product === product
                      ? "border-primary bg-primary/10 font-semibold"
                      : "border-border",
                  )}
                >
                  {productLabel(product)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{copy.plantsShare}</p>
            <div className="flex flex-wrap gap-2">
              {selectedPlantIds.map((id) => {
                const plant = plantsById.get(id);
                return (
                  <span
                    key={id}
                    className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-border px-3 py-1 text-xs"
                  >
                    <Leaf className="h-3 w-3 shrink-0 text-primary" />
                    <span className="truncate">{plant?.name ?? id}</span>
                    <button
                      type="button"
                      onClick={() => removePlant(id)}
                      aria-label={`${copy.remove} ${plant?.name ?? id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
            <select
              className="h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm"
              aria-label={copy.choosePlant}
              defaultValue=""
              onChange={(event) => addPlant(event.target.value)}
            >
              <option value="">{copy.choosePlant}</option>
              {plants
                .filter((plant) => !mix.crops[plant.id])
                .slice(0, 80)
                .map((plant) => (
                  <option key={plant.id} value={plant.id}>
                    {plant.name} · {plant.scientificName}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{copy.stage}</p>
            <div className="grid grid-cols-3 gap-2">
              {PHASES.map((phase) => (
                <button
                  type="button"
                  key={phase}
                  onClick={() => updateMix("phase", phase)}
                  aria-pressed={mix.phase === phase}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-xs",
                    mix.phase === phase
                      ? "border-primary bg-primary/10 font-semibold"
                      : "border-border",
                  )}
                >
                  {phase === "seedling"
                    ? language === "es"
                      ? "Plántula"
                      : "Seedling"
                    : phase === "vegetative"
                      ? language === "es"
                        ? "Vegetativa"
                        : "Vegetative"
                      : language === "es"
                        ? "Floración"
                        : "Flowering"}
                </button>
              ))}
            </div>
          </div>
          {mode !== "target" || mix.product === "flora" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{copy.waterLiters}</p>
              <div className="flex flex-wrap gap-2">
                {LITER_CHIPS.map((liters) => (
                  <button
                    type="button"
                    key={liters}
                    onClick={() => updateMix("volumeL", liters)}
                    aria-pressed={mix.volumeL === liters}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs",
                      mix.volumeL === liters
                        ? "border-primary bg-primary/10 font-semibold"
                        : "border-border",
                    )}
                  >
                    {liters} L
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {mix.product === "aerogarden" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                <span>{copy.podCount}</span>
                <select
                  value={mix.podCount}
                  onChange={(event) => updateMix("podCount", Number(event.target.value))}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3"
                >
                  <option value={6}>6</option>
                  <option value={7}>7</option>
                  <option value={9}>9</option>
                  <option value={12}>12</option>
                </select>
              </label>
              <NumberField
                label={copy.stage}
                value={String(mix.feedingIndex)}
                onChange={(value) => updateMix("feedingIndex", parseNumber(value) ?? 1)}
                step="1"
                min="1"
              />
            </div>
          ) : (
            <NumberField
              label={copy.stage}
              value={String(mix.feedingIndex)}
              onChange={(value) => updateMix("feedingIndex", parseNumber(value) ?? 1)}
              step="1"
              min="1"
            />
          )}
          {mode === "target" ? (
            <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{copy.targetEc}</p>
                  <p className="text-xs text-muted-foreground">{copy.targetHint}</p>
                </div>
                <Gauge className="h-5 w-5 shrink-0 text-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">{copy.reportedRange}</span>
                  <strong className="mt-1 block">
                    {targetPreview.value
                      ? `${formatNumber(targetPreview.value.target.min)}–${formatNumber(targetPreview.value.target.max)} mS/cm`
                      : copy.noRange}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">{copy.suggested}</span>
                  <strong className="mt-1 block">
                    {formatNumber(targetPreview.value?.suggestedStartingPoint)} mS/cm
                  </strong>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background shadow-sm"
                  onClick={() => updateMix("targetEc", Math.max(0, (selectedEc ?? 0) - 0.1))}
                  aria-label="Decrease EC"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <Input
                  className="min-w-0 text-center"
                  inputMode="decimal"
                  type="number"
                  step="0.1"
                  value={mix.targetEc ?? formatNumber(selectedEc)}
                  onChange={(event) => updateNumber("targetEc", event.target.value)}
                  aria-label={copy.targetEc}
                />
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background shadow-sm"
                  onClick={() => updateMix("targetEc", (selectedEc ?? 0) + 0.1)}
                  aria-label="Increase EC"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <span className="shrink-0 text-xs text-muted-foreground">mS/cm</span>
              </div>
            </div>
          ) : null}
          {mode === "correction" || mode === "topup" ? (
            <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
              <p className="text-sm font-semibold">
                {language === "es" ? "Medición del tanque" : "Reservoir measurement"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  label={copy.currentEc}
                  value={mix.currentEc === undefined ? "" : String(mix.currentEc)}
                  onChange={(value) => updateNumber("currentEc", value)}
                  suffix="mS/cm"
                />
                <NumberField
                  label={copy.targetEc}
                  value={
                    mix.targetEc === undefined ? formatNumber(selectedEc) : String(mix.targetEc)
                  }
                  onChange={(value) => updateNumber("targetEc", value)}
                  suffix="mS/cm"
                />
                <NumberField
                  label={copy.currentVolume}
                  value={mix.currentVolumeL === undefined ? "" : String(mix.currentVolumeL)}
                  onChange={(value) => updateNumber("currentVolumeL", value)}
                  suffix="L"
                />
                {mode === "topup" ? (
                  <>
                    <NumberField
                      label={copy.waterAdded}
                      value={
                        mix.replacementWaterL === undefined ? "" : String(mix.replacementWaterL)
                      }
                      onChange={(value) => updateNumber("replacementWaterL", value)}
                      suffix="L"
                    />
                    <NumberField
                      label={copy.reservoir}
                      value={mix.nominalVolumeL === undefined ? "" : String(mix.nominalVolumeL)}
                      onChange={(value) => updateNumber("nominalVolumeL", value)}
                      suffix="L"
                    />
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
          {mode === "recipe" || mode === "correction" || mode === "topup" ? (
            <CalibrationCapture
              language={language}
              copy={copy}
              result={selectedRecipe}
              actualDoses={actualDoses}
              setActualDoses={setActualDoses}
              baselineEc={baselineEc}
              setBaselineEc={setBaselineEc}
              resultEc={resultEc}
              setResultEc={setResultEc}
              actualConfirmed={actualConfirmed}
              setActualConfirmed={setActualConfirmed}
              recordCalibration={recordCalibration}
            />
          ) : null}
          {mode === "correction" && !calibrationModel?.value ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
              {copy.noCalibration}
            </p>
          ) : null}
          <button
            type="button"
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
            onClick={saveSystem}
          >
            <Save className="mr-2 h-4 w-4" />
            {mix.name ? copy.saveChanges : copy.saveAs}
          </button>
        </section>
        <section className="min-w-0 space-y-5 rounded-3xl border border-border/70 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sprout className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {copy.calculator}
              </p>
              <h2 className="truncate text-xl font-semibold">
                {mode === "recipe"
                  ? copy.modeRecipe
                  : mode === "target"
                    ? copy.modeTarget
                    : mode === "correction"
                      ? copy.modeCorrection
                      : copy.modeTopup}
              </h2>
            </div>
          </div>
          {selectedPlantIds.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              {copy.addPlantFirst}
            </p>
          ) : (
            <>
              <NoticeList warnings={displayWarnings} errors={displayErrors} language={language} />
              {mode === "recipe" && selectedRecipe?.value ? (
                <RecipeResultCard
                  language={language}
                  copy={copy}
                  result={selectedRecipe.value}
                  cropRanges={cropRanges}
                />
              ) : null}
              {mode === "target" && targetResult?.value ? (
                <TargetResultCard language={language} copy={copy} result={targetResult.value} />
              ) : null}
              {mode === "correction" && correctionResult?.value ? (
                <CorrectionResultCard
                  language={language}
                  copy={copy}
                  result={correctionResult.value}
                />
              ) : null}
              {mode === "topup" && topupResult?.value ? (
                <TopupResultCard language={language} copy={copy} result={topupResult.value} />
              ) : null}
              {mode === "target" && !targetResult?.value && targetResult ? (
                <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  {copy.noRange}
                </p>
              ) : null}
              <ClaimsDisclosure claims={displayClaims} language={language} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function CalibrationCapture({
  copy,
  result,
  actualDoses,
  setActualDoses,
  baselineEc,
  setBaselineEc,
  resultEc,
  setResultEc,
  actualConfirmed,
  setActualConfirmed,
  recordCalibration,
}: {
  language: Language;
  copy: Copy;
  result: EngineResult<RecipeResult> | null;
  actualDoses: Record<string, string>;
  setActualDoses: (value: Record<string, string>) => void;
  baselineEc: string;
  setBaselineEc: (value: string) => void;
  resultEc: string;
  setResultEc: (value: string) => void;
  actualConfirmed: boolean;
  setActualConfirmed: (value: boolean) => void;
  recordCalibration: () => void;
}) {
  if (!result?.value)
    return (
      <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm">
        {copy.unsupported}
      </div>
    );
  return (
    <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div>
        <p className="text-sm font-semibold">{copy.measured}</p>
        <p className="text-xs text-muted-foreground">{copy.actualDose}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {result.value.parts.map((part) => (
          <NumberField
            key={part.componentId}
            label={part.label}
            value={actualDoses[part.componentId] ?? part.ml.toFixed(2)}
            onChange={(value) => setActualDoses({ ...actualDoses, [part.componentId]: value })}
            suffix="mL"
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label={copy.baselineEc}
          value={baselineEc}
          onChange={setBaselineEc}
          suffix="mS/cm"
        />
        <NumberField label={copy.resultEc} value={resultEc} onChange={setResultEc} suffix="mS/cm" />
      </div>
      <label className="flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={actualConfirmed}
          onChange={(event) => setActualConfirmed(event.target.checked)}
          className="mt-0.5"
        />{" "}
        <span className="min-w-0 break-words">{copy.confirmActual}</span>
      </label>
      <button
        type="button"
        className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium shadow-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
        onClick={recordCalibration}
        disabled={!actualConfirmed || !baselineEc || !resultEc}
      >
        <Check className="mr-2 h-4 w-4" />
        {copy.record}
      </button>
    </div>
  );
}

function RecipeResultCard({
  language,
  copy,
  result,
  cropRanges,
}: {
  language: Language;
  copy: Copy;
  result: RecipeResult;
  cropRanges: ReturnType<typeof selectCropRange>["ec"][];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {copy.sourceRecipe}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {result.parts.map((part) => (
            <div
              key={part.componentId}
              className="flex min-w-0 items-center justify-between gap-3 border-b border-border/60 pb-2 text-sm"
            >
              <span className="min-w-0 truncate">{part.label}</span>
              <strong className="shrink-0">{part.ml.toFixed(2)} mL</strong>
            </div>
          ))}
        </div>
        {result.manufacturerRecipeExpectation ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {copy.officialExpected}: {result.manufacturerRecipeExpectation.min.toFixed(2)}–
            {result.manufacturerRecipeExpectation.max.toFixed(2)} mS/cm
          </p>
        ) : null}
      </div>
      <div className="rounded-2xl border border-border p-4">
        <p className="text-sm font-semibold">{copy.mixOrder}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {result.recipe.mixingOrder
            .map((id) => result.recipe.components.find((part) => part.id === id)?.label ?? id)
            .join(" → ")}
        </p>
      </div>
      <EvidenceBlock language={language} copy={copy} ranges={cropRanges} />
    </div>
  );
}

function TargetResultCard({
  language,
  copy,
  result,
}: {
  language: Language;
  copy: Copy;
  result: NonNullable<
    EngineResult<
      ReturnType<typeof calculateFreshTargetEc> extends EngineResult<infer T> ? T : never
    >["value"]
  >;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {copy.sourceGarden}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <span className="text-xs text-muted-foreground">{copy.targetEc}</span>
            <strong className="mt-1 block text-2xl">
              {result.target.min.toFixed(2)}
              {result.target.max !== result.target.min
                ? `–${result.target.max.toFixed(2)}`
                : ""}{" "}
              <span className="text-sm font-normal">mS/cm</span>
            </strong>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">{copy.suggested}</span>
            <strong className="mt-1 block text-2xl">
              {formatNumber(result.suggestedStartingPoint)}{" "}
              <span className="text-sm font-normal">mS/cm</span>
            </strong>
          </div>
        </div>
      </div>
      <p className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        {copy.targetHint}
      </p>
    </div>
  );
}

function CorrectionResultCard({
  language,
  copy,
  result,
}: {
  language: Language;
  copy: Copy;
  result: NonNullable<
    EngineResult<
      ReturnType<typeof calculateEcCorrection> extends EngineResult<infer T> ? T : never
    >["value"]
  >;
}) {
  const action =
    result.direction === "NO_CHANGE"
      ? copy.noChange
      : result.direction === "ADD_WATER"
        ? copy.addWater
        : copy.addNutrient;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {copy.sourceMeasurement}
        </p>
        <h3 className="mt-2 text-2xl font-semibold">{action}</h3>
        <p className="mt-2 text-lg">
          {result.doseMl !== undefined
            ? `${result.doseMl.toFixed(2)} mL`
            : result.waterMl !== undefined
              ? `${result.waterMl.toFixed(0)} mL`
              : copy.noChange}
        </p>
        {result.firstStepDoseMl !== undefined ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {copy.partial}: {result.firstStepDoseMl.toFixed(2)} mL
          </p>
        ) : null}
      </div>
      <p className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        {copy.correctionHint}
      </p>
      <p className="text-sm font-medium">
        {copy.nextMeasure}: {copy.remeasure}
      </p>
    </div>
  );
}

function TopupResultCard({
  copy,
  result,
}: {
  language: Language;
  copy: Copy;
  result: NonNullable<
    EngineResult<
      ReturnType<typeof calculateTopUpMaintenance> extends EngineResult<infer T> ? T : never
    >["value"]
  >;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {copy.sourceMeasurement}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <span className="text-xs text-muted-foreground">{copy.waterAdded}</span>
            <strong className="mt-1 block text-2xl">
              {result.replacementWaterMl.toFixed(0)} mL
            </strong>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">{copy.resultEc}</span>
            <strong className="mt-1 block text-2xl">
              {result.nutrientDoseMl === undefined
                ? copy.noChange
                : `${result.nutrientDoseMl.toFixed(2)} mL`}
            </strong>
          </div>
        </div>
      </div>
      <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
        {copy.topupHint}
      </p>
    </div>
  );
}

function EvidenceBlock({
  language,
  copy,
  ranges,
}: {
  language: Language;
  copy: Copy;
  ranges: ReturnType<typeof selectCropRange>["ec"][];
}) {
  const values = ranges.filter((range) => range.ec);
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="text-sm font-semibold">{copy.evidence}</p>
      {values.length ? (
        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
          {values.map((range) => (
            <li
              key={range.cropIdentity}
              className="flex min-w-0 flex-wrap items-center justify-between gap-2"
            >
              <span className="font-medium text-foreground">{range.cropIdentity}</span>
              <span>
                {range.ec!.min.toFixed(2)}–{range.ec!.max.toFixed(2)} mS/cm · {range.evidenceState}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{copy.noRange}</p>
      )}
    </div>
  );
}
