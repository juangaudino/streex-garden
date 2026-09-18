import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, ScanLine, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { useGarden } from "@/lib/garden-store";
import { analysePhoto, formatDate, plantEvents, plantPhotos, type AnalysisResult } from "@/lib/garden-logic";
import { runAiCheck } from "@/lib/garden-backend";
import { ConfidenceBar, ProvenanceTag, SectionTitle } from "@/components/garden/atoms";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plants/$plantId/check")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: search["from"] === "garden-ai" ? "garden-ai" as const : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AI check — Garden X" },
      {
        name: "description",
        content:
          "Analyse a plant photo into observations, possible explanations, confidence and a recommended action — with uncertainty kept explicit.",
      },
      { property: "og:title", content: "AI check — Garden X" },
      {
        property: "og:description",
        content: "Observations, possible explanations, confidence and a recommended action for one photo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Check_,
});

function Check_() {
  const { plantId } = Route.useParams();
  const { from } = Route.useSearch();
  const store = useGarden();
  const plant = store.plants.find((p) => p.id === plantId);
  if (!plant) throw notFound();

  const photos = plantPhotos(store.photos, plant.id);
  const events = plantEvents(store.events, plant.id);
  const [selected, setSelected] = useState(photos[photos.length - 1]?.id ?? "");
  const [phase, setPhase] = useState<"idle" | "scanning" | "done">("idle");
  const [saved, setSaved] = useState(false);
  const [aiResult, setAiResult] = useState<AnalysisResult | null>(null);
  const photo = store.photos.find((p) => p.id === selected)!;
  const fallbackResult = analysePhoto(plant, photo, events);
  const result = aiResult ?? fallbackResult;

  const run = () => {
    setPhase("scanning");
    setSaved(false);
    setAiResult(null);
    if (!plant.backendGrowCycleId || !photo.backendEventId) {
      window.setTimeout(() => { setAiResult(fallbackResult); setPhase("done"); }, 700);
      return;
    }
    void runAiCheck(plant.backendGrowCycleId, photo.id)
      .then(({ proposal }) => {
        const confidence = proposal.confidence === "high" ? "high" : proposal.confidence === "medium" ? "moderate" : "low";
        const observations = Array.isArray(proposal.observations) ? proposal.observations.map(String) : [];
        const uncertainty = Array.isArray(proposal.uncertainty) ? proposal.uncertainty.map(String) : [];
        const recs = Array.isArray(proposal.development_recommendations) ? proposal.development_recommendations : [];
        const findings: AnalysisResult["findings"] = [
          ...observations.map((body, index) => ({ kind: "observed" as const, title: index === 0 ? "Visible state" : "Observation", body })),
          ...uncertainty.map((body) => ({ kind: "inference" as const, title: "Uncertainty", body, confidence })),
          ...recs.filter((item) => item.recommendation !== "no_action").map((item) => ({ kind: "recommendation" as const, title: String(item.kind ?? "Next step"), body: String(item.rationale ?? ""), confidence: item.confidence === "high" ? "high" as const : item.confidence === "medium" ? "moderate" as const : "low" as const })),
        ];
        setAiResult({ headline: String(proposal.summary ?? "Garden AI check"), confidence, findings, grounding: [`Photo · ${formatDate(photo.daysAgo)}`, `${events.length} recorded events`] });
      })
      .catch(() => setAiResult(fallbackResult))
      .finally(() => setPhase("done"));
  };

  return (
    <div className="rise pb-20">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-5 pt-7 pb-5 sm:px-8 lg:px-12">
        {from === "garden-ai" ? (
          <Link to="/garden-ai" className="press grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/70 bg-card" aria-label="Back to Garden AI">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <Link to="/plants/$plantId" params={{ plantId: plant.id }} className="press grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/70 bg-card" aria-label={`Back to ${plant.name}`}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="min-w-0">
          <p className="eyebrow">AI check</p>
          <h1 className="truncate font-display text-2xl">{plant.name}</h1>
        </div>
      </div>

      <div className="grid gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,9fr)] lg:px-12">
        {/* photo pane */}
        <div>
          <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft">
            <img src={photo.src} alt={photo.caption} className="aspect-[4/5] w-full object-cover" />
            {phase === "scanning" ? (
              <>
                <div className="absolute inset-0 bg-primary/10" />
                <div className="scan-sweep absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 bg-black/45 px-4 py-3 text-xs text-white backdrop-blur-md">
                  Reading colour, density and leaf edges…
                </div>
              </>
            ) : null}
            {phase === "done" ? (
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-black/45 px-4 py-3 text-xs text-white backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" /> Analysis refined against {events.length} recorded events
              </div>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {photo.caption} · {formatDate(photo.daysAgo)}
          </p>

          <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
            {photos.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelected(p.id);
                  setPhase("idle");
                }}
                className={cn(
                  "press h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 transition-colors",
                  p.id === selected ? "border-primary" : "border-transparent opacity-70",
                )}
              >
                <img src={p.src} alt={p.caption} loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>

          <button
            onClick={run}
            disabled={phase === "scanning"}
            className="press mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground disabled:opacity-70"
          >
            <ScanLine className="h-4 w-4" />
            {phase === "idle" ? "Analyse this photo" : phase === "scanning" ? "Analysing…" : "Analyse again"}
          </button>
        </div>

        {/* result pane */}
        <div>
          {phase !== "done" ? (
            <div className="surface grid min-h-64 place-items-center p-8 text-center">
              <div className="max-w-sm">
                <span className={cn("mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-primary", phase === "scanning" && "breathe")}>
                  <Sparkles className="h-5 w-5" />
                </span>
                <p className="mt-4 font-display text-xl">
                  {phase === "scanning" ? "Refining the reading" : "Nothing claimed yet"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {phase === "scanning"
                    ? "First the image, then the history. Observations are separated from guesses."
                    : "Pick a photo and run the check. Results are split into what is visible, what it might mean, and what to do."}
                </p>
              </div>
            </div>
          ) : (
            <div className="rise space-y-4">
              <div className="surface p-5">
                <p className="eyebrow">Headline</p>
                <p className="mt-1.5 font-display text-2xl">{result.headline}</p>
                <div className="mt-4">
                  <ConfidenceBar confidence={result.confidence} />
                </div>
              </div>

              {(["observed", "inference", "recommendation"] as const).map((kind) => {
                const items = result.findings.filter((f) => f.kind === kind);
                if (!items.length) return null;
                const heading =
                  kind === "observed" ? "Observed" : kind === "inference" ? "Possible explanation" : "Recommended action";
                return (
                  <div key={kind} className="surface p-5">
                    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <h2 className="min-w-0 truncate font-display text-lg">{heading}</h2>
                      <ProvenanceTag kind={kind === "inference" ? "inferred" : kind === "observed" ? "observed" : "recommendation"} />
                    </div>
                    <ul className="space-y-3.5">
                      {items.map((f) => (
                        <li key={f.title}>
                          <p className="text-sm font-medium">{f.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                          {f.confidence ? (
                            <p className="mt-1 text-xs text-inference capitalize">Confidence: {f.confidence}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}

              <div className="surface p-5">
                <p className="eyebrow">What this reading is grounded in</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {result.grounding.map((g) => (
                    <li key={g}>· {g}</li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted-foreground">
                  Saving stores the analysis as its own timeline event. It does not change {plant.name}'s identity,
                  species, or status.
                </p>
                <button
                  onClick={() => {
                    const inference = result.findings.find((f) => f.kind === "inference");
                    store.addEvent({
                      plantId: plant.id,
                      daysAgo: 0,
                      type: "ai",
                      title: `AI check: ${result.headline.toLowerCase()}`,
                      ...(inference && { detail: inference.body }),
                      photoId: photo.id,
                      provenance: "inferred",
                    });
                    setSaved(true);
                    toast.success("Analysis saved to the timeline");
                  }}
                  disabled={saved}
                  className="press mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm disabled:opacity-60"
                >
                  <Check className="h-4 w-4 text-primary" /> {saved ? "Saved to timeline" : "Save to timeline"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 px-5 sm:px-8 lg:px-12">
        <SectionTitle>Keep going</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/plants/$plantId/compare"
            params={{ plantId: plant.id }}
            search={{ from }}
            className="press rounded-full border border-border/70 bg-card px-4 py-2.5 text-sm"
          >
            Compare two dates
          </Link>
          <Link
            to="/plants/$plantId/ask"
            params={{ plantId: plant.id }}
            search={{ from, prompt: undefined }}
            className="press rounded-full border border-border/70 bg-card px-4 py-2.5 text-sm"
          >
            Ask about {plant.name}
          </Link>
        </div>
      </div>
    </div>
  );
}