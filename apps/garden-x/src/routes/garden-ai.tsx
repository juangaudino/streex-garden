import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, ChevronDown, GitCompareArrows, Search, ScanLine, Sparkles } from "lucide-react";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { PageHeader } from "@/components/garden/shell";
import { PlantThumb, ProvenanceTag } from "@/components/garden/atoms";
import { Button } from "@/components/ui/button";
import { useGarden } from "@/lib/garden-store";
import { cn } from "@/lib/utils";
import { gardenCoverPhoto } from "@/lib/garden-logic";
import { PhotoImage } from "@/components/garden/photo-image";
import { ui } from "@/lib/ui-copy";

export const Route = createFileRoute("/garden-ai")({
  head: () => ({
    meta: [
      { title: "Garden AI tools — Garden X" },
      { name: "description", content: "Ask about your garden, identify a plant, or inspect changes with evidence-aware AI tools." },
      { property: "og:title", content: "Garden AI tools — Garden X" },
      { property: "og:description", content: "AI tools grounded in your plants, photos, and recorded history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GardenAI,
});

const plantTools = [
  { to: "/plants/$plantId/check", titleKey: "aiCheckTitle", descriptionKey: "aiCheckDescription", icon: ScanLine },
  { to: "/plants/$plantId/compare", titleKey: "aiCompareTitle", descriptionKey: "aiCompareDescription", icon: GitCompareArrows },
] as const;

function GardenAI() {
  const store = useGarden();
  const language = store.language;
  const navigate = useNavigate();
  const activePlants = store.plants.filter((plant) => !plant.cycleClosed);
  const [plantId, setPlantId] = useState("");
  const [gardenId, setGardenId] = useState("all");
  const [query, setQuery] = useState("");
  const selected = activePlants.find((plant) => plant.id === plantId);
  const selectedPhoto = selected ? store.photos.find((photo) => photo.id === selected.heroPhotoId) : undefined;
  const contextGarden = store.gardens.find((garden) => garden.id === gardenId) ?? store.gardens[0];
  const contextGardenPhoto = contextGarden ? gardenCoverPhoto(contextGarden, store.plants, store.photos) : undefined;
  const selectedEvents = selected ? store.events.filter((event) => event.plantId === selected.id) : [];
  const selectedPhotos = selected ? store.photos.filter((photo) => photo.plantId === selected.id) : [];
  const selectedTasks = selected ? store.tasks.filter((task) => task.plantId === selected.id && !task.done) : [];
  const filtered = activePlants.filter((plant) => {
    const inGarden = gardenId === "all" || plant.gardenId === gardenId;
    const matches = plant.name.toLowerCase().includes(query.toLowerCase());
    return inGarden && matches;
  });
  const suggestions = selected
    ? [
        ...(selectedTasks.length ? [ui(language, "suggestionToday")] : []),
        ...(selectedPhotos.length > 1 ? [ui(language, "suggestionImproved")] : []),
        ...(selectedEvents.some((event) => event.type === "problem") ? [ui(language, "suggestionProblem")] : []),
        ...(selectedEvents.some((event) => event.type === "maintenance") ? [ui(language, "suggestionLastCare")] : []),
        `${ui(language, "suggestionRecords")} ${selected.name}?`,
      ].slice(0, 3)
    : [ui(language, "suggestionAttention"), ui(language, "suggestionChanged"), ui(language, "suggestionCloserLook")];

  const openConversation = (question: string) => {
    const prompt = question.trim();
    if (!prompt) return;

    if (selected) {
      void navigate({
        to: "/plants/$plantId/ask",
        params: { plantId: selected.id },
        search: { from: "garden-ai", prompt },
      });
      return;
    }

    void navigate({ to: "/ask", search: { prompt } });
  };

  return (
    <div className="pb-64 lg:pb-52">
      <div className="px-5 pt-6 pb-4 sm:hidden">
        <p className="eyebrow">Garden AI</p>
        <h1 className="mt-1 font-display text-3xl">{ui(language, "secondLook")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{ui(language, "groundedInRecorded")}</p>
      </div>
      <div className="hidden sm:block"><PageHeader eyebrow="Garden AI" title={ui(language, "secondLookWhenNeeded")} subtitle={ui(language, "aiSupportsObservation")} /></div>

      <div className="px-5 sm:px-8 lg:px-12">
        <div className="mb-4 hidden items-center gap-2 sm:flex">
          <Sparkles className="h-4 w-4 text-inference" />
          <ProvenanceTag kind="inferred" />
        </div>

        <section className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className={cn("surface col-span-2 min-w-0 p-4 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:block sm:p-5", selected && "hidden")}>
            <div className="flex items-center justify-between gap-3"><p className="eyebrow">{ui(language, "choosePlant")}</p>{selected ? <Button type="button" variant="ghost" onClick={() => setPlantId("")} className="h-auto px-1 py-0 text-xs text-muted-foreground">{ui(language, "clear")}</Button> : null}</div>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <label className="relative min-w-0"><Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui(language, "searchPlants")} className="input-soft w-full pl-9 text-sm" /></label>
              <label className="relative"><select value={gardenId} onChange={(event) => setGardenId(event.target.value)} aria-label={ui(language, "allGardens")} className="input-soft h-full max-w-32 appearance-none pr-8 text-xs"><option value="all">{ui(language, "allGardens")}</option>{store.gardens.map((garden) => <option key={garden.id} value={garden.id}>{garden.name}</option>)}</select><ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /></label>
            </div>
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 sm:max-h-80 sm:flex-col sm:overflow-y-auto">
              {filtered.map((plant) => {
                const photo = store.photos.find((item) => item.id === plant.heroPhotoId);
                return (
                  <Button
                    key={plant.id}
                    type="button"
                    variant="ghost"
                    onClick={() => setPlantId(plant.id)}
                    className={cn(
                      "press h-auto shrink-0 justify-start gap-3 rounded-2xl border px-3 py-2.5 text-left sm:w-full",
                      selected?.id === plant.id ? "border-primary bg-accent/50" : "border-border/70 bg-card",
                    )}
                  >
                    <PlantThumb plant={plant} photo={photo} size="sm" />
                    <span className="min-w-0 pr-3">
                      <span className="block truncate text-sm font-medium">{plant.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{plant.species}</span>
                    </span>
                  </Button>
                );
              })}
              {filtered.length === 0 ? <p className="py-3 text-sm text-muted-foreground">{ui(language, "noPlantsMatch")}</p> : null}
            </div>
          </div>

          {selected ? (
            <div className="relative col-span-2 min-w-0 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft sm:col-span-1 sm:col-start-1 sm:row-start-1">
              {selectedPhoto ? <PhotoImage photo={selectedPhoto} alt={selected.name} className="aspect-[16/9] w-full object-cover" loading="eager" /> : null}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 sm:block sm:p-5">
                <div className="min-w-0">
                  <p className="eyebrow">{ui(language, "selectedPlant")}</p>
                  <p className="mt-1 truncate font-display text-xl">{selected.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{selected.species} · {selected.slot}</p>
                </div>
                <Button type="button" variant="ghost" onClick={() => setPlantId("")} className="h-auto px-1 py-0 text-xs text-muted-foreground sm:hidden">{ui(language, "clear")}</Button>
              </div>
            </div>
          ) : contextGarden && contextGardenPhoto ? (
            <div className="relative hidden min-w-0 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft sm:col-start-1 sm:row-start-1 sm:block">
              <PhotoImage photo={contextGardenPhoto} alt={`${contextGarden.name} garden`} className="aspect-[16/9] w-full object-cover" />
              <div className="p-5">
                <p className="eyebrow">{ui(language, "gardenContext")}</p>
                <p className="mt-1 font-display text-xl">{contextGarden.name}</p>
                <p className="text-sm text-muted-foreground">{contextGarden.place}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-3 grid grid-cols-3 gap-2 sm:mt-8 sm:gap-3">
          <Link to="/identify" search={{ from: "garden-ai" }} className="press surface p-4 sm:p-5">
            <Camera className="h-5 w-5 text-primary" />
            <h2 className="mt-3 font-display text-lg sm:mt-5 sm:text-xl">{ui(language, "identify")}</h2>
            <p className="mt-1.5 hidden text-sm leading-relaxed text-muted-foreground sm:block">{ui(language, "identifyDescriptionShort")}</p>
          </Link>
          {plantTools.map((tool) => (
            selected ? (
              <Link key={tool.titleKey} to={tool.to} params={{ plantId: selected.id }} search={{ from: "garden-ai" }} className="press surface p-4 sm:p-5">
                <tool.icon className="h-5 w-5 text-primary" />
                <h2 className="mt-3 font-display text-lg sm:mt-5 sm:text-xl">{ui(language, tool.titleKey)}</h2>
                <p className="mt-1.5 hidden text-sm leading-relaxed text-muted-foreground sm:block">{ui(language, tool.descriptionKey)}</p>
              </Link>
            ) : (
              <div key={tool.titleKey} aria-disabled="true" className="surface p-4 opacity-45 sm:p-5">
                <tool.icon className="h-5 w-5 text-primary" />
                <h2 className="mt-3 font-display text-lg sm:mt-5 sm:text-xl">{ui(language, tool.titleKey)}</h2>
                <p className="mt-1.5 hidden text-sm leading-relaxed text-muted-foreground sm:block">{ui(language, tool.descriptionKey)}</p>
              </div>
            )
          ))}
          {!selected ? <p className="col-span-3 mt-1 text-xs text-muted-foreground">{ui(language, "choosePlantForAi")}</p> : null}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-[4.35rem] z-30 border-t border-border/70 bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-8 lg:bottom-0 lg:left-60 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="no-scrollbar mb-2.5 flex gap-2 overflow-x-auto">
            {suggestions.map((suggestion) => (
              <Button key={suggestion} type="button" variant="outline" onClick={() => openConversation(suggestion)} className="h-auto shrink-0 rounded-full bg-card px-3 py-1.5 text-xs font-normal text-muted-foreground">
                {suggestion}
              </Button>
            ))}
          </div>
          <PromptInput onSubmit={({ text }) => openConversation(text)} className="rounded-2xl bg-card shadow-soft">
            <PromptInputTextarea placeholder={selected ? `${language === "es" ? "Pregunta sobre" : "Ask about"} ${selected.name}…` : ui(language, "askPlaceholder")} />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
