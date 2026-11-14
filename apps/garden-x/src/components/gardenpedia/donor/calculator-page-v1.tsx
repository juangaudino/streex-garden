import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Droplets,
  FlaskConical,
  Gauge,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Waves,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gardenSeedAgeReferences } from "@/generated/garden-seed-profile-index";
import type { HydroponicSystem } from "@/lib/garden-nutrient-engine-v1/types";
import { CROP_STAGE_REFERENCES, CROP_STUDY_REFERENCES } from "@/lib/garden-nutrient-engine-v1/data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CALCULATOR_PLANTS,
  CALCULATOR_EXCLUDED_CARNIVOROUS_IDS,
  CALCULATOR_PRODUCTS,
  calculateGardenResult,
  calibrationUsage,
  calculatorSourceUrl,
  generalCropReferenceForStage,
  loadSavedSystems,
  manufacturerDoseDefaults,
  planTopUpToCapacity,
  persistSavedSystems,
  recipeStageLabel,
  recordActualDoses,
  resolveNutrientCropIdentity,
  type CalcResult,
  type CalculatorAdditionalStage,
  type CalculatorCropStage,
  type EcUnit,
  type Evidence,
  type Lang,
  type Mode,
  type Provenance,
  type SavedSystem,
} from "./calculator-lovable-adapter";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- copy */

const T = {
  es: {
    systems: "Tus sistemas",
    quick: "Mezcla rápida",
    quickHint: "Sin guardar",
    modes: { recipe: "Receta", target: "Por EC", adjust: "Corregir", topup: "Rellenar" },
    modeHint: {
      recipe: "Prepara agua nueva siguiendo la receta oficial del producto.",
      target: "Prepara agua nueva para alcanzar un EC objetivo.",
      adjust: "Ajusta el EC de una solución que ya preparaste.",
      topup: "Repón agua en un tanque que ya está en uso.",
    },
    plants: "Plantas en el tanque",
    addPlant: "Añadir planta",
    volume: "Volumen del tanque",
    capacity: "Capacidad del tanque",
    pods: "Capacidad del modelo (pods)",
    podGroupsHint: "Grupos verificados: 6, 7 y 9 pods",
    product: "Nutriente",
    customAbManufacturer: "Fabricante del producto A+B",
    customAbName: "Nombre exacto del producto A+B",
    customAbVersion: "Formulación o versión exacta",
    customAbNote:
      "Identificado por ti. No hay receta oficial cargada: mide las dosis reales de A y B para calibrar y sigue las instrucciones del fabricante para mezclarlos.",
    stage: "Etapa de la receta",
    feedingEvent: "Evento de alimentación",
    currentEc: "EC que mediste",
    currentLiters: "Litros que quedan",
    currentLitersBeforeTopup: "Litros antes de rellenar",
    currentEcBeforeTopup: "EC antes de rellenar",
    waterAdded: "Agua que vas a añadir",
    fillToCapacity: "Calcular agua hasta la capacidad",
    correctionStep: "Primera dosis de corrección",
    correctionStepNote:
      "Estrategia ajustable, no una regla científica. Mezcla y vuelve a medir antes de continuar.",
    more: "Más ajustes",
    unit: "Unidad EC",
    sourceEc: "EC del agua de origen",
    targetEc: "EC objetivo",
    targetManualHint:
      "Escribe el EC que quieres usar. Sin una referencia aplicable, Garden no puede sugerirlo por ti.",
    meter: "Medidor",
    dosing: "Dosificación",
    syringe: "Jeringa 1 mL",
    cup: "Vaso medidor",
    now: "Qué hacer ahora",
    order: "En este orden",
    next: "Qué medir después",
    actAdd: "Añade al tanque",
    actDilute: "Diluye con agua",
    actHold: "Estás en el objetivo",
    holdBody: "No añadas nada. Vuelve a medir en tu próximo control.",
    stepMix: "Mezcla o circula el agua",
    stepWait: "Deja que se estabilice",
    stepMeasure: "Mide EC y pH",
    waitNote: "Espera una lectura estable. No hay un tiempo universal de estabilización.",
    expect: "Deberías ver cerca de",
    manufacturerExpected: "EC esperado por el fabricante",
    why: "Por qué y de dónde sale",
    range: "Rango de EC reportado",
    start: "Punto de partida sugerido",
    common: "Rango común",
    noCommon: "Sin rango de EC común",
    noCommonBody: (p: string) =>
      `${p} tiene el rango de EC reportado más bajo, así que Garden propone un compromiso operativo cerca de ese rango. No significa que las plantas sean incompatibles.`,
    yourTarget: "Tu objetivo",
    useSuggested: "Usar sugerido",
    outside:
      "Este objetivo está fuera del rango con evidencia disponible. Lo respetamos; vigila la respuesta de tus plantas.",
    evidence: "Evidencia",
    sources: "Fuentes",
    ev: {
      high: "Alta",
      moderate: "Moderada",
      low: "Baja",
      conflicting: "Contradictoria",
      insufficient: "Insuficiente",
    },
    prov: {
      official: "Receta oficial del fabricante",
      garden: "Cálculo de Garden",
      measured: "Basado en tus mediciones",
      user: "Objetivo elegido por ti",
    },
    needs: "Para calcular necesito",
    needLabels: {
      currentEc: "el EC que mediste",
      currentLiters: "cuántos litros quedan",
      waterAdded: "cuánta agua vas a añadir",
    },
    learnTitle: "¿Qué obtuviste?",
    learnBody:
      "Cuéntale a Garden lo que mediste y lo que añadiste de verdad. Así afina este sistema.",
    gotEc: "EC medido",
    gotMl: "mL que añadiste",
    learn: "Guardar lectura",
    actualDose: "Lo que añadiste realmente",
    calibrate: "Calibrar este producto",
    calibrationTitle: "Una medición real para calibrar",
    calibrationInstructions:
      "Prepara esta mezcla, mide el EC antes y después, y registra las cantidades que añadiste realmente.",
    calibrationStage: "Receta usada",
    calibrationBaseline: "EC antes de añadir",
    calibrationAfter: "EC después de mezclar",
    calibrationSave: "Guardar calibración",
    calibrationInvalid: "Revisa las mediciones y las dosis reales antes de guardar.",
    calibrationStorageError: "No se pudo guardar la calibración en este dispositivo.",
    calibrationTemporary:
      "Esta calibración solo está en memoria. Se perderá si recargas o cambias de sistema.",
    learned: (n: number) => `${n} lecturas aplicables a esta mezcla`,
    learnedNew:
      "Medición guardada. Garden usará la respuesta de esta mezcla; vuelve a medir después de dosificar.",
    round: "Ronda",
    again: "Medir otra vez",
    closeEnough: "Finalizar esta iteración",
    calib: (p: number) => `Calibración personal ${p > 0 ? "+" : ""}${p}%`,
    demo: "",
    save: "Guardar como sistema",
    saveTitle: "Guardar sistema",
    saveDescription: "Guarda esta configuración solo en este dispositivo.",
    systemName: "Nombre del sistema",
    saveConfirm: "Guardar",
    cancel: "Cancelar",
    deleteSystem: "Eliminar sistema",
    searchPlant: "Buscar planta…",
    noPlants: "No encontramos identidades con esa búsqueda.",
    unsupportedProduct:
      "Producto no disponible: falta una formulación exacta y calibración verificable.",
  },
  en: {
    systems: "Your systems",
    quick: "Quick mix",
    quickHint: "Unsaved",
    modes: { recipe: "Recipe", target: "By EC", adjust: "Correct", topup: "Top up" },
    modeHint: {
      recipe: "Prepare fresh water using the product's official recipe.",
      target: "Prepare fresh water toward a target EC.",
      adjust: "Adjust the EC of a solution already prepared.",
      topup: "Replace water in a reservoir already in use.",
    },
    plants: "Plants in the reservoir",
    addPlant: "Add plant",
    volume: "Reservoir volume",
    capacity: "Reservoir capacity",
    pods: "Model capacity (pods)",
    podGroupsHint: "Verified groups: 6, 7, and 9 pods",
    product: "Nutrient",
    customAbManufacturer: "A+B manufacturer",
    customAbName: "Exact A+B product name",
    customAbVersion: "Exact formulation or version",
    customAbNote:
      "Identified by you. No official recipe is loaded: measure the actual A and B doses to calibrate and follow the manufacturer's mixing instructions.",
    stage: "Recipe stage",
    feedingEvent: "Feeding event",
    currentEc: "EC you measured",
    currentLiters: "Liters remaining",
    currentLitersBeforeTopup: "Liters before top-up",
    currentEcBeforeTopup: "EC before top-up",
    waterAdded: "Water to add",
    fillToCapacity: "Calculate water to capacity",
    correctionStep: "First correction dose",
    correctionStepNote:
      "Adjustable strategy, not a scientific rule. Mix and measure again before continuing.",
    more: "More settings",
    unit: "EC unit",
    sourceEc: "Source-water EC",
    targetEc: "Target EC",
    targetManualHint:
      "Enter the EC you want to use. Without an applicable reference, Garden cannot suggest one for you.",
    meter: "Meter",
    dosing: "Dosing",
    syringe: "1 mL syringe",
    cup: "Measuring cup",
    now: "What to do now",
    order: "In this order",
    next: "What to measure next",
    actAdd: "Add to the reservoir",
    actDilute: "Dilute with water",
    actHold: "You're on target",
    holdBody: "Add nothing. Measure again at your next check.",
    stepMix: "Mix or circulate",
    stepWait: "Let it stabilize",
    stepMeasure: "Measure EC and pH",
    waitNote: "Wait for a stable reading. There is no universal stabilization time.",
    expect: "You should see about",
    manufacturerExpected: "Manufacturer expected EC",
    why: "Why, and where it comes from",
    range: "Reported EC range",
    start: "Suggested starting point",
    common: "Common range",
    noCommon: "No common EC range",
    noCommonBody: (p: string) =>
      `${p} has the lower reported EC range, so Garden offers an operational compromise near it. This does not mean the plants are incompatible.`,
    yourTarget: "Your target",
    useSuggested: "Use suggested",
    outside:
      "This target is outside the available evidence. We'll keep it; watch how your plants respond.",
    evidence: "Evidence",
    sources: "Sources",
    ev: {
      high: "High",
      moderate: "Moderate",
      low: "Low",
      conflicting: "Conflicting",
      insufficient: "Insufficient",
    },
    prov: {
      official: "Official manufacturer recipe",
      garden: "Garden calculation",
      measured: "Based on your measurements",
      user: "Your selected target",
    },
    needs: "To calculate I need",
    needLabels: {
      currentEc: "the EC you measured",
      currentLiters: "how many liters remain",
      waterAdded: "how much water you plan to add",
    },
    learnTitle: "What did you get?",
    learnBody: "Tell Garden what you measured and actually added. It tunes this system.",
    gotEc: "Measured EC",
    gotMl: "mL you added",
    learn: "Save reading",
    actualDose: "What you actually added",
    calibrate: "Calibrate this product",
    calibrationTitle: "A real measurement to calibrate",
    calibrationInstructions:
      "Prepare this mix, measure EC before and after, and record the amounts you actually added.",
    calibrationStage: "Recipe used",
    calibrationBaseline: "EC before adding nutrients",
    calibrationAfter: "EC after mixing",
    calibrationSave: "Save calibration",
    calibrationInvalid: "Check the measurements and actual doses before saving.",
    calibrationStorageError: "Calibration could not be saved on this device.",
    calibrationTemporary:
      "This calibration is in memory only. It will be lost if you reload or change systems.",
    learned: (n: number) => `${n} readings apply to this mixture`,
    learnedNew:
      "Measurement saved. Garden will use this mixture's response; remeasure after dosing.",
    round: "Round",
    again: "Measure again",
    closeEnough: "Finish this iteration",
    calib: (p: number) => `Personal calibration ${p > 0 ? "+" : ""}${p}%`,
    demo: "",
    save: "Save as system",
    saveTitle: "Save system",
    saveDescription: "Saved locally on this device only.",
    systemName: "System name",
    saveConfirm: "Save",
    cancel: "Cancel",
    deleteSystem: "Delete system",
    searchPlant: "Search plant…",
    noPlants: "No identities match that search.",
    unsupportedProduct:
      "Unavailable product: exact formulation and verified calibration are required.",
  },
} as const;
type Copy = (typeof T)[Lang];

const MODE_ICONS: Record<Mode, React.ComponentType<{ className?: string }>> = {
  recipe: BookOpen,
  target: Target,
  adjust: Gauge,
  topup: Droplets,
};
const MODES: Mode[] = ["recipe", "target", "adjust", "topup"];
const LITERS = [2, 4, 6.5, 10];
const QUICK_CALIBRATION_STORAGE_KEY = "gardenpedia.calculator.quick-calibration.v1";

function parseDecimalInput(raw: string): number | null {
  if (raw.trim() === "") return null;
  const parsed = Number(raw.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function loadQuickCalibrationObservations(): import("@/lib/garden-nutrient-engine-v1").CalibrationObservation[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUICK_CALIBRATION_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const QUICK: SavedSystem = {
  id: "quick",
  name: "",
  crops: {},
  liters: 4,
  productId: "gh-flora",
  water: { label: { es: "Agua de origen", en: "Source water" }, ec: 0 },
  sourceEcKnown: false,
  meter: "—",
  stageId: "feeding-2",
  pods: 6,
  unit: "mS",
};

function localizedComponent(label: string, lang: Lang) {
  return lang === "en" ? label.replace(/^Parte ([AB])$/, "Part $1") : label;
}

type SeedAgeReference = {
  value: { en: string; es: string };
  note: { en?: string; es?: string } | null;
  sources: readonly { id: string; title: string; url: string }[];
};
const seedAgeReferences: Readonly<Record<string, SeedAgeReference>> = gardenSeedAgeReferences;

/* ---------------------------------------------------------------- page */

export function CalculatorPage({ language = "es" }: { language?: Lang }) {
  const [lang, setLang] = useState<Lang>(language);
  useEffect(() => setLang(language), [language]);
  const t = T[lang];
  const [sys, setSys] = useState<SavedSystem>(QUICK);
  const quickDraft = useRef<SavedSystem>(QUICK);
  const [savedSystems, setSavedSystems] = useState(() => loadSavedSystems());
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [plantPickerOpen, setPlantPickerOpen] = useState(false);
  const [plantQuery, setPlantQuery] = useState("");
  const [mode, setMode] = useState<Mode>("recipe");
  const [crops, setCrops] = useState(sys.crops);
  const [hydroponicSystem, setHydroponicSystem] = useState<HydroponicSystem>(
    sys.hydroponicSystem ?? "UNKNOWN",
  );
  const [cropStages, setCropStages] = useState<Record<string, CalculatorCropStage>>(
    sys.cropStages ?? {},
  );
  const [cropAdditionalStages, setCropAdditionalStages] = useState<
    Record<string, CalculatorAdditionalStage[]>
  >(sys.cropAdditionalStages ?? {});
  const [cropSowingAgeDays, setCropSowingAgeDays] = useState<Record<string, string>>(
    sys.cropSowingAgeDays ?? {},
  );
  const [liters, setLiters] = useState(sys.liters);
  const [volumeInput, setVolumeInput] = useState(String(sys.liters));
  const [productId, setProductId] = useState(sys.productId);
  const [customAbManufacturer, setCustomAbManufacturer] = useState(sys.customAbManufacturer ?? "");
  const [customAbName, setCustomAbName] = useState(sys.customAbName ?? "");
  const [customAbVersion, setCustomAbVersion] = useState(sys.customAbVersion ?? "");
  const [stageId, setStageId] = useState(QUICK.stageId);
  const [pods, setPods] = useState(QUICK.pods);
  const [unit, setUnit] = useState<EcUnit>("mS");
  const [currentEc, setCurrentEc] = useState<string>("");
  const [currentLiters, setCurrentLiters] = useState<string>("");
  const [capacityInput, setCapacityInput] = useState<string>("");
  const [waterAdded, setWaterAdded] = useState<string>("");
  const [fillPlanMessage, setFillPlanMessage] = useState("");
  const [userTarget, setUserTarget] = useState<number | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [targetEdited, setTargetEdited] = useState(false);
  const [sourceEcInput, setSourceEcInput] = useState("");
  const [calibrationOpen, setCalibrationOpen] = useState(true);
  const [calibrationError, setCalibrationError] = useState("");
  const [calibrationTemporary, setCalibrationTemporary] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dosingResolutionInput, setDosingResolutionInput] = useState("0.5");
  const [correctionStepInput, setCorrectionStepInput] = useState("50");
  const dosingResolutionMl = parseDecimalInput(dosingResolutionInput) ?? 0;
  const [round, setRound] = useState(1);
  const [justLearned, setJustLearned] = useState(false);
  const [calibrationObservations, setCalibrationObservations] = useState<
    import("@/lib/garden-nutrient-engine-v1").CalibrationObservation[]
  >(() => loadQuickCalibrationObservations());

  const product = CALCULATOR_PRODUCTS.find((p) => p.id === productId) ?? CALCULATOR_PRODUCTS[0]!;
  const calibrationCounts = calibrationUsage({
    productId,
    customAbManufacturer,
    customAbName,
    customAbVersion,
    stageId,
    liters,
    pods,
    calibrationObservations,
  });

  const pick = (selection: SavedSystem) => {
    if (sys.id === "quick")
      quickDraft.current = {
        ...sys,
        crops,
        hydroponicSystem,
        cropStages,
        cropAdditionalStages,
        cropSowingAgeDays,
        liters,
        productId,
        customAbManufacturer,
        customAbName,
        customAbVersion,
        stageId,
        pods,
        unit,
        mode,
        userTarget,
        currentEc: parseDisplayedEc(currentEc),
        currentLiters: parseDecimalInput(currentLiters),
        capacityLiters: parseDecimalInput(capacityInput),
        waterAdded: parseDecimalInput(waterAdded),
        dosingResolutionMl,
        correctionFraction: (parseDecimalInput(correctionStepInput) ?? 50) / 100,
        water: { ...sys.water, ec: sourceEc },
        sourceEcKnown: parseDecimalInput(sourceEcInput) !== null,
        calibrationObservations,
      };
    const s = selection.id === "quick" ? quickDraft.current : selection;
    setSys(s);
    setCrops(s.crops);
    setHydroponicSystem(s.hydroponicSystem ?? "UNKNOWN");
    setCropStages(s.cropStages ?? {});
    setCropAdditionalStages(s.cropAdditionalStages ?? {});
    setCropSowingAgeDays(s.cropSowingAgeDays ?? {});
    setLiters(s.liters);
    setVolumeInput(String(s.liters));
    setProductId(s.productId);
    setCustomAbManufacturer(s.customAbManufacturer ?? "");
    setCustomAbName(s.customAbName ?? "");
    setCustomAbVersion(s.customAbVersion ?? "");
    setStageId(s.stageId);
    setPods(s.pods);
    setUnit(s.unit);
    setSourceEcInput(s.sourceEcKnown === false ? "" : String(s.water.ec));
    setMode(s.mode ?? "recipe");
    setUserTarget(s.userTarget ?? null);
    setTargetInput(
      s.userTarget == null ? "" : String(s.unit === "uS" ? s.userTarget * 1000 : s.userTarget),
    );
    setTargetEdited(s.userTarget != null);
    setCurrentEc(
      s.currentEc == null ? "" : String(s.unit === "uS" ? s.currentEc * 1000 : s.currentEc),
    );
    setCurrentLiters(s.currentLiters == null ? "" : String(s.currentLiters));
    setCapacityInput(s.capacityLiters == null ? "" : String(s.capacityLiters));
    setWaterAdded(s.waterAdded == null ? "" : String(s.waterAdded));
    setDosingResolutionInput(String(s.dosingResolutionMl ?? 0.5));
    setCorrectionStepInput(String((s.correctionFraction ?? 0.5) * 100));
    setRound(1);
    const observations =
      s.id === "quick" ? loadQuickCalibrationObservations() : (s.calibrationObservations ?? []);
    setCalibrationObservations(observations);
    setJustLearned(false);
    setCalibrationOpen(true);
    setCalibrationTemporary(false);
  };
  const saveCurrentSystem = () => {
    const localId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `local-${Date.now()}`;
    const next: SavedSystem = {
      ...sys,
      id: sys.id === "quick" ? localId : sys.id,
      name: saveName.trim(),
      crops: { ...crops },
      hydroponicSystem,
      cropStages: { ...cropStages },
      cropAdditionalStages: { ...cropAdditionalStages },
      cropSowingAgeDays: { ...cropSowingAgeDays },
      liters,
      productId,
      customAbManufacturer,
      customAbName,
      customAbVersion,
      stageId,
      pods,
      unit,
      water: { ...sys.water, ec: parseDecimalInput(sourceEcInput) ?? 0 },
      sourceEcKnown: parseDecimalInput(sourceEcInput) !== null,
      calibrationObservations,
      mode,
      userTarget,
      currentEc: parseDisplayedEc(currentEc),
      currentLiters: parseDecimalInput(currentLiters),
      capacityLiters: parseDecimalInput(capacityInput),
      waterAdded: parseDecimalInput(waterAdded),
      dosingResolutionMl,
      correctionFraction: (parseDecimalInput(correctionStepInput) ?? 50) / 100,
      calibration: calibrationObservations.length
        ? { learned: 0, readings: calibrationObservations.length }
        : undefined,
    };
    const nextSystems = [...savedSystems.filter((item) => item.id !== next.id), next];
    try {
      persistSavedSystems(nextSystems);
    } catch {
      setSaveError(
        lang === "es"
          ? "No se pudo guardar en este dispositivo. La configuración sigue abierta."
          : "Could not save on this device. Your configuration is still open.",
      );
      return;
    }
    setSaveError("");
    setSavedSystems(nextSystems);
    setSys(next);
    setSaveOpen(false);
    setSaveName("");
  };
  const removeSavedSystem = (id: string) => {
    const next = savedSystems.filter((item) => item.id !== id);
    try {
      persistSavedSystems(next);
    } catch {
      setSaveError(
        lang === "es"
          ? "No se pudo eliminar el sistema en este dispositivo."
          : "Could not remove the system on this device.",
      );
      return;
    }
    setSavedSystems(next);
    if (sys.id === id) pick(QUICK);
  };
  const changeMode = (m: Mode) => {
    setMode(m);
    setFillPlanMessage("");
    setRound(1);
    setJustLearned(false);
  };

  const sourceEc = parseDecimalInput(sourceEcInput) ?? 0;
  useEffect(
    () => setFillPlanMessage(""),
    [
      currentEc,
      currentLiters,
      capacityInput,
      sourceEcInput,
      userTarget,
      productId,
      stageId,
      calibrationObservations,
    ],
  );
  const parseDisplayedEc = useCallback(
    (raw: string) => {
      const parsed = parseDecimalInput(raw);
      if (parsed === null) return null;
      return unit === "uS" ? parsed / 1000 : parsed;
    },
    [unit],
  );
  const editTarget = (raw: string) => {
    setTargetEdited(true);
    setTargetInput(raw);
    setUserTarget(parseDisplayedEc(raw));
  };
  const changeUnit = (next: EcUnit) => {
    if (next !== unit && targetInput.trim()) {
      const currentMs = parseDisplayedEc(targetInput);
      if (currentMs !== null) {
        setTargetInput(next === "uS" ? String(Math.round(currentMs * 1000)) : currentMs.toFixed(2));
      }
    }
    setUnit(next);
    if (next !== unit && currentEc.trim()) {
      const currentMs = parseDisplayedEc(currentEc);
      if (currentMs !== null) setCurrentEc(String(next === "uS" ? currentMs * 1000 : currentMs));
    }
  };

  const saveCalibrationObservation = (
    observation: import("@/lib/garden-nutrient-engine-v1").CalibrationObservation,
  ) => {
    const nextObservations = [...calibrationObservations, observation];
    const snapshot: SavedSystem = {
      ...sys,
      crops: { ...crops },
      hydroponicSystem,
      cropStages: { ...cropStages },
      cropAdditionalStages: { ...cropAdditionalStages },
      cropSowingAgeDays: { ...cropSowingAgeDays },
      liters,
      productId,
      customAbManufacturer,
      customAbName,
      customAbVersion,
      stageId,
      pods,
      unit,
      water: { ...sys.water, ec: sourceEc },
      sourceEcKnown: parseDecimalInput(sourceEcInput) !== null,
      calibrationObservations: nextObservations,
      mode,
      userTarget,
      currentEc: parseDisplayedEc(currentEc),
      currentLiters: parseDecimalInput(currentLiters),
      capacityLiters: parseDecimalInput(capacityInput),
      waterAdded: parseDecimalInput(waterAdded),
      dosingResolutionMl,
      correctionFraction: (parseDecimalInput(correctionStepInput) ?? 50) / 100,
      calibration: { learned: 0, readings: nextObservations.length },
    };
    let persisted = true;
    if (sys.id === "quick") {
      try {
        window.localStorage.setItem(
          QUICK_CALIBRATION_STORAGE_KEY,
          JSON.stringify(nextObservations),
        );
      } catch {
        persisted = false;
      }
    } else {
      const nextSystems = savedSystems.map((item) => (item.id === sys.id ? snapshot : item));
      try {
        persistSavedSystems(nextSystems);
      } catch {
        persisted = false;
      }
      setSavedSystems(nextSystems);
    }
    setCalibrationObservations(nextObservations);
    setSys(snapshot);
    setCalibrationTemporary(!persisted);
    setCalibrationOpen(false);
    setCalibrationError("");
    setJustLearned(true);
  };

  const num = useCallback(
    (s: string, convertUs = false) => {
      if (s.trim() === "") return null;
      const n = parseDecimalInput(s);
      if (n === null) return null;
      return unit === "uS" && convertUs ? n / 1000 : n;
    },
    [unit],
  );

  const result = useMemo<CalcResult>(
    () =>
      calculateGardenResult({
        language: lang,
        mode,
        crops,
        hydroponicSystem,
        cropStages,
        cropAdditionalStages,
        liters,
        productId,
        customAbManufacturer,
        customAbName,
        customAbVersion,
        stageId,
        pods,
        sourceEc,
        currentEc: num(currentEc, true),
        currentLiters: num(currentLiters),
        capacityLiters: num(capacityInput),
        waterAdded: num(waterAdded),
        userTarget,
        round,
        calibrationObservations,
        dosingResolutionMl,
        correctionFraction: (parseDecimalInput(correctionStepInput) ?? 0) / 100,
        invalidFields: [
          ...(productId === "ab" && !customAbManufacturer.trim() ? [t.customAbManufacturer] : []),
          ...(productId === "ab" && !customAbName.trim() ? [t.customAbName] : []),
          ...(productId === "ab" && !customAbVersion.trim() ? [t.customAbVersion] : []),
          ...((mode === "recipe" && product.basis === "liters") || mode === "target"
            ? parseDecimalInput(volumeInput) === null || (parseDecimalInput(volumeInput) ?? 0) <= 0
              ? [t.volume]
              : []
            : []),
          ...(mode !== "recipe" && parseDecimalInput(sourceEcInput) === null ? [t.sourceEc] : []),
          ...(targetEdited && (userTarget === null || userTarget <= 0) && mode !== "recipe"
            ? [t.targetEc]
            : []),
          ...(dosingResolutionMl <= 0 ? [t.dosing] : []),
          ...(mode === "adjust" &&
          ((parseDecimalInput(correctionStepInput) ?? 0) <= 0 ||
            (parseDecimalInput(correctionStepInput) ?? 0) > 100)
            ? [t.correctionStep]
            : []),
        ],
      }),
    [
      lang,
      mode,
      crops,
      hydroponicSystem,
      cropStages,
      cropAdditionalStages,
      liters,
      volumeInput,
      product.basis,
      productId,
      customAbManufacturer,
      customAbName,
      customAbVersion,
      stageId,
      pods,
      sourceEc,
      currentEc,
      currentLiters,
      capacityInput,
      waterAdded,
      userTarget,
      round,
      calibrationObservations,
      dosingResolutionMl,
      correctionStepInput,
      sourceEcInput,
      targetEdited,
      t,
      num,
    ],
  );

  const fmtEc = (v: number) => (unit === "mS" ? v.toFixed(2) : String(Math.round(v * 1000)));
  const unitLabel = unit === "mS" ? "mS/cm" : "µS/cm";
  const cropName = (id: string) =>
    CALCULATOR_PLANTS.find((plant) => plant.id === id)?.name[lang] ?? id;

  return (
    <>
      <main className="min-h-screen px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {/* Dock */}
          <section aria-label={t.systems} className="mt-5">
            {saveError && !saveOpen && (
              <p role="alert" className="mb-2 text-sm text-destructive">
                {saveError}
              </p>
            )}
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{t.systems}</p>
            <div
              className="min-w-0 max-w-full flex snap-x gap-2 overflow-x-auto px-1 py-1.5"
              style={{ scrollPaddingInline: "0.75rem" }}
            >
              <DockItem
                active={sys.id === "quick"}
                onClick={() => pick(QUICK)}
                title={t.quick}
                meta={t.quickHint}
                icon={<Sparkles className="h-4 w-4" />}
              />
              {savedSystems.map((s) => {
                const n = Object.values(s.crops).reduce((a, b) => a + b, 0);
                const p = CALCULATOR_PRODUCTS.find((x) => x.id === s.productId);
                return (
                  <DockItem
                    key={s.id}
                    active={sys.id === s.id}
                    onClick={() => pick(s)}
                    title={s.name}
                    meta={`${s.liters} L · ${n} · ${p?.name.split(" ")[0] ?? s.productId}`}
                    learned={!!s.calibration}
                    onDelete={() => removeSavedSystem(s.id)}
                    deleteLabel={t.deleteSystem}
                  />
                );
              })}
            </div>
          </section>

          {/* Modes */}
          <div
            role="tablist"
            aria-label="Modo"
            className="glass-soft mt-4 grid grid-cols-4 gap-1 p-1"
          >
            {MODES.map((m) => {
              const Icon = MODE_ICONS[m];
              return (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => changeMode(m)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-md py-2.5 text-[11px] font-semibold transition-colors sm:flex-row sm:gap-2 sm:text-sm",
                    mode === m
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/60",
                  )}
                >
                  <Icon className="h-4 w-4" /> {t.modes[m]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-sm text-muted-foreground">{t.modeHint[mode]}</p>

          {/* Workbench */}
          <div className="mt-4 grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <section className="glass-panel min-w-0 space-y-6 p-5 sm:p-6" aria-label="Workbench">
              {(mode === "adjust" || mode === "topup") && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {mode === "topup" && (
                    <Field
                      label={t.capacity}
                      suffix="L"
                      value={capacityInput}
                      onChange={setCapacityInput}
                      placeholder="4.0"
                    />
                  )}
                  {(mode === "topup" || mode === "adjust") && (
                    <Field
                      label={mode === "topup" ? t.currentLitersBeforeTopup : t.currentLiters}
                      suffix="L"
                      value={currentLiters}
                      onChange={setCurrentLiters}
                      placeholder="3.0"
                    />
                  )}
                  {mode === "topup" && (
                    <div>
                      <Field
                        label={t.waterAdded}
                        suffix="L"
                        value={waterAdded}
                        onChange={(value) => {
                          setWaterAdded(value);
                          setFillPlanMessage("");
                        }}
                        placeholder="1.0"
                      />
                      <button
                        type="button"
                        className="mt-2 text-xs underline"
                        disabled={
                          parseDecimalInput(capacityInput) === null ||
                          parseDecimalInput(currentLiters) === null ||
                          (parseDecimalInput(capacityInput) ?? 0) <
                            (parseDecimalInput(currentLiters) ?? 0)
                        }
                        onClick={() => {
                          const capacity = parseDecimalInput(capacityInput);
                          const current = parseDecimalInput(currentLiters);
                          const measuredEc = num(currentEc, true);
                          if (capacity === null || current === null || capacity < current) return;
                          const simpleWater = () => {
                            setWaterAdded(String(Number((capacity - current).toFixed(6))));
                            setFillPlanMessage(
                              lang === "es"
                                ? "Esta cantidad llena el espacio antes de añadir nutrientes. Introduce las mediciones y una calibración aplicable; después vuelve a calcular para reservarles espacio."
                                : "This amount fills the space before nutrients. Enter the measurements and an applicable calibration, then calculate again to leave room for them.",
                            );
                          };
                          if (
                            measuredEc === null ||
                            parseDecimalInput(sourceEcInput) === null ||
                            !result.target
                          ) {
                            simpleWater();
                            return;
                          }
                          const plan = planTopUpToCapacity(
                            {
                              language: lang,
                              mode: "topup",
                              crops,
                              cropStages,
                              cropAdditionalStages,
                              hydroponicSystem,
                              liters,
                              productId,
                              customAbManufacturer,
                              customAbName,
                              customAbVersion,
                              stageId,
                              pods,
                              sourceEc,
                              currentEc: measuredEc,
                              currentLiters: current,
                              capacityLiters: capacity,
                              waterAdded: null,
                              userTarget,
                              round,
                              calibrationObservations,
                            },
                            result.target.value,
                          );
                          if (plan.ok) {
                            setWaterAdded(String(plan.waterToAddL));
                            setFillPlanMessage(
                              lang === "es"
                                ? "Agua estimada dejando espacio para los nutrientes calibrados. Mezcla y vuelve a medir."
                                : "Estimated water leaves room for the calibrated nutrients. Mix and remeasure.",
                            );
                          } else if (plan.code === "CALIBRATION_REQUIRED") {
                            simpleWater();
                          } else setFillPlanMessage(plan.message);
                        }}
                      >
                        {t.fillToCapacity}
                      </button>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {lang === "es"
                          ? "Si necesitas nutrientes, deja espacio para su volumen o reduce el agua."
                          : "If nutrients are needed, leave room for their volume or reduce the water."}
                      </p>
                      {fillPlanMessage && (
                        <p role="status" className="mt-1 text-xs text-muted-foreground">
                          {fillPlanMessage}
                        </p>
                      )}
                    </div>
                  )}
                  <Field
                    label={mode === "topup" ? t.currentEcBeforeTopup : t.currentEc}
                    suffix={unitLabel}
                    value={currentEc}
                    onChange={(v) => {
                      setCurrentEc(v);
                      setJustLearned(false);
                    }}
                    placeholder={unit === "mS" ? "1.10" : "1100"}
                    highlight={mode === "adjust"}
                    className={mode === "adjust" ? "sm:col-span-3" : ""}
                  />
                  {mode === "adjust" && (
                    <div>
                      <Field
                        label={t.correctionStep}
                        suffix="%"
                        value={correctionStepInput}
                        onChange={setCorrectionStepInput}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">{t.correctionStepNote}</p>
                    </div>
                  )}
                </div>
              )}
              <label className="block text-xs font-medium text-muted-foreground">
                {lang === "es" ? "Tipo de sistema (opcional)" : "Growing system (optional)"}
                <select
                  aria-label={lang === "es" ? "Tipo de sistema" : "Growing system"}
                  value={hydroponicSystem}
                  onChange={(event) => setHydroponicSystem(event.target.value as HydroponicSystem)}
                  className="mt-1 h-11 w-full rounded-md border border-input bg-background/70 px-3 text-sm text-foreground"
                >
                  <option value="UNKNOWN">
                    {lang === "es" ? "Sin especificar" : "Unspecified"}
                  </option>
                  <option value="KRATKY">Kratky</option>
                  <option value="DWC">DWC</option>
                  <option value="NFT">NFT</option>
                  <option value="DRIP">{lang === "es" ? "Goteo" : "Drip"}</option>
                  <option value="AEROPONIC">{lang === "es" ? "Aeropónico" : "Aeroponic"}</option>
                  <option value="COUNTERTOP_POD">
                    {lang === "es" ? "Sistema de sobremesa con pods" : "Countertop pod system"}
                  </option>
                </select>
                <span className="mt-1 block font-normal">
                  {lang === "es"
                    ? "Ayuda a comprobar si una fuente aplica; no cambia por sí solo la receta del fabricante."
                    : "Helps check whether a source applies; it does not by itself change the manufacturer's recipe."}
                </span>
                {hydroponicSystem !== "UNKNOWN" &&
                  result.compatibility &&
                  Object.keys(crops).length > 0 &&
                  !result.compatibility.cropRanges.some((crop) =>
                    crop.observations.some(
                      (observation) => observation.hydroponicSystem === hydroponicSystem,
                    ),
                  ) && (
                    <span className="mt-1 block font-normal">
                      {lang === "es"
                        ? "No hay un rango específico verificado para este sistema y las plantas o etapas elegidas. Se usa evidencia hidropónica general cuando es aplicable."
                        : "There is no verified system-specific range for these selected plants or stages. General hydroponic evidence is used when applicable."}
                    </span>
                  )}
              </label>
              {mode !== "recipe" || product.basis === "liters" ? (
                <Block title={t.plants} hint={`${Object.values(crops).reduce((a, b) => a + b, 0)}`}>
                  <ul className="space-y-1.5">
                    {Object.keys(crops).map((id) => {
                      const c = CALCULATOR_PLANTS.find((x) => x.id === id);
                      if (!c) return null;
                      const stageReference = CROP_STAGE_REFERENCES.find(
                        (reference) => reference.cropIdentity === resolveNutrientCropIdentity(id),
                      );
                      const studies = CROP_STUDY_REFERENCES.filter((reference) =>
                        (reference.plantIds as readonly string[]).includes(id),
                      );
                      const generalReference = generalCropReferenceForStage(
                        id,
                        cropStages[id] ?? "UNSPECIFIED",
                        hydroponicSystem,
                      );
                      return (
                        <li
                          key={id}
                          className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 rounded-md bg-background/50 px-3 py-2"
                        >
                          <span className="text-lg" aria-hidden>
                            {c.emoji}
                          </span>
                          <span className="min-w-0 break-words text-sm font-medium">
                            {c.name[lang]}
                          </span>
                          <Stepper
                            value={crops[id]!}
                            onChange={(v) => {
                              setCrops({ ...crops, [id]: v });
                              if (v <= 1)
                                setCropAdditionalStages((current) => {
                                  const next = { ...current };
                                  delete next[id];
                                  return next;
                                });
                            }}
                          />
                          <button
                            aria-label={lang === "es" ? "Quitar" : "Remove"}
                            onClick={() => {
                              const { [id]: _, ...r } = crops;
                              setCrops(r);
                              setCropStages((current) => {
                                const next = { ...current };
                                delete next[id];
                                return next;
                              });
                              setCropAdditionalStages((current) => {
                                const next = { ...current };
                                delete next[id];
                                return next;
                              });
                              setCropSowingAgeDays((current) => {
                                const next = { ...current };
                                delete next[id];
                                return next;
                              });
                            }}
                            className="grid h-8 w-8 place-items-center text-muted-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <select
                            aria-label={`${lang === "es" ? "Etapa de" : "Stage of"} ${c.name[lang]}`}
                            value={cropStages[id] ?? "UNSPECIFIED"}
                            onChange={(event) => {
                              setCropStages({
                                ...cropStages,
                                [id]: event.target.value as CalculatorCropStage,
                              });
                              setCropAdditionalStages((current) => ({
                                ...current,
                                [id]: (current[id] ?? []).filter(
                                  (stage) => stage !== event.target.value,
                                ),
                              }));
                            }}
                            className="col-span-full w-full min-w-0 bg-transparent text-xs font-normal"
                          >
                            <option value="UNSPECIFIED">
                              {lang === "es" ? "Etapa no especificada" : "Stage unspecified"}
                            </option>
                            <option value="SEEDLING">
                              {lang === "es" ? "Plántula" : "Seedling"}
                            </option>
                            <option value="VEGETATIVE">
                              {lang === "es" ? "Crecimiento vegetativo" : "Vegetative growth"}
                            </option>
                            <option value="FLOWERING">
                              {lang === "es" ? "Floración" : "Flowering"}
                            </option>
                            <option value="FRUITING">
                              {lang === "es" ? "Fructificación" : "Fruiting"}
                            </option>
                            <option value="MIXED">
                              {lang === "es"
                                ? "Plántulas y otras etapas"
                                : "Seedlings and other stages"}
                            </option>
                          </select>
                          {generalReference && (
                            <details className="col-span-full text-xs text-muted-foreground">
                              <summary className="cursor-pointer font-medium">
                                {lang === "es"
                                  ? "Ver referencia general de EC"
                                  : "View general EC reference"}
                              </summary>
                              <p className="mt-2">
                                {lang === "es"
                                  ? "La fuente reporta un rango general para este cultivo, pero no indica que corresponda a la etapa seleccionada. No se utiliza como objetivo automático: "
                                  : "The source reports a general range for this crop, but does not say it applies to the selected stage. It is not used as an automatic target: "}
                                {unit === "uS"
                                  ? generalReference.range.min * 1000
                                  : generalReference.range.min.toFixed(2)}
                                –
                                {unit === "uS"
                                  ? generalReference.range.max * 1000
                                  : generalReference.range.max.toFixed(2)}{" "}
                                {unit === "uS" ? "µS/cm" : "mS/cm"}.
                              </p>
                              {generalReference.sources.map((source) => (
                                <a
                                  key={source.id}
                                  className="mr-3 mt-1 inline-block underline"
                                  href={source.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {source.publisher}
                                </a>
                              ))}
                            </details>
                          )}
                          {stageReference && (
                            <details className="col-span-full text-xs text-muted-foreground">
                              <summary className="cursor-pointer font-medium">
                                {lang === "es"
                                  ? "Referencia para observar esta planta"
                                  : "Reference for observing this plant"}
                              </summary>
                              <p className="mt-2">{stageReference.text[lang]}</p>
                              <a
                                className="mt-1 inline-block underline"
                                href={stageReference.source.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {stageReference.source.publisher}
                              </a>
                            </details>
                          )}
                          {studies.length > 0 && (
                            <details className="col-span-full text-xs text-muted-foreground">
                              <summary className="cursor-pointer font-medium">
                                {lang === "es"
                                  ? "Ver fuentes de cultivo"
                                  : "View cultivation sources"}
                              </summary>
                              {studies.map((reference) => (
                                <div key={reference.source.id}>
                                  <p className="mt-2">{reference.text[lang]}</p>
                                  <a
                                    className="mt-1 inline-block underline"
                                    href={reference.source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {reference.source.publisher}
                                  </a>
                                </div>
                              ))}
                            </details>
                          )}
                          {crops[id]! > 1 && (
                            <details className="col-span-full text-xs text-muted-foreground">
                              <summary className="cursor-pointer font-medium">
                                {lang === "es"
                                  ? "¿Hay otras etapas de esta planta?"
                                  : "Other stages of this plant?"}
                              </summary>
                              <p className="mt-2">
                                {lang === "es"
                                  ? "Selecciona las etapas observadas en las demás plantas de esta variedad."
                                  : "Select the stages observed in the other plants of this variety."}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                                {(
                                  [
                                    ["SEEDLING", lang === "es" ? "Plántula" : "Seedling"],
                                    [
                                      "VEGETATIVE",
                                      lang === "es"
                                        ? "Crecimiento vegetativo"
                                        : "Vegetative growth",
                                    ],
                                    ["FLOWERING", lang === "es" ? "Floración" : "Flowering"],
                                    ["FRUITING", lang === "es" ? "Fructificación" : "Fruiting"],
                                  ] as [CalculatorAdditionalStage, string][]
                                )
                                  .filter(
                                    ([stage]) =>
                                      stage !== cropStages[id] &&
                                      !(cropStages[id] === "MIXED" && stage === "SEEDLING"),
                                  )
                                  .map(([stage, label]) => (
                                    <label key={stage} className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={(cropAdditionalStages[id] ?? []).includes(stage)}
                                        onChange={(event) =>
                                          setCropAdditionalStages((current) => ({
                                            ...current,
                                            [id]: event.target.checked
                                              ? [...(current[id] ?? []), stage]
                                              : (current[id] ?? []).filter(
                                                  (item) => item !== stage,
                                                ),
                                          }))
                                        }
                                      />
                                      {label}
                                    </label>
                                  ))}
                              </div>
                            </details>
                          )}
                          <label className="col-span-full flex items-center gap-2 text-xs text-muted-foreground">
                            {lang === "es"
                              ? "Días desde la siembra (opcional)"
                              : "Days since sowing (optional)"}
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="numeric"
                              className="ml-auto h-10 w-20 rounded border border-input bg-background px-2 text-sm"
                              aria-label={`${lang === "es" ? "Días desde la siembra de" : "Days since sowing of"} ${c.name[lang]}`}
                              value={cropSowingAgeDays[id] ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                if (value === "" || /^\d{1,5}$/.test(value))
                                  setCropSowingAgeDays({ ...cropSowingAgeDays, [id]: value });
                              }}
                            />
                          </label>
                          {cropSowingAgeDays[id] !== undefined && cropSowingAgeDays[id] !== "" && (
                            <div className="col-span-full text-xs text-muted-foreground">
                              {seedAgeReferences[id] ? (
                                <>
                                  <p>
                                    {lang === "es"
                                      ? "Referencia publicada de germinación"
                                      : "Published germination reference"}
                                    : {seedAgeReferences[id].value[lang]}
                                    {seedAgeReferences[id].note?.[lang]
                                      ? ` · ${seedAgeReferences[id].note[lang]}`
                                      : ""}
                                  </p>
                                  <p>
                                    {seedAgeReferences[id].sources.map((source, index) => (
                                      <span key={source.id}>
                                        {index ? " · " : ""}
                                        <a
                                          className="underline"
                                          href={source.url}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          {source.title}
                                        </a>
                                      </span>
                                    ))}
                                  </p>
                                </>
                              ) : (
                                <p>
                                  {lang === "es"
                                    ? "No hay una referencia de germinación respaldada para esta identidad."
                                    : "No supported germination reference is available for this identity."}
                                </p>
                              )}
                              <p>
                                {lang === "es"
                                  ? "Es una referencia desde la siembra, no una etapa confirmada ni una dosis. Selecciona la etapa observada arriba."
                                  : "This is a reference from sowing, not a confirmed stage or dose. Select the observed stage above."}
                              </p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {Object.keys(crops).length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {lang === "es"
                        ? "Indica si hay plántulas: la edad en días no determina por sí sola una etapa ni un EC adecuado."
                        : "Indicate whether seedlings are present: age in days alone does not determine stage or a suitable EC."}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPlantQuery("");
                      setPlantPickerOpen(true);
                    }}
                    className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-xs font-medium text-muted-foreground hover:bg-background/60"
                  >
                    <Plus className="h-3 w-3" /> {t.addPlant}
                  </button>
                </Block>
              ) : null}

              <Block title={t.product}>
                <div className="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-3">
                  {CALCULATOR_PRODUCTS.map((p) => (
                    <Chip
                      key={p.id}
                      active={productId === p.id}
                      disabled={!p.available}
                      onClick={() => {
                        setProductId(p.id);
                        if (p.recipeStages[0]) setStageId(p.recipeStages[0].id);
                      }}
                    >
                      {p.name.split(" (")[0]!.replace("Liquid Plant Food", "")}
                    </Chip>
                  ))}
                </div>
                {productId === "ab" && (
                  <div className="mt-3 grid gap-2">
                    <label className="text-xs">
                      {t.customAbManufacturer}
                      <Input
                        aria-label={t.customAbManufacturer}
                        value={customAbManufacturer}
                        onChange={(event) => setCustomAbManufacturer(event.target.value)}
                      />
                    </label>
                    <label className="text-xs">
                      {t.customAbName}
                      <Input
                        aria-label={t.customAbName}
                        value={customAbName}
                        onChange={(event) => setCustomAbName(event.target.value)}
                      />
                    </label>
                    <label className="text-xs">
                      {t.customAbVersion}
                      <Input
                        aria-label={t.customAbVersion}
                        value={customAbVersion}
                        onChange={(event) => setCustomAbVersion(event.target.value)}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">{t.customAbNote}</p>
                  </div>
                )}
                {mode === "recipe" && product.hasRecipeStages && (
                  <div className="mt-3 space-y-2">
                    <select
                      aria-label={product.id === "aerogarden" ? t.feedingEvent : t.stage}
                      value={stageId}
                      onChange={(e) => setStageId(e.target.value)}
                      className="h-11 w-full rounded-md border border-input bg-background/70 px-3 text-sm"
                    >
                      {product.recipeStages
                        .filter(
                          (s) => product.id !== "aerogarden" || s.feedingIndex === 1 || pods === 9,
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {recipeStageLabel(s, product.id, pods, lang)}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </Block>

              {product.basis === "pods" && (
                <Block title={t.pods}>
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-1.5">
                      {(product.podGroups ?? []).map((group) => (
                        <Chip
                          key={group}
                          active={pods === group}
                          onClick={() => {
                            setPods(group);
                            if (group !== 9 && ["feeding-2", "feeding-3"].includes(stageId))
                              setStageId("feeding-1");
                          }}
                        >
                          {group} pods
                        </Chip>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{t.podGroupsHint}</p>
                  </div>
                </Block>
              )}
              {(mode !== "recipe" || product.basis === "liters") &&
                mode !== "topup" &&
                mode !== "adjust" && (
                  <Block title={t.volume}>
                    <div className="flex flex-wrap gap-1.5">
                      {LITERS.map((l) => (
                        <Chip
                          key={l}
                          active={liters === l && parseDecimalInput(volumeInput) === l}
                          onClick={() => {
                            setLiters(l);
                            setVolumeInput(String(l));
                          }}
                        >
                          {l} L
                        </Chip>
                      ))}
                      <div className="inline-flex items-center gap-1">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0.001}
                          step="any"
                          aria-label={t.volume}
                          value={volumeInput}
                          onChange={(e) => {
                            setVolumeInput(e.target.value);
                            const value = parseDecimalInput(e.target.value);
                            if (value !== null && value > 0) setLiters(value);
                          }}
                          className="h-10 w-20"
                        />
                        <span className="text-sm">L</span>
                      </div>
                    </div>
                    {parseDecimalInput(volumeInput) !== null &&
                      (parseDecimalInput(volumeInput) ?? 0) > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {lang === "es" ? "Equivale a" : "Equivalent to"}{" "}
                          {Number(((parseDecimalInput(volumeInput) ?? 0) * 1000).toFixed(3))} mL
                        </p>
                      )}
                  </Block>
                )}

              {mode !== "recipe" && (
                <Field
                  label={t.sourceEc}
                  suffix="mS/cm"
                  value={sourceEcInput}
                  onChange={setSourceEcInput}
                />
              )}

              {mode !== "recipe" && (
                <TargetControl
                  t={t}
                  unitLabel={unitLabel}
                  fmtEc={fmtEc}
                  value={
                    targetEdited ? targetInput : result.target ? fmtEc(result.target.value) : ""
                  }
                  range={result.range}
                  isUser={result.target?.provenance === "user"}
                  outside={!!result.outsideEvidence}
                  onChange={editTarget}
                  onStep={(delta) => {
                    const displayed = parseDecimalInput(
                      targetInput || (result.target ? fmtEc(result.target.value) : ""),
                    );
                    if (displayed !== null) editTarget(String(Math.max(0, displayed + delta)));
                  }}
                  onReset={() => {
                    setTargetInput("");
                    setTargetEdited(false);
                    setUserTarget(null);
                  }}
                  step={unit === "uS" ? 100 : 0.1}
                />
              )}
              <details className="group rounded-md border border-border/70 bg-background/30">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
                  {t.more}
                  <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                    {unitLabel} · {sourceEcInput.trim() ? fmtEc(sourceEc) : "—"}
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <div className="grid gap-4 border-t border-border/70 p-4 sm:grid-cols-2">
                  {mode !== "recipe" && product.hasRecipeStages && (
                    <label className="text-xs text-muted-foreground">
                      {t.calibrationStage}
                      <select
                        aria-label={t.calibrationStage}
                        value={stageId}
                        onChange={(event) => setStageId(event.target.value)}
                        className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {product.recipeStages
                          .filter(
                            (stage) =>
                              product.id !== "aerogarden" || stage.feedingIndex === 1 || pods === 9,
                          )
                          .map((stage) => (
                            <option key={stage.id} value={stage.id}>
                              {recipeStageLabel(stage, product.id, pods, lang)}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <div>
                    <p className="mb-1.5 text-xs text-muted-foreground">{t.unit}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Chip active={unit === "mS"} onClick={() => changeUnit("mS")}>
                        mS/cm
                      </Chip>
                      <Chip active={unit === "uS"} onClick={() => changeUnit("uS")}>
                        µS/cm
                      </Chip>
                    </div>
                  </div>
                  {mode === "recipe" && (
                    <Field
                      label={t.sourceEc}
                      suffix="mS/cm"
                      value={sourceEcInput}
                      onChange={setSourceEcInput}
                    />
                  )}
                  {mode === "adjust" && (
                    <Field
                      label={t.capacity}
                      suffix="L"
                      value={capacityInput}
                      onChange={setCapacityInput}
                      placeholder="—"
                    />
                  )}
                  <div className="text-sm">
                    <p className="text-xs text-muted-foreground">{t.meter}</p>
                    <p className="mt-1 font-medium">{sys.meter}</p>
                  </div>
                  <Field
                    label={lang === "es" ? "Resolución de dosificación" : "Dosing resolution"}
                    suffix="mL"
                    value={dosingResolutionInput}
                    onChange={setDosingResolutionInput}
                  />
                </div>
              </details>

              {sys.id === "quick" && (
                <Button
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => {
                    setSaveName("");
                    setSaveOpen(true);
                  }}
                >
                  {t.save}
                </Button>
              )}
              {sys.id !== "quick" && (
                <Button
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => {
                    setSaveName(sys.name);
                    setSaveOpen(true);
                  }}
                >
                  {t.save}
                </Button>
              )}
            </section>

            {/* Result */}
            <section className="space-y-4" aria-live="polite">
              {calibrationTemporary && (
                <p role="alert" className="rounded-lg border border-amber-500/60 p-3 text-sm">
                  {t.calibrationTemporary}
                </p>
              )}
              {mode !== "recipe" && calibrationObservations.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {lang === "es"
                    ? `Calibración: ${calibrationCounts.used} de ${calibrationCounts.recorded} lecturas guardadas se aplican a esta formulación y proporción. Proporciones distintas no se mezclan.`
                    : `Calibration: ${calibrationCounts.used} of ${calibrationCounts.recorded} saved readings apply to this formulation and ratio. Different ratios are not combined.`}
                </p>
              )}
              {result.compatibility?.evidenceState === "CONFLICTING" && (
                <p role="alert" className="rounded-lg border border-amber-500/60 p-3 text-sm">
                  {lang === "es"
                    ? "Las fuentes aplicables presentan rangos contradictorios. Garden no determina automáticamente un objetivo para esta combinación."
                    : "Applicable sources report conflicting ranges. Garden cannot automatically choose a target for this combination."}
                </p>
              )}
              {result.compatibility?.status === "INSUFFICIENT" &&
                result.compatibility.evidenceState !== "CONFLICTING" &&
                Object.keys(crops).length > 0 && (
                  <div role="alert" className="rounded-lg border border-amber-500/60 p-3 text-sm">
                    <p>
                      {lang === "es"
                        ? "No hay evidencia de EC aplicable suficiente para todas las plantas o etapas elegidas. Una dosis calculada no confirma que el objetivo sea adecuado para ellas."
                        : "There is not enough applicable EC evidence for every selected plant or stage. A calculated dose does not confirm that the target is suitable for them."}
                    </p>
                    <p className="mt-2">
                      {[
                        ...new Set(
                          result.compatibility.cropRanges
                            .filter((crop) => !crop.ec || crop.evidenceState === "INSUFFICIENT")
                            .flatMap((crop) =>
                              Object.keys(crops).filter(
                                (id) =>
                                  (resolveNutrientCropIdentity(id) ?? id) === crop.cropIdentity,
                              ),
                            ),
                        ),
                      ]
                        .map(cropName)
                        .join(", ")}
                    </p>
                  </div>
                )}
              {result.compatibility?.status === "NO_COMMON_OPTIMUM_RANGE" && (
                <div className="rounded-lg border border-amber-500/60 p-3 text-sm">
                  <p>
                    {lang === "es"
                      ? "Los rangos publicados no se solapan. Considera separar los cultivos; un objetivo elegido no convierte esos rangos en compatibles."
                      : "The reported ranges do not overlap. Consider separating the crops; a selected target does not make the ranges overlap."}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {result.compatibility.cropRanges.map((crop, index) => {
                      const selected = Object.keys(crops).filter(
                        (id) => (resolveNutrientCropIdentity(id) ?? id) === crop.cropIdentity,
                      );
                      return crop.ec ? (
                        <li key={`${crop.cropIdentity}-${index}`}>
                          {selected.map(cropName).join(", ") || crop.cropIdentity}:{" "}
                          {fmtEc(crop.ec.min)}–{fmtEc(crop.ec.max)} {unitLabel}
                        </li>
                      ) : null;
                    })}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {lang === "es" ? "Fuente" : "Source"}:{" "}
                    {[
                      ...new Map(
                        result.compatibility.cropRanges
                          .flatMap((crop) => crop.observations)
                          .map((observation) => [observation.source.id, observation.source]),
                      ).values(),
                    ].map((source, index) => (
                      <span key={source.id}>
                        {index > 0 ? "; " : ""}
                        <a className="underline" href={source.url} target="_blank" rel="noreferrer">
                          {source.publisher}
                        </a>
                      </span>
                    ))}
                  </p>
                </div>
              )}
              {result.kind === "needs" ? (
                <div className="glass-panel p-6">
                  <p className="eyebrow">{t.now}</p>
                  <p className="mt-3 font-display text-xl font-semibold">{t.needs}</p>
                  {result.message ? (
                    <p className="mt-3 text-sm text-muted-foreground">{result.message}</p>
                  ) : null}
                  {result.calibrationRequired && product.available && (
                    <Button
                      className="mt-4 h-11 w-full"
                      onClick={() => {
                        setCalibrationError("");
                        setCalibrationOpen(true);
                      }}
                    >
                      {t.calibrate}
                    </Button>
                  )}
                  {calibrationOpen && result.calibrationRequired && product.available && (
                    <CalibrationCard
                      key={`${productId}-${unit}`}
                      t={t}
                      lang={lang}
                      product={product}
                      stageId={stageId}
                      onStageChange={setStageId}
                      liters={liters}
                      pods={pods}
                      unit={unit}
                      unitLabel={unitLabel}
                      onSave={(baselineEc, resultingEc, actualDoses, sampleVolumeL) => {
                        const observation = recordActualDoses({
                          productId,
                          customAbManufacturer,
                          customAbName,
                          customAbVersion,
                          stageId,
                          liters: sampleVolumeL,
                          pods,
                          baselineEc,
                          resultingEc,
                          actualDoses,
                        });
                        if (!observation.ok || !observation.value) {
                          setCalibrationError(
                            observation.errors[0]?.message ?? t.calibrationInvalid,
                          );
                          return;
                        }
                        saveCalibrationObservation(observation.value);
                      }}
                    />
                  )}
                  {calibrationError && (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                      {calibrationError}
                    </p>
                  )}
                  {result.missing.length ? (
                    <ul className="mt-3 space-y-2 text-sm">
                      {result.missing.map((m) => (
                        <li key={m} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                          {t.needLabels[m as keyof typeof t.needLabels] ?? m}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="glass-panel animate-rise p-5 sm:p-6" key={`${mode}-${round}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="eyebrow">
                        {t.now}
                        {mode === "adjust" && ` · ${t.round} ${round}`}
                      </p>
                      <ProvenanceTag kind={result.provenance} t={t} />
                    </div>
                    {mode === "topup" && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {lang === "es"
                          ? "La mezcla de EC es una aproximación. Recuperar el EC no demuestra recuperar la composición original de nutrientes."
                          : "EC mixing is approximate. Restoring EC does not prove restoration of the original nutrient composition."}
                      </p>
                    )}
                    {mode === "recipe" && product.basis === "liters" && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {lang === "es"
                          ? "La dosis sigue el programa oficial Light Feed de GH; las plantas seleccionadas se evalúan por separado."
                          : "Doses follow GH's official Light Feed program; selected crops are evaluated separately."}
                      </p>
                    )}
                    <h2 className="mt-3 font-display text-2xl font-bold">
                      {result.action === "add"
                        ? t.actAdd
                        : result.action === "dilute"
                          ? t.actDilute
                          : t.actHold}
                    </h2>
                    {result.action === "hold" ? (
                      <p className="mt-2 text-sm text-muted-foreground">{t.holdBody}</p>
                    ) : (
                      <>
                        <p className="mt-4 text-xs font-semibold text-muted-foreground">
                          {productId === "ab"
                            ? lang === "es"
                              ? "Cantidades · sigue las instrucciones de mezcla del fabricante"
                              : "Amounts · follow the manufacturer's mixing instructions"
                            : t.order}
                        </p>
                        <ol className="mt-2 divide-y divide-border/70">
                          {result.doses.map((d, i) => (
                            <li key={d.label} className="flex items-center gap-3 py-3">
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-primary/40 text-xs font-bold">
                                {productId === "ab" ? "•" : i + 1}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                {d.label === "Replacement water"
                                  ? lang === "es"
                                    ? "Agua de reposición"
                                    : d.label
                                  : d.label === "Water" || d.label === "Agua"
                                    ? lang === "es"
                                      ? "Agua"
                                      : "Water"
                                    : localizedComponent(d.label, lang)}
                              </span>
                              <span className="font-display text-3xl font-bold tabular-nums">
                                {d.unit === "L"
                                  ? d.amount > 0 && d.amount < 0.000001
                                    ? "<0.000001"
                                    : String(Number(d.amount.toFixed(6)))
                                  : d.amount > 0 && d.amount < 0.005
                                    ? "<0.01"
                                    : d.amount.toFixed(2)}
                                <span className="ml-1 text-sm font-medium text-muted-foreground">
                                  {d.unit}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      </>
                    )}

                    {/* Next */}
                    <div className="mt-5 rounded-lg bg-background/55 p-4">
                      <p className="text-xs font-semibold text-muted-foreground">{t.next}</p>
                      <ol className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        {[
                          { icon: Waves, label: t.stepMix },
                          { icon: RefreshCw, label: t.stepWait },
                          { icon: Gauge, label: t.stepMeasure },
                        ].map(({ icon: Icon, label }, i) => (
                          <li key={label} className="flex flex-col items-center gap-1.5">
                            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="leading-tight">
                              <span className="sr-only">{i + 1}. </span>
                              {label}
                            </span>
                          </li>
                        ))}
                      </ol>
                      <p className="mt-3 text-center text-[11px] text-muted-foreground">
                        {t.waitNote}
                      </p>
                      {result.expectedEc != null && (
                        <p className="mt-3 border-t border-border/70 pt-3 text-center text-sm">
                          {result.expectedEc.kind === "manufacturer"
                            ? t.manufacturerExpected
                            : t.expect}{" "}
                          <strong className="font-display tabular-nums">
                            {fmtEc(result.expectedEc.min)}
                            {result.expectedEc.min !== result.expectedEc.max
                              ? `–${fmtEc(result.expectedEc.max)}`
                              : ""}{" "}
                            {unitLabel}
                          </strong>
                        </p>
                      )}
                    </div>

                    {/* Disclosure: why */}
                    <details className="group mt-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2 text-sm font-semibold">
                        <span className="flex min-w-0 items-center gap-2">{t.why}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <EvidenceMark level={result.evidence} t={t} compact />
                          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                        </span>
                      </summary>
                      <div className="space-y-4 pt-2 text-sm">
                        {result.compatibility && (
                          <p className="font-medium">
                            {lang === "es" ? "Compatibilidad de cultivos" : "Crop compatibility"}:{" "}
                            {result.compatibility.evidenceState === "CONFLICTING"
                              ? lang === "es"
                                ? "Evidencia contradictoria"
                                : "Conflicting evidence"
                              : result.compatibility.status === "INSUFFICIENT"
                                ? lang === "es"
                                  ? "Evidencia insuficiente"
                                  : "Insufficient evidence"
                                : result.compatibility.status === "NO_COMMON_OPTIMUM_RANGE"
                                  ? t.noCommon
                                  : t.common}
                          </p>
                        )}
                        {result.range && (
                          <div className="grid grid-cols-2 gap-2">
                            <Stat
                              label={result.range.common ? t.range : t.noCommon}
                              value={`${fmtEc(result.range.min)}–${fmtEc(result.range.max)}`}
                            />
                            {result.target && (
                              <Stat
                                label={result.target.provenance === "user" ? t.yourTarget : t.start}
                                value={fmtEc(result.target.value)}
                              />
                            )}
                          </div>
                        )}
                        {result.range && !result.range.common && result.range.limiting && (
                          <p className="rounded-md border-l-2 border-accent bg-accent/10 p-3 text-sm">
                            {t.noCommonBody(cropName(result.range.limiting))}
                          </p>
                        )}
                        <EvidenceMark level={result.evidence} t={t} />
                        <p className="text-muted-foreground">{result.evidenceNote[lang]}</p>
                        {result.warnings?.map((message) => (
                          <p key={message} className="text-sm text-muted-foreground">
                            {message}
                          </p>
                        ))}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">{t.sources}</p>
                          <ul className="mt-1 list-inside list-disc text-muted-foreground">
                            {result.sources.map((s) => (
                              <li key={s}>
                                {calculatorSourceUrl(s) ? (
                                  <a href={calculatorSourceUrl(s)} target="_blank" rel="noreferrer">
                                    {s}
                                  </a>
                                ) : (
                                  s
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </details>
                  </div>

                  {/* Target control */}
                  {/* Learn / loop */}
                  {product.available &&
                    result.action === "add" &&
                    result.doses.some((dose) => dose.unit === "mL" && dose.amount > 0) && (
                      <LearnCard
                        key={`${sys.id}-${mode}-${round}-${unit}`}
                        t={t}
                        lang={lang}
                        unitLabel={unitLabel}
                        system={sys}
                        productId={productId}
                        recommendedDoses={result.doses}
                        learnedCount={calibrationCounts.used}
                        justLearned={justLearned}
                        requireMeasuredBaseline={mode === "recipe" || mode === "topup"}
                        onLearn={(ec, actualDoses, baseline) => {
                          const measured = Number(ec.replace(",", "."));
                          const measuredMs = unit === "uS" ? measured / 1000 : measured;
                          const observation = recordActualDoses({
                            productId,
                            customAbManufacturer,
                            customAbName,
                            customAbVersion,
                            stageId,
                            liters:
                              mode === "adjust"
                                ? (num(currentLiters) ?? NaN)
                                : mode === "topup"
                                  ? (num(currentLiters) ?? 0) + (num(waterAdded) ?? 0)
                                  : liters,
                            pods,
                            baselineEc:
                              mode === "recipe" || mode === "topup"
                                ? (num(baseline, true) ?? NaN)
                                : mode === "adjust"
                                  ? (num(currentEc, true) ?? sourceEc)
                                  : sourceEc,
                            resultingEc: measuredMs,
                            actualDoses,
                          });
                          if (!observation.ok || !observation.value) {
                            setCalibrationError(t.calibrationInvalid);
                            return;
                          }
                          saveCalibrationObservation(observation.value);
                          if (mode === "adjust") {
                            setCurrentEc(ec);
                          }
                        }}
                        onAgain={() => {
                          setRound((r) => r + 1);
                          setJustLearned(false);
                        }}
                        canLoop={mode === "adjust"}
                      />
                    )}
                  {calibrationError && (
                    <p role="alert" className="text-sm text-destructive">
                      {calibrationError}
                    </p>
                  )}
                </>
              )}
              {t.demo ? (
                <p className="text-center text-[11px] text-muted-foreground">{t.demo}</p>
              ) : null}
            </section>
          </div>
        </div>
      </main>

      <Dialog open={plantPickerOpen} onOpenChange={setPlantPickerOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-lg rounded-3xl p-4 sm:p-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="font-display text-2xl font-medium">{t.addPlant}</DialogTitle>
            <DialogDescription>{t.searchPlant}</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={plantQuery}
              onChange={(event) => setPlantQuery(event.target.value)}
              placeholder={t.searchPlant}
              className="h-11 pl-9"
            />
          </div>
          <PlantPickerResults
            lang={lang}
            query={plantQuery}
            selected={crops}
            onSelect={(id) => {
              setCrops((current) => ({ ...current, [id]: current[id] ?? 1 }));
              setPlantPickerOpen(false);
            }}
            noResults={t.noPlants}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-3xl p-5 sm:p-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="font-display text-2xl font-medium">{t.saveTitle}</DialogTitle>
            <DialogDescription>{t.saveDescription}</DialogDescription>
          </DialogHeader>
          {saveError && <p role="alert">{saveError}</p>}
          <Field
            label={t.systemName}
            value={saveName}
            onChange={setSaveName}
            placeholder={lang === "es" ? "Mi sistema" : "My system"}
            type="text"
            inputMode="text"
            autoComplete="off"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11" onClick={() => setSaveOpen(false)}>
              {t.cancel}
            </Button>
            <Button className="h-11" disabled={!saveName.trim()} onClick={saveCurrentSystem}>
              {t.saveConfirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const CalculatorPageV1 = CalculatorPage;

/* ---------------------------------------------------------------- parts */

function PlantPickerResults({
  lang,
  query,
  selected,
  onSelect,
  noResults,
}: {
  lang: Lang;
  query: string;
  selected: Record<string, number>;
  onSelect: (id: string) => void;
  noResults: string;
}) {
  const normalizedQuery = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
  const matches = CALCULATOR_PLANTS.filter((plant) => {
    if (CALCULATOR_EXCLUDED_CARNIVOROUS_IDS.has(plant.id)) return false;
    if (!normalizedQuery) return true;
    return [
      plant.id,
      plant.name.es,
      plant.name.en,
      plant.scientificName,
      plant.cultivar ?? "",
      ...plant.aliases,
    ].some((value) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  });
  const visible = normalizedQuery ? matches : matches.slice(0, 8);

  return (
    <div className="min-h-0 overflow-y-auto rounded-xl border border-border/70" role="listbox">
      {visible.length ? (
        visible.map((plant) => (
          <button
            key={plant.id}
            type="button"
            role="option"
            aria-selected={Boolean(selected[plant.id])}
            onClick={() => onSelect(plant.id)}
            className="flex w-full items-center gap-3 border-b border-border/60 px-3 py-3 text-left last:border-b-0 hover:bg-muted/40"
          >
            <span className="text-lg" aria-hidden>
              {plant.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{plant.name[lang]}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {plant.scientificName || plant.cultivar || plant.id}
              </span>
            </span>
            {selected[plant.id] ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <Plus className="h-4 w-4 shrink-0" />
            )}
          </button>
        ))
      ) : (
        <p className="p-4 text-sm text-muted-foreground">{noResults}</p>
      )}
    </div>
  );
}

function DockItem({
  active,
  onClick,
  title,
  meta,
  icon,
  learned,
  onDelete,
  deleteLabel,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  meta: string;
  icon?: React.ReactNode;
  learned?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <div
      className={cn(
        "glass-soft relative min-w-[150px] shrink-0 snap-start transition-shadow sm:min-w-[180px]",
        active && "bg-background/80 ring-2 ring-primary ring-offset-0",
      )}
    >
      <button onClick={onClick} aria-pressed={active} className="w-full px-4 py-3 pr-10 text-left">
        <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
          {icon}
          {title}
        </span>
        <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          {meta}
          {learned && <Sparkles className="h-3 w-3 text-accent" aria-label="calibrated" />}
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          aria-label={deleteLabel}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-background"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

const PROV_ICON: Record<Provenance, React.ComponentType<{ className?: string }>> = {
  official: BookOpen,
  garden: FlaskConical,
  measured: Gauge,
  user: Target,
};
function ProvenanceTag({ kind, t }: { kind: Provenance; t: Copy }) {
  const Icon = PROV_ICON[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        kind === "official"
          ? "border-primary/30 bg-primary/5"
          : kind === "user"
            ? "border-accent/60 bg-accent/10"
            : "border-border bg-background/60",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {t.prov[kind]}
    </span>
  );
}

const EV_LEVEL: Record<Evidence, number> = {
  high: 3,
  moderate: 2,
  low: 1,
  conflicting: -1,
  insufficient: 0,
};
function EvidenceMark({ level, t, compact }: { level: Evidence; t: Copy; compact?: boolean }) {
  const n = EV_LEVEL[level];
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="flex items-center gap-0.5" aria-hidden>
        {n === -1 ? (
          <>
            <span className="h-2 w-2 rounded-full bg-foreground/70" />
            <span className="h-2 w-2 rounded-full border border-foreground/70" />
            <span className="h-2 w-2 rounded-full bg-foreground/70" />
          </>
        ) : (
          [0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-2 w-2 rounded-full",
                i < n ? "bg-foreground/75" : "border border-foreground/40",
              )}
            />
          ))
        )}
      </span>
      <span className={cn("font-semibold", compact && "hidden sm:inline")}>
        {compact ? t.ev[level] : `${t.evidence}: ${t.ev[level]}`}
      </span>
    </span>
  );
}

function TargetControl({
  t,
  value,
  range,
  isUser,
  outside,
  onChange,
  onStep,
  onReset,
  unitLabel,
  fmtEc,
  step,
}: {
  t: Copy;
  value: string;
  range?: { min: number; max: number; common: boolean } | undefined;
  isUser: boolean;
  outside: boolean;
  onChange: (v: string) => void;
  onStep: (delta: number) => void;
  onReset: () => void;
  unitLabel: string;
  fmtEc: (v: number) => string;
  step: number;
}) {
  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">
          {isUser ? t.yourTarget : value ? t.start : t.targetEc}
        </p>
        {isUser && (
          <button
            onClick={onReset}
            className="text-xs font-semibold text-muted-foreground underline underline-offset-2"
          >
            {t.useSuggested}
          </button>
        )}
      </div>
      {range && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t.range}: {fmtEc(range.min)}–{fmtEc(range.max)} {unitLabel}
        </p>
      )}
      {!range && !isUser && (
        <p className="mt-2 text-xs text-muted-foreground">{t.targetManualHint}</p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label={`−${step}`}
          onClick={() => onStep(-step)}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <label className="min-w-0 flex-1 text-center">
          <span className="sr-only">{t.targetEc}</span>
          <span className="flex items-center justify-center gap-1">
            <input
              aria-label={t.targetEc}
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder="—"
              className="w-full min-w-0 bg-transparent text-center font-display text-3xl font-bold tabular-nums outline-none"
            />
            <span className="shrink-0 text-sm font-medium text-muted-foreground">{unitLabel}</span>
          </span>
        </label>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label={`+${step}`}
          onClick={() => onStep(step)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {outside && (
        <p className="mt-3 flex gap-2 rounded-md border-l-2 border-accent bg-accent/10 p-3 text-xs">
          <span aria-hidden>△</span>
          {t.outside}
        </p>
      )}
    </div>
  );
}

function CalibrationCard({
  t,
  lang,
  product,
  stageId,
  onStageChange,
  liters,
  pods,
  unit,
  unitLabel,
  onSave,
}: {
  t: Copy;
  lang: Lang;
  product: (typeof CALCULATOR_PRODUCTS)[number];
  stageId: string;
  onStageChange: (stageId: string) => void;
  liters: number;
  pods: number;
  unit: EcUnit;
  unitLabel: string;
  onSave: (
    baselineEc: number,
    resultingEc: number,
    actualDoses: Record<string, string>,
    sampleVolumeL: number,
  ) => void;
}) {
  const [sampleVolumeInput, setSampleVolumeInput] = useState(String(liters));
  const sampleVolumeL = parseDecimalInput(sampleVolumeInput) ?? 0;
  const defaults = useMemo(
    () =>
      product.basis === "pods" || product.id === "ab"
        ? []
        : manufacturerDoseDefaults({ productId: product.id, stageId, liters: sampleVolumeL, pods }),
    [product.id, product.basis, stageId, sampleVolumeL, pods],
  );
  const [baseline, setBaseline] = useState("");
  const [resulting, setResulting] = useState("");
  const [actualDoses, setActualDoses] = useState<Record<string, string>>(() =>
    Object.fromEntries(defaults.map((part) => [part.id, part.amount.toFixed(2)])),
  );
  const editedParts = useRef(new Set<string>());
  const previousRecipe = useRef(`${product.id}:${stageId}`);

  useEffect(() => {
    const recipe = `${product.id}:${stageId}`;
    if (previousRecipe.current !== recipe) {
      previousRecipe.current = recipe;
      editedParts.current.clear();
    }
    setActualDoses((current) =>
      Object.fromEntries(
        product.parts.map((part) => [
          part.id,
          editedParts.current.has(part.id)
            ? (current[part.id] ?? "")
            : (defaults.find((item) => item.id === part.id)?.amount.toFixed(2) ?? ""),
        ]),
      ),
    );
  }, [defaults, product, stageId]);

  const submit = () => {
    const before = parseDecimalInput(baseline);
    const after = parseDecimalInput(resulting);
    if (before === null || after === null || after <= before) return;
    const toMs = (value: number) => (unit === "uS" ? value / 1000 : value);
    onSave(toMs(before), toMs(after), actualDoses, sampleVolumeL);
  };

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-primary/20 bg-background/70 p-4">
      <div>
        <h3 className="font-display text-lg font-semibold">{t.calibrationTitle}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t.calibrationInstructions}</p>
      </div>
      <details className="rounded-lg border border-border/70 p-3 text-sm">
        <summary className="cursor-pointer font-medium">
          {lang === "es" ? "¿Primera calibración?" : "First calibration?"}
        </summary>
        <ol className="mt-2 list-inside list-decimal space-y-2 text-muted-foreground">
          <li>
            {lang === "es"
              ? "Anota el volumen real de la muestra y mide su EC antes de añadir nutrientes."
              : "Enter the actual sample volume and measure its EC before adding nutrients."}
          </li>
          <li>
            {lang === "es"
              ? "Añade los componentes siguiendo las instrucciones de mezcla de tu producto. Anota cuánto pusiste realmente de cada uno."
              : "Add the components following your product's mixing instructions. Record the actual amount of each one."}
          </li>
          <li>
            {lang === "es"
              ? "Mezcla, espera una lectura estable y vuelve a medir el EC. Introduce ambas lecturas y las cantidades reales abajo."
              : "Mix, wait for a stable reading and measure EC again. Enter both readings and the actual amounts below."}
          </li>
        </ol>
      </details>
      {product.recipeStages.length > 0 && (
        <label className="block text-xs text-muted-foreground">
          {product.id === "aerogarden" ? t.feedingEvent : t.calibrationStage}
          <select
            aria-label={product.id === "aerogarden" ? t.feedingEvent : t.calibrationStage}
            value={stageId}
            onChange={(event) => onStageChange(event.target.value)}
            className="mt-1 h-11 w-full rounded-md border border-input bg-background/70 px-3 text-sm text-foreground"
          >
            {product.recipeStages
              .filter(
                (stage) => product.id !== "aerogarden" || stage.feedingIndex === 1 || pods === 9,
              )
              .map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {recipeStageLabel(stage, product.id, pods, lang)}
                </option>
              ))}
          </select>
        </label>
      )}
      <Field
        label={lang === "es" ? "Volumen real de la muestra" : "Actual sample volume"}
        suffix="L"
        value={sampleVolumeInput}
        onChange={setSampleVolumeInput}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t.calibrationBaseline}
          suffix={unitLabel}
          value={baseline}
          onChange={setBaseline}
          placeholder={unit === "mS" ? "0.20" : "200"}
        />
        <Field
          label={t.calibrationAfter}
          suffix={unitLabel}
          value={resulting}
          onChange={setResulting}
          placeholder={unit === "mS" ? "1.00" : "1000"}
        />
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground">{t.actualDose}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {product.parts.map((part) => (
            <Field
              key={part.id}
              label={localizedComponent(part.label, lang)}
              suffix="mL"
              value={actualDoses[part.id] ?? ""}
              onChange={(value) => {
                editedParts.current.add(part.id);
                setActualDoses((current) => ({ ...current, [part.id]: value }));
              }}
              placeholder={defaults.find((item) => item.id === part.id)?.amount.toFixed(2) ?? "—"}
            />
          ))}
        </div>
      </div>
      <Button
        className="h-11 w-full"
        disabled={
          parseDecimalInput(baseline) === null ||
          sampleVolumeL <= 0 ||
          parseDecimalInput(resulting) === null ||
          (parseDecimalInput(resulting) ?? 0) <= (parseDecimalInput(baseline) ?? 0) ||
          product.parts.some((part) => !actualDoses[part.id])
        }
        onClick={submit}
      >
        {t.calibrationSave}
      </Button>
    </div>
  );
}

function LearnCard({
  t,
  lang,
  unitLabel,
  system,
  productId,
  recommendedDoses,
  learnedCount,
  justLearned,
  onLearn,
  requireMeasuredBaseline,
  onAgain,
  canLoop,
}: {
  t: Copy;
  lang: Lang;
  unitLabel: string;
  system: SavedSystem;
  productId: string;
  recommendedDoses: { label: string; amount: number; unit: "mL" | "L" }[];
  learnedCount: number;
  justLearned: boolean;
  onLearn: (ec: string, actualDoses: Record<string, string>, baseline: string) => void;
  requireMeasuredBaseline: boolean;
  onAgain: () => void;
  canLoop: boolean;
}) {
  const [ec, setEc] = useState("");
  const [baseline, setBaseline] = useState("");
  const [iterationClosed, setIterationClosed] = useState(false);
  const product =
    CALCULATOR_PRODUCTS.find((item) => item.id === productId) ?? CALCULATOR_PRODUCTS[0]!;
  const [actualDoses, setActualDoses] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      product.parts.map((part) => {
        const recommended = recommendedDoses.find((dose) => dose.label === part.label);
        return [part.id, recommended ? recommended.amount.toFixed(2) : ""];
      }),
    ),
  );
  useEffect(() => {
    setActualDoses(
      Object.fromEntries(
        product.parts.map((part) => {
          const recommended = recommendedDoses.find((dose) => dose.label === part.label);
          return [part.id, recommended ? recommended.amount.toFixed(2) : ""];
        }),
      ),
    );
  }, [productId, product.parts, recommendedDoses]);
  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-lg font-semibold">{t.learnTitle}</p>
        {learnedCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            {learnedCount}
          </span>
        )}
      </div>
      {justLearned ? (
        <div className="mt-3 space-y-3 animate-rise">
          <p className="flex gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            {t.learnedNew}
          </p>
          {system.calibration && (
            <p className="text-xs text-muted-foreground">{t.learned(learnedCount)}</p>
          )}
          {canLoop && !iterationClosed && (
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-11" onClick={onAgain}>
                <RefreshCw className="h-4 w-4" />
                {t.again}
              </Button>
              <Button variant="outline" className="h-11" onClick={() => setIterationClosed(true)}>
                <Check className="h-4 w-4" />
                {t.closeEnough}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{t.learnBody}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {requireMeasuredBaseline && (
              <Field
                label={t.calibrationBaseline}
                suffix={unitLabel}
                value={baseline}
                onChange={setBaseline}
                placeholder="—"
              />
            )}
            <Field label={t.gotEc} suffix={unitLabel} value={ec} onChange={setEc} placeholder="—" />
          </div>
          <p className="mt-3 text-xs font-semibold text-muted-foreground">{t.actualDose}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {product.parts.map((part) => (
              <Field
                key={part.id}
                label={localizedComponent(part.label, lang)}
                suffix="mL"
                value={actualDoses[part.id] ?? ""}
                onChange={(value) =>
                  setActualDoses((current) => ({ ...current, [part.id]: value }))
                }
                placeholder="—"
              />
            ))}
          </div>
          <Button
            className="mt-3 h-11 w-full"
            disabled={!ec || (requireMeasuredBaseline && parseDecimalInput(baseline) === null)}
            onClick={() => onLearn(ec, actualDoses, baseline)}
          >
            {t.learn} <ArrowRight className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}

function Block({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between text-sm font-semibold">
        <span>{title}</span>
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  suffix,
  value,
  onChange,
  placeholder,
  highlight,
  className,
  type = "text",
  inputMode = "decimal",
  autoComplete,
}: {
  label: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  highlight?: boolean;
  className?: string;
  type?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
}) {
  return (
    <label
      className={cn("block w-full min-w-0 max-w-full text-xs text-muted-foreground", className)}
    >
      {label}
      <span
        className={cn(
          "mt-1 flex h-12 w-full min-w-0 max-w-full items-center rounded-md border bg-background/70 px-3",
          highlight ? "border-primary/50" : "border-input",
        )}
      >
        <input
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-0 min-w-0 flex-1 bg-transparent font-display text-lg font-semibold text-foreground outline-none"
        />
        {suffix && <span className="shrink-0 text-xs">{suffix}</span>}
      </span>
    </label>
  );
}

function Chip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "h-10 min-w-0 truncate rounded-md border px-3 text-xs font-medium transition-colors sm:text-sm",
        disabled
          ? "cursor-not-allowed border-border bg-muted/50 text-muted-foreground/60"
          : active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-background/60 hover:bg-background",
      )}
    >
      {children}
    </button>
  );
}

function Stepper({
  value,
  onChange,
  large,
}: {
  value: number;
  onChange: (v: number) => void;
  large?: boolean;
}) {
  const s = large ? "h-11 w-11" : "h-8 w-8";
  return (
    <div className="flex shrink-0 items-center">
      <button
        aria-label="−"
        onClick={() => onChange(Math.max(1, value - 1))}
        className={cn("grid place-items-center", s)}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span
        className={cn(
          "text-center font-semibold tabular-nums",
          large ? "w-8 text-lg" : "w-5 text-sm",
        )}
      >
        {value}
      </span>
      <button
        aria-label="+"
        onClick={() => onChange(value + 1)}
        className={cn("grid place-items-center", s)}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/55 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}
