import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, ArrowRight, MoveHorizontal } from "lucide-react";
import { useGarden } from "@/lib/garden-store";
import { ageLabel, comparePhotos, eventsBetween, formatDate, plantPhotos, type CompareResult } from "@/lib/garden-logic";
import { runAiCheck } from "@/lib/garden-backend";
import { ConfidenceBar, ProvenanceTag } from "@/components/garden/atoms";
import { PhotoImage } from "@/components/garden/photo-image";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui-copy";

export const Route = createFileRoute("/plants/$plantId/compare")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: search["from"] === "garden-ai" ? "garden-ai" as const : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AI compare — Garden X" },
      {
        name: "description",
        content:
          "Put two photos of the same plant side by side and see exactly what changed between those dates: growth, density, colour, damage, recovery.",
      },
      { property: "og:title", content: "AI compare — Garden X" },
      { property: "og:description", content: "What changed between two dates: growth, density, colour, recovery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Compare,
});

function Compare() {
  const { plantId } = Route.useParams();
  const { from } = Route.useSearch();
  const store = useGarden();
  const language = store.language;
  const plant = store.plants.find((p) => p.id === plantId);
  if (!plant) throw notFound();

  const photos = plantPhotos(store.photos, plant.id);
  const [aId, setAId] = useState(photos[0]?.id ?? "");
  const [bId, setBId] = useState(photos[photos.length - 1]?.id ?? "");
  const [slider, setSlider] = useState(50);
  const [aiComparison, setAiComparison] = useState<{ observations: string[]; inference: string; confidence: "high" | "moderate" | "low" } | null>(null);

  const a = store.photos.find((p) => p.id === aId);
  const b = store.photos.find((p) => p.id === bId);
  useEffect(() => {
    setAiComparison(null);
    if (!plant.backendGrowCycleId || !a?.backendStoragePath || !b?.backendStoragePath || a.id === b.id) return;
    void runAiCheck(plant.backendGrowCycleId, b.id, a.id, language)
      .then(({ proposal }) => {
        const confidence = proposal.confidence === "high" ? "high" : proposal.confidence === "medium" ? "moderate" : "low";
        const observations = Array.isArray(proposal.observations) ? proposal.observations.map(String) : [];
        const uncertainty = Array.isArray(proposal.uncertainty) ? proposal.uncertainty.map(String) : [];
        setAiComparison({
          observations,
          inference: [String(proposal.summary ?? ""), ...uncertainty].filter(Boolean).join(" "),
          confidence,
        });
      })
      .catch(() => undefined);
  }, [a?.backendStoragePath, a?.id, b?.backendStoragePath, b?.id, language, plant.backendGrowCycleId]);

  if (!a || !b) return <div className="p-8 text-sm text-muted-foreground">{ui(language, "twoPhotosNeeded")}</div>;
  const deterministic = comparePhotos(a, b, plant, language);
  const result: CompareResult = aiComparison ? { ...deterministic, observations: aiComparison.observations, inference: aiComparison.inference, confidence: aiComparison.confidence } : deterministic;
  const hasRecordedMeasurements = [
    a.metrics.heightCm,
    a.metrics.leafCount,
    a.metrics.density,
    b.metrics.heightCm,
    b.metrics.leafCount,
    b.metrics.density,
  ].some((value) => value !== null);
  const earlier = a.daysAgo > b.daysAgo ? a : b;
  const later = a.daysAgo > b.daysAgo ? b : a;
  const context = eventsBetween(store.events, plant.id, earlier.daysAgo, later.daysAgo).filter((event) => event.type !== "photo" && event.type !== "ai");

  return (
    <div className="rise pb-20">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-5 pt-7 pb-5 sm:px-8 lg:px-12">
        {from === "garden-ai" ? (
          <Link to="/garden-ai" className="press grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/70 bg-card" aria-label={ui(language, "backToGardenAI")}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <Link to="/plants/$plantId" params={{ plantId: plant.id }} className="press grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/70 bg-card" aria-label={`${ui(language, "backToPlant")}: ${plant.name}`}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="min-w-0">
          <p className="eyebrow">{ui(language, "comparisonWhatChanged")}</p>
          <h1 className="truncate font-display text-2xl">
            {plant.name} · {ui(language, "twoRealMoments")}
          </h1>
        </div>
      </div>

      {/* wipe comparison */}
      <div className="px-5 sm:px-8 lg:px-12">
        <div className="relative overflow-hidden rounded-3xl border border-border/70 shadow-lift select-none">
          <PhotoImage photo={b} alt={b.caption} className="aspect-[4/5] w-full object-cover sm:aspect-[16/9]" loading="eager" />
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${slider}%` }}>
            <PhotoImage
              photo={a}
              alt={a.caption}
              className="h-full w-full object-cover"
              style={{ width: `${(100 / Math.max(slider, 1)) * 100}%`, maxWidth: "none" }}
            />
          </div>
          <div className="absolute inset-y-0 w-px bg-white/80" style={{ left: `${slider}%` }}>
            <span className="absolute top-1/2 left-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-lift">
              <MoveHorizontal className="h-4 w-4" />
            </span>
          </div>
          <span className="absolute top-3 left-3 rounded-full bg-black/45 px-2.5 py-1 text-[0.65rem] text-white backdrop-blur">
             {formatDate(a.daysAgo)} · {ui(language, "dayLabel")} {Math.max(plant.plantedDaysAgo - a.daysAgo, 0)}
          </span>
          <span className="absolute top-3 right-3 rounded-full bg-black/45 px-2.5 py-1 text-[0.65rem] text-white backdrop-blur">
             {formatDate(b.daysAgo)} · {ui(language, "dayLabel")} {Math.max(plant.plantedDaysAgo - b.daysAgo, 0)}
          </span>
        </div>
        <input
          type="range"
          min={2}
          max={98}
          value={slider}
          onChange={(e) => setSlider(Number(e.target.value))}
          aria-label={ui(language, "revealEarlier")}
          className="mt-4 w-full accent-[var(--color-primary)]"
        />
      </div>

      <div className="mt-8 px-5 sm:px-8 lg:px-12">
        <div className="grid gap-px overflow-hidden rounded-3xl border border-border/70 bg-border/60 sm:grid-cols-3">
          <div className="bg-card p-4"><p className="eyebrow">{ui(language, "earlier")}</p><p className="mt-1 font-display text-lg">{ui(language, "dayLabel")} {Math.max(plant.plantedDaysAgo - earlier.daysAgo, 0)}</p><p className="text-xs text-muted-foreground">{earlier.caption}</p></div>
          <div className="bg-card p-4"><p className="eyebrow">{ui(language, "timeBetween")}</p><p className="mt-1 font-display text-lg">{result.days} {ui(language, "days")}</p><p className="text-xs text-muted-foreground">{context.length} {context.length === 1 ? ui(language, "relevantRecordedEvent") : ui(language, "relevantRecordedEvents")}</p></div>
          <div className="bg-card p-4"><p className="eyebrow">{ui(language, "later")}</p><p className="mt-1 font-display text-lg">{ageLabel(plant.plantedDaysAgo - later.daysAgo)}</p><p className="text-xs text-muted-foreground">{later.caption}</p></div>
        </div>
      </div>

      {/* pickers */}
      <div className="mt-8 grid gap-5 px-5 sm:grid-cols-2 sm:px-8 lg:px-12">
        {[
          { label: ui(language, "earlierPhoto"), value: aId, set: setAId },
          { label: ui(language, "laterPhoto"), value: bId, set: setBId },
        ].map((picker) => (
          <div key={picker.label}>
            <p className="eyebrow mb-2">{picker.label}</p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {photos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => picker.set(p.id)}
                  className={cn(
                    "press shrink-0 overflow-hidden rounded-2xl border-2",
                    p.id === picker.value ? "border-primary" : "border-transparent opacity-70",
                  )}
                >
                  <PhotoImage photo={p} alt={p.caption} className="h-16 w-16 object-cover" />
                  <span className="numeral block px-1 pb-1 text-[0.6rem] text-muted-foreground">
                    {formatDate(p.daysAgo)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {context.length ? <div className="mt-10 px-5 sm:px-8 lg:px-12"><div className="surface p-5"><div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><h2 className="font-display text-lg">{ui(language, "recordedBetweenMoments")}</h2><ProvenanceTag kind="recorded" /></div><div className="flex flex-wrap gap-2">{context.map((event) => <span key={event.id} className="rounded-full bg-secondary px-3 py-1.5 text-xs">{formatDate(event.daysAgo)} · {event.title}</span>)}</div></div></div> : null}

      {/* deltas */}
      <div className="mt-10 grid gap-4 px-5 sm:px-8 lg:grid-cols-2 lg:px-12">
        <div className="surface p-5">
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <h2 className="min-w-0 font-display text-lg">{ui(language, "recordedMeasurements")}</h2>
            <ProvenanceTag kind="observed" />
          </div>
          {hasRecordedMeasurements ? <ul className="space-y-4">
            {result.deltas.map((d) => {
              const diff = d.to - d.from;
              const pct = Math.min(100, Math.round((d.to / Math.max(d.from, d.to, 1)) * 100));
              return (
                <li key={d.label}>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                    <span className="truncate text-sm">{d.label}</span>
                    <span className="numeral shrink-0 text-sm">
                      {d.from}
                      {d.unit} <ArrowRight className="inline h-3 w-3 text-muted-foreground" /> {d.to}
                      {d.unit}
                      <span className={cn("ml-2 text-xs", diff >= 0 ? "text-primary" : "text-clay")}>
                        {diff >= 0 ? "+" : ""}
                        {diff}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-1000", diff >= 0 ? "bg-primary" : "bg-clay")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul> : <p className="text-sm text-muted-foreground">{ui(language, "noNumericMeasurements")}</p>}
        </div>

        <div className="space-y-4">
          <div className="surface p-5">
            <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="min-w-0 font-display text-lg">{ui(language, "observed")}</h2>
              <ProvenanceTag kind="observed" />
            </div>
            <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              {result.observations.map((o) => (
                <li key={o}>· {o}</li>
              ))}
            </ul>
          </div>
          <div className="surface p-5">
            <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="min-w-0 font-display text-lg">{ui(language, "possibleMeaning")}</h2>
              <ProvenanceTag kind="inferred" confidence={result.confidence} />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{result.inference}</p>
            <div className="mt-4">
              <ConfidenceBar confidence={result.confidence} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 px-5 sm:px-8 lg:px-12">
        <Link
          to="/plants/$plantId/film"
          params={{ plantId: plant.id }}
          className="press inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground"
        >
          {ui(language, "wholeArcFilm")} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
