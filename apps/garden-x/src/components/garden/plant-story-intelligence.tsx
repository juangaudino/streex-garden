import { BookOpen, CircleHelp, Eye, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { ProvenanceTag } from "@/components/garden/atoms";
import type { PlantStoryContext, PlantStoryEvidenceRef } from "@/lib/plant-story-context";
import { ui, type UiCopyKey, type UiLanguage } from "@/lib/ui-copy";

function EvidenceRefs({ refs, language }: { refs: PlantStoryEvidenceRef[]; language: UiLanguage }) {
  if (!refs.length) return null;
  return (
    <div className="mt-2 flex min-w-0 max-w-full flex-wrap gap-1.5" aria-label={ui(language, "storyEvidenceReferences")}>
      {refs.slice(0, 4).map((ref) => (
        <span
          key={`${ref.kind}-${ref.id}`}
          className="inline-flex min-w-0 max-w-full items-center rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[0.625rem] whitespace-normal break-words text-muted-foreground"
        >
          <span className="min-w-0 max-w-full whitespace-normal break-words">{ref.label}</span>
        </span>
      ))}
    </div>
  );
}

function StoryList({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Eye;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border/60 bg-background/45 p-4">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
        <p className="eyebrow min-w-0">{title}</p>
      </div>
      <div className="mt-3 min-w-0 space-y-3">{children}</div>
    </div>
  );
}

type StoryGroupKey =
  | "storyGroupBegins"
  | "storyGroupNewPlace"
  | "storyGroupVisibleDevelopment"
  | "storyGroupPropagation"
  | "storyGroupRecordedCare";

function eventGroupKey(
  event: PlantStoryContext["events"][number],
  index: number,
): StoryGroupKey {
  if (index === 0) return "storyGroupBegins";
  if (event.lifeEvent === "moved" || event.lifeEvent === "transplanted" || event.type === "transplant") {
    return "storyGroupNewPlace";
  }
  if (event.lifeEvent === "propagated") return "storyGroupPropagation";
  if (
    event.lifeEvent === "germinated" ||
    event.lifeEvent === "sprouted" ||
    event.lifeEvent === "growth_observed" ||
    event.lifeEvent === "flowered" ||
    event.lifeEvent === "fruited" ||
    event.lifeEvent === "harvested" ||
    event.lifeEvent === "regrowth"
  ) {
    return "storyGroupVisibleDevelopment";
  }
  return "storyGroupRecordedCare";
}

function groupedEvents(context: PlantStoryContext, language: UiLanguage) {
  const groups = new Map<StoryGroupKey, { titles: string[]; evidence: PlantStoryEvidenceRef[] }>();
  context.events.slice(0, 8).forEach((event, index) => {
    const key = eventGroupKey(event, index);
    const group = groups.get(key) ?? { titles: [], evidence: [] };
    group.titles.push(event.title);
    group.evidence.push(...event.evidence);
    groups.set(key, group);
  });
  return [...groups.entries()].map(([key, value]) => ({
    label: ui(language, key as UiCopyKey),
    ...value,
  }));
}

/** Compact derived story reading. It renders source evidence, never canonical AI state. */
export function PlantStoryIntelligence({
  context,
  language,
}: {
  context: PlantStoryContext;
  language: UiLanguage;
}) {
  const hasDerivedReading =
    context.observations.length > 0 ||
    context.interpretations.length > 0 ||
    context.recommendations.length > 0 ||
    context.uncertainties.length > 0;
  const eventGroups = groupedEvents(context, language);

  return (
    <section
      className="min-w-0 rounded-3xl border border-border/70 bg-card p-5 shadow-soft"
      aria-labelledby="plant-story-intelligence-title"
    >
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{ui(language, "storyEyebrow")}</p>
          <h2 id="plant-story-intelligence-title" className="mt-1 font-display text-2xl">
            {ui(language, "storyTitle")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {ui(language, "storyDescription")}
          </p>
        </div>
        <BookOpen className="mt-1 h-5 w-5 shrink-0 text-primary" strokeWidth={1.7} />
      </div>

      <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
        <StoryList icon={BookOpen} title={ui(language, "storySinceArriving")}>
          {context.facts.map((fact) => (
            <div key={fact.id} className="min-w-0">
              <p className="text-xs text-muted-foreground">{fact.label}</p>
              <p className="mt-0.5 min-w-0 max-w-full whitespace-normal break-words text-sm font-medium">
                {fact.value}
              </p>
              <EvidenceRefs refs={fact.evidence} language={language} />
            </div>
          ))}
          {eventGroups.length ? (
            <div className="min-w-0 border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">{ui(language, "storySelectedEvents")}</p>
              <ul className="mt-2 min-w-0 space-y-2">
                {eventGroups.map((group) => (
                  <li key={group.label} className="min-w-0 text-sm">
                    <p className="font-medium">{group.label}</p>
                    <p className="mt-0.5 min-w-0 whitespace-normal break-words text-muted-foreground">
                      {group.titles.join(" · ")}
                    </p>
                    <EvidenceRefs refs={group.evidence} language={language} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </StoryList>

        {context.interpretations.length ? (
          <StoryList icon={Lightbulb} title={ui(language, "storyWhatMayMean")}>
            {context.interpretations.map((item) => (
              <div key={item.id} className="min-w-0">
                <ProvenanceTag kind="inferred" confidence={item.confidence} />
                <p className="mt-2 min-w-0 whitespace-normal break-words text-sm leading-relaxed">
                  {item.text}
                </p>
                <EvidenceRefs refs={item.evidence} language={language} />
              </div>
            ))}
          </StoryList>
        ) : null}
      </div>

      {context.observations.length ? (
        <div className="mt-3 min-w-0 rounded-2xl border border-observation/20 bg-observation/5 p-4">
          <div className="flex min-w-0 items-center gap-2">
            <Eye className="h-4 w-4 shrink-0 text-observation" strokeWidth={1.8} />
            <p className="eyebrow">{ui(language, "storyObservations")}</p>
          </div>
          {context.observations.map((item) => (
            <div key={item.id} className="mt-3 min-w-0">
              <ProvenanceTag kind="observed" />
              <p className="mt-2 min-w-0 whitespace-normal break-words text-sm leading-relaxed">
                {item.text}
              </p>
              <EvidenceRefs refs={item.evidence} language={language} />
            </div>
          ))}
        </div>
      ) : null}

      {context.uncertainties.length ? (
        <div className="mt-3 min-w-0 rounded-2xl border border-inference/20 bg-inference/5 p-4">
          <div className="flex min-w-0 items-center gap-2">
            <CircleHelp className="h-4 w-4 shrink-0 text-inference" strokeWidth={1.8} />
            <p className="eyebrow">{ui(language, "storyUncertainty")}</p>
          </div>
          {context.uncertainties.map((item) => (
            <div key={item.id} className="mt-3 min-w-0">
              <p className="min-w-0 whitespace-normal break-words text-sm leading-relaxed text-muted-foreground">
                {item.text}
              </p>
              <EvidenceRefs refs={item.evidence} language={language} />
            </div>
          ))}
        </div>
      ) : null}

      {!hasDerivedReading ? (
        <p className="mt-4 text-sm text-muted-foreground">{ui(language, "storyNoInterpretation")}</p>
      ) : null}
    </section>
  );
}
