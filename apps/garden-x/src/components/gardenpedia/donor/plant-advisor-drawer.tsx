import { useState } from "react";
import { Loader2, Sparkles, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ADVISOR_PRESETS } from "./plant-advisor.data";
import { getPlantRecommendations } from "./plant-advisor.service";
import type { AdvisorResponse } from "./plant-advisor.types";
import { donorPlants as plants, type DonorPlant } from "./canonical-adapter";

const plantsById = new Map<string, DonorPlant>(plants.map((plant) => [plant.id, plant]));

const PRESET_TITLES: Record<string, { en: string; es: string }> = {
  beginner: { en: "Beginner gardener", es: "Principiante sin experiencia" },
  "low-light": { en: "Low light / indoors", es: "Poca luz / interior" },
  "continuous-harvest": { en: "Continuous harvest", es: "Cosecha continua" },
  "compact-hydro": { en: "Compact hydroponics", es: "Hidroponía compacta" },
};

export function PlantAdvisorDrawer({
  activeFilters,
  onApplyRecommendations,
  language = "es",
}: {
  activeFilters?: {
    category?: string;
    light?: string;
    /** @deprecated Kept for callers from the previous two-axis pass. */
    indoorLight?: string;
    outdoorExposure?: string;
    inventory?: string;
  };
  onApplyRecommendations?: (plantIds: string[]) => void;
  language?: "en" | "es";
}) {
  const copy =
    language === "en"
      ? {
          title: "Ask Garden",
          description: "Describe your space and we will suggest catalog plants.",
          trigger: "Ask Garden",
          find: "Find plants",
          loading: "Evaluating catalog…",
          clear: "Clear",
          question: "What conditions or plans do you have?",
          placeholder: "E.g. east-facing balcony, little space, for salads",
          quick: "Quick ideas",
          diagnosis: "Assessment",
          recommendations: "Recommendations",
          apply: "Filter catalog with these options",
          noMatch: "Try adding light hours, indoor or outdoor context, and available space.",
          error: "We could not consult the advisor. Try again in a moment.",
          inventoryOwned: "Own seed inventory",
          viewDetail: "View full profile →",
        }
      : {
          title: "Ask Garden",
          description: "Describe tu espacio y te sugerimos cultivos del catálogo.",
          trigger: "Ask Garden",
          find: "Encontrar cultivos",
          loading: "Evaluando catálogo…",
          clear: "Limpiar",
          question: "¿Qué condiciones o planes tienes?",
          placeholder: "Ej: balcón con sol de mañana, poco espacio, para ensaladas",
          quick: "Ideas rápidas",
          diagnosis: "Diagnóstico",
          recommendations: "Recomendaciones",
          apply: "Filtrar catálogo con estas opciones",
          noMatch: "Prueba indicando horas de luz, interior o exterior y espacio disponible.",
          error: "No pudimos consultar el asesor. Intenta de nuevo en un momento.",
          inventoryOwned: "Con semilla propia",
          viewDetail: "Ver ficha completa →",
        };

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdvisorResponse | null>(null);

  async function run(nextQuery: string) {
    const trimmed = nextQuery.trim();
    if (!trimmed || loading) return;
    setQuery(trimmed);
    setLoading(true);
    setError(null);
    try {
      const response = await getPlantRecommendations({
        query: trimmed,
        language,
        ...(activeFilters ? { activeFilters } : {}),
      });
      setResult(response);
    } catch {
      setError(copy.error);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setQuery("");
    setResult(null);
    setError(null);
  }

  const matches = (result?.recommendations ?? []).filter((item) => plantsById.has(item.plantId));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="rounded-full shadow-none">
          <Sparkles className="size-4" aria-hidden="true" />
          {copy.trigger}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="gardenpedia-direct-sheet glass-dialog flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[440px]"
      >
        <SheetHeader className="border-b border-border/70 px-5 py-5 text-left">
          <SheetTitle className="flex items-center gap-2 font-display text-lg">
            <WandSparkles className="size-5 text-accent" aria-hidden="true" />
            {copy.title}
          </SheetTitle>
          <SheetDescription>{copy.description}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-5 py-5">
          <div className="space-y-3">
            <label
              className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
              htmlFor="advisor-query"
            >
              {copy.question}
            </label>
            <Textarea
              id="advisor-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.placeholder}
              className="glass-soft min-h-24 resize-none border-0 text-sm shadow-none focus-visible:ring-1"
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={() => run(query)}
                disabled={loading || !query.trim()}
                className="flex-1"
              >
                {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {loading ? copy.loading : copy.find}
              </Button>
              {result || error ? (
                <Button variant="ghost" onClick={reset}>
                  {copy.clear}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {copy.quick}
            </p>
            <div className="grid gap-2">
              {ADVISOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => run(preset.query)}
                  disabled={loading}
                  className="glass-soft flex items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-background/70 disabled:opacity-60"
                >
                  <span aria-hidden="true" className="text-base">
                    {preset.badge}
                  </span>
                  <span className="font-medium">
                    {PRESET_TITLES[preset.id]?.[language] ?? preset.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <p className="glass-soft px-4 py-3 text-sm text-muted-foreground">{error}</p>
          ) : null}

          {result ? (
            <div className="space-y-4 border-t border-border/70 pt-5">
              <div className="glass-soft p-4">
                <p className="eyebrow">{copy.diagnosis}</p>
                <p className="mt-2 text-sm leading-6">{result.summary}</p>
              </div>
              {result.cultivationAdvice ? (
                <div className="glass-soft p-4 text-sm leading-6">
                  <span aria-hidden="true">💡 </span>
                  {result.cultivationAdvice}
                </div>
              ) : null}

              {matches.length ? (
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {copy.recommendations} ({matches.length})
                  </p>
                  {matches.map((item) => {
                    const plant = plantsById.get(item.plantId)!;
                    return (
                      <article key={item.plantId} className="glass-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl" aria-hidden="true">
                              {plant.emoji}
                            </span>
                            <div>
                              <h4 className="font-display text-base font-semibold leading-tight">
                                {language === "es" ? plant.spanishName : plant.name}
                              </h4>
                              <p className="text-xs italic text-muted-foreground">
                                {plant.scientificName}
                              </p>
                            </div>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground",
                            )}
                          >
                            {item.score}% {language === "es" ? "afinidad" : "criteria match"}
                          </span>
                        </div>
                        {plant.inventory === "owned" ? (
                          <p className="mt-3 inline-flex rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-secondary-foreground">
                            {copy.inventoryOwned}
                          </p>
                        ) : null}
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {item.reason}
                        </p>
                        <a
                          href={`/gardenpedia#${encodeURIComponent(plant.id)}`}
                          onClick={() => setOpen(false)}
                          className="mt-4 inline-flex text-xs font-semibold text-accent underline-offset-4 hover:underline"
                        >
                          {copy.viewDetail}
                        </a>
                      </article>
                    );
                  })}
                  {onApplyRecommendations ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        onApplyRecommendations(matches.map((item) => item.plantId));
                        setOpen(false);
                      }}
                    >
                      {copy.apply}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <p className="glass-soft px-4 py-3 text-sm text-muted-foreground">{copy.noMatch}</p>
              )}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
