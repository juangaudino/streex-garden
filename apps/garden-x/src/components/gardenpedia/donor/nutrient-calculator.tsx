import { useMemo, useState } from "react";
import { AlertTriangle, Beaker, Droplets, Info, Minus, Plus, X } from "lucide-react";
import { donorPlants as plantList } from "./canonical-adapter";

import { Input } from "@/components/ui/input";
import {
  FORMULAS,
  PHASE_HINTS,
  PHASE_LABELS,
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
}

export function NutrientCalculator({
  plantIds,
  defaultLiters,
  defaultPhase = "vegetative",
  variant = "crop",
  eyebrow = "Herramienta de cultivo",
  title = "Calculadora de mezcla nutritiva",
  description,
}: NutrientCalculatorProps) {
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
        {eyebrow}
      </p>
      <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{title}</h2>
      {description && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}

      {/* Crops sharing the water */}
      <p className="eyebrow mt-5 text-[10px]">1 · ¿Qué plantas comparten el agua?</p>
      <div className="glass-soft mt-2 p-3">
        {selectedIds.length === 0 ? (
          <p className="text-xs text-muted-foreground">Añade al menos una planta para calcular.</p>
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
                    <span aria-hidden="true">{plant?.emoji}</span> {plant?.spanishName ?? id}
                    {profile && (
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                        EC {profile.ecMin}–{profile.ecMax}
                      </span>
                    )}
                    {limiting && (
                      <span className="ml-1 text-[10px] font-bold text-accent">
                        · marca el techo
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => changeCount(id, -1)}
                      aria-label={`Quitar una ${plant?.spanishName}`}
                      className="grid size-9 place-items-center rounded-full border border-border hover:bg-secondary"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{crops[id]}</span>
                    <button
                      type="button"
                      onClick={() => changeCount(id, 1)}
                      aria-label={`Añadir una ${plant?.spanishName}`}
                      className="grid size-9 place-items-center rounded-full border border-border hover:bg-secondary"
                    >
                      <Plus className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => changeCount(id, -(crops[id] ?? 0))}
                      aria-label={`Eliminar ${plant?.spanishName}`}
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
          aria-label="Agregar planta"
        >
          <option value="">+ Agregar planta…</option>
          {plantList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.emoji} {p.spanishName}
            </option>
          ))}
        </select>
        {totalPlants > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {totalPlants} {totalPlants === 1 ? "planta" : "plantas"} · {selectedIds.length}{" "}
            {selectedIds.length === 1 ? "variedad" : "variedades"}
            {selectedIds.length > 1 && " · se calcula una mezcla equilibrada"}
          </p>
        )}
      </div>

      {/* Formula picker */}
      <p className="eyebrow mt-5 text-[10px]">2 · ¿Qué fórmula tienes en casa?</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {FORMULAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFormulaId(item.id)}
            aria-pressed={formulaId === item.id}
            className={cn(
              "flex min-h-11 flex-col items-start rounded-xl border p-3 text-left transition-colors",
              formulaId === item.id
                ? "border-primary bg-primary/10"
                : "border-border bg-background/50 hover:bg-secondary",
            )}
          >
            <span className="font-display text-sm font-semibold leading-tight">{item.vendor}</span>
            <span className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {item.parts.length === 1 ? "Fórmula única" : `${item.parts.length} componentes`}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{formula.philosophy}</p>

      {/* Phase picker */}
      <p className="eyebrow mt-5 text-[10px]">3 · Fase del cultivo</p>
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
            <span className="text-sm font-semibold leading-tight">{PHASE_LABELS[item]}</span>
            <span className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {PHASE_HINTS[item]}
            </span>
          </button>
        ))}
      </div>

      {/* Volume */}
      <p className="eyebrow mt-5 text-[10px]">
        4 · {variant === "tank" ? "Tipo de carga" : "Litros de agua disponibles"}
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
              <span className="text-sm font-semibold">Llenado completo · {liters} L</span>
              <span className="mt-1 text-[11px] text-muted-foreground">
                Tanque vaciado y agua limpia
              </span>
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
              <span className="text-sm font-semibold">Relleno de mantenimiento</span>
              <span className="mt-1 text-[11px] text-muted-foreground">
                Reposición por evaporación, dosis suave
              </span>
            </button>
          </div>
          {refill && (
            <label className="flex items-center gap-3 text-xs font-semibold">
              Litros a reponer
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
            Otro
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
              <p className="eyebrow text-[10px]">Dosis para {activeLiters} L</p>
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
                ? "Equilibrio protegido"
                : result.status === "adjusted"
                  ? "Dosis ajustada"
                  : "Dentro de rango"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {result.parts.map((part) => (
              <div key={part.partId} className="glass-soft p-3">
                <p className="text-[11px] font-semibold text-muted-foreground">{part.label}</p>
                <p className="mt-1 font-display text-2xl font-bold leading-none">
                  {part.ml}
                  <span className="ml-1 text-sm font-semibold">mL</span>
                </p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                  {part.equivalence}
                </p>
              </div>
            ))}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-semibold text-muted-foreground">EC estimada</dt>
              <dd className="mt-1 font-display text-lg font-bold">{result.estimatedEc} mS/cm</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-muted-foreground">EC objetivo</dt>
              <dd className="mt-1 font-display text-lg font-bold">
                {result.targetEc.min}–{result.targetEc.max}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold text-muted-foreground">pH objetivo</dt>
              <dd className="mt-1 font-display text-lg font-bold">
                {result.targetPh.min}–{result.targetPh.max}
              </dd>
            </div>
          </dl>

          <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
            <Info aria-hidden="true" className="mt-1 size-3.5 shrink-0" />
            {result.diagnosis}
          </p>
          {variant === "tank" && refill && (
            <p className="mt-2 flex items-start gap-2 text-xs leading-6 text-muted-foreground">
              <Droplets aria-hidden="true" className="mt-1 size-3.5 shrink-0" />
              El relleno lleva un 40% menos de concentrado: el agua que se evapora deja las sales
              dentro del tanque.
            </p>
          )}
        </div>
      )}

      {/* Mixing protocol */}
      <p className="eyebrow mt-6 text-[10px]">Orden de mezcla del fabricante</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-7">
        {formula.mixingSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-3 flex items-start gap-2 rounded-xl bg-accent/15 p-3 text-xs leading-6">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
        <span>
          <strong>Advertencia crítica:</strong> {formula.criticalWarning}
        </span>
      </p>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Las dosis son una adaptación doméstica de las tablas publicadas por cada fabricante.
        Verifica siempre con tu medidor de EC y ajusta el pH al final de la mezcla.
      </p>
    </section>
  );
}
