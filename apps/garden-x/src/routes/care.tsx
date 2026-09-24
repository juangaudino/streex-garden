import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  Leaf,
  MessageCircle,
  MoreHorizontal,
  ScanLine,
  SkipForward,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RecordMomentSheet, type MomentFlow } from "@/components/garden/record-moment";
import { useGarden } from "@/lib/garden-store";
import {
  ageLabel,
  dueLabel,
  lastReview,
  openTasks,
  plantEvents,
  latestPlantPhoto,
  relativeDay,
} from "@/lib/garden-logic";
import { PageHeader } from "@/components/garden/shell";
import { ConfidenceBar, ProvenanceTag, SectionTitle, maintenanceIcons } from "@/components/garden/atoms";
import type { MaintenanceType, Photo, Plant } from "@/lib/garden-data";
import { ui } from "@/lib/ui-copy";
import { PhotoSourcePicker } from "@/components/garden/photo-source-picker";
import { PhotoImage } from "@/components/garden/photo-image";
import { GardenConversationComposer } from "@/components/garden/garden-conversation-composer";
import { CareSessionGardenList } from "@/components/garden/care-session-garden-list";
import { runAiCheckDraft, askGardenAi, type AiCheckProposal } from "@/lib/garden-backend";
import { buildAiCheckPresentation, projectCareActions, shouldShowFindingConfidence } from "@/lib/ai-check-presentation";
import type { AnalysisResult } from "@/lib/garden-logic";
import { normalizePhotoDataUrl } from "@/lib/photo-input";
import {
  askGardenAccentClassName,
  careSessionAction,
  careSessionSearch,
  parseCareSessionBoolean,
  parseCareSessionNumber,
  parseCareSessionQueue,
  resolveCareSession,
  buildCarePlantQueue,
  canRunCareAiCheck,
  careInspectionForKey,
  careFlowCanReuseReviewPhoto,
  careReviewContextMessage,
  careReviewPhotoKey,
  createCareInspectionState,
  type CareInspectionState,
  reorderCareGarden,
  toggleCareGardenSelection,
  clearCareSession,
  careSessionHasProgress,
  loadCareSession,
  saveCareSession,
  type SavedCareSession,
} from "@/lib/care-session";
import { dateOnlyToUtcNoon } from "@/lib/temporal";

export const Route = createFileRoute("/care")({
  validateSearch: (search: Record<string, unknown>) => ({
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
      { title: "Guided Plant Care — Garden X" },
      {
        name: "description",
        content: "Review your plants one at a time, notice changes, record care, and remember what needs another look.",
      },
      { property: "og:title", content: "Guided Plant Care — Garden X" },
      {
        property: "og:description",
        content: "A calm, plant-by-plant review for recording trustworthy garden history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Care,
});

interface SessionSummary {
  reviewed: number;
  observations: number;
  care: number;
  followups: number;
}

const emptySummary = (): SessionSummary => ({ reviewed: 0, observations: 0, care: 0, followups: 0 });

function Care() {
  const store = useGarden();
  const language = store.language;
  const sessionSearch = Route.useSearch();
  const navigate = Route.useNavigate();
  const tasks = openTasks(store.tasks);
  const [queue, setQueue] = useState<string[]>(() => parseCareSessionQueue(sessionSearch.careQueue));
  const initialQueue = useRef(queue);
  const [index, setIndex] = useState(sessionSearch.careIndex ?? 0);
  const [summary, setSummary] = useState<SessionSummary>(() => ({
    reviewed: sessionSearch.careReviewed ?? 0,
    observations: sessionSearch.careObservations ?? 0,
    care: sessionSearch.careActions ?? 0,
    followups: sessionSearch.careFollowups ?? 0,
  }));
  const [finished, setFinished] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordFlow, setRecordFlow] = useState<MomentFlow | undefined>();
  const [recordCare, setRecordCare] = useState<MaintenanceType | undefined>();
  const [recordedForReview, setRecordedForReview] = useState(sessionSearch.careRecorded ?? false);
  const [resumeSnapshot, setResumeSnapshot] = useState<SavedCareSession | null>(null);
  const [sessionRestoreReady, setSessionRestoreReady] = useState(false);
  const [gardenOrder, setGardenOrder] = useState<string[]>([]);
  const [selectedGardenIds, setSelectedGardenIds] = useState<string[] | null>(null);

  useEffect(() => {
    // localStorage is browser-only. Read it after mount so SSR and the first
    // hydration render use identical state; PWA snapshots can outlive deploys.
    const snapshot = loadCareSession();
    setResumeSnapshot(snapshot);
    if (initialQueue.current.length && snapshot?.queue.join(",") === initialQueue.current.join(",")) {
      setGardenOrder(snapshot.gardenOrder);
      setSelectedGardenIds(snapshot.selectedGardenIds);
    }
    setSessionRestoreReady(true);
  }, [initialQueue]);

  useEffect(() => {
    if (!queue.length) {
      void navigate({
        search: {
          careQueue: undefined,
          careIndex: undefined,
          careRecorded: undefined,
          careReviewed: undefined,
          careObservations: undefined,
          careActions: undefined,
          careFollowups: undefined,
        },
        replace: true,
      });
      return;
    }
    void navigate({
      search: careSessionSearch({ queue, index, recordedForReview, ...summary }),
      replace: true,
    });
  }, [navigate, queue, index, recordedForReview, summary]);

  const activePlants = useMemo(() => store.plants.filter((plant) => !plant.cycleClosed), [store.plants]);
  const sessionGardens = useMemo(() => store.gardens.filter((garden) => !garden.archived && activePlants.some((plant) => plant.gardenId === garden.id)), [store.gardens, activePlants]);
  const orderedGardens = useMemo(() => {
    const available = new Set(sessionGardens.map((garden) => garden.id));
    return [...gardenOrder.filter((id) => available.has(id)), ...sessionGardens.map((garden) => garden.id).filter((id) => !gardenOrder.includes(id))];
  }, [gardenOrder, sessionGardens]);
  const selectedGardens = selectedGardenIds ?? orderedGardens;
  useEffect(() => {
    // Do not replace a valid saved selection/order with empty bootstrap arrays
    // during a PWA reopen. The store must first resolve canonical gardens/plants.
    if (sessionRestoreReady && queue.length && !finished && store.hydration !== "loading" && store.hydration !== "error") {
      const snapshot: SavedCareSession = {
        queue,
        index,
        recordedForReview,
        ...summary,
        gardenOrder: orderedGardens,
        selectedGardenIds: selectedGardenIds ?? orderedGardens,
      };
      saveCareSession(snapshot);
    } else if (finished) {
      clearCareSession();
      setResumeSnapshot(null);
    }
  }, [sessionRestoreReady, queue, index, recordedForReview, summary, orderedGardens, selectedGardenIds, finished, store.hydration]);
  const needingLook = new Set(tasks.map((t) => t.plantId)).size;
  const routine = activePlants.length - needingLook;
  const current = queue[index] ? store.plants.find((plant) => plant.id === queue[index]) : undefined;

  const startSession = () => {
    if (resumeSnapshot && careSessionHasProgress(resumeSnapshot)) {
      if (typeof window !== "undefined" && !window.confirm(ui(language, "confirmStartNewCareSession"))) return;
    }
    clearCareSession();
    setResumeSnapshot(null);
    const positionNumbers = new Map(sessionGardens.flatMap((garden) => (garden.backendPositions ?? []).map((position) => [position.id, position.number] as const)));
    setGardenOrder(orderedGardens);
    setSelectedGardenIds(selectedGardens);
    setQueue(buildCarePlantQueue(sessionGardens, activePlants, orderedGardens, selectedGardens, positionNumbers));
    setIndex(0);
    setSummary(emptySummary());
    setFinished(false);
    setRecordedForReview(false);
    store.clearCareInspection();
  };

  const continueSession = () => {
    if (!resumeSnapshot || store.hydration === "loading" || store.hydration === "error") return;
    const snapshot = resolveCareSession(resumeSnapshot, activePlants, store.gardens);
    if (!snapshot) {
      clearCareSession();
      setResumeSnapshot(null);
      return;
    }
    setQueue(snapshot.queue);
    setIndex(snapshot.index);
    setSummary({ reviewed: snapshot.reviewed, observations: snapshot.observations, care: snapshot.care, followups: snapshot.followups });
    setRecordedForReview(snapshot.recordedForReview);
    setGardenOrder(snapshot.gardenOrder);
    setSelectedGardenIds(snapshot.selectedGardenIds);
    setFinished(false);
    setResumeSnapshot(null);
  };

  const leaveSession = () => {
    clearCareSession();
    setResumeSnapshot(null);
    setQueue([]);
    setIndex(0);
    setFinished(false);
    setRecordOpen(false);
    setRecordedForReview(false);
    store.clearCareInspection();
    setSelectedGardenIds(null);
  };

  const advance = (reviewed: boolean) => {
    if (reviewed) setSummary((value) => ({ ...value, reviewed: value.reviewed + 1 }));
    setRecordedForReview(false);
    store.clearCareInspection();
    if (index + 1 >= queue.length) setFinished(true);
    else setIndex((value) => value + 1);
  };

  const toggleGarden = (gardenId: string) => {
    const current = selectedGardenIds ?? orderedGardens;
    setSelectedGardenIds(toggleCareGardenSelection(current, gardenId));
  };

  const focusSessionSetup = () => {
    document.getElementById("care-session-setup")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const openRecord = (flow?: MomentFlow, careType?: MaintenanceType) => {
    setRecordFlow(flow);
    setRecordCare(careType);
    setRecordOpen(true);
  };

  const handleRecorded = (flow: MomentFlow) => {
    setRecordedForReview(true);
    if (flow === "observation") setSummary((value) => ({ ...value, observations: value.observations + 1 }));
    if (flow === "care") setSummary((value) => ({ ...value, care: value.care + 1 }));
    if (flow === "followup") setSummary((value) => ({ ...value, followups: value.followups + 1 }));
  };

  if (queue.length > 0) {
    const currentPhotoKey = current ? careReviewPhotoKey(current.id, current.backendGrowCycleId) : "";
    const currentInspection = careInspectionForKey(store.careInspection, currentPhotoKey) ?? (current ? createCareInspectionState(currentPhotoKey) : undefined);
    const currentWorkingPhoto = currentInspection?.workingPhoto;
    return (
      <div className="min-h-screen pb-24">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/70 px-5 py-4 sm:px-8 lg:px-12">
          <div className="min-w-0">
            <p className="eyebrow">{ui(language, "careSession")}</p>
            <p className="numeral mt-0.5 text-sm text-muted-foreground">
              {summary.reviewed} / {queue.length} {ui(language, "plantsReviewed")}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={leaveSession}>{ui(language, "end")}</Button>
        </header>

        {(store.hydration === "loading" || store.hydration === "error") && !current ? (
          <main className="mx-auto grid min-h-[50vh] w-full max-w-xl place-items-center px-5 py-12 text-center" aria-busy={store.hydration === "loading"}>
            <p className="text-sm text-muted-foreground">{ui(language, "loadingGarden")}</p>
          </main>
        ) : finished || !current ? (
          <SessionComplete language={language} summary={summary} onDone={leaveSession} />
        ) : (
          <PlantReview
            language={language}
            plant={current}
            key={`${current.id}:${current.backendGrowCycleId ?? "cycle"}`}
            gardenName={store.gardens.find((garden) => garden.id === current.gardenId)?.name ?? "Garden"}
            lastReview={lastReview(store.events, current.id)}
            canonicalPhoto={latestPlantPhoto(store.photos, current.id)}
            workingPhoto={currentWorkingPhoto}
            inspection={currentInspection!}
            onInspectionPatch={(patch, requestId) => store.patchCareInspection(currentPhotoKey, patch, requestId)}
            recentEvent={plantEvents(store.events, current.id)[0]}
            contextEventCount={plantEvents(store.events, current.id).length}
            recentHistory={plantEvents(store.events, current.id).slice(0, 8).map((event) => `${event.title}${event.occurredAt ? ` · ${event.occurredAt}` : ` · ${relativeDay(event.daysAgo)}`}`)}
            sessionItem={index + 1}
            sessionTotal={queue.length}
            attention={tasks.find((task) => task.plantId === current.id)}
            onRecord={openRecord}
            onNext={() => advance(true)}
            onSkip={() => advance(false)}
            onLooksGood={async () => {
              if (recordedForReview) return;
              const now = new Date();
              const occurredOn = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
              try {
                await store.addEvent({
                  plantId: current.id,
                  daysAgo: 0,
                  occurredAt: dateOnlyToUtcNoon(occurredOn),
                  type: "note",
                  backendEventType: "visual_review",
                  title: language === "es" ? "Revisada — se ve bien" : "Reviewed — looks good",
                  detail: language === "es" ? "Revisión visual tranquilizadora confirmada por la persona." : "Reassuring visual review confirmed by the user.",
                  provenance: "observed",
                }, { waitForPersistence: true });
                setRecordedForReview(true);
              } catch {
                toast.error(language === "es" ? "No se pudo guardar la revisión. Inténtalo de nuevo." : "The review could not be saved. Please try again.");
              }
            }}
            recordedForReview={recordedForReview}
            careReturnSearch={careSessionSearch({
              queue,
              index,
              recordedForReview,
              ...summary,
            })}
          />
        )}

        {current ? (
          <RecordMomentSheet
            plant={current}
            open={recordOpen}
            initialFlow={recordFlow}
            initialCareType={recordCare}
            initialPhotoDataUrl={careFlowCanReuseReviewPhoto(recordFlow) ? currentWorkingPhoto : undefined}
            onRecorded={handleRecorded}
            onClose={() => setRecordOpen(false)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="rise pb-16">
      <PageHeader
        eyebrow={ui(language, "care")}
        title={ui(language, "checkOnPlants")}
        subtitle={ui(language, "startCareSubtitle")}
      />

      <section className="px-5 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-soft">
          <div className="grid gap-6 px-6 py-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-8">
            <div className="max-w-xl">
              <p className="text-xs uppercase text-primary-foreground/70">{ui(language, "guidedReview")}</p>
              <h1 className="mt-2 font-display text-3xl">{ui(language, "seeEachPlant")}</h1>
              <p className="mt-2 text-sm text-primary-foreground/75">
                {activePlants.length} {activePlants.length === 1 ? (language === "es" ? "planta" : "plant") : ui(language, "plants").toLowerCase()} {language === "es" ? "para revisar" : "to check"} · {needingLook} {language === "es" ? (needingLook === 1 ? "necesita" : "necesitan") : (needingLook === 1 ? "needs" : "need")} {ui(language, "worthCloserLook").toLowerCase()} · {routine} {language === "es" ? "revisión" : "routine review"}{routine === 1 ? "" : language === "es" ? "es" : "s"}
              </p>
            </div>
            <Button
              onClick={() => focusSessionSetup()}
              className="w-full bg-background text-foreground hover:bg-background/90 sm:w-auto"
            >
              {ui(language, "startCareSession")} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {resumeSnapshot ? (
        <section className="mt-5 px-5 sm:px-8 lg:px-12" aria-label={ui(language, "continueSession")}>
          <div className="surface mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
            <div>
              <h2 className="font-display text-xl">{ui(language, "continueSession")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{resumeSnapshot.reviewed} / {resumeSnapshot.queue.length} {ui(language, "plantsReviewed")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={continueSession} disabled={store.hydration === "loading" || store.hydration === "error"}>{ui(language, "continueSession")} <ArrowRight className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={startSession}>{ui(language, "startNewSession")}</Button>
            </div>
          </div>
        </section>
      ) : null}

      <section id="care-session-setup" className="mt-5 px-5 sm:px-8 lg:px-12" aria-label={ui(language, "careSessionSetup")}>
        <div className="surface mx-auto max-w-3xl p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-xl">{ui(language, "careSessionSetup")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{ui(language, "careSessionSetupHint")}</p>
            </div>
            <p className="text-xs text-muted-foreground">{activePlants.filter((plant) => selectedGardens.includes(plant.gardenId)).length} {ui(language, "plantsInGarden")}</p>
          </div>
          <CareSessionGardenList
            gardens={orderedGardens.flatMap((gardenId) => {
              const garden = sessionGardens.find((item) => item.id === gardenId);
              return garden ? [{ id: garden.id, name: garden.name, systemName: garden.machine?.name, plantCount: activePlants.filter((plant) => plant.gardenId === garden.id).length }] : [];
            })}
            selectedIds={selectedGardens}
            selectedLabel={ui(language, "selected")}
            notSelectedLabel={ui(language, "notSelected")}
            reorderLabel={ui(language, "reorderGarden")}
            plantsLabel={ui(language, "plantsInGarden")}
            onToggle={toggleGarden}
            onReorder={(fromId, toId) => setGardenOrder((order) => reorderCareGarden(
              [...order.filter((id) => orderedGardens.includes(id)), ...orderedGardens.filter((id) => !order.includes(id))],
              fromId,
              toId,
              (id) => id,
            ))}
          />
          <Button className="mt-4 w-full" onClick={startSession} disabled={!selectedGardens.length || !activePlants.some((plant) => selectedGardens.includes(plant.gardenId))}>
            {ui(language, "startSession")} <ArrowRight className="h-4 w-4" />
          </Button>
          {!selectedGardens.length ? <p className="mt-2 text-center text-xs text-muted-foreground">{ui(language, "chooseAtLeastOneGarden")}</p> : null}
        </div>
      </section>

      <section className="mt-10 px-5 sm:px-8 lg:px-12">
        <SectionTitle>{ui(language, "worthCloserLook")}</SectionTitle>
        <div className="divide-y divide-border/70 border-y border-border/70">
          {tasks.map((task) => {
            const plant = store.plants.find((item) => item.id === task.plantId);
            if (!plant) return null;
            const Icon = maintenanceIcons[task.type];
            return (
              <div key={task.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm">{plant.name} · {task.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{dueLabel(task.dueInDays)}{task.hint ? ` · ${task.hint}` : ""}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={focusSessionSetup}>
                  {ui(language, "review")} <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {tasks.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{ui(language, "nothingAttention")}</p> : null}
        </div>
      </section>
    </div>
  );
}

export function PlantReview({
  plant,
  language,
  gardenName,
  lastReview,
  canonicalPhoto,
  workingPhoto,
  inspection,
  onInspectionPatch,
  recentEvent,
  contextEventCount,
  recentHistory,
  sessionItem,
  sessionTotal,
  attention,
  onRecord,
  onNext,
  onSkip,
  onLooksGood,
  recordedForReview,
  careReturnSearch,
}: {
  plant: Plant;
  language: "en" | "es";
  gardenName: string;
  lastReview?: { title: string; daysAgo: number } | undefined;
  canonicalPhoto?: Photo | undefined;
  workingPhoto?: string | undefined;
  inspection: CareInspectionState;
  onInspectionPatch: (patch: Partial<CareInspectionState>, expectedRequestId?: string) => void;
  recentEvent?: { title: string; daysAgo: number } | undefined;
  contextEventCount: number;
  recentHistory: string[];
  sessionItem: number;
  sessionTotal: number;
  attention?: { label: string; dueInDays: number } | undefined;
  onRecord: (flow?: MomentFlow, careType?: MaintenanceType) => void;
  onNext: () => void;
  onSkip: () => void;
  onLooksGood: () => void | Promise<void>;
  recordedForReview: boolean;
  careReturnSearch: ReturnType<typeof careSessionSearch>;
}) {
  const { checkPhase, checkProposal, conversation } = inspection;
  const [chatBusy, setChatBusy] = useState(false);
  const [looksGoodBusy, setLooksGoodBusy] = useState(false);
  const checkRequest = useRef(inspection.requestGuardId);
  const updateInspection = (patch: Partial<CareInspectionState>) => onInspectionPatch(patch);
  const reviewImage = workingPhoto ?? null;
  const canCheck = canRunCareAiCheck(plant.backendGrowCycleId, reviewImage);
  const result: AnalysisResult | null = checkProposal
    ? buildAiCheckPresentation(checkProposal, language, [ui(language, "careReviewPhoto"), `${contextEventCount} ${ui(language, "recordedEvents")}`])
    : null;
  const careActions = checkProposal ? projectCareActions(checkProposal, language) : [];

  const readReviewPhoto = (file: File) => {
    const photoReadToken = crypto.randomUUID();
    checkRequest.current = photoReadToken;
    updateInspection({ requestGuardId: photoReadToken });
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const isCurrentRead = checkRequest.current === photoReadToken;
        onInspectionPatch({
          workingPhoto: normalizePhotoDataUrl(reader.result, file),
          checkRequestId: null,
          requestGuardId: null,
          checkProposal: null,
          checkPhase: "idle",
          conversation: [],
        }, photoReadToken);
        if (isCurrentRead) {
          checkRequest.current = null;
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const runCheck = () => {
    if (!reviewImage || !plant.backendGrowCycleId || checkPhase === "scanning") return;
    const runToken = crypto.randomUUID();
    checkRequest.current = runToken;
    updateInspection({ checkRequestId: null, requestGuardId: runToken, checkPhase: "scanning", checkProposal: null, conversation: [] });
    void runAiCheckDraft(plant.backendGrowCycleId, reviewImage, language)
      .then(({ proposal, requestId }) => {
        if (checkRequest.current !== runToken) return;
        onInspectionPatch({ checkProposal: proposal, checkPhase: "done", checkRequestId: requestId, requestGuardId: null }, runToken);
      })
      .catch(() => {
        if (checkRequest.current === runToken) onInspectionPatch({ checkPhase: "error", requestGuardId: null }, runToken);
      });
  };

  const askAboutCheck = async (question: string, attachedImage?: string) => {
    const clean = question.trim();
    if (!clean || chatBusy || !checkProposal || !plant.backendGrowCycleId || !reviewImage) return;
    const chatRequestToken = crypto.randomUUID();
    checkRequest.current = chatRequestToken;
    updateInspection({ requestGuardId: chatRequestToken });
    setChatBusy(true);
    const context = careReviewContextMessage({
      plantId: plant.id,
      plantName: plant.name,
      growCycleId: plant.backendGrowCycleId,
      gardenName,
      positionLabel: plant.slot,
      sessionItem,
      sessionTotal,
      photoSelected: Boolean(reviewImage),
      checkProposal,
      recentHistory,
    });
    const prior = conversation.slice(-3).map((item) => ({ question: item.question, answer: [...item.facts, item.answer, item.imageDataUrl ? "A photo was attached in this previous turn." : ""].filter(Boolean).join(" ").slice(0, 500) }));
    try {
      const answer = await askGardenAi(clean, [context, ...prior], {
        photoDataUrl: reviewImage,
        context: context.answer,
        messageImageDataUrl: attachedImage,
      });
      const facts = answer.confirmed_facts.map((fact) => fact.claim);
      onInspectionPatch({ conversation: [...conversation, {
        question: clean,
        answer: answer.answer,
        facts,
        ...(attachedImage ? { imageDataUrl: attachedImage } : {}),
      }], requestGuardId: null }, chatRequestToken);
    } catch {
      onInspectionPatch({ conversation: [...conversation, { question: clean, answer: ui(language, "careAskUnavailable"), facts: [], ...(attachedImage ? { imageDataUrl: attachedImage } : {}) }], requestGuardId: null }, chatRequestToken);
    } finally {
      setChatBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl px-5 py-6 sm:px-8 sm:py-8">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-secondary shadow-lift sm:aspect-[16/10]">
        {reviewImage ? <img src={reviewImage} alt={`${plant.name}, ${plant.species}`} className="h-full w-full object-cover" /> : canonicalPhoto ? <PhotoImage photo={canonicalPhoto} alt={`${plant.name}, ${plant.species}`} rendition="display" loading="eager" className="h-full w-full object-cover" /> : null}
        <div className="veil absolute inset-0" />
        <div data-testid="care-photo-actions" className="pointer-events-auto absolute top-3 left-1/2 z-30 w-max max-w-[calc(100%-1rem)] -translate-x-1/2">
          <PhotoSourcePicker language={language} onFile={readReviewPhoto} className="[&>div]:flex [&>div]:flex-nowrap [&>div]:justify-center [&>div]:gap-1 [&_button]:!min-h-11 [&_button]:!rounded-none [&_button]:!border-0 [&_button]:!bg-transparent [&_button]:!px-2 [&_button]:!text-white [&_button]:!shadow-none [&_button]:!backdrop-blur-none [&_button]:[text-shadow:0_1px_2px_rgba(0,0,0,0.85)] [&_button]:hover:!bg-transparent [&_button]:focus-visible:!ring-white [&_button]:focus-visible:!ring-offset-0" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <p className="text-xs uppercase text-background/70">{gardenName}{plant.slot ? ` · ${plant.slot}` : ""}</p>
          <h1 className="mt-1 font-display text-4xl text-background break-words [overflow-wrap:anywhere]">{plant.name}</h1>
          <p className="mt-1 text-sm text-background/80">{plant.species} · {plant.variety}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70">
        <div className="bg-card px-4 py-3">
          <p className="eyebrow">{ui(language, "growing")}</p>
          <p className="mt-1 text-sm">{ageLabel(plant.plantedDaysAgo)}</p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="eyebrow">{ui(language, "lastReview")}</p>
          <p className="mt-1 text-sm">{lastReview ? relativeDay(lastReview.daysAgo) : ui(language, "notYet")}</p>
        </div>
      </div>

      {(attention || recentEvent) ? (
        <div className="mt-5 border-l-2 border-primary/30 pl-4">
          {attention ? <p className="text-sm">{ui(language, "forThisReview")}: {attention.label} · <span className="text-muted-foreground">{dueLabel(attention.dueInDays)}</span></p> : null}
          {recentEvent ? <p className="mt-1 text-xs text-muted-foreground">{ui(language, "recently")}: {recentEvent.title} · {relativeDay(recentEvent.daysAgo)}</p> : null}
        </div>
      ) : null}

      <div className="mt-8 text-center">
        <p className="font-display text-3xl">{ui(language, "howLooksToday")}</p>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2">
        <Button variant="outline" className="h-10 min-w-0 gap-1.5 px-2 text-xs sm:px-3 sm:text-sm" onClick={() => onRecord("observation")}>
          <StickyNote className="h-4 w-4 shrink-0 text-primary" /> <span className="truncate">{ui(language, "observe")}</span>
        </Button>
        <Button variant="outline" className="h-10 min-w-0 gap-1.5 px-2 text-xs sm:px-3 sm:text-sm" onClick={() => onRecord("care")}>
          <Leaf className="h-4 w-4 shrink-0 text-primary" /> <span className="truncate">{ui(language, "careAction")}</span>
        </Button>
        <Button variant="outline" className="h-10 min-w-0 gap-1.5 px-2 text-xs sm:px-3 sm:text-sm" onClick={() => onRecord("followup")}>
          <CalendarClock className="h-4 w-4 shrink-0 text-primary" /> <span className="truncate">{ui(language, "followUpAction")}</span>
        </Button>
        <Button variant="outline" className="h-10 min-w-0 gap-1.5 px-2 text-xs sm:px-3 sm:text-sm" onClick={() => onRecord()}>
          <MoreHorizontal className="h-4 w-4 shrink-0 text-primary" /> <span className="truncate">{ui(language, "more")}</span>
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={!canCheck || checkPhase === "scanning"} onClick={runCheck} className="min-h-11 flex-1 gap-2 disabled:cursor-not-allowed disabled:opacity-45">
          <ScanLine className="h-4 w-4" /> {checkPhase === "scanning" ? ui(language, "analysing") : ui(language, "aiCheck")}
        </Button>
        <Button asChild className={`min-h-11 flex-1 border shadow-none ${askGardenAccentClassName}`}>
          <Link to="/plants/$plantId/ask" params={{ plantId: plant.id }} search={{ from: "care", prompt: undefined, ...careReturnSearch }}>
            <MessageCircle className="h-4 w-4" /> {ui(language, "askGarden")}
          </Link>
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-10 gap-2"
          disabled={recordedForReview || looksGoodBusy}
          onClick={async () => {
            setLooksGoodBusy(true);
            try { await onLooksGood(); } finally { setLooksGoodBusy(false); }
          }}
        >
          <Check className="h-4 w-4" /> {ui(language, "looksGood")}
        </Button>
        <Button
          type="button"
          variant={recordedForReview ? "outline" : "ghost"}
          className="min-h-10 gap-2 text-muted-foreground"
          onClick={recordedForReview ? onNext : onSkip}
        >
          {ui(language, careSessionAction(recordedForReview))}
          {recordedForReview ? <ArrowRight className="h-4 w-4" /> : <SkipForward className="h-4 w-4" />}
        </Button>
      </div>

      {!reviewImage ? <p className="mt-2 text-center text-xs text-muted-foreground">{ui(language, "noReviewPhoto")}</p> : null}

      {checkPhase !== "idle" ? (
        <section className="mt-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl">{ui(language, "gardenAiCheck")}</h2>
            <ProvenanceTag kind="inferred" />
          </div>
          {checkPhase === "scanning" ? <p className="mt-3 text-sm text-muted-foreground">{ui(language, "analysing")}</p> : null}
          {checkPhase === "error" ? <p className="mt-3 text-sm text-muted-foreground">{ui(language, "analysisUnavailableBody")}</p> : null}
          {result ? (
            <>
              {careActions.length ? (
                <div className="mt-4 border-t border-border/60 pt-4">
                  <h3 className="eyebrow">{ui(language, "whatToDoToday")}</h3>
                  <div className="mt-3 space-y-3">
                    {careActions.map((action) => (
                      <div key={`${action.key}-${action.label}`}>
                        <p className="text-sm font-medium">{action.label}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{action.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <details className="mt-4 border-t border-border/60 pt-3">
                <summary className="cursor-pointer text-sm font-medium text-primary">{ui(language, "viewFullAnalysis")}</summary>
                <div className="pt-2">
                  <h3 className="font-display text-lg">{result.headline}</h3>
                  {result.summary ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{result.summary}</p> : null}
                  <div className="mt-3"><ConfidenceBar confidence={result.confidence} /></div>
                  {result.findings.map((finding, index) => (
                    <div key={`${finding.kind}-${index}`} className="mt-4 border-t border-border/60 pt-3">
                      <ProvenanceTag kind={finding.kind === "inference" ? "inferred" : finding.kind} confidence={finding.confidence} />
                      {finding.title ? <p className="mt-2 text-sm font-medium">{finding.title}</p> : null}
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{finding.body}</p>
                      {shouldShowFindingConfidence(finding, result.confidence) ? <p className="mt-1 text-xs text-inference">{ui(language, "confidence")}: {ui(language, finding.confidence === "high" ? "confidenceHigh" : finding.confidence === "moderate" ? "confidenceModerate" : "confidenceLow")}</p> : null}
                    </div>
                  ))}
                  <p className="mt-4 text-xs text-muted-foreground">{ui(language, "savingDoesNotChange")}</p>
                </div>
              </details>
              <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
                {conversation.map((item, index) => (
                    <div key={`${item.question}-${index}`} className="min-w-0 max-w-full space-y-2 text-sm break-words [overflow-wrap:anywhere]">
                    <div className="ml-auto flex max-w-[90%] flex-col items-end gap-2">
                      {item.imageDataUrl ? <img src={item.imageDataUrl} alt={ui(language, "attachedPhotoPreview")} className="max-h-36 max-w-40 rounded-xl object-cover" /> : null}
                      <p className="w-fit min-w-0 max-w-full break-words rounded-2xl rounded-br-md bg-primary px-3 py-2 text-primary-foreground [overflow-wrap:anywhere]">{item.question}</p>
                    </div>
                    {item.facts.length ? <div><ProvenanceTag kind="recorded" /><ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">{item.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul></div> : null}
                    <div><ProvenanceTag kind="inferred" /><p className="mt-2 leading-relaxed text-muted-foreground">{item.answer}</p></div>
                  </div>
                ))}
                <GardenConversationComposer
                  language={language}
                  placeholder={ui(language, "askAboutThis")}
                  disabled={chatBusy}
                  sending={chatBusy}
                  sendLabel={chatBusy ? ui(language, "analysing") : ui(language, "sendQuestion")}
                  onSend={askAboutCheck}
                />
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function SessionComplete({ language, summary, onDone }: { language: "en" | "es"; summary: SessionSummary; onDone: () => void }) {
  const outcomes = [
    { label: ui(language, "plantsReviewed"), value: summary.reviewed },
    { label: ui(language, "observations"), value: summary.observations },
    { label: ui(language, "careActions"), value: summary.care },
    { label: ui(language, "followUps"), value: summary.followups },
  ];
  return (
    <main className="mx-auto grid min-h-[70vh] w-full max-w-xl place-items-center px-5 py-12 text-center">
      <div className="w-full">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-primary"><Sparkles className="h-5 w-5" /></span>
        <p className="eyebrow mt-5">{ui(language, "sessionComplete")}</p>
        <h1 className="mt-2 font-display text-3xl">{ui(language, "gardenSeen")}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{ui(language, "onlyRecorded")}</p>
        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 text-left">
          {outcomes.map((outcome) => (
            <div key={outcome.label} className="bg-card p-4">
              <dt className="text-xs text-muted-foreground">{outcome.label}</dt>
              <dd className="numeral mt-1 text-xl">{outcome.value}</dd>
            </div>
          ))}
        </dl>
        <Button className="mt-7" onClick={onDone}>{ui(language, "backToCare")} <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </main>
  );
}
