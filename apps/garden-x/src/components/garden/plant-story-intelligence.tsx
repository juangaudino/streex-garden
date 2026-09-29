import { BookOpen, CircleHelp, Eye, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { ProvenanceTag } from "@/components/garden/atoms";
import type { PlantStoryContext, PlantStoryEvidenceRef } from "@/lib/plant-story-context";
import { preferredLanguage } from "@/lib/ui-copy";

function EvidenceRefs({ refs }: { refs: PlantStoryEvidenceRef[] }) {
  if (!refs.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Evidence references">
      {refs.slice(0, 4).map((ref) => (
        <span
          key={`${ref.kind}-${ref.id}`}
          className="inline-flex max-w-full items-center rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[0.625rem] text-muted-foreground"
        >
          <span className="truncate">{ref.label}</span>
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
    <div className="rounded-2xl border border-border/60 bg-background/45 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.8} />
        <p className="eyebrow">{title}</p>
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

/** Compact derived story reading. It renders source evidence, never canonical AI state. */
export function PlantStoryIntelligence({ context }: { context: PlantStoryContext }) {
  const language = preferredLanguage();
  const hasDerivedReading =
    context.observations.length > 0 ||
    context.interpretations.length > 0 ||
    context.recommendations.length > 0 ||
    context.uncertainties.length > 0;

  return (
    <section
      className="mx-5 mt-6 rounded-3xl border border-border/70 bg-card p-5 shadow-soft sm:mx-8 lg:mx-12"
      aria-labelledby="plant-story-intelligence-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{language === "es" ? "Historia de la planta" : "Plant story"}</p>
          <h2 id="plant-story-intelligence-title" className="mt-1 font-display text-2xl">
            {language === "es" ? "Una lectura de su historia" : "A reading of its story"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {language === "es"
              ? "Hecha a partir de hechos registrados y evidencia disponible."
              : "Built from recorded facts and the evidence available."}
          </p>
        </div>
        <BookOpen className="mt-1 h-5 w-5 shrink-0 text-primary" strokeWidth={1.7} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <StoryList icon={BookOpen} title={language === "es" ? "Desde que llegó" : "Since arriving"}>
          {context.facts.map((fact) => (
            <div key={fact.id}>
              <p className="text-xs text-muted-foreground">{fact.label}</p>
              <p className="mt-0.5 text-sm font-medium">{fact.value}</p>
              <EvidenceRefs refs={fact.evidence} />
            </div>
          ))}
          {context.events.length ? (
            <div className="border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">
                {language === "es" ? "Hechos seleccionados" : "Selected recorded events"}
              </p>
              <ul className="mt-2 space-y-2">
                {context.events.slice(0, 5).map((event) => (
                  <li key={event.id} className="text-sm">
                    <span>
                      {language === "es" ? "Registrado: " : "Recorded: "}
                      {event.title}
                    </span>
                    <EvidenceRefs refs={event.evidence} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </StoryList>

        {context.interpretations.length ? (
          <StoryList
            icon={Lightbulb}
            title={language === "es" ? "Qué puede significar" : "What this may mean"}
          >
            {context.interpretations.map((item) => (
              <div key={item.id}>
                <ProvenanceTag kind="inferred" confidence={item.confidence} />
                <p className="mt-2 text-sm leading-relaxed">{item.text}</p>
                <EvidenceRefs refs={item.evidence} />
              </div>
            ))}
          </StoryList>
        ) : null}
      </div>

      {context.observations.length ? (
        <div className="mt-3 rounded-2xl border border-observation/20 bg-observation/5 p-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-observation" strokeWidth={1.8} />
            <p className="eyebrow">{language === "es" ? "Observaciones" : "Observations"}</p>
          </div>
          {context.observations.map((item) => (
            <div key={item.id} className="mt-3">
              <ProvenanceTag kind="observed" />
              <p className="mt-2 text-sm leading-relaxed">{item.text}</p>
              <EvidenceRefs refs={item.evidence} />
            </div>
          ))}
        </div>
      ) : null}

      {context.uncertainties.length ? (
        <div className="mt-3 rounded-2xl border border-inference/20 bg-inference/5 p-4">
          <div className="flex items-center gap-2">
            <CircleHelp className="h-4 w-4 text-inference" strokeWidth={1.8} />
            <p className="eyebrow">
              {language === "es" ? "Lo que sigue incierto" : "What remains uncertain"}
            </p>
          </div>
          {context.uncertainties.map((item) => (
            <div key={item.id} className="mt-3">
              <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              <EvidenceRefs refs={item.evidence} />
            </div>
          ))}
        </div>
      ) : null}

      {!hasDerivedReading ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {language === "es"
            ? "Todavía no hay suficiente evidencia para interpretar una historia más allá de los hechos registrados."
            : "There is not yet enough evidence to interpret more than the recorded facts."}
        </p>
      ) : null}
    </section>
  );
}
