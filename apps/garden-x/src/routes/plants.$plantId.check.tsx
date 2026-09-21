import { useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, ScanLine, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { useGarden } from "@/lib/garden-store";
import { canRunAiCheck, formatDate, plantEvents, plantPhotos } from "@/lib/garden-logic";
import { runAiCheck } from "@/lib/garden-backend";
import { buildAiCheckPresentation, shouldShowFindingConfidence } from "@/lib/ai-check-presentation";
import { ConfidenceBar, ProvenanceTag, SectionTitle } from "@/components/garden/atoms";
import { PhotoImage } from "@/components/garden/photo-image";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui-copy";

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
  const language = store.language;
  const plant = store.plants.find((p) => p.id === plantId);
  if (!plant) throw notFound();

  const photos = plantPhotos(store.photos, plant.id);
  const events = plantEvents(store.events, plant.id);
  const [selected, setSelected] = useState(photos[photos.length - 1]?.id ?? "");
  const [phase, setPhase] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [saved, setSaved] = useState(false);
  const [aiResult, setAiResult] = useState<AnalysisResult | null>(null);
  const analysisRequestRef = useRef<string | null>(null);
  const photo = store.photos.find((p) => p.id === selected)!;
  const result = aiResult;

  const run = () => {
    const requestToken = crypto.randomUUID();
    analysisRequestRef.current = requestToken;
    setPhase("scanning");
    setSaved(false);
    setAiResult(null);
    if (!canRunAiCheck(plant, photo)) {
      setPhase("error");
      return;
    }
    const growCycleId = plant.backendGrowCycleId;
    if (!growCycleId) {
      setPhase("error");
      return;
    }
    void runAiCheck(growCycleId, photo.id, undefined, language)
      .then(({ proposal }) => {
        if (analysisRequestRef.current !== requestToken) return;
        setAiResult(buildAiCheckPresentation(proposal, language, [`${ui(language, "photo")} · ${formatDate(photo.daysAgo)}`, `${events.length} ${ui(language, "recordedEvents")}`]));
      })
      .then(() => {
        if (analysisRequestRef.current === requestToken) setPhase("done");
      })
      .catch(() => {
        if (analysisRequestRef.current === requestToken) setPhase("error");
      });
  };

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
          <p className="eyebrow">{ui(language, "aiCheck")}</p>
          <h1 className="truncate font-display text-2xl">{plant.name}</h1>
        </div>
      </div>

      <div className="grid min-w-0 gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,9fr)] lg:px-12">
        {/* photo pane */}
        <div className="min-w-0">
          <div className="relative h-[min(62vh,28rem)] min-h-0 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft sm:h-auto sm:aspect-[4/5]">
            <PhotoImage
              photo={photo}
              alt={photo.caption}
              className="h-full w-full object-contain sm:object-cover"
              loading="eager"
            />
            {phase === "scanning" ? (
              <>
                <div className="absolute inset-0 bg-primary/10" />
                <div className="scan-sweep absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 bg-black/45 px-4 py-3 text-xs text-white backdrop-blur-md">
                  {ui(language, "readingImage")}
                </div>
              </>
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
                  analysisRequestRef.current = null;
                  setSelected(p.id);
                  setPhase("idle");
                  setAiResult(null);
                }}
                className={cn(
                  "press h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 transition-colors",
                  p.id === selected ? "border-primary" : "border-transparent opacity-70",
                )}
              >
                <PhotoImage photo={p} alt={p.caption} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>

          <button
            onClick={run}
            disabled={phase === "scanning"}
            className="press mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground disabled:opacity-70"
          >
            <ScanLine className="h-4 w-4" />
            {phase === "idle" ? ui(language, "analysePhoto") : phase === "scanning" ? ui(language, "analysing") : ui(language, "analyseAgain")}
          </button>
        </div>

        {/* result pane */}
        <div className="min-w-0">
          {phase !== "done" || !result ? (
            <div className="surface grid min-h-64 place-items-center p-8 text-center">
              <div className="max-w-sm">
                <span className={cn("mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent text-primary", phase === "scanning" && "breathe")}>
                  <Sparkles className="h-5 w-5" />
                </span>
                <p className="mt-4 font-display text-xl">
                  {phase === "scanning" ? ui(language, "refiningReading") : phase === "error" ? ui(language, "analysisUnavailable") : ui(language, "nothingClaimed")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {phase === "scanning" ? ui(language, "checkScanningInstruction") : phase === "error" ? ui(language, "analysisUnavailableBody") : ui(language, "checkInstruction")}
                </p>
              </div>
            </div>
          ) : (
            <div className="rise space-y-4">
              <div className="surface p-4 sm:p-5">
                <p className="font-display text-2xl">{result.headline}</p>
                {result.summary ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.summary}</p> : null}
                <div className="mt-4">
                  <ConfidenceBar confidence={result.confidence} />
                </div>
              </div>

              {(() => {
                const observed = result.findings.filter((f) => f.kind === "observed");
                if (!observed.length) return null;
                return (
                  <div className="surface p-4 sm:p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="font-display text-lg">{ui(language, "observed")}</h2>
                      <ProvenanceTag kind="observed" />
                    </div>
                    <ul className="space-y-2.5">
                      {observed.map((f, index) => <li key={`observed-${index}`} className="relative pl-4 text-sm leading-relaxed text-muted-foreground before:absolute before:left-0 before:text-primary before:content-['•']">{f.body}</li>)}
                    </ul>
                  </div>
                );
              })()}

              {(() => {
                const interpretations = result.findings.filter((f) => f.kind === "inference" && f.subkind !== "uncertainty");
                const uncertainty = result.findings.filter((f) => f.kind === "inference" && f.subkind === "uncertainty");
                if (!interpretations.length && !uncertainty.length) return null;
                return (
                  <div className="surface p-4 sm:p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="font-display text-lg">{ui(language, "possibleMeaning")}</h2>
                      <ProvenanceTag kind="inferred" />
                    </div>
                    {interpretations.length ? (
                      <ul className="space-y-2.5">
                        {interpretations.map((f, index) => (
                          <li key={`interpretation-${index}`} className="relative pl-4 text-sm leading-relaxed text-muted-foreground before:absolute before:left-0 before:text-primary before:content-['•']">
                            {f.body}
                            {shouldShowFindingConfidence(f, result.confidence) ? <span className="mt-1 block text-xs text-inference">{ui(language, "confidence")}: {ui(language, f.confidence === "high" ? "confidenceHigh" : f.confidence === "moderate" ? "confidenceModerate" : "confidenceLow")}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {uncertainty.length ? (
                      <div className={cn("border-border/70", interpretations.length && "mt-4 border-t pt-4")}>
                        <p className="eyebrow">{ui(language, "uncertainty")}</p>
                        <ul className="mt-2.5 space-y-2.5">
                          {uncertainty.map((f, index) => <li key={`uncertainty-${index}`} className="relative pl-4 text-sm leading-relaxed text-muted-foreground before:absolute before:left-0 before:text-primary before:content-['•']">{f.body}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              {(() => {
                const recommendations = result.findings.filter((f) => f.kind === "recommendation");
                if (!recommendations.length) return null;
                return (
                  <div className="surface p-4 sm:p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="font-display text-lg">{ui(language, "recommendations")}</h2>
                      <ProvenanceTag kind="recommendation" />
                    </div>
                    <ul className="space-y-3">
                      {recommendations.map((f, index) => (
                        <li key={`recommendation-${index}`} className="relative pl-4 before:absolute before:left-0 before:text-primary before:content-['•']">
                          {f.title ? <p className="text-sm font-medium">{f.title}</p> : null}
                          <p className={cn("text-sm leading-relaxed text-muted-foreground", f.title && "mt-1")}>{f.body}</p>
                          {shouldShowFindingConfidence(f, result.confidence) ? <p className="mt-1 text-xs text-inference">{ui(language, "confidence")}: {ui(language, f.confidence === "high" ? "confidenceHigh" : f.confidence === "moderate" ? "confidenceModerate" : "confidenceLow")}</p> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              <div className="surface p-4 sm:p-5">
                <p className="eyebrow">{ui(language, "groundedIn")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.grounding.map((g) => <span key={g} className="rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground">{g}</span>)}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {ui(language, "savingDoesNotChange")}
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
                    toast.success(ui(language, "analysisSaved"));
                  }}
                  disabled={saved}
                  className="press mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm disabled:opacity-60"
                >
                  <Check className="h-4 w-4 text-primary" /> {saved ? ui(language, "savedTimeline") : ui(language, "saveTimeline")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 px-5 sm:px-8 lg:px-12">
        <SectionTitle>{ui(language, "keepGoing")}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/plants/$plantId/compare"
            params={{ plantId: plant.id }}
            search={{ from }}
            className="press rounded-full border border-border/70 bg-card px-4 py-2.5 text-sm"
          >
            {ui(language, "compareDates")}
          </Link>
          <Link
            to="/plants/$plantId/ask"
            params={{ plantId: plant.id }}
            search={{ from, prompt: undefined }}
            className="press rounded-full border border-border/70 bg-card px-4 py-2.5 text-sm"
          >
            {ui(language, "askAbout")} {plant.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
