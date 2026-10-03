import { useEffect, useMemo, useState } from "react";
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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { donorPlants as plants } from "./canonical-adapter";
import {
  FORMULAS,
  PHASE_LABELS,
  calculatePolycultureCompromise,
  getCropProfile,
} from "./hydro-calculator.engine";
import type { FormulaId, GrowthPhase } from "./hydro-calculator.types";
import { cn } from "@/lib/utils";

type Mix = {
  id: string;
  name: string;
  crops: Record<string, number>;
  liters: number;
  formulaId: FormulaId;
  phase: GrowthPhase;
  refill: boolean;
  /** Personal calibration multiplier learned from real readings. */
  calibration: number;
  lastReading?: { ec: number; ph: number; date: string };
};

const STORAGE_KEY = "gardenpedia.calculator.systems.v1";
const LITER_CHIPS = [1, 2, 3, 4, 6.5, 10];
const PHASES: GrowthPhase[] = ["seedling", "vegetative", "flowering"];

const COPY = {
  es: {
    calculator: "Calculadora",
    library: "Library",
    seeds: "Seeds",
    machines: "Machines",
    quickMix: "Mezcla rápida",
    plantsShare: "Plantas que comparten el agua",
    plants: "plantas",
    choosePlant: "Elige una planta…",
    addPlant: "Añadir planta",
    waterLiters: "Litros de agua",
    otherLiters: "Otros litros",
    fullFill: "Llenado completo",
    refill: "Relleno (60%)",
    formulaStage: "Fórmula y etapa",
    unsaved: "Sin guardar",
    saveChanges: "Guardar cambios",
    saveAs: "Guardar como sistema",
    remove: "Eliminar",
    recommendedDose: "Dosis recomendada",
    targetEc: "EC objetivo",
    estimatedEc: "EC estimada",
    targetPh: "pH objetivo",
    mixOrder: "Orden de mezcla",
    measured: "Calculado vs. medido",
    measuredEc: "EC medida (mS/cm)",
    measuredPh: "pH medido",
    calibration: "Calibrar este sistema",
    measureHint:
      "Mide con tu lápiz de EC después de mezclar. La cifra calculada es una estimación; la medición real manda.",
    addAtLeastOne: "Añade al menos una planta para calcular.",
    namePrompt: "Nombre del sistema",
    newSystem: "H3 — Nuevo sistema",
    withinRange: "Tu medición coincide con el cálculo. No hace falta calibrar.",
    highReading: "Tu solución mide sobre lo calculado: probablemente tu agua ya trae sales.",
    lowReading: "Tu solución mide bajo lo calculado: el producto rinde menos de lo previsto.",
    phWarning: " El pH está fuera de rango: ajústalo antes de volver a medir EC.",
    empty: "Añade al menos una planta para calcular.",
    lastReading: "Última",
    calibrationApplied: "Incluye tu calibración personal",
  },
  en: {
    calculator: "Calculator",
    library: "Library",
    seeds: "Seeds",
    machines: "Machines",
    quickMix: "Quick Mix",
    plantsShare: "Plants sharing the water",
    plants: "plants",
    choosePlant: "Choose a plant…",
    addPlant: "Add plant",
    waterLiters: "Water volume",
    otherLiters: "Other liters",
    fullFill: "Full fill",
    refill: "Refill (60%)",
    formulaStage: "Formula and stage",
    unsaved: "Unsaved",
    saveChanges: "Save changes",
    saveAs: "Save as system",
    remove: "Delete",
    recommendedDose: "Recommended dose",
    targetEc: "Target EC",
    estimatedEc: "Estimated EC",
    targetPh: "Target pH",
    mixOrder: "Mixing order",
    measured: "Calculated vs. measured",
    measuredEc: "Measured EC (mS/cm)",
    measuredPh: "Measured pH",
    calibration: "Calibrate this system",
    measureHint:
      "Measure with your EC meter after mixing. The calculated value is an estimate; the real measurement wins.",
    addAtLeastOne: "Add at least one plant to calculate.",
    namePrompt: "System name",
    newSystem: "H3 — New system",
    withinRange: "Your measurement matches the calculation. No calibration is needed.",
    highReading:
      "Your solution measures above the calculation: your water may already contain salts.",
    lowReading:
      "Your solution measures below the calculation: the product performs below expectation.",
    phWarning: " pH is outside the target range: adjust it before measuring EC again.",
    empty: "Add at least one plant to calculate.",
    lastReading: "Last",
    calibrationApplied: "Includes your personal calibration",
  },
} as const;

const FORMULA_COPY: Record<
  "en" | "es",
  Record<FormulaId, { name: string; mixingSteps: string[]; criticalWarning: string }>
> = {
  es: {
    aerogarden: {
      name: "AeroGarden Liquid Nutrients",
      mixingSteps: [
        "Agita el frasco con fuerza durante 5 segundos: los micronutrientes sedimentan.",
        "Vierte la dosis directamente en el tanque con el agua ya cargada.",
        "Haz circular la bomba 2 minutos antes de colocar las canastillas.",
      ],
      criticalWarning:
        "No la combines con otras marcas: ya trae buffer de pH y mezclarla descontrola la lectura.",
    },
    ab: {
      name: "Fórmula A + B universal",
      mixingSteps: [
        "Llena el tanque con el agua a temperatura ambiente.",
        "Añade toda la Solución A y agita o deja circular 1 minuto.",
        "Solo entonces añade la Solución B y vuelve a homogeneizar.",
      ],
      criticalWarning:
        "Nunca mezcles A y B concentrados entre sí: precipita fosfato de calcio y pierdes el calcio de forma irreversible.",
    },
    flora: {
      name: "General Hydroponics FloraSeries",
      mixingSteps: [
        "Primero FloraMicro en el agua y agita bien hasta disolver por completo.",
        "Después FloraGro y vuelve a homogeneizar.",
        "Por último FloraBloom. Comprueba el pH al final de la mezcla.",
      ],
      criticalWarning:
        "El orden es obligatorio. Si FloraBloom entra antes que FloraMicro, el calcio se bloquea y aparecen sales en el fondo.",
    },
  },
  en: {
    aerogarden: {
      name: "AeroGarden Liquid Nutrients",
      mixingSteps: [
        "Shake the bottle firmly for 5 seconds: micronutrients settle.",
        "Pour the dose directly into the tank after filling it with water.",
        "Run the pump for 2 minutes before placing the baskets.",
      ],
      criticalWarning:
        "Do not combine it with other brands: it already contains a pH buffer and mixing it disrupts the reading.",
    },
    ab: {
      name: "Universal A + B formula",
      mixingSteps: [
        "Fill the tank with room-temperature water.",
        "Add all of Solution A and stir or circulate for 1 minute.",
        "Only then add Solution B and homogenize again.",
      ],
      criticalWarning:
        "Never mix concentrated A and B together: calcium phosphate precipitates and calcium is lost irreversibly.",
    },
    flora: {
      name: "General Hydroponics FloraSeries",
      mixingSteps: [
        "Add FloraMicro to the water first and stir until fully dissolved.",
        "Then add FloraGro and homogenize again.",
        "Add FloraBloom last. Check pH after mixing.",
      ],
      criticalWarning:
        "The order is mandatory. If FloraBloom enters before FloraMicro, calcium is locked out and salts form at the bottom.",
    },
  },
};

const DEMO: Mix[] = [
  {
    id: "h1",
    name: "H1 — Tomates & Albahaca",
    crops: { "cherry-tomato": 2, "genovese-basil": 3, "bibb-lettuce": 2 },
    liters: 6.5,
    formulaId: "flora",
    phase: "flowering",
    refill: false,
    calibration: 0.88,
    lastReading: { ec: 1.85, ph: 6.4, date: "28 sep" },
  },
  {
    id: "h2",
    name: "H2 — Aromáticas de cocina",
    crops: { "sweet-basil": 2, "common-mint": 2, "common-chives": 1 },
    liters: 3,
    formulaId: "ab",
    phase: "vegetative",
    refill: false,
    calibration: 1,
  },
];

const blank = (language: "en" | "es" = "es"): Mix => ({
  id: "draft",
  name: language === "en" ? "Quick Mix" : "Mezcla rápida",
  crops: { "genovese-basil": 1 },
  liters: 2,
  formulaId: "ab",
  phase: "vegetative",
  refill: false,
  calibration: 1,
});

export function CalculatorPage({ language = "es" }: { language?: "en" | "es" }) {
  const copy = COPY[language];
  const [systems, setSystems] = useState<Mix[]>(DEMO);
  const [mix, setMix] = useState<Mix>(DEMO[0]!);
  const [dirty, setDirty] = useState(false);
  const [adding, setAdding] = useState(false);
  const [ecReading, setEcReading] = useState("");
  const [phReading, setPhReading] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Mix[];
        if (saved.length) {
          setSystems(saved);
          setMix(saved[0]!);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: Mix[]) => {
    setSystems(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const update = (patch: Partial<Mix>) => {
    setMix((m) => ({ ...m, ...patch }));
    setDirty(true);
  };

  const open = (m: Mix) => {
    setMix(m);
    setDirty(false);
    setEcReading("");
    setPhReading("");
  };

  const ids = Object.keys(mix.crops);
  const expanded = ids.flatMap((id) => Array(mix.crops[id]).fill(id) as string[]);
  const totalPlants = expanded.length;
  const plantById = useMemo(() => new Map(plants.map((plant) => [plant.id, plant])), []);

  const result = useMemo(() => {
    if (!ids.length) return null;
    const base = calculatePolycultureCompromise({
      plantIds: expanded,
      formulaId: mix.formulaId,
      phase: mix.phase,
      liters: mix.liters,
    });
    const factor = (mix.refill ? 0.6 : 1) * mix.calibration;
    return {
      ...base,
      parts: base.parts.map((p) => ({ ...p, ml: Math.round(p.ml * factor * 10) / 10 })),
      estimatedEc: Math.round(base.estimatedEc * (mix.refill ? 0.6 : 1) * 100) / 100,
    };
  }, [mix, expanded.join(","), ids.length]);

  const formulaCopy = FORMULA_COPY[language][mix.formulaId];
  const isSaved = mix.id !== "draft";

  const save = () => {
    if (isSaved) {
      persist(systems.map((s) => (s.id === mix.id ? mix : s)));
    } else {
      const name = window.prompt(copy.namePrompt, copy.newSystem)?.trim();
      if (!name) return;
      const created = { ...mix, id: `s${Date.now()}`, name };
      persist([...systems, created]);
      setMix(created);
    }
    setDirty(false);
  };

  const removeSystem = () => {
    if (!isSaved) return;
    const next = systems.filter((s) => s.id !== mix.id);
    persist(next);
    open(next[0] ?? blank(language));
  };

  const ec = Number(ecReading.replace(",", "."));
  const ph = Number(phReading.replace(",", "."));
  const hasReading = ecReading !== "" && ec > 0;
  const delta = hasReading && result ? ec - result.estimatedEc : 0;
  const suggestedCalibration =
    hasReading && result && ec > 0
      ? Math.min(
          1.3,
          Math.max(0.6, Math.round(mix.calibration * (result.estimatedEc / ec) * 100) / 100),
        )
      : mix.calibration;

  const applyCalibration = () => {
    const next = {
      ...mix,
      calibration: suggestedCalibration,
      lastReading: {
        ec,
        ph: ph || 0,
        date: new Date().toLocaleDateString(language, { day: "numeric", month: "short" }),
      },
    };
    setMix(next);
    if (isSaved) persist(systems.map((s) => (s.id === next.id ? next : s)));
    else setDirty(true);
  };

  return (
    <div className="min-w-0 max-w-full px-1 py-2 sm:px-0 sm:py-0">
      <div className="mx-auto min-w-0 max-w-6xl">
        {/* Dock */}
        <section
          aria-label="Sistemas guardados"
          className="mt-5 flex min-w-0 max-w-full gap-2 overflow-x-auto px-2 py-2 [scroll-padding-inline:0.5rem]"
        >
          <button
            onClick={() => open(blank(language))}
            className={cn(
              "glass-soft flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold",
              mix.id === "draft" && "ring-2 ring-inset ring-primary",
            )}
          >
            <Plus className="h-4 w-4" /> {copy.quickMix}
          </button>
          {systems.map((s) => {
            const n = Object.values(s.crops).reduce((a, b) => a + b, 0);
            return (
              <button
                key={s.id}
                onClick={() => open(s)}
                className={cn(
                  "glass-soft min-w-[190px] shrink-0 px-4 py-3 text-left",
                  mix.id === s.id && "ring-2 ring-inset ring-primary",
                )}
              >
                <span className="block truncate text-sm font-semibold">{s.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {s.liters} L · {n} {copy.plants} ·{" "}
                  {s.formulaId === "aerogarden"
                    ? "AeroGarden"
                    : s.formulaId === "ab"
                      ? "A + B"
                      : "GH Flora"}
                </span>
              </button>
            );
          })}
        </section>

        {/* Workbench */}
        <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">
          <section className="glass-panel min-w-0 space-y-6 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Input
                aria-label={copy.quickMix}
                value={mix.name}
                onChange={(e) => update({ name: e.target.value })}
                className="h-10 min-w-0 border-transparent bg-transparent px-0 font-display text-lg font-bold shadow-none focus-visible:ring-0"
              />
              {dirty && (
                <span className="shrink-0 text-xs text-muted-foreground">{copy.unsaved}</span>
              )}
            </div>

            <Block
              icon={<Leaf className="h-4 w-4" />}
              title={copy.plantsShare}
              hint={`${totalPlants} ${copy.plants}`}
            >
              <ul className="space-y-2">
                {ids.map((id) => {
                  const prof = getCropProfile(id);
                  const limiting = result?.limitingCrop?.id === id && ids.length > 1;
                  return (
                    <li key={id} className="glass-card flex items-center gap-3 px-3 py-2">
                      <span className="text-lg">{prof.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {language === "en"
                            ? (plantById.get(id)?.name ?? prof.spanishName)
                            : prof.spanishName}
                        </p>
                        <p
                          className={cn(
                            "text-xs text-muted-foreground",
                            limiting && "font-semibold text-accent-foreground",
                          )}
                        >
                          EC {prof.ecMin}–{prof.ecMax}
                          {limiting &&
                            (language === "en" ? " · sets the limit" : " · marca el límite")}
                        </p>
                      </div>
                      <Stepper
                        value={mix.crops[id]!}
                        onChange={(v) => update({ crops: { ...mix.crops, [id]: v } })}
                      />
                      <button
                        aria-label={`${language === "en" ? "Remove" : "Quitar"} ${language === "en" ? (plantById.get(id)?.name ?? prof.spanishName) : prof.spanishName}`}
                        onClick={() => {
                          const { [id]: _, ...rest } = mix.crops;
                          update({ crops: rest });
                        }}
                        className="grid h-9 w-9 place-items-center text-muted-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {adding ? (
                <select
                  autoFocus
                  className="mt-2 h-11 w-full rounded-md border border-input bg-background/70 px-3 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) update({ crops: { ...mix.crops, [e.target.value]: 1 } });
                    setAdding(false);
                  }}
                  onBlur={() => setAdding(false)}
                >
                  <option value="" disabled>
                    {copy.choosePlant}
                  </option>
                  {plants
                    .filter((p) => !mix.crops[p.id])
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.emoji} {language === "en" ? p.name : p.spanishName}
                      </option>
                    ))}
                </select>
              ) : (
                <Button
                  variant="outline"
                  className="mt-2 h-11 w-full"
                  onClick={() => setAdding(true)}
                >
                  <Plus className="h-4 w-4" /> {copy.addPlant}
                </Button>
              )}
            </Block>

            <Block icon={<Gauge className="h-4 w-4" />} title={copy.waterLiters}>
              <div className="flex flex-wrap gap-2">
                {LITER_CHIPS.map((l) => (
                  <Chip key={l} active={mix.liters === l} onClick={() => update({ liters: l })}>
                    {l} L
                  </Chip>
                ))}
                <Input
                  type="number"
                  min={0.5}
                  step={0.5}
                  aria-label={copy.otherLiters}
                  value={mix.liters}
                  onChange={(e) => update({ liters: Math.max(0.1, Number(e.target.value) || 0.1) })}
                  className="h-10 w-20"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <Chip active={!mix.refill} onClick={() => update({ refill: false })}>
                  {copy.fullFill}
                </Chip>
                <Chip active={mix.refill} onClick={() => update({ refill: true })}>
                  {copy.refill}
                </Chip>
              </div>
            </Block>

            <Block icon={<Sliders className="h-4 w-4" />} title={copy.formulaStage}>
              <div className="grid grid-cols-3 gap-2">
                {FORMULAS.map((f) => (
                  <Chip
                    key={f.id}
                    active={mix.formulaId === f.id}
                    onClick={() => update({ formulaId: f.id })}
                  >
                    {f.id === "aerogarden" ? "AeroGarden" : f.id === "ab" ? "A + B" : "GH Flora"}
                  </Chip>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {PHASES.map((p) => (
                  <Chip key={p} active={mix.phase === p} onClick={() => update({ phase: p })}>
                    {language === "en"
                      ? { seedling: "Seedling", vegetative: "Vegetative", flowering: "Flowering" }[
                          p
                        ]
                      : PHASE_LABELS[p].split(" ")[0]}
                  </Chip>
                ))}
              </div>
            </Block>

            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={isSaved && !dirty} className="h-11 flex-1">
                <Save className="h-4 w-4" /> {isSaved ? copy.saveChanges : copy.saveAs}
              </Button>
              {isSaved && (
                <Button variant="ghost" className="h-11" onClick={removeSystem}>
                  {copy.remove}
                </Button>
              )}
            </div>
          </section>

          <section className="min-w-0 space-y-5">
            {result ? (
              <>
                <div className="glass-panel p-5 sm:p-6">
                  <p className="eyebrow">
                    {copy.recommendedDose} · {mix.liters} L
                  </p>
                  <ul className="mt-4 space-y-3">
                    {result.parts.map((p) => (
                      <li key={p.partId} className="flex items-baseline justify-between gap-3">
                        <span className="text-sm">{p.label}</span>
                        <span className="font-display text-3xl font-bold tabular-nums">
                          {p.ml}
                          <span className="ml-1 text-sm font-medium text-muted-foreground">mL</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {mix.calibration !== 1 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {copy.calibrationApplied} ({Math.round((mix.calibration - 1) * 100)}%).
                    </p>
                  )}
                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    <Stat
                      label={copy.targetEc}
                      value={`${result.targetEc.min}–${result.targetEc.max}`}
                    />
                    <Stat label={copy.estimatedEc} value={`${result.estimatedEc}`} />
                    <Stat
                      label={copy.targetPh}
                      value={`${result.targetPh.min}–${result.targetPh.max}`}
                    />
                  </div>
                  {result.status !== "ok" && (
                    <div className="mt-4 flex gap-2 rounded-lg bg-accent/30 p-3 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        {language === "en"
                          ? "The dose was adjusted to the supported crop range for this mix."
                          : result.diagnosis}
                      </p>
                    </div>
                  )}
                </div>

                <div className="glass-panel p-5 sm:p-6">
                  <p className="eyebrow">
                    {copy.mixOrder} · {formulaCopy.name}
                  </p>
                  <ol className="mt-3 space-y-2 text-sm">
                    {formulaCopy.mixingSteps.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{s}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-xs text-muted-foreground">
                    ⚠️ {formulaCopy.criticalWarning}
                  </p>
                </div>

                <div className="glass-panel p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="eyebrow">{copy.measured}</p>
                    {mix.lastReading && (
                      <span className="text-xs text-muted-foreground">
                        {copy.lastReading}: EC {mix.lastReading.ec} · {mix.lastReading.date}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="text-xs text-muted-foreground">
                      {copy.measuredEc}
                      <Input
                        inputMode="decimal"
                        value={ecReading}
                        onChange={(e) => setEcReading(e.target.value)}
                        placeholder={`${result.estimatedEc}`}
                        className="mt-1 h-11"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      {copy.measuredPh}
                      <Input
                        inputMode="decimal"
                        value={phReading}
                        onChange={(e) => setPhReading(e.target.value)}
                        placeholder="6.0"
                        className="mt-1 h-11"
                      />
                    </label>
                  </div>
                  {hasReading ? (
                    <div className="mt-4 space-y-3 text-sm">
                      <p>
                        {Math.abs(delta) < 0.1
                          ? copy.withinRange
                          : delta > 0
                            ? `${language === "en" ? `Your solution measures +${delta.toFixed(2)} mS/cm above the calculation:` : `Tu solución mide +${delta.toFixed(2)} mS/cm sobre lo calculado:`} ${copy.highReading}`
                            : `${language === "en" ? `Your solution measures ${delta.toFixed(2)} mS/cm below the calculation:` : `Tu solución mide ${delta.toFixed(2)} mS/cm bajo lo calculado:`} ${copy.lowReading}`}
                        {ph > 0 &&
                          (ph < result.targetPh.min || ph > result.targetPh.max) &&
                          copy.phWarning}
                      </p>
                      {Math.abs(delta) >= 0.1 && (
                        <Button
                          variant="outline"
                          className="h-11 w-full"
                          onClick={applyCalibration}
                        >
                          <Check className="h-4 w-4" /> {copy.calibration} (
                          {Math.round((suggestedCalibration - 1) * 100)}%)
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">{copy.measureHint}</p>
                  )}
                </div>
              </>
            ) : (
              <div className="glass-panel grid place-items-center p-10 text-center text-sm text-muted-foreground">
                <Sprout className="mb-2 h-6 w-6" /> {copy.empty}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Block({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon} <span className="flex-1">{title}</span>
        {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
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
      className={cn(
        "h-10 rounded-md border px-3 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background/60 hover:bg-background",
      )}
    >
      {children}
    </button>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex shrink-0 items-center">
      <button
        aria-label="Menos"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="grid h-9 w-8 place-items-center"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-5 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        aria-label="Más"
        onClick={() => onChange(value + 1)}
        className="grid h-9 w-8 place-items-center"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card px-2 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}
