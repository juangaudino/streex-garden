import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Minus, Play, Plus } from "lucide-react";

import type { DonorGuideSection, DonorPlantDetail } from "./canonical-adapter";
import { cn } from "@/lib/utils";
import { NutrientCalculator } from "./nutrient-calculator";

const categoryLabels: Record<string, string> = {
  herbs: "Hierbas",
  "leafy greens": "Hojas verdes",
  fruiting: "Frutos",
  fruits: "Frutos",
  alliums: "Alliums",
  flowers: "Flores",
  vegetables: "Vegetales",
  "root vegetables": "Raíces",
};

const detailLabels = {
  es: {
    library: "Biblioteca",
    profile: "Ficha",
    backed: "Respaldado",
    adapted: "Adaptación Garden",
    pending: "Por validar",
    coverage: "Cobertura de fuentes",
    calculator: "Calculadora de mezcla nutritiva",
    guides: "Guías de manejo",
    sections: "secciones de cultivo",
  },
  en: {
    library: "Library",
    profile: "Profile",
    backed: "Source-backed",
    adapted: "Garden adaptation",
    pending: "Needs validation",
    coverage: "Source coverage",
    calculator: "Nutrient mixing calculator",
    guides: "Growing guides",
    sections: "growing sections",
  },
} as const;

function detailCategoryLabel(category: string, language: "en" | "es") {
  if (language === "en") {
    return (
      (
        {
          herbs: "Herbs",
          "leafy greens": "Leafy greens",
          fruiting: "Fruiting",
          fruits: "Fruit",
          alliums: "Alliums",
          flowers: "Flowers",
          vegetables: "Vegetables",
          "root vegetables": "Root vegetables",
        } as Record<string, string>
      )[category] ?? category
    );
  }
  return categoryLabels[category] ?? category;
}

export function DonorPlantDetailPage({
  detail,
  language = "es",
}: {
  detail: DonorPlantDetail;
  language?: "en" | "es";
}) {
  const labels = detailLabels[language];
  return (
    <main className="garden-stage min-h-screen text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-[1320px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:px-6">
          <a
            href="/gardenpedia"
            className="flex h-10 items-center gap-2 rounded-full border border-border px-3 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
            <span className="hidden sm:inline">{labels.library}</span>
          </a>
          <div className="min-w-0">
            <p className="eyebrow truncate text-[10px]">Gardenpedia · {labels.profile}</p>
            <p className="truncate font-display text-sm font-bold leading-tight sm:text-base">
              {language === "es" ? detail.spanishName : detail.name}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8">
        <FullSheet detail={detail} category={detail.category} language={language} />
      </div>
    </main>
  );
}

function FullSheet({
  detail,
  category,
  language,
}: {
  detail: DonorPlantDetail;
  category: string;
  language: "en" | "es";
}) {
  const labels = detailLabels[language];
  return (
    <div className="animate-rise grid gap-5 lg:grid-cols-12">
      {/* Left rail */}
      <div className="flex flex-col gap-5 lg:col-span-5 xl:col-span-4">
        <section className="glass-panel p-5 sm:p-7 lg:sticky lg:top-24">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
            <span className="shrink-0 text-4xl leading-none" aria-hidden="true">
              {detail.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-accent">
                {language === "es" ? detail.spanishName : detail.name}
              </p>
              <span className="mt-1 inline-block rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">
                {detailCategoryLabel(category, language)}
              </span>
            </div>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-[1.05] tracking-tight sm:text-4xl">
            {language === "es" ? detail.spanishName : detail.name}
          </h1>
          <p className="mt-2 text-sm italic text-muted-foreground">{detail.scientificName}</p>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">{detail.summary}</p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {detail.metrics.map((metric) => (
              <div key={metric.label} className="glass-soft p-3">
                <p className="text-[11px] font-semibold text-muted-foreground">{metric.label}</p>
                <p className="mt-1 font-display text-lg font-bold leading-tight">{metric.value}</p>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{metric.note}</p>
              </div>
            ))}
          </div>

          {detail.evidence && (
            <div className="mt-5 border-t border-border pt-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="eyebrow text-[10px]">Knowledge · v0.1</p>
                  <h2 className="mt-1 font-display text-lg font-semibold">Evidence Health</h2>
                </div>
                <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold">
                  {detail.evidence.badge}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {language === "es"
                  ? "Mapa de calidad del conocimiento de esta ficha. Mide respaldo y huecos; no mide la salud de la planta."
                  : "This knowledge-quality map shows evidence coverage and gaps; it does not measure plant health."}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                {[
                  [String(detail.evidence.backed), labels.backed],
                  [String(detail.evidence.adapted), labels.adapted],
                  [String(detail.evidence.pending), labels.pending],
                  [detail.evidence.coverage, labels.coverage],
                ].map(([value, label]) => (
                  <div key={label} className="glass-soft p-3">
                    <dt className="font-display text-xl font-bold leading-none">{value}</dt>
                    <dd className="mt-1 text-[11px] text-muted-foreground">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>
      </div>

      {/* Right column */}
      <div className="flex flex-col gap-5 lg:col-span-7 xl:col-span-8">
        <NutrientCalculator
          plantIds={[detail.id]}
          defaultLiters={2.5}
          eyebrow={language === "es" ? "Herramienta de cultivo" : "Growing tool"}
          title={labels.calculator}
          description={`${language === "es" ? detail.spanishName : detail.name}. ${language === "es" ? "Suma las demás plantas que comparten el mismo agua y los litros que tienes." : "Add other plants sharing the water and the liters in your reservoir."}`}
        />
        {detail.timeline && (
          <section className="glass-panel p-5 sm:p-6">
            <p className="eyebrow text-[10px]">Calendar · v0.1</p>
            <h2 className="mt-1 font-display text-xl font-semibold">Grow Timeline</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {detail.timeline.note}
            </p>
            <ol className="mt-5 space-y-4">
              {detail.timeline.steps.map((step, index) => (
                <li key={step.label} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <span className="relative flex flex-col items-center">
                    <span className="mt-1 size-3 shrink-0 rounded-full border-2 border-primary" />
                    {index < detail.timeline!.steps.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-border" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-2 pb-1">
                    <strong className="font-display text-sm">{step.label}</strong>
                    <span className="text-sm text-muted-foreground">{step.day}</span>
                    {step.backed && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold">
                        Respaldado
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              Observar y decidir: {detail.timeline.decide}
            </p>
          </section>
        )}

        {detail.harvestUse && (
          <section className="glass-panel p-5 sm:p-6">
            <p className="eyebrow text-[10px]">Después de cosechar · Harvest use</p>
            <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
              <h2 className="min-w-0 font-display text-2xl font-bold leading-tight">
                ¿Qué puedes hacer ahora?
              </h2>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                v0.2 · Source-backed
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="glass-soft p-4">
                <p className="eyebrow text-[10px]">Parte comestible</p>
                <p className="mt-2 font-display text-base font-semibold">
                  {detail.harvestUse.ediblePart}
                </p>
              </div>
              <div className="glass-soft p-4">
                <p className="eyebrow text-[10px]">Mejor uso</p>
                <p className="mt-2 text-sm font-semibold leading-6">{detail.harvestUse.bestUse}</p>
              </div>
            </div>

            <p className="eyebrow mt-5 text-[10px]">Usos rápidos</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {detail.harvestUse.quickUses.map((use) => (
                <span
                  key={use}
                  className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold"
                >
                  {use}
                </span>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {detail.harvestUse.options.map((option) => (
                <article key={option.title} className="glass-card flex flex-col p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xl leading-none" aria-hidden="true">
                      {option.emoji}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
                        option.rank === "Mejor opción" && "bg-secondary text-secondary-foreground",
                        option.rank === "Buena opción" && "bg-muted text-foreground",
                        option.rank === "Posible" && "bg-accent/20 text-accent-foreground",
                      )}
                    >
                      {option.rank}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-lg font-semibold">{option.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{option.lead}</p>
                  <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-6">
                    {option.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <div className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border pt-3 text-xs">
                    <span className="font-semibold text-muted-foreground">Fuentes</span>
                    {option.sources.map((source) => (
                      <SourceLink key={source.url} label={source.label} url={source.url} />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {detail.neighbors && (
          <section className="glass-panel p-5 sm:p-6">
            <p className="eyebrow text-[10px]">↔ Vecinas</p>
            <div className="mt-1 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-end">
              <h2 className="font-display text-2xl font-bold leading-tight">
                Buenas vecinas / Mejor separar
              </h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Garden prioriza compatibilidad real de cultivo. Una asociación tradicional solo sube
                de nivel cuando una fuente confiable la respalda.
              </p>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <NeighborColumn title="✓ Buenas vecinas" entries={detail.neighbors.good} />
              <NeighborColumn title="↔ Mejor separar" entries={detail.neighbors.avoid} />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              ‘Mejor separar’ normalmente significa mala combinación de luz / espacio / raíces /
              nutrientes; no que una planta envenene químicamente a la otra.
            </p>
          </section>
        )}

        {detail.visualGuide && (
          <section className="glass-panel p-5 sm:p-6">
            <p className="eyebrow text-[10px]">Referencia externa</p>
            <div className="mt-1 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:items-end">
              <h2 className="font-display text-2xl font-bold leading-tight">Guía visual</h2>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Referencias externas elegidas por la acción que enseñan, no como fotos decorativas
                de la planta.
              </p>
            </div>
            <article className="glass-card mt-5 overflow-hidden">
              <div className="relative grid min-h-40 place-items-center bg-secondary/40 p-6">
                <div className="text-center">
                  <Play aria-hidden="true" className="mx-auto size-7" />
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em]">
                    {detail.visualGuide.kind}
                  </p>
                </div>
                <span className="absolute bottom-3 left-3 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                  {detail.visualGuide.tag}
                </span>
              </div>
              <div className="p-4">
                <p className="eyebrow text-[10px]">
                  {detail.visualGuide.kind} · {detail.visualGuide.publisher}
                </p>
                <h3 className="mt-2 font-display text-lg font-semibold leading-tight">
                  {detail.visualGuide.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {detail.visualGuide.description}
                </p>
                <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-3">
                  <span className="truncate text-xs text-muted-foreground">Ver en la fuente</span>
                  <a
                    href={detail.visualGuide.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex shrink-0 items-center gap-1 text-xs font-bold underline underline-offset-4"
                  >
                    Abrir fuente <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  </a>
                </div>
              </div>
            </article>
          </section>
        )}

        <section>
          <p className="eyebrow text-[10px]">{labels.guides}</p>
          <h2 className="mt-1 font-display text-2xl font-bold">
            {detail.guides.length} {labels.sections}
          </h2>
          <div className="mt-4 space-y-3">
            {detail.guides.map((guide, index) => (
              <GuideAccordion key={guide.id} guide={guide} defaultOpen={index === 0} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function NeighborColumn({
  title,
  entries,
}: {
  title: string;
  entries: NonNullable<DonorPlantDetail["neighbors"]>["good"];
}) {
  return (
    <div className="glass-soft p-4">
      <h3 className="font-display text-sm font-semibold">{title}</h3>
      <div className="mt-3 divide-y divide-border">
        {entries.map((entry) => (
          <div key={entry.name} className="py-3 first:pt-0 last:pb-0">
            <p className="flex items-start gap-2 font-display text-sm font-semibold">
              <span className="shrink-0" aria-hidden="true">
                {entry.emoji}
              </span>
              <span className="min-w-0">{entry.name}</span>
            </p>
            <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{entry.reason}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-foreground/40 px-2.5 py-1 text-[11px] font-semibold">
                {entry.action}
              </span>
              <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                {entry.basis}
              </span>
            </div>
            {entry.source && (
              <p className="mt-2">
                <SourceLink label={entry.source.label} url={entry.source.url} />
              </p>
            )}
          </div>
        ))}
        {entries.length === 0 && (
          <p className="py-3 text-xs text-muted-foreground">
            Sin registros para esta ficha todavía.
          </p>
        )}
      </div>
    </div>
  );
}

function GuideAccordion({
  guide,
  defaultOpen,
}: {
  guide: DonorGuideSection;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  return (
    <article className={cn("glass-card overflow-hidden", open && "bg-card")}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-4 text-left"
      >
        <span className="shrink-0 text-xl leading-none" aria-hidden="true">
          {guide.emoji}
        </span>
        <span className="min-w-0">
          <span className="block font-display text-base font-semibold leading-tight">
            {guide.title}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{guide.subtitle}</span>
        </span>
        {open ? (
          <Minus aria-hidden="true" className="size-4 shrink-0" />
        ) : (
          <Plus aria-hidden="true" className="size-4 shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-border p-4">
          <p className="text-sm leading-7">{guide.body}</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-7">
            {guide.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
            {guide.avoid && (
              <li>
                <strong>Evitar:</strong> {guide.avoid}
              </li>
            )}
          </ul>
          {guide.context && (
            <p className="mt-3 text-sm leading-7">
              <strong>Contexto:</strong> {guide.context}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold",
                guide.backing === "source"
                  ? "bg-secondary text-secondary-foreground"
                  : guide.backing === "pending"
                    ? "bg-muted text-muted-foreground"
                    : "bg-accent/20 text-accent-foreground",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  guide.backing === "source"
                    ? "bg-primary"
                    : guide.backing === "pending"
                      ? "bg-muted-foreground"
                      : "bg-accent",
                )}
              />
              {guide.backing === "source"
                ? "Respaldado por fuente"
                : guide.backing === "pending"
                  ? "Pendiente / desconocido"
                  : "Adaptación de Garden"}
            </span>
            <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">
              Confianza: {guide.confidence}
            </span>
          </div>
          <div className="mt-3 space-y-1.5">
            {guide.sources.map((source) => (
              <p key={source.url}>
                <SourceLink label={source.label} url={source.url} />
              </p>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function SourceLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-baseline gap-1 text-xs font-medium underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground"
    >
      {label}
      <ArrowUpRight aria-hidden="true" className="size-3 shrink-0 self-center" />
    </a>
  );
}
