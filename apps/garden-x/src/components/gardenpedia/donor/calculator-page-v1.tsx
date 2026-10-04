import { useCallback, useEffect, useMemo, useState } from "react";
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
  Sparkles,
  Target,
  Waves,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  calculateGardenResult,
  DEMO_CROPS,
  DEMO_PRODUCTS,
  DEMO_STAGES,
  DEMO_SYSTEMS,
  recordActualDoses,
  type CalcResult,
  type EcUnit,
  type Evidence,
  type Intensity,
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
    pods: "Pods activos",
    product: "Nutriente",
    stage: "Etapa de la receta",
    intensity: "Intensidad",
    intensities: { light: "Suave", medium: "Media", aggressive: "Intensa" },
    currentEc: "EC que mediste",
    currentLiters: "Litros que quedan",
    waterAdded: "Agua añadida",
    more: "Más ajustes",
    unit: "Unidad EC",
    sourceEc: "EC del agua de origen",
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
    waitNote: "El tiempo exacto lo indicará el fabricante o Garden.",
    expect: "Deberías ver cerca de",
    why: "Por qué y de dónde sale",
    range: "Rango óptimo reportado",
    start: "Punto de partida sugerido",
    common: "Rango común",
    noCommon: "Sin rango óptimo común",
    noCommonBody: (p: string) =>
      `${p} tiene el rango óptimo de EC reportado más bajo, así que Garden propone un compromiso operativo cerca de ese rango. No significa que las plantas sean incompatibles.`,
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
      waterAdded: "cuánta agua añadiste",
    },
    learnTitle: "¿Qué obtuviste?",
    learnBody:
      "Cuéntale a Garden lo que mediste y lo que añadiste de verdad. Así afina este sistema.",
    gotEc: "EC medido",
    gotMl: "mL que añadiste",
    learn: "Guardar lectura",
    learned: (n: number) => `Garden ajustó este sistema · ${n} lecturas`,
    learnedNew: "Lectura guardada. La próxima dosis será más precisa para tu producto y tu agua.",
    round: "Ronda",
    again: "Medir otra vez",
    closeEnough: "Listo, en rango",
    calib: (p: number) => `Calibración personal ${p > 0 ? "+" : ""}${p}%`,
    demo: "",
    save: "Guardar como sistema",
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
    pods: "Active pods",
    product: "Nutrient",
    stage: "Recipe stage",
    intensity: "Intensity",
    intensities: { light: "Light", medium: "Medium", aggressive: "Aggressive" },
    currentEc: "EC you measured",
    currentLiters: "Liters remaining",
    waterAdded: "Water added",
    more: "More settings",
    unit: "EC unit",
    sourceEc: "Source-water EC",
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
    waitNote: "Exact timing will come from the manufacturer or Garden.",
    expect: "You should see about",
    why: "Why, and where it comes from",
    range: "Reported optimum range",
    start: "Suggested starting point",
    common: "Common range",
    noCommon: "No common optimum range",
    noCommonBody: (p: string) =>
      `${p} has the lower reported optimum EC range, so Garden offers an operational compromise near it. This does not mean the plants are incompatible.`,
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
      waterAdded: "how much water you added",
    },
    learnTitle: "What did you get?",
    learnBody: "Tell Garden what you measured and actually added. It tunes this system.",
    gotEc: "Measured EC",
    gotMl: "mL you added",
    learn: "Save reading",
    learned: (n: number) => `Garden tuned this system · ${n} readings`,
    learnedNew: "Reading saved. Next dose will be more accurate for your product and water.",
    round: "Round",
    again: "Measure again",
    closeEnough: "Done, in range",
    calib: (p: number) => `Personal calibration ${p > 0 ? "+" : ""}${p}%`,
    demo: "",
    save: "Save as system",
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

const QUICK: SavedSystem = {
  id: "quick",
  name: "",
  crops: { "genovese-basil": 2 },
  liters: 4,
  productId: "custom-ab",
  water: { label: { es: "Grifo", en: "Tap" }, ec: 0.3 },
  meter: "—",
};

/* ---------------------------------------------------------------- page */

export function CalculatorPage({ language = "es" }: { language?: Lang }) {
  const [lang, setLang] = useState<Lang>(language);
  useEffect(() => setLang(language), [language]);
  const t = T[lang];
  const [sys, setSys] = useState<SavedSystem>(QUICK);
  const [mode, setMode] = useState<Mode>("recipe");
  const [crops, setCrops] = useState(sys.crops);
  const [liters, setLiters] = useState(sys.liters);
  const [productId, setProductId] = useState(sys.productId);
  const [stageId, setStageId] = useState("w3");
  const [intensity, setIntensity] = useState<Intensity>("medium");
  const [pods, setPods] = useState(6);
  const [unit, setUnit] = useState<EcUnit>("mS");
  const [sourceEc, setSourceEc] = useState(sys.water.ec);
  const [currentEc, setCurrentEc] = useState<string>("");
  const [currentLiters, setCurrentLiters] = useState<string>("");
  const [waterAdded, setWaterAdded] = useState<string>("");
  const [userTarget, setUserTarget] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [learnedCount, setLearnedCount] = useState(sys.calibration?.readings ?? 0);
  const [justLearned, setJustLearned] = useState(false);
  const [calibrationObservations, setCalibrationObservations] = useState<
    import("@/lib/garden-nutrient-engine-v1").CalibrationObservation[]
  >([]);

  const product = DEMO_PRODUCTS.find((p) => p.id === productId)!;

  const pick = (s: SavedSystem) => {
    setSys(s);
    setCrops(s.crops);
    setLiters(s.liters);
    setProductId(s.productId);
    setSourceEc(s.water.ec);
    setUserTarget(null);
    setCurrentEc("");
    setCurrentLiters("");
    setWaterAdded("");
    setRound(1);
    setLearnedCount(s.calibration?.readings ?? 0);
    setJustLearned(false);
  };
  const changeMode = (m: Mode) => {
    setMode(m);
    setRound(1);
    setJustLearned(false);
  };

  const num = useCallback(
    (s: string) => {
      if (s.trim() === "") return null;
      const n = Number(s.replace(",", "."));
      if (!Number.isFinite(n)) return null;
      return unit === "uS" && s === currentEc ? n / 1000 : n;
    },
    [unit, currentEc],
  );

  const result = useMemo<CalcResult>(
    () =>
      calculateGardenResult({
        mode,
        crops,
        liters,
        productId,
        stageId,
        intensity,
        pods,
        sourceEc,
        currentEc: num(currentEc),
        currentLiters: num(currentLiters),
        waterAdded: num(waterAdded),
        userTarget,
        round,
        calibrationObservations,
      }),
    [
      mode,
      crops,
      liters,
      productId,
      stageId,
      intensity,
      pods,
      sourceEc,
      currentEc,
      currentLiters,
      waterAdded,
      userTarget,
      round,
      calibrationObservations,
      num,
    ],
  );

  const fmtEc = (v: number) => (unit === "mS" ? v.toFixed(2) : String(Math.round(v * 1000)));
  const unitLabel = unit === "mS" ? "mS/cm" : "µS/cm";
  const cropName = (id: string) => DEMO_CROPS.find((c) => c.id === id)?.name[lang] ?? id;

  return (
    <main className="min-h-screen px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Dock */}
        <section aria-label={t.systems} className="mt-5">
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
            {DEMO_SYSTEMS.map((s) => {
              const n = Object.values(s.crops).reduce((a, b) => a + b, 0);
              const p = DEMO_PRODUCTS.find((x) => x.id === s.productId)!;
              return (
                <DockItem
                  key={s.id}
                  active={sys.id === s.id}
                  onClick={() => pick(s)}
                  title={s.name}
                  meta={`${s.liters} L · ${n} · ${p.name.split(" ")[0]}`}
                  learned={!!s.calibration}
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
        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="glass-panel space-y-6 p-5 sm:p-6" aria-label="Workbench">
            {(mode === "adjust" || mode === "topup") && (
              <div className="grid gap-3 sm:grid-cols-3">
                {mode === "topup" && (
                  <Field
                    label={t.currentLiters}
                    suffix="L"
                    value={currentLiters}
                    onChange={setCurrentLiters}
                    placeholder="3.0"
                  />
                )}
                {mode === "topup" && (
                  <Field
                    label={t.waterAdded}
                    suffix="L"
                    value={waterAdded}
                    onChange={setWaterAdded}
                    placeholder="3.5"
                  />
                )}
                <Field
                  label={t.currentEc}
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
              </div>
            )}

            {mode !== "recipe" || product.basis === "liters" ? (
              <Block title={t.plants} hint={`${Object.values(crops).reduce((a, b) => a + b, 0)}`}>
                <ul className="space-y-1.5">
                  {Object.keys(crops).map((id) => {
                    const c = DEMO_CROPS.find((x) => x.id === id)!;
                    return (
                      <li
                        key={id}
                        className="flex items-center gap-3 rounded-md bg-background/50 px-3 py-1.5"
                      >
                        <span className="text-lg" aria-hidden>
                          {c.emoji}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {c.name[lang]}
                        </span>
                        <Stepper
                          value={crops[id]!}
                          onChange={(v) => setCrops({ ...crops, [id]: v })}
                        />
                        <button
                          aria-label="Quitar"
                          onClick={() => {
                            const { [id]: _, ...r } = crops;
                            setCrops(r);
                          }}
                          className="grid h-8 w-8 place-items-center text-muted-foreground"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DEMO_CROPS.filter((c) => !crops[c.id]).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCrops({ ...crops, [c.id]: 1 })}
                      className="flex h-9 items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-xs font-medium text-muted-foreground hover:bg-background/60"
                    >
                      <Plus className="h-3 w-3" /> {c.emoji} {c.name[lang]}
                    </button>
                  ))}
                </div>
              </Block>
            ) : null}

            <Block title={t.product}>
              <div className="grid grid-cols-3 gap-1.5">
                {DEMO_PRODUCTS.map((p) => (
                  <Chip key={p.id} active={productId === p.id} onClick={() => setProductId(p.id)}>
                    {p.name.split(" (")[0]!.replace("Liquid Plant Food", "")}
                  </Chip>
                ))}
              </div>
              {mode === "recipe" && product.hasRecipeStages && (
                <div className="mt-3 space-y-2">
                  <select
                    aria-label={t.stage}
                    value={stageId}
                    onChange={(e) => setStageId(e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background/70 px-3 text-sm"
                  >
                    {DEMO_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label[lang]}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["light", "medium", "aggressive"] as Intensity[]).map((k) => (
                      <Chip key={k} active={intensity === k} onClick={() => setIntensity(k)}>
                        {t.intensities[k]}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </Block>

            {mode === "recipe" && product.basis === "pods" ? (
              <Block title={t.pods}>
                <div className="flex items-center gap-3">
                  <Stepper value={pods} onChange={setPods} large />
                  <span className="text-sm text-muted-foreground">pods</span>
                </div>
              </Block>
            ) : mode !== "topup" ? (
              <Block title={t.volume}>
                <div className="flex flex-wrap gap-1.5">
                  {LITERS.map((l) => (
                    <Chip key={l} active={liters === l} onClick={() => setLiters(l)}>
                      {l} L
                    </Chip>
                  ))}
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0.5}
                    step={0.5}
                    aria-label={t.volume}
                    value={liters}
                    onChange={(e) => setLiters(Math.max(0.1, Number(e.target.value) || 0.1))}
                    className="h-10 w-20"
                  />
                </div>
              </Block>
            ) : null}

            <details className="group rounded-md border border-border/70 bg-background/30">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
                {t.more}
                <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                  {unitLabel} · {sys.water.label[lang]} {fmtEc(sourceEc)}
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <div className="grid gap-4 border-t border-border/70 p-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">{t.unit}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Chip active={unit === "mS"} onClick={() => setUnit("mS")}>
                      mS/cm
                    </Chip>
                    <Chip active={unit === "uS"} onClick={() => setUnit("uS")}>
                      µS/cm
                    </Chip>
                  </div>
                </div>
                <Field
                  label={t.sourceEc}
                  suffix="mS/cm"
                  value={String(sourceEc)}
                  onChange={(v) => setSourceEc(Number(v.replace(",", ".")) || 0)}
                />
                <div className="text-sm">
                  <p className="text-xs text-muted-foreground">{t.meter}</p>
                  <p className="mt-1 font-medium">{sys.meter}</p>
                </div>
                <div className="text-sm">
                  <p className="text-xs text-muted-foreground">{t.dosing}</p>
                  <p className="mt-1 font-medium">{t.syringe}</p>
                </div>
              </div>
            </details>

            {sys.id === "quick" && (
              <Button variant="outline" className="h-11 w-full">
                {t.save}
              </Button>
            )}

            {mode === "target" && result.kind === "ok" && result.target && (
              <TargetControl
                t={t}
                unitLabel={unitLabel}
                fmtEc={fmtEc}
                value={result.target.value}
                isUser={result.target.provenance === "user"}
                outside={!!result.outsideEvidence}
                onChange={(v) => setUserTarget(v)}
                onReset={() => setUserTarget(null)}
              />
            )}
          </section>

          {/* Result */}
          <section className="space-y-4" aria-live="polite">
            {result.kind === "needs" ? (
              <div className="glass-panel p-6">
                <p className="eyebrow">{t.now}</p>
                <p className="mt-3 font-display text-xl font-semibold">{t.needs}</p>
                {result.message ? (
                  <p className="mt-3 text-sm text-muted-foreground">{result.message}</p>
                ) : null}
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
                      <p className="mt-4 text-xs font-semibold text-muted-foreground">{t.order}</p>
                      <ol className="mt-2 divide-y divide-border/70">
                        {result.doses.map((d, i) => (
                          <li key={d.label} className="flex items-center gap-3 py-3">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-primary/40 text-xs font-bold">
                              {i + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {d.label}
                            </span>
                            <span className="font-display text-3xl font-bold tabular-nums">
                              {d.amount}
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
                        {t.expect}{" "}
                        <strong className="font-display tabular-nums">
                          {fmtEc(result.expectedEc)} {unitLabel}
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
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">{t.sources}</p>
                        <ul className="mt-1 list-inside list-disc text-muted-foreground">
                          {result.sources.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </details>
                </div>

                {/* Target control */}
                {mode !== "recipe" && mode !== "target" && result.target && (
                  <TargetControl
                    t={t}
                    unitLabel={unitLabel}
                    fmtEc={fmtEc}
                    value={result.target.value}
                    isUser={result.target.provenance === "user"}
                    outside={!!result.outsideEvidence}
                    onChange={(v) => setUserTarget(v)}
                    onReset={() => setUserTarget(null)}
                  />
                )}

                {/* Learn / loop */}
                <LearnCard
                  key={`${sys.id}-${mode}-${round}`}
                  t={t}
                  unitLabel={unitLabel}
                  system={sys}
                  productId={productId}
                  recommendedDoses={result.doses}
                  learnedCount={learnedCount}
                  justLearned={justLearned}
                  onLearn={(ec, actualDoses) => {
                    const measured = Number(ec.replace(",", "."));
                    const measuredMs = unit === "uS" ? measured / 1000 : measured;
                    const observation = recordActualDoses({
                      productId,
                      stageId,
                      liters,
                      pods,
                      baselineEc: sourceEc,
                      resultingEc: measuredMs,
                      actualDoses,
                    });
                    if (!observation.ok || !observation.value) return;
                    setCalibrationObservations((items) => [...items, observation.value!]);
                    setLearnedCount((n) => n + 1);
                    setJustLearned(true);
                    if (mode === "adjust") {
                      setCurrentEc(ec);
                    }
                  }}
                  onAgain={() => {
                    setRound((r) => r + 1);
                    setJustLearned(false);
                  }}
                  canLoop={mode === "adjust" && result.action !== "hold"}
                />
              </>
            )}
            {t.demo ? (
              <p className="text-center text-[11px] text-muted-foreground">{t.demo}</p>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

export const CalculatorPageV1 = CalculatorPage;

/* ---------------------------------------------------------------- parts */

function DockItem({
  active,
  onClick,
  title,
  meta,
  icon,
  learned,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  meta: string;
  icon?: React.ReactNode;
  learned?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "glass-soft relative min-w-[150px] shrink-0 snap-start px-4 py-3 text-left transition-shadow sm:min-w-[180px]",
        active && "bg-background/80 ring-2 ring-primary ring-offset-0",
      )}
    >
      <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
        {icon}
        {title}
      </span>
      <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        {meta}
        {learned && <Sparkles className="h-3 w-3 text-accent" aria-label="calibrated" />}
      </span>
    </button>
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
  isUser,
  outside,
  onChange,
  onReset,
  unitLabel,
  fmtEc,
}: {
  t: Copy;
  value: number;
  isUser: boolean;
  outside: boolean;
  onChange: (v: number) => void;
  onReset: () => void;
  unitLabel: string;
  fmtEc: (v: number) => string;
}) {
  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{isUser ? t.yourTarget : t.start}</p>
        {isUser && (
          <button
            onClick={onReset}
            className="text-xs font-semibold text-muted-foreground underline underline-offset-2"
          >
            {t.useSuggested}
          </button>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label="−0.1"
          onClick={() => onChange(Math.max(0.1, Math.round((value - 0.1) * 10) / 10))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <p className="flex-1 text-center font-display text-3xl font-bold tabular-nums">
          {fmtEc(value)}
          <span className="ml-1 text-sm font-medium text-muted-foreground">{unitLabel}</span>
        </p>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 shrink-0"
          aria-label="+0.1"
          onClick={() => onChange(Math.round((value + 0.1) * 10) / 10)}
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

function LearnCard({
  t,
  unitLabel,
  system,
  productId,
  recommendedDoses,
  learnedCount,
  justLearned,
  onLearn,
  onAgain,
  canLoop,
}: {
  t: Copy;
  unitLabel: string;
  system: SavedSystem;
  productId: string;
  recommendedDoses: { label: string; amount: number; unit: "mL" | "L" }[];
  learnedCount: number;
  justLearned: boolean;
  onLearn: (ec: string, actualDoses: Record<string, string>) => void;
  onAgain: () => void;
  canLoop: boolean;
}) {
  const [ec, setEc] = useState("");
  const product = DEMO_PRODUCTS.find((item) => item.id === productId) ?? DEMO_PRODUCTS[0]!;
  const [actualDoses, setActualDoses] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      product.parts.map((part) => {
        const recommended = recommendedDoses.find((dose) => dose.label === part.label);
        return [part.id, recommended ? String(recommended.amount) : ""];
      }),
    ),
  );
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
            <p className="text-xs text-muted-foreground">
              {t.calib(system.calibration.learned)} · {t.learned(learnedCount)}
            </p>
          )}
          {canLoop && (
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-11" onClick={onAgain}>
                <RefreshCw className="h-4 w-4" />
                {t.again}
              </Button>
              <Button variant="outline" className="h-11">
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
            <Field label={t.gotEc} suffix={unitLabel} value={ec} onChange={setEc} placeholder="—" />
          </div>
          <p className="mt-3 text-xs font-semibold text-muted-foreground">{t.actualDose}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {product.parts.map((part) => (
              <Field
                key={part.id}
                label={part.label}
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
            disabled={!ec}
            onClick={() => onLearn(ec, actualDoses)}
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
}: {
  label: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("block text-xs text-muted-foreground", className)}>
      {label}
      <span
        className={cn(
          "mt-1 flex h-12 items-center rounded-md border bg-background/70 px-3",
          highlight ? "border-primary/50" : "border-input",
        )}
      >
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent font-display text-lg font-semibold text-foreground outline-none"
        />
        {suffix && <span className="shrink-0 text-xs">{suffix}</span>}
      </span>
    </label>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-10 min-w-0 truncate rounded-md border px-3 text-xs font-medium transition-colors sm:text-sm",
        active
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
