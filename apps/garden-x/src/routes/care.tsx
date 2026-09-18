import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  Leaf,
  MessageCircle,
  MoreHorizontal,
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
  relativeDay,
} from "@/lib/garden-logic";
import { PageHeader } from "@/components/garden/shell";
import { SectionTitle, maintenanceIcons } from "@/components/garden/atoms";
import type { MaintenanceType, Plant } from "@/lib/garden-data";

export const Route = createFileRoute("/care")({
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
  const tasks = openTasks(store.tasks);
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState<SessionSummary>(emptySummary);
  const [finished, setFinished] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordFlow, setRecordFlow] = useState<MomentFlow | undefined>();
  const [recordCare, setRecordCare] = useState<MaintenanceType | undefined>();

  const activePlants = useMemo(() => store.plants.filter((plant) => !plant.cycleClosed), [store.plants]);
  const needingLook = new Set(tasks.map((t) => t.plantId)).size;
  const routine = activePlants.length - needingLook;
  const current = queue[index] ? store.plants.find((plant) => plant.id === queue[index]) : undefined;

  const orderedQueue = (firstId?: string) => {
    const urgency = new Map<string, number>();
    tasks.forEach((task) => {
      urgency.set(task.plantId, Math.min(urgency.get(task.plantId) ?? Number.POSITIVE_INFINITY, task.dueInDays));
    });
    const ids = [...activePlants]
      .sort((a, b) => (urgency.get(a.id) ?? 99) - (urgency.get(b.id) ?? 99))
      .map((plant) => plant.id);
    if (!firstId || !ids.includes(firstId)) return ids;
    return [firstId, ...ids.filter((id) => id !== firstId)];
  };

  const startSession = (firstId?: string) => {
    setQueue(orderedQueue(firstId));
    setIndex(0);
    setSummary(emptySummary());
    setFinished(false);
  };

  const leaveSession = () => {
    setQueue([]);
    setIndex(0);
    setFinished(false);
    setRecordOpen(false);
  };

  const advance = (reviewed: boolean) => {
    if (reviewed) setSummary((value) => ({ ...value, reviewed: value.reviewed + 1 }));
    if (index + 1 >= queue.length) setFinished(true);
    else setIndex((value) => value + 1);
  };

  const openRecord = (flow?: MomentFlow, careType?: MaintenanceType) => {
    setRecordFlow(flow);
    setRecordCare(careType);
    setRecordOpen(true);
  };

  const handleRecorded = (flow: MomentFlow) => {
    if (flow === "observation") setSummary((value) => ({ ...value, observations: value.observations + 1 }));
    if (flow === "care") setSummary((value) => ({ ...value, care: value.care + 1 }));
    if (flow === "followup") setSummary((value) => ({ ...value, followups: value.followups + 1 }));
  };

  if (queue.length > 0) {
    return (
      <div className="min-h-screen pb-24">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/70 px-5 py-4 sm:px-8 lg:px-12">
          <div className="min-w-0">
            <p className="eyebrow">Care session</p>
            <p className="numeral mt-0.5 text-sm text-muted-foreground">
              {summary.reviewed} of {queue.length} plants reviewed
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={leaveSession}>End</Button>
        </header>

        {finished || !current ? (
          <SessionComplete summary={summary} onDone={leaveSession} />
        ) : (
          <PlantReview
            plant={current}
            gardenName={store.gardens.find((garden) => garden.id === current.gardenId)?.name ?? "Garden"}
            lastReview={lastReview(store.events, current.id)}
            photoSrc={store.photos.find((photo) => photo.id === current.heroPhotoId)?.src}
            recentEvent={plantEvents(store.events, current.id)[0]}
            attention={tasks.find((task) => task.plantId === current.id)}
            onRecord={openRecord}
            onLooksGood={() => {
              store.addEvent({
                plantId: current.id,
                daysAgo: 0,
                type: "note",
                title: "Reviewed — looks good",
                detail: "No action needed during today's care review.",
                provenance: "recorded",
              });
              toast.success(`${current.name} reviewed`);
              advance(true);
            }}
            onNext={() => advance(true)}
            onSkip={() => advance(false)}
          />
        )}

        {current ? (
          <RecordMomentSheet
            plant={current}
            open={recordOpen}
            initialFlow={recordFlow}
            initialCareType={recordCare}
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
        eyebrow="Care"
        title="Check on your plants"
        subtitle="Take a quiet pass through the garden. Notice what changed, record what matters, and decide what deserves another look."
      />

      <section className="px-5 sm:px-8 lg:px-12">
        <div className="overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-soft">
          <div className="grid gap-6 px-6 py-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-8">
            <div className="max-w-xl">
              <p className="text-xs uppercase text-primary-foreground/70">Guided review</p>
              <h1 className="mt-2 font-display text-3xl">See each plant as it is today.</h1>
              <p className="mt-2 text-sm text-primary-foreground/75">
                {activePlants.length} {activePlants.length === 1 ? "plant" : "plants"} to check · {needingLook} {needingLook === 1 ? "needs" : "need"} a closer look · {routine} routine {routine === 1 ? "review" : "reviews"}
              </p>
            </div>
            <Button
              onClick={() => startSession()}
              className="w-full bg-background text-foreground hover:bg-background/90 sm:w-auto"
            >
              Start care session <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-10 px-5 sm:px-8 lg:px-12">
        <SectionTitle>Worth a closer look</SectionTitle>
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
                <Button variant="ghost" size="sm" onClick={() => startSession(plant.id)}>
                  Review <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {tasks.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nothing is asking for attention right now.</p> : null}
        </div>
      </section>
    </div>
  );
}

function PlantReview({
  plant,
  gardenName,
  lastReview,
  photoSrc,
  recentEvent,
  attention,
  onRecord,
  onLooksGood,
  onNext,
  onSkip,
}: {
  plant: Plant;
  gardenName: string;
  lastReview?: { title: string; daysAgo: number } | undefined;
  photoSrc?: string | undefined;
  recentEvent?: { title: string; daysAgo: number } | undefined;
  attention?: { label: string; dueInDays: number } | undefined;
  onRecord: (flow?: MomentFlow, careType?: MaintenanceType) => void;
  onLooksGood: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8 sm:py-8">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-secondary shadow-lift sm:aspect-[16/10]">
        {photoSrc ? <img src={photoSrc} alt={`${plant.name}, ${plant.species}`} className="h-full w-full object-cover" /> : null}
        <div className="veil absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <p className="text-xs uppercase text-background/70">{gardenName}{plant.slot ? ` · ${plant.slot}` : ""}</p>
          <h1 className="mt-1 font-display text-4xl text-background">{plant.name}</h1>
          <p className="mt-1 text-sm text-background/80">{plant.species} · {plant.variety}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70">
        <div className="bg-card px-4 py-3">
          <p className="eyebrow">Growing</p>
          <p className="mt-1 text-sm">{ageLabel(plant.plantedDaysAgo)}</p>
        </div>
        <div className="bg-card px-4 py-3">
          <p className="eyebrow">Last review</p>
          <p className="mt-1 text-sm">{lastReview ? relativeDay(lastReview.daysAgo) : "Not yet"}</p>
        </div>
      </div>

      {(attention || recentEvent) ? (
        <div className="mt-5 border-l-2 border-primary/30 pl-4">
          {attention ? <p className="text-sm">For this review: {attention.label} · <span className="text-muted-foreground">{dueLabel(attention.dueInDays)}</span></p> : null}
          {recentEvent ? <p className="mt-1 text-xs text-muted-foreground">Recently: {recentEvent.title} · {relativeDay(recentEvent.daysAgo)}</p> : null}
        </div>
      ) : null}

      <div className="mt-8 text-center">
        <p className="font-display text-3xl">How does it look today?</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-auto justify-start gap-3 py-3.5" onClick={() => onRecord("observation")}>
          <StickyNote className="h-4 w-4 text-primary" /> Add observation
        </Button>
        <Button variant="outline" className="h-auto justify-start gap-3 py-3.5" onClick={() => onRecord("care")}>
          <Leaf className="h-4 w-4 text-primary" /> Record care
        </Button>
        <Button variant="outline" className="h-auto justify-start gap-3 py-3.5" onClick={() => onRecord("followup")}>
          <CalendarClock className="h-4 w-4 text-primary" /> Review later
        </Button>
        <Button variant="outline" className="h-auto justify-start gap-3 py-3.5" onClick={() => onRecord()}>
          <MoreHorizontal className="h-4 w-4 text-primary" /> More
        </Button>
      </div>

      <Button variant="outline" asChild className="mt-3 w-full">
        <Link to="/plants/$plantId/ask" params={{ plantId: plant.id }} search={{ from: undefined, prompt: undefined }}>
          <MessageCircle className="h-4 w-4 text-primary" /> Ask Garden AI for a second look
        </Link>
      </Button>

      <Button className="mt-6 w-full" onClick={onLooksGood}>
        <Check className="h-4 w-4" /> Looks good · no action needed
      </Button>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onNext}>Next plant <ArrowRight className="h-4 w-4" /></Button>
        <Button variant="ghost" className="text-muted-foreground" onClick={onSkip}>Skip for now <SkipForward className="h-4 w-4" /></Button>
      </div>
    </main>
  );
}

function SessionComplete({ summary, onDone }: { summary: SessionSummary; onDone: () => void }) {
  const outcomes = [
    { label: "Plants reviewed", value: summary.reviewed },
    { label: "Observations", value: summary.observations },
    { label: "Care actions", value: summary.care },
    { label: "Follow-ups", value: summary.followups },
  ];
  return (
    <main className="mx-auto grid min-h-[70vh] w-full max-w-xl place-items-center px-5 py-12 text-center">
      <div className="w-full">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-primary"><Sparkles className="h-5 w-5" /></span>
        <p className="eyebrow mt-5">Session complete</p>
        <h1 className="mt-2 font-display text-3xl">The garden has been seen.</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Only what you chose to record was added to plant history.</p>
        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 text-left">
          {outcomes.map((outcome) => (
            <div key={outcome.label} className="bg-card p-4">
              <dt className="text-xs text-muted-foreground">{outcome.label}</dt>
              <dd className="numeral mt-1 text-xl">{outcome.value}</dd>
            </div>
          ))}
        </dl>
        <Button className="mt-7" onClick={onDone}>Back to Care <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </main>
  );
}