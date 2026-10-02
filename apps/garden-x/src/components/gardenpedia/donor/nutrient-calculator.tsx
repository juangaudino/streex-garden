import { useMemo, useState } from "react";
import { AlertTriangle, Beaker, Droplets, Info, Minus, Plus, X } from "lucide-react";
import { donorPlants as plantList } from "./canonical-adapter";

import { Input } from "@/components/ui/input";
import {
  FORMULAS,
  VOLUME_PRESETS,
  calculatePolycultureCompromise,
  calculateSingleCropDose,
  getFormula,
} from "./hydro-calculator.engine";
import type { FormulaId, GrowthPhase } from "./hydro-calculator.types";
import { cn } from "@/lib/utils";

const PHASES: GrowthPhase[] = ["seedling", "vegetative", "flowering"];

interface NutrientCalculatorProps {
  /** One plant id = single-crop mode. Several = shared-tank balancing. */
  plantIds: string[];
  defaultLiters: number;
  defaultPhase?: GrowthPhase;
  /** Tank mode adds the full-fill vs maintenance-refill switch. */
  variant?: "crop" | "tank";
  eyebrow?: string;
  title?: string;
  description?: string;
  language?: "en" | "es";
}

const CALCULATOR_COPY = {
  es: {
    eyebrow: "Herramienta de cultivo",
    title: "Calculadora de mezcla nutritiva",
    crops: "¿Qué plantas comparten el agua?",
    addCrop: "+ Agregar planta…",
    addAtLeastOne: "Añade al menos una planta para calcular.",
    removeOne: (name: string) => `Quitar una ${name}`,
    addOne: (name: string) => `Añadir una ${name}`,
    remove: (name: string) => `Eliminar ${name}`,
    plant: "planta",
    plants: "plantas",
    variety: "variedad",
    varieties: "variedades",
    balancedMix: "se calcula una mezcla equilibrada",
    formula: "¿Qué fórmula tienes en casa?",
    singleFormula: "Fórmula única",
    components: (count: number) => `${count} componentes`,
    phase: "Fase del cultivo",
    volume: "Litros de agua disponibles",
    loadType: "Tipo de carga",
    refillLiters: "Litros a reponer",
    fullFill: (liters: number) => `Llenado completo · ${liters} L`,
    fullFillHint: "Tanque vaciado y agua limpia",
    maintenanceRefill: "Relleno de mantenimiento",
    maintenanceRefillHint: "Reposición por evaporación, dosis suave",
    other: "Otro",
    doseFor: (liters: number) => `Dosis para ${liters} L`,
    protectedBalance: "Equilibrio protegido",
    adjustedDose: "Dosis ajustada",
    inRange: "Dentro de rango",
    estimatedEc: "EC estimada",
    targetEc: "EC objetivo",
    targetPh: "pH objetivo",
    mixOrder: "Orden de mezcla del fabricante",
    criticalWarning: "Advertencia crítica:",
    domesticAdaptation:
      "Las dosis son una adaptación doméstica de las tablas publicadas por cada fabricante. Verifica siempre con tu medidor de EC y ajusta el pH al final de la mezcla.",
    refillNote:
      "El relleno lleva un 40% menos de concentrado: el agua que se evapora deja las sales dentro del tanque.",
  },
  en: {
    eyebrow: "Growing tool",
    title: "Nutrient mixing calculator",
    crops: "Which plants share the water?",
    addCrop: "+ Add plant…",
    addAtLeastOne: "Add at least one plant to calculate.",
    removeOne: (name: string) => `Remove one ${name}`,
    addOne: (name: string) => `Add one ${name}`,
    remove: (name: string) => `Remove ${name}`,
    plant: "plant",
    plants: "plants",
    variety: "variety",
    varieties: "varieties",
    balancedMix: "a balanced mix is calculated",
    formula: "Which formula do you have at home?",
    singleFormula: "Single formula",
    components: (count: number) => `${count} components`,
    phase: "Growth phase",
    volume: "Liters of water available",
    loadType: "Load type",
    refillLiters: "Liters to replace",
    fullFill: (liters: number) => `Full fill · ${liters} L`,
    fullFillHint: "Tank emptied and filled with clean water",
    maintenanceRefill: "Maintenance refill",
    maintenanceRefillHint: "Evaporation replacement, softer dose",
    other: "Other",
    doseFor: (liters: number) => `Dose for ${liters} L`,
    protectedBalance: "Protected balance",
    adjustedDose: "Adjusted dose",
    inRange: "Within range",
    estimatedEc: "Estimated EC",
    targetEc: "Target EC",
    targetPh: "Target pH",
    mixOrder: "Manufacturer mixing order",
    criticalWarning: "Critical warning:",
    domesticAdaptation:
      "These doses are a home-growing adaptation of each manufacturer's published tables. Always verify with an EC meter and adjust pH at the end of mixing.",
    refillNote:
      "The refill uses 40% less concentrate: evaporated water leaves salts behind in the tank.",
  },
} as const;

const PHASE_COPY = {
  es: {
    seedling: ["Plántula / trasplante", "Dosis suave para raíces jóvenes"],
    vegetative: ["Crecimiento vegetativo", "Dosis estándar para hoja y aroma"],
    flowering: ["Floración y fruto", "Dosis madura para flor y fruto"],
  },
  en: {
    seedling: ["Seedling / transplant", "Gentle dose for young roots"],
    vegetative: ["Vegetative growth", "Standard dose for leaves and aroma"],
    flowering: ["Flowering and fruiting", "Mature dose for flowers and fruit"],
  },
} as const;

function localizedPartLabel(partId: string, language: "en" | "es") {
  const labels = {
    es: {
      single: "Nutriente líquido",
      a: "Solución A",
      b: "Solución B",
      micro: "FloraMicro",
      gro: "FloraGro",
      bloom: "FloraBloom",
    },
    en: {
      single: "Liquid nutrient",
      a: "Solution A",
      b: "Solution B",
      micro: "FloraMicro",
      gro: "FloraGro",
      bloom: "FloraBloom",
    },
  } as const;
  return labels[language][partId as keyof (typeof labels)[typeof language]] ?? partId;
}

const FORMULA_COPY = {
  en: {
    aerogarden: {
      philosophy: "A single patented formula (4-3-6) with built-in pH buffers for simple dosing.",
      mixingSteps: [
        "Shake the bottle firmly for 5 seconds: micronutrients settle.",
        "Pour the dose directly into the tank after filling it with water.",
        "Run the pump for 2 minutes before placing the baskets.",
      ],
      criticalWarning:
        "Do not combine it with other brands: it already contains a pH buffer, and mixing products can destabilize the reading.",
    },
    ab: {
      philosophy:
        "A concentrated two-part formula: A supplies calcium and iron, while B supplies phosphorus, potassium, magnesium and micronutrients.",
      mixingSteps: [
        "Fill the tank with room-temperature water.",
        "Add all of Solution A and shake or circulate for 1 minute.",
        "Only then add Solution B and homogenize again.",
      ],
      criticalWarning:
        "Never mix concentrated A and B together: calcium phosphate precipitates and calcium is lost irreversibly.",
    },
    flora: {
      philosophy:
        "A professional three-part formula: adjust nitrogen or phosphorus according to the growth stage.",
      mixingSteps: [
        "Add FloraMicro to the water first and mix until fully dissolved.",
        "Then add FloraGro and homogenize again.",
        "Add FloraBloom last. Check pH at the end of mixing.",
      ],
      criticalWarning:
        "The order is mandatory. If FloraBloom enters before FloraMicro, calcium can lock out and salts may settle at the bottom.",
    },
  },
  es: {
    aerogarden: {
      philosophy:
        "Fórmula única patentada (4-3-6) con amortiguadores de pH incluidos. Máxima simplicidad.",
      mixingSteps: [
        "Agita el frasco con fuerza durante 5 segundos: los micronutrientes sedimentan.",
        "Vierte la dosis directamente en el tanque con el agua ya cargada.",
        "Haz circular la bomba 2 minutos antes de colocar las canastillas.",
      ],
      criticalWarning:
        "No la combines con otras marcas: ya trae buffer de pH y mezclarla descontrola la lectura.",
    },
    ab: {
      philosophy:
        "Bicomponente concentrado: A aporta calcio y hierro, B aporta fósforo, potasio y magnesio.",
      mixingSteps: [
        "Llena el tanque con el agua a temperatura ambiente.",
        "Añade toda la Solución A y agita o deja circular 1 minuto.",
        "Solo entonces añade la Solución B y vuelve a homogeneizar.",
      ],
      criticalWarning:
        "Nunca mezcles A y B concentrados entre sí: precipita fosfato de calcio y pierdes el calcio de forma irreversible.",
    },
    flora: {
      philosophy:
        "Tricomponente profesional: ajustas nitrógeno o fósforo según la etapa del cultivo.",
      mixingSteps: [
        "Primero FloraMicro en el agua y agita bien hasta disolver por completo.",
        "Después FloraGro y vuelve a homogeneizar.",
        "Por último FloraBloom. Comprueba el pH al final de la mezcla.",
      ],
      criticalWarning:
        "El orden es obligatorio. Si FloraBloom entra antes que FloraMicro, el calcio se bloquea y aparecen sales en el fondo.",
    },
  },
} as const;

function formatEquivalence(ml: number, capSizeMl: number, language: "en" | "es") {
  if (ml < 1) return language === "en" ? "use a syringe or dropper" : "usa jeringa o cuentagotas";
  const caps = ml / capSizeMl;
  if (caps < 0.4) {
    return language === "en"
      ? `less than ½ cap of ${capSizeMl} mL`
      : `menos de ½ tapón de ${capSizeMl} mL`;
  }
  return language === "en"
    ? `≈ ${Math.round(caps * 10) / 10} caps of ${capSizeMl} mL`
    : `≈ ${Math.round(caps * 10) / 10} tapones de ${capSizeMl} mL`;
}

function localizedDiagnosis(
  status: "ok" | "adjusted" | "conflict",
  plantName: string,
  targetEc: { min: number; max: number },
  language: "en" | "es",
) {
  if (language === "es") {
    if (status === "ok")
      return `Dosis de tabla dentro del rango óptimo de ${plantName} (${targetEc.min}–${targetEc.max} mS/cm).`;
    if (status === "conflict")
      return `La mezcla está limitada por el cultivo más sensible del tanque.`;
    return `Dosis ajustada para mantener ${plantName} dentro de ${targetEc.min}–${targetEc.max} mS/cm.`;
  }
  if (status === "ok")
    return `The chart dose is within ${plantName}'s target range (${targetEc.min}–${targetEc.max} mS/cm).`;
  if (status === "conflict") return "The mix is limited by the most sensitive crop in the tank.";
  return `Dose adjusted to keep ${plantName} within ${targetEc.min}–${targetEc.max} mS/cm.`;
}

export function NutrientCalculator({
  plantIds,
  defaultLiters,
  defaultPhase = "vegetative",
  variant = "crop",
  eyebrow,
  title,
  description,
  language = "es",
}: NutrientCalculatorProps) {
  const copy = CALCULATOR_COPY[language];
  const formulaCopy = FORMULA_COPY[language];
  // Crop list is user-editable: props only seed the initial selection.
  const [crops, setCrops] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const id of plantIds) initial[id] = (initial[id] ?? 0) + 1;
    return initial;
  });
  const [picker, setPicker] = useState("");
  const selectedIds = Object.keys(crops);
  const totalPlants = Object.values(crops).reduce((sum, n) => sum + n, 0);
  const [formulaId, setFormulaId] = useState<FormulaId>("ab");
  const [phase, setPhase] = useState<GrowthPhase>(defaultPhase);
  const [liters, setLiters] = useState(defaultLiters);
  const [refill, setRefill] = useState(false);
  const [refillLiters, setRefillLiters] = useState(1.5);

  const formula = getFormula(formulaId);
  const activeLiters = variant === "tank" && refill ? refillLiters : liters;

  const result = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const base =
      selectedIds.length > 1
        ? calculatePolycultureCompromise({
            plantIds: selectedIds,
            formulaId,
            phase,
            liters: activeLiters,
          })
        : calculateSingleCropDose({
            plantId: selectedIds[0]!,
            formulaId,
            phase,
            liters: activeLiters,
          });
    if (variant === "tank" && refill) {
      // A maintenance top-up replaces evaporated water, so it carries a softer
      // charge to avoid stacking salts in the reservoir.
      return {
        ...base,
        parts: base.parts.map((part) => ({ ...part, ml: Math.round(part.ml * 0.6 * 10) / 10 })),
      };
    }
    return base;
  }, [selectedIds.join("|"), formulaId, phase, activeLiters, variant, refill]);

  const plantById = useMemo(() => new Map(plantList.map((p) => [p.id, p])), []);
  const changeCount = (id: string, delta: number) =>
    setCrops((prev) => {
      const next = { ...prev };
      const value = (next[id] ?? 0) + delta;
      if (value <= 0) delete next[id];
      else next[id] = value;
      return next;
    });

  return (
    <section className="glass-panel p-5 sm:p-6">
      <p className="eyebrow flex items-center gap-2 text-[10px]">
        <Beaker aria-hidden="true" className="size-3.5" />
        {eyebrow ?? copy.eyebrow}
      </p>
      <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{title ?? copy.title}</h2>
      {description && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}

      {/* Crops sharing the water */}
      <p className="eyebrow mt-5 text-[10px]">1 · {copy.crops}</p>
      <div className="glass-soft mt-2 p-3">
        {selectedIds.length === 0 ? (
          <p className="text-xs text-muted-foreground">{copy.addAtLeastOne}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {selectedIds.map((id) => {
              const plant = plantById.get(id);
              const profile = result?.crops.find((c) => c.id === id);
              const limiting = selectedIds.length > 1 && result?.limitingCrop?.id === id;
              return (
                <li
                  key={id}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-3 py-2",
                    limiting ? "border-accent bg-accent/15" : "border-border bg-background/60",
                  )}
                >
                  <span className="min-w-0 text-sm font-semibold">
                    <span aria-hidden="true">{plant?.emoji}</span>{" "}
                    {language === "es" ? plant?.spanishName : (plant?.name ?? id)}
                    {profile && (
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                        EC {profile.ecMin}–{profile.ecMax}
                      </span>
                    )}
                    {limiting && (
                      <span className="ml-1 text-[10px] font-bold text-accent">
                        · {language === "es" ? "marca el techo" : "sets the ceiling"}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => changeCount(id, -1)}
                      aria-label={copy.removeOne(
                        language === "es" ? (plant?.spanishName ?? id) : (plant?.name ?? id),
                      )}
                      className="grid size-9 place-items-center rounded-full border border-border hover:bg-secondary"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{crops[id]}</span>
                    <button
                      type="button"
                      onClick={() => changeCount(id, 1)}
                      aria-label={copy.addOne(
                        language === "es" ? (plant?.spanishName ?? id) : (plant?.name ?? id),
                      )}
                      className="grid size-9 place-items-center rounded-full border border-border hover:bg-secondary"
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => changeCount(id, -(crops[id] ?? 0))}
                      aria-label={copy.remove(
                        language === "es" ? (plant?.spanishName ?? id) : (plant?.name ?? id),
                      )}
                      className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <select
          value={picker}
          onChange={(event) => {
            const id = event.target.value;
            if (id) changeCount(id, 1);
            setPicker("");
          }}
          className="mt-3 h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm font-semibold"
          aria-label={language === "es" ? "Agregar planta" : "Add plant"}
        >
          <option value="">{copy.addCrop}</option>
          {plantList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.emoji} {language === "es" ? p.spanishName : p.name}
            </option>
          ))}
        </select>
        {totalPlants > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {totalPlants} {totalPlants === 1 ? copy.plant : copy.plants} · {selectedIds.length}{" "}
            {selectedIds.length === 1 ? copy.variety : copy.varieties}
            {selectedIds.length > 1 && ` · ${copy.balancedMix}`}
          </p>
        )}
      </div>

      {/* Formula picker */}
      <p className="eyebrow mt-5 text-[10px]">2 · {copy.formula}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {FORMULAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFormulaId(item.id)}
            aria-pressed={formulaId === item.id}
            className={cn(
              "flex min-h-11 min-w-0 flex-col items-start rounded-xl border p-3 text-left transition-colors",
              formulaId === item.id
                ? "border-primary bg-primary/10"
                : "border-border bg-background/50 hover:bg-secondary",
            )}
          >
            <span className="max-w-full break-words font-display text-sm font-semibold leading-tight">
              {item.vendor}
            </span>
            <span className="mt-1 max-w-full break-words text-[11px] leading-snug text-muted-foreground">
              {item.descriptor
                ? `${item.descriptor} · ${copy.components(item.parts.length)}`
                : item.parts.length === 1
                  ? copy.singleFormula
                  : copy.components(item.parts.length)}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {formulaCopy[formulaId].philosophy}
      </p>

      {/* Phase picker */}
      <p className="eyebrow mt-5 text-[10px]">3 · {copy.phase}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {PHASES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setPhase(item)}
            aria-pressed={phase === item}
            className={cn(
              "flex min-h-11 flex-col items-start rounded-xl border p-3 text-left transition-colors",
              phase === item
                ? "border-primary bg-primary/10"
                : "border-border bg-background/50 hover:bg-secondary",
            )}
          >
            <span className="text-sm font-semibold leading-tight">
              {PHASE_COPY[language][item][0]}
            </span>
            <span className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {PHASE_COPY[language][item][1]}
            </span>
          </button>
        ))}
      </div>

      {/* Volume */}
      <p className="eyebrow mt-5 text-[10px]">
        4 · {variant === "tank" ? copy.loadType : copy.volume}
      </p>
      {variant === "tank" ? (
        <div className="mt-2 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setRefill(false)}
              aria-pressed={!refill}
              className={cn(
                "flex min-h-11 flex-col items-start rounded-xl border p-3 text-left transition-colors",
                !refill
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/50 hover:bg-secondary",
              )}
            >
              <span className="text-sm font-semibold">{copy.fullFill(liters)}</span>
              <span className="mt-1 text-[11px] text-muted-foreground">{copy.fullFillHint}</span>
            </button>
            <button
              type="button"
              onClick={() => setRefill(true)}
              aria-pressed={refill}
              className={cn(
                "flex min-h-11 flex-col items-start rounded-xl border p-3 text-left transition-colors",
                refill
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/50 hover:bg-secondary",
              )}
            >
              <span className="text-sm font-semibold">{copy.maintenanceRefill}</span>
              <span className="mt-1 text-[11px] text-muted-foreground">
                {copy.maintenanceRefillHint}
              </span>
            </button>
          </div>
          {refill && (
            <label className="flex items-center gap-3 text-xs font-semibold">
              {copy.refillLiters}
              <Input
                type="number"
                min={0.25}
                max={liters}
                step={0.25}
                value={refillLiters}
                onChange={(event) =>
                  setRefillLiters(Math.max(0.25, Number(event.target.value) || 0.25))
                }
                className="h-11 w-24"
              />
            </label>
          )}
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {VOLUME_PRESETS.map((preset) => (
            <button
              key={preset.liters}
              type="button"
              onClick={() => setLiters(preset.liters)}
              aria-pressed={liters === preset.liters}
              className={cn(
                "min-h-11 rounded-full border px-3 text-xs font-semibold transition-colors",
                liters === preset.liters
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/50 hover:bg-secondary",
              )}
              title={preset.note}
            >
              {preset.label}
            </button>
          ))}
          <label className="flex items-center gap-2 text-xs font-semibold">
            {copy.other}
            <Input
              type="number"
              min={0.25}
              step={0.25}
              value={liters}
              onChange={(event) => setLiters(Math.max(0.25, Number(event.target.value) || 0.25))}
              className="h-11 w-24"
            />
            L
          </label>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="glass-card mt-6 p-4 sm:p-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <p className="eyebrow text-[10px]">{copy.doseFor(activeLiters)}</p>
              <p className="mt-1 font-display text-lg font-semibold leading-tight">
                {formula.name}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold",
                result.status === "conflict"
                  ? "bg-accent/20 text-accent-foreground"
                  : result.status === "adjusted"
                    ? "bg-muted text-foreground"
                    : "bg-secondary text-secondary-foreground",
              )}
            >
              {result.status === "conflict"
                ? copy.protectedBalance
                : result.status === "adjusted"
                  ? copy.adjustedDose
                  : copy.inRange}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {result.parts.map((part) => (
              <div key={part.partId} className="glass-soft p-3">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  {localizedPartLabel(part.partId, language)}
                </p>
                <p className="mt-1 font-display text-2xl font-bold leading-none">
                  {part.ml}
                  <span className="ml-1 text-sm font-semibold">mL</span>
                </p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                  {formatEquivalence(part.ml, formula.capSizeMl, language)}
                </p>
              </div>
            ))}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-semibold text-muted-foreground">
                {copy.estimatedEc}
              </dt>
              <dd className="mt-1 font-display text-lg font-bold">{result.estimatedEc} mS/cm</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-muted-foreground">{copy.targetEc}</dt>
              <dd className="mt-1 font-display text-lg font-bold">
                {result.targetEc.min}–{result.targetEc.max}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-muted-foreground">{copy.targetPh}</dt>
              <dd className="mt-1 font-display text-lg font-bold">
                {result.targetPh.min}–{result.targetPh.max}
              </dd>
            </div>
          </dl>

          <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
            <Info aria-hidden="true" className="mt-1 size-3.5 shrink-0" />
            {localizedDiagnosis(
              result.status,
              language === "es"
                ? (plantById.get(selectedIds[0]!)?.spanishName ?? selectedIds[0]!)
                : (plantById.get(selectedIds[0]!)?.name ?? selectedIds[0]!),
              result.targetEc,
              language,
            )}
          </p>
          {variant === "tank" && refill && (
            <p className="mt-2 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
              <Droplets aria-hidden="true" className="mt-1 size-3.5 shrink-0" />
              {copy.refillNote}
            </p>
          )}
        </div>
      )}

      {/* Mixing protocol */}
      <p className="eyebrow mt-6 text-[10px]">{copy.mixOrder}</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-7">
        {formulaCopy[formulaId].mixingSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-accent/15 p-3 text-xs leading-6">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
        <span>
          <strong>{copy.criticalWarning}</strong> {formulaCopy[formulaId].criticalWarning}
        </span>
      </p>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {copy.domesticAdaptation}
      </p>
    </section>
  );
}
