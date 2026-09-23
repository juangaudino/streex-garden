import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, notFound, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, Sparkles } from "lucide-react";
import { useGarden } from "@/lib/garden-store";
import { askGarden, askSuggestions, plantEvents, plantPhotos, type AskAnswer } from "@/lib/garden-logic";
import { askGardenAi } from "@/lib/garden-backend";
import { ProvenanceTag } from "@/components/garden/atoms";
import { ui } from "@/lib/ui-copy";
import { GardenConversationComposer } from "@/components/garden/garden-conversation-composer";
import { careInspectionForKey, careReviewPhotoKey, parseCareSessionBoolean, parseCareSessionNumber } from "@/lib/care-session";

export const Route = createFileRoute("/plants/$plantId/ask")({
  validateSearch: (search: Record<string, unknown>) => ({
    from: search["from"] === "garden-ai" ? "garden-ai" as const : search["from"] === "care" ? "care" as const : undefined,
    prompt: typeof search["prompt"] === "string" ? search["prompt"] : undefined,
    careQueue: typeof search["careQueue"] === "string" ? search["careQueue"] : undefined,
    careIndex: parseCareSessionNumber(search["careIndex"]),
    careRecorded: parseCareSessionBoolean(search["careRecorded"]),
    careReviewed: parseCareSessionNumber(search["careReviewed"]),
    careObservations: parseCareSessionNumber(search["careObservations"]),
    careActions: parseCareSessionNumber(search["careActions"]),
    careFollowups: parseCareSessionNumber(search["careFollowups"]),
  }),
  head: () => ({
    meta: [
      { title: "Ask Garden — Garden X" },
      {
        name: "description",
        content:
          "Ask about one plant and get answers grounded in its own record — clearly separated from inference.",
      },
      { property: "og:title", content: "Ask Garden — Garden X" },
      { property: "og:description", content: "Answers grounded in a plant's own record, with inference labelled." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Ask,
});

function Ask() {
  const { plantId } = Route.useParams();
  const { from, prompt, careQueue, careIndex, careRecorded, careReviewed, careObservations, careActions, careFollowups } = Route.useSearch();
  const store = useGarden();
  const language = store.language;
  const navigationImage = useRouterState({ select: (state) => {
    const value = state.location.state as { gardenConversationImage?: unknown } | undefined;
    return typeof value?.gardenConversationImage === "string" ? value.gardenConversationImage : undefined;
  } });
  const plant = store.plants.find((p) => p.id === plantId);
  if (!plant) throw notFound();

  const [thread, setThread] = useState<Array<AskAnswer & { attachedImageDataUrl?: string }>>([]);
  const [thinking, setThinking] = useState(false);
  const initialPromptSent = useRef(false);
  const imageConversationActive = useRef(false);
  const careInspection = from === "care"
    ? careInspectionForKey(store.careInspection, careReviewPhotoKey(plant.id, plant.backendGrowCycleId))
    : undefined;

  const send = useCallback(async (question: string, imageDataUrl?: string) => {
    const clean = question.trim();
    if (!clean || thinking) return;
    setThinking(true);
    if (imageDataUrl || imageConversationActive.current) {
      imageConversationActive.current = true;
      const currentEvents = plantEvents(store.events, plant.id);
      const currentPhotos = plantPhotos(store.photos, plant.id);
      const garden = store.gardens.find((item) => item.id === plant.gardenId);
      const carePhoto = careInspection?.workingPhoto;
      const careContext = carePhoto ? [
        "Temporary Care Session review context; this is not canonical evidence.",
        `Plant Instance: ${plant.name} (${plant.id}); grow cycle: ${plant.backendGrowCycleId ?? "unknown"}.`,
        `Garden/system: ${garden?.name ?? "unknown"}; position: ${plant.slot ?? "unknown"}.`,
        ...(careInspection?.checkProposal ? [
          `Prior unconfirmed AI Check: ${careInspection.checkProposal.headline}.`,
          careInspection.checkProposal.summary,
          ...careInspection.checkProposal.observations,
          ...careInspection.checkProposal.interpretations,
          ...careInspection.checkProposal.uncertainty,
        ] : []),
      ].join("\n").slice(0, 9000) : undefined;
      const scope = {
        question: "Plant-scoped Ask Garden context",
        answer: JSON.stringify({
          plant_instance_id: plant.id,
          plant_name: plant.name,
          identity: plant.scientific || plant.species,
          grow_cycle_id: plant.backendGrowCycleId ?? null,
          garden: garden?.name ?? null,
          position: plant.slot ?? null,
          recent_event_count: currentEvents.length,
          photo_count: currentPhotos.length,
          scope_rule: "Answer about this plant and cycle only unless the user explicitly broadens the question.",
          ...(careInspection?.checkProposal ? { temporary_care_check: careInspection.checkProposal } : {}),
        }),
      };
      const prior = thread.slice(-3).map((item) => ({
        question: item.question,
        answer: [...item.grounded, item.inference, item.attachedImageDataUrl ? "The user attached a photo in that turn." : ""].filter(Boolean).join(" ").slice(0, 500),
      }));
      try {
        const result = await askGardenAi(clean, [scope, ...prior], {
          ...(carePhoto && careContext ? { photoDataUrl: carePhoto, context: careContext } : {}),
          ...(imageDataUrl ? { messageImageDataUrl: imageDataUrl } : {}),
        });
        setThread((current) => [...current, {
          question: clean,
          grounded: result.confirmed_facts.length ? result.confirmed_facts.map((fact) => fact.claim) : [result.answer],
          evidence: result.confirmed_facts.map((fact) => `${fact.source.kind} · ${fact.source.id.slice(0, 8)}`),
          ...(result.confirmed_facts.length && result.answer ? { inference: result.answer } : {}),
          ...(imageDataUrl ? { attachedImageDataUrl: imageDataUrl } : {}),
        }]);
      } catch {
        setThread((current) => [...current, {
          question: clean,
          grounded: [ui(language, "careAskUnavailable")],
          evidence: [],
          ...(imageDataUrl ? { attachedImageDataUrl: imageDataUrl } : {}),
        }]);
      } finally {
        setThinking(false);
      }
      return;
    }
    const answer = askGarden(clean, { plant, events: store.events, photos: store.photos, tasks: store.tasks }, language);
    window.setTimeout(() => {
      setThread((current) => [...current, answer]);
      setThinking(false);
    }, 900);
  }, [careInspection, language, plant, store, thread, thinking]);

  useEffect(() => {
    if (!prompt || initialPromptSent.current) return;
    initialPromptSent.current = true;
    void send(prompt, navigationImage);
  }, [navigationImage, prompt, send]);

  const events = plantEvents(store.events, plant.id);
  const photos = plantPhotos(store.photos, plant.id);

  return (
    <div className="flex min-h-screen flex-col">
      {/* compact header */}
      <header className="sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 bg-background/85 px-4 py-2.5 backdrop-blur-xl sm:px-8 lg:px-12">
        {from === "garden-ai" ? (
          <Link to="/garden-ai" className="press grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/70 bg-card" aria-label={ui(language, "backToGardenAI")}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : from === "care" ? (
          <Link
            to="/care"
            search={{ careQueue, careIndex, careRecorded, careReviewed, careObservations, careActions, careFollowups }}
            className="press grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/70 bg-card"
            aria-label={ui(language, "backToCare")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <Link to="/plants/$plantId" params={{ plantId: plant.id }} className="press grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/70 bg-card" aria-label={`${ui(language, "backToPlant")}: ${plant.name}`}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Ask Garden · {plant.name}</p>
          <p className="numeral truncate text-[0.7rem] text-muted-foreground">
            {events.length} {ui(language, "eventsInContext")} · {photos.length} {ui(language, "photosInContext")}
          </p>
        </div>
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8">
        {thread.length === 0 && !thinking ? (
          <div className="rise">
            <h1 className="font-display text-3xl">{ui(language, "askPlantQuestion")} {plant.name}?</h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
              {ui(language, "askPlantDescription")}
            </p>
          </div>
        ) : null}

        <div className="space-y-8">
          {thread.map((a, i) => (
            <div key={i} className="rise space-y-3">
              <p className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                {a.attachedImageDataUrl ? <img src={a.attachedImageDataUrl} alt={ui(language, "attachedPhotoPreview")} className="mb-2 max-h-36 max-w-40 rounded-xl object-cover" /> : null}
                {a.question}
              </p>
              <div className="surface p-5">
                <div className="mb-3">
                  <ProvenanceTag kind="recorded" />
                </div>
                <ul className="space-y-2 text-sm leading-relaxed">
                  {a.grounded.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
                {a.inference ? (
                  <div className="mt-5 rounded-2xl border border-inference/25 bg-inference/6 p-4">
                    <ProvenanceTag kind="inferred" confidence="moderate" />
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{a.inference}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {thinking ? (
            <div className="surface flex items-center gap-3 p-5 text-sm text-muted-foreground">
              <Sparkles className="breathe h-4 w-4 text-primary" /> {ui(language, "readingRecordShort")}
            </div>
          ) : null}
        </div>
      </div>

      {/* composer */}
      <div className="sticky bottom-0 border-t border-border/70 bg-background/90 px-4 pt-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <div className="no-scrollbar mb-2.5 flex gap-2 overflow-x-auto">
            {askSuggestions(language).map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="press shrink-0 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground"
              >
                {s}
              </button>
            ))}
          </div>
          <GardenConversationComposer
            language={language}
            placeholder={`${ui(language, "askAbout")} ${plant.name}…`}
            sendLabel={ui(language, "sendQuestion")}
            disabled={thinking}
            sending={thinking}
            onSend={send}
          />
        </div>
      </div>
    </div>
  );
}
