import { ArrowRight, Eye, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ProvenanceTag } from "@/components/garden/atoms";
import { formatDate } from "@/lib/garden-logic";
import type {
  MeaningfulChangeResult,
  PlantChangeMetric,
  PlantChangeReading,
} from "@/lib/meaningful-changes";
import { ui, type UiLanguage } from "@/lib/ui-copy";

function evidenceLabel(reading: PlantChangeReading, language: UiLanguage) {
  return `${formatDate(reading.before.daysAgo, language)} → ${formatDate(reading.after.daysAgo, language)}`;
}

function metricLabel(metric: PlantChangeMetric, language: UiLanguage) {
  const name = ui(
    language,
    metric.key === "heightCm"
      ? "storyMetricHeight"
      : metric.key === "leafCount"
        ? "storyMetricLeaves"
        : "storyMetricDensity",
  );
  const direction = ui(
    language,
    metric.direction === "increased" ? "storyChangeIncreased" : "storyChangeDecreased",
  );
  return `${name} ${direction} · ${Math.abs(metric.delta)}`;
}

function EvidencePill({ children, to }: { children: string; to?: { plantId: string; photoId?: string; eventId?: string } }) {
  if (to) {
    return (
      <Link
        to="/plants/$plantId/"
        params={{ plantId: to.plantId }}
        search={{
          tab: to.photoId ? "Photos" : "Timeline",
          focusPhotoId: to.photoId,
          focusEventId: to.eventId,
        }}
        className="inline-flex min-w-0 max-w-full whitespace-normal break-words rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[0.625rem] text-primary underline-offset-2 hover:underline"
      >
        {children}
      </Link>
    );
  }
  return (
    <span className="inline-flex min-w-0 max-w-full whitespace-normal break-words rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[0.625rem] text-muted-foreground">
      {children}
    </span>
  );
}

export function PlantChangeReading({
  reading,
  result,
  language,
  analyzing,
  onAnalyze,
  plantId,
  showAnalyzeAction = true,
}: {
  reading: PlantChangeReading | null;
  result: MeaningfulChangeResult | null;
  language: UiLanguage;
  analyzing: boolean;
  onAnalyze: () => void;
  plantId?: string;
  showAnalyzeAction?: boolean;
}) {
  if (!reading) return null;

  return (
    <section
      className="mt-3 min-w-0 rounded-2xl border border-border/60 bg-background/45 p-4"
      aria-labelledby="plant-change-reading-title"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{ui(language, "storyChangeEyebrow")}</p>
          <h3 id="plant-change-reading-title" className="mt-1 font-display text-xl">
            {ui(language, "storyChangeTitle")}
          </h3>
          <p className="mt-1 min-w-0 max-w-full text-sm text-muted-foreground">
            {evidenceLabel(reading, language)} · {reading.elapsedDays}{" "}
            {ui(language, reading.elapsedDays === 1 ? "day" : "days")}
          </p>
        </div>
        <Eye className="mt-1 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
      </div>

      {result ? (
        <div className="mt-4 min-w-0 space-y-3">
          <div className="min-w-0">
            <ProvenanceTag kind="observed" />
            <p className="mt-2 min-w-0 whitespace-normal break-words text-sm leading-relaxed">
              {result.primaryVisualObservation}
            </p>
          </div>
          {result.interpretation ? (
            <div className="min-w-0">
              <ProvenanceTag
                kind="inferred"
                confidence={result.interpretationConfidence ?? "low"}
              />
              <p className="mt-2 min-w-0 whitespace-normal break-words text-sm leading-relaxed">
                {result.interpretation}
              </p>
            </div>
          ) : null}
          {result.comparabilityNotes.length ? (
            <div className="min-w-0">
              <p className="eyebrow">{ui(language, "storyChangeUncertainty")}</p>
              <p className="mt-2 min-w-0 whitespace-normal break-words text-sm text-muted-foreground">
                {result.comparabilityNotes.join(" ")}
              </p>
            </div>
          ) : null}
          {result.supportingVisualObservations.length ? (
            <ul className="min-w-0 space-y-1 text-sm leading-relaxed text-muted-foreground">
              {result.supportingVisualObservations.map((observation) => <li key={observation}>· {observation}</li>)}
            </ul>
          ) : null}
          <div className="flex min-w-0 flex-wrap gap-1.5">
            <EvidencePill to={plantId ? { plantId, photoId: reading.before.id } : undefined}>
              {formatDate(reading.before.daysAgo, language)}
            </EvidencePill>
            <EvidencePill to={plantId ? { plantId, photoId: reading.after.id } : undefined}>
              {formatDate(reading.after.daysAgo, language)}
            </EvidencePill>
            {reading.contextFacts.slice(0, 3).map((fact, index) => (
              <EvidencePill key={`${fact.text}-${index}`} to={plantId && fact.eventId ? { plantId, eventId: fact.eventId } : undefined}>
                {fact.text}
              </EvidencePill>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 min-w-0 space-y-3">
          {reading.metrics.length ? (
            <div className="min-w-0">
              <ProvenanceTag kind="recorded" />
              <p className="mt-2 min-w-0 whitespace-normal break-words text-sm leading-relaxed">
                {ui(language, "storyChangeRecorded")}
              </p>
              <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                {reading.metrics.map((metric) => (
                  <EvidencePill key={metric.key}>{metricLabel(metric, language)}</EvidencePill>
                ))}
              </div>
            </div>
          ) : reading.state === "visual_review_available" ? (
            <p className="min-w-0 whitespace-normal break-words text-sm leading-relaxed text-muted-foreground">
              {ui(language, "storyChangeVisualAvailable")}
            </p>
          ) : reading.state === "metadata_only" ? (
            <p className="min-w-0 whitespace-normal break-words text-sm leading-relaxed text-muted-foreground">
              {ui(language, "storyChangeMetadataOnly")}
            </p>
          ) : (
            <p className="min-w-0 whitespace-normal break-words text-sm leading-relaxed text-muted-foreground">
              {ui(language, "storyChangeNoComparable")}
            </p>
          )}

          {showAnalyzeAction && reading.visualEvidenceAvailable && !reading.metrics.length ? (
            <button
              type="button"
              onClick={onAnalyze}
              disabled={analyzing}
              className="press inline-flex min-h-9 items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-2 text-xs font-medium shadow-soft disabled:cursor-wait disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
              {ui(language, analyzing ? "storyAnalyzingChange" : "storyAnalyzeChange")}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
