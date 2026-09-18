import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sprout,
  Leaf,
  Camera,
  Droplets,
  Scissors,
  ShoppingBasket as Basket,
  Flower2,
  Apple,
  Sparkles,
  StickyNote,
  AlertTriangle,
  HeartPulse,
  Move,
  Wrench,
  Bug,
  Sun,
  Beaker,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { statusMeta, type Confidence } from "@/lib/garden-logic";
import type { EventType, MaintenanceType, Photo, Plant, PlantStatus } from "@/lib/garden-data";

export const eventIcons: Record<EventType, typeof Leaf> = {
  planted: Sprout,
  germinated: Leaf,
  photo: Camera,
  maintenance: Droplets,
  pruning: Scissors,
  harvest: Basket,
  thinning: Leaf,
  transplant: Move,
  problem: AlertTriangle,
  recovery: HeartPulse,
  flowering: Flower2,
  fruiting: Apple,
  ai: Sparkles,
  note: StickyNote,
};

export const maintenanceIcons: Record<MaintenanceType, typeof Leaf> = {
  watering: Droplets,
  nutrients: Beaker,
  pruning: Scissors,
  harvest: Basket,
  thinning: Leaf,
  transplant: Move,
  cleaning: Trash2,
  pest: Bug,
  light: Sun,
  custom: Wrench,
};

export function StatusDot({ status, className }: { status: PlantStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", statusMeta[status].tone, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta[status].dot)} />
      {statusMeta[status].label}
    </span>
  );
}

/** The core epistemic device of Garden X. */
export function ProvenanceTag({
  kind,
  confidence,
}: {
  kind: "recorded" | "observed" | "inferred" | "recommendation";
  confidence?: Confidence;
}) {
  const map = {
    recorded: { label: "Recorded fact", cls: "border-fact/30 bg-fact/8 text-fact" },
    observed: { label: "Visual observation", cls: "border-observation/30 bg-observation/8 text-observation" },
    inferred: { label: "Inference", cls: "border-inference/40 bg-inference/10 text-inference" },
    recommendation: { label: "Recommendation", cls: "border-advice/30 bg-advice/8 text-advice" },
  }[kind];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.625rem] font-medium tracking-wide uppercase",
        map.cls,
      )}
    >
      {map.label}
      {confidence ? <span className="opacity-70">· {confidence}</span> : null}
    </span>
  );
}

export function ConfidenceBar({ confidence }: { confidence: Confidence }) {
  const pct = confidence === "high" ? 86 : confidence === "moderate" ? 58 : 27;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">Confidence</span>
        <span className="numeral text-sm capitalize">{confidence}</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Derived from image signal quality and how much recorded history backs it.
      </p>
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <h2 className="min-w-0 truncate font-display text-xl">{children}</h2>
      {action ? <div className="shrink-0 text-sm">{action}</div> : null}
    </div>
  );
}

export function PlantThumb({
  plant,
  photo,
  size = "md",
}: {
  plant: Plant;
  photo?: Photo | undefined;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl bg-secondary",
        size === "sm" ? "h-12 w-12" : "h-16 w-16",
      )}
    >
      {photo ? (
        <img src={photo.src} alt={plant.name} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted-foreground">
          <Leaf className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

export function PlantCard({
  plant,
  photo,
  meta,
}: {
  plant: Plant;
  photo?: Photo | undefined;
  meta?: string | undefined;
}) {
  return (
    <Link
      to="/plants/$plantId"
      params={{ plantId: plant.id }}
      className="press group block overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft hover:shadow-lift"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        {photo ? (
          <img
            src={photo.src}
            alt={`${plant.name}, ${plant.species}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : null}
        <div className="veil pointer-events-none absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="font-display text-lg leading-tight text-white">{plant.name}</p>
          <p className="mt-0.5 truncate text-xs text-white/75">
            {plant.species} · {plant.variety}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{meta}</span>
        <StatusDot status={plant.status} className="shrink-0" />
      </div>
    </Link>
  );
}