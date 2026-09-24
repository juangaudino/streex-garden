import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, ChevronDown, GitCompareArrows, Search, ScanLine, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/garden/shell";
import { PlantThumb, ProvenanceTag } from "@/components/garden/atoms";
import { Button } from "@/components/ui/button";
import { useGarden } from "@/lib/garden-store";
import { cn } from "@/lib/utils";
import { gardenCoverPhoto } from "@/lib/garden-logic";
import { PhotoImage } from "@/components/garden/photo-image";
import { PhotoSourcePicker } from "@/components/garden/photo-source-picker";
import { ui } from "@/lib/ui-copy";
import { buildAiCheckPresentation } from "@/lib/ai-check-presentation";
import { runAiCheckDraft, type AiCheckProposal } from "@/lib/garden-backend";
import { ConfidenceBar } from "@/components/garden/atoms";
import { GardenConversationComposer } from "@/components/garden/garden-conversation-composer";

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
  const [draftPhoto, setDraftPhoto] = useState<string>();
  const [draftPhase, setDraftPhase] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [draftProposal, setDraftProposal] = useState<AiCheckProposal | null>(null);
  const draftRequestRef = useRef<string | null>(null);
  const selected = activePlants.find((plant) => plant.id === plantId);
  const selectedPhoto = selected ? store.photos.find((photo) => photo.id === selected.heroPhotoId) : undefined;
  const contextGarden = store.gardens.find((garden) => garden.id === gardenId) ?? store.gardens[0];
  const contextGardenPhoto = contextGarden ? gardenCoverPhoto(contextGarden, store.plants, store.photos) : undefined;
  const selectedEvents = selected ? store.events.filter((event) => event.plantId === selected.id) : [];
  const selectedPhotos = selected ? store.photos.filter((photo) => photo.plantId === selected.id) : [];
  const selectedTasks = selected ? store.tasks.filter((task) => task.plantId === selected.id && !task.done) : [];
  const draftResult = draftProposal ? buildAiCheckPresentation(draftProposal, language, [ui(language, "newPhoto"), ...(selected ? [`${selectedEvents.length} ${ui(language, "recordedEvents")}`] : [])]) : null;
  const filtered = activePlants.filter((plant) => {
    const inGarden = gardenId === "all" || plant.gardenId === gardenId;
    const matches = plant.name.toLowerCase().includes(query.toLowerCase());
    return inGarden && matches;
  });
  const resetDraft = () => {
    draftRequestRef.current = null;
    setDraftPhoto(undefined);
    setDraftProposal(null);
    setDraftPhase("idle");
  };
  const choosePlant = (id: string) => {
    resetDraft();
    setPlantId(id);
  };
  const suggestions = selected
    ? [
        ...(selectedTasks.length ? [ui(language, "suggestionToday")] : []),
        ...(selectedPhotos.length > 1 ? [ui(language, "suggestionImproved")] : []),
        ...(selectedEvents.some((event) => event.type === "problem") ? [ui(language, "suggestionProblem")] : []),
        ...(selectedEvents.some((event) => event.type === "maintenance") ? [ui(language, "suggestionLastCare")] : []),
        `${ui(language, "suggestionRecords")} ${selected.name}?`,
      ].slice(0, 3)
    : [ui(language, "suggestionAttention"), ui(language, "suggestionChanged"), ui(language, "suggestionCloserLook")];

  const openConversation = (question: string, imageDataUrl?: string) => {
    const prompt = question.trim();
    if (!prompt) return;

    if (selected) {
      void navigate({
        to: "/plants/$plantId/ask",
        params: { plantId: selected.id },
        search: { from: "garden-ai", prompt },
        ...(imageDataUrl ? { state: { gardenConversationImage: imageDataUrl } } : {}),
      });
      return;
    }

    void navigate({ to: "/ask", search: { prompt }, ...(imageDataUrl ? { state: { gardenConversationImage: imageDataUrl } } : {}) });
  };

  const readDraftPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setDraftPhoto(reader.result);
      setDraftProposal(null);
      setDraftPhase("idle");
    };
    reader.readAsDataURL(file);
  };

  const runDraftCheck = () => {
    if ((selected && !selected.backendGrowCycleId) || !draftPhoto) return;
    const requestToken = crypto.randomUUID();
    draftRequestRef.current = requestToken;
    setDraftPhase("scanning");
    setDraftProposal(null);
    void runAiCheckDraft(selected?.backendGrowCycleId ?? null, draftPhoto, language)
      .then(({ proposal }) => {
        if (draftRequestRef.current !== requestToken) return;
        setDraftProposal(proposal);
        setDraftPhase("done");
      })
      .catch(() => {
        if (draftRequestRef.current === requestToken) setDraftPhase("error");
      });
  };

  return (
    <div className="w-full min-w-0 max-w-full pb-64 lg:pb-52">
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

        <section className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          <div className={cn("surface col-span-2 min-w-0 p-4 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:block sm:p-5", selected && "hidden")}>
            <div className="flex items-center justify-between gap-3"><p className="eyebrow">{ui(language, "choosePlant")}</p>{selected ? <Button type="button" variant="ghost" onClick={() => { resetDraft(); setPlantId(""); }} className="h-auto px-1 py-0 text-xs text-muted-foreground">{ui(language, "clear")}</Button> : null}</div>
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
                    onClick={() => choosePlant(plant.id)}
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
              {selectedPhoto ? <PhotoImage photo={selectedPhoto} alt={selected.name} rendition="display" className="aspect-[16/9] w-full object-cover" loading="eager" fetchPriority="high" /> : null}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 sm:block sm:p-5">
                <div className="min-w-0">
                  <p className="eyebrow">{ui(language, "selectedPlant")}</p>
                  <p className="mt-1 truncate font-display text-xl">{selected.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{selected.species} · {selected.slot}</p>
                </div>
                <Button type="button" variant="ghost" onClick={() => { resetDraft(); setPlantId(""); }} className="h-auto px-1 py-0 text-xs text-muted-foreground sm:hidden">{ui(language, "clear")}</Button>
              </div>
            </div>
          ) : contextGarden && contextGardenPhoto ? (
            <div className="relative hidden min-w-0 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft sm:col-start-1 sm:row-start-1 sm:block">
              <PhotoImage photo={contextGardenPhoto} alt={`${contextGarden.name} garden`} rendition="display" className="aspect-[16/9] w-full object-cover" />
              <div className="p-5">
                <p className="eyebrow">{ui(language, "gardenContext")}</p>
                <p className="mt-1 font-display text-xl">{contextGarden.name}</p>
                <p className="text-sm text-muted-foreground">{contextGarden.place}</p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:mt-8 sm:gap-3">
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
          {!selected ? <p className="col-span-2 mt-1 text-xs text-muted-foreground">{ui(language, "choosePlantForAi")}</p> : null}
        </section>

        <section className="surface mt-3 min-w-0 p-4 sm:mt-5 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2"><ScanLine className="h-4 w-4 shrink-0 text-primary" /><h2 className="min-w-0 font-display text-xl break-words [overflow-wrap:anywhere]">{ui(language, "aiCheckTitle")}</h2></div>
                <p className="mt-1 text-sm text-muted-foreground">{ui(language, selected ? "gardenAiNewPhotoHint" : "gardenAiPhotoOnlyHint")}</p>
              </div>
              <ProvenanceTag kind="inferred" />
            </div>
            <PhotoSourcePicker language={language} onFile={readDraftPhoto} className="mt-4" />
            {draftPhoto ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-start">
                <img src={draftPhoto} alt={ui(language, "newPhoto")} className="aspect-[4/3] w-full rounded-2xl object-cover" />
                <div className="min-w-0">
                  <button type="button" onClick={runDraftCheck} disabled={draftPhase === "scanning" || Boolean(selected && !selected.backendGrowCycleId)} className="press inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-70 sm:w-auto">
                    <ScanLine className="h-4 w-4" />
                    {draftPhase === "scanning" ? ui(language, "analysing") : ui(language, "analysePhoto")}
                  </button>
                  {draftPhase === "error" ? <p className="mt-3 text-sm text-muted-foreground">{ui(language, "analysisUnavailableBody")}</p> : null}
                  {draftResult ? (
                    <div className="mt-4 rounded-2xl border border-border/70 bg-card p-4">
                      <p className="font-display text-xl">{draftResult.headline}</p>
                      {draftResult.summary ? <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{draftResult.summary}</p> : null}
                      <div className="mt-3"><ConfidenceBar confidence={draftResult.confidence} /></div>
                      <p className="mt-3 text-xs text-muted-foreground">{ui(language, "savingDoesNotChange")}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
      </div>

      <div className="fixed inset-x-0 bottom-[4.35rem] z-30 min-w-0 max-w-full border-t border-border/70 bg-background/90 px-[max(1rem,env(safe-area-inset-left))] py-3 pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur-xl sm:px-8 lg:bottom-0 lg:left-60 lg:px-12">
        <div className="mx-auto min-w-0 max-w-3xl">
          <div className="no-scrollbar mb-2.5 flex min-w-0 max-w-full gap-2 overflow-x-auto">
            {suggestions.map((suggestion) => (
              <Button key={suggestion} type="button" variant="outline" onClick={() => openConversation(suggestion)} className="h-auto shrink-0 rounded-full bg-card px-3 py-1.5 text-xs font-normal text-muted-foreground">
                {suggestion}
              </Button>
            ))}
          </div>
          <GardenConversationComposer
            language={language}
            placeholder={selected ? `${language === "es" ? "Pregunta sobre" : "Ask about"} ${selected.name}…` : ui(language, "askPlaceholder")}
            sendLabel={ui(language, "sendQuestion")}
            onSend={openConversation}
          />
        </div>
      </div>
    </div>
  );
}
