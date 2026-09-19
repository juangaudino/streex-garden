import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ChevronLeft,
  Film,
  ScanLine,
  GitCompareArrows,
  MessageCircle,
  Plus,
  Check,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { useGarden, knowledgeById } from "@/lib/garden-store";
import {
  ageLabel,
  chronological,
  dueLabel,
  eventLabels,
  formatDate,
  maintenanceLabels,
  openTasks,
  plantEvents,
  plantPhotos,
  relativeDay,
  statusMeta,
  storyFacts,
  plantCompanions,
  latestPlantPhoto,
} from "@/lib/garden-logic";
import type { MaintenanceType } from "@/lib/garden-data";
import { ProvenanceTag, SectionTitle, StatusDot, eventIcons, maintenanceIcons } from "@/components/garden/atoms";
import { RecordMomentSheet, careShortcuts, type MomentFlow } from "@/components/garden/record-moment";
import { HistoryShareDialog } from "@/components/garden/share-story";
import { usePhotoViewer } from "@/components/garden/photo-viewer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plants/$plantId/")({
  head: () => ({
    meta: [
      { title: "Plant profile — Garden X" },
      {
        name: "description",
        content:
          "One plant, one living record: identity, age, status, story milestones, photos, care and every recorded event.",
      },
      { property: "og:title", content: "Plant profile — Garden X" },
      {
        property: "og:description",
        content: "Identity, age, milestones, photos and every recorded event for a single plant.",
      },
    ],
  }),
  component: PlantProfile,
});

const tabs = ["History", "Timeline", "Photos", "Care", "Reference"] as const;
type Tab = (typeof tabs)[number];

function PlantProfile() {
  const { plantId } = Route.useParams();
  const store = useGarden();
  const plant = store.plants.find((p) => p.id === plantId);
  if (!plant) throw notFound();

  const [tab, setTab] = useState<Tab>("History");
  const [note, setNote] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordFlow, setRecordFlow] = useState<MomentFlow | undefined>(undefined);
  const [recordCare, setRecordCare] = useState<MaintenanceType | undefined>(undefined);
  const [shareOpen, setShareOpen] = useState(false);
  const photoViewer = usePhotoViewer();

  const openRecord = (flow?: MomentFlow, care?: MaintenanceType) => {
    setRecordFlow(flow);
    setRecordCare(care);
    setRecordOpen(true);
  };

  const garden = store.gardens.find((g) => g.id === plant.gardenId)!;
  const photos = plantPhotos(store.photos, plant.id);
  const hero = latestPlantPhoto(store.photos, plant.id);
  const events = plantEvents(store.events, plant.id);
  const tasks = openTasks(store.tasks.filter((t) => t.plantId === plant.id));
  const doneTasks = store.tasks.filter((t) => t.plantId === plant.id && t.done);
  const reference = knowledgeById(plant.knowledgeId);
  const companions = plantCompanions(plant.knowledgeId);
  const history = useMemo(() => chronological(events), [events]);

  const first = photos[0];
  const latest = photos[photos.length - 1];

  return (
    <div className="rise pb-20">
      {/* hero */}
      <div className="relative">
        <div className="relative aspect-[4/5] sm:aspect-[21/9]">
          {hero ? (
            <img
              src={hero.src}
              alt={`${plant.name}, ${plant.species}`}
              width={1024}
              height={1280}
              className="h-full w-full object-cover"
            />
          ) : null}
          <div className="veil absolute inset-0" />
        </div>
        <Link
          to="/gardens/$gardenId"
          params={{ gardenId: garden.id }}
          search={{ view: "overview" }}
          className="absolute top-5 left-5 inline-flex items-center gap-1 rounded-full bg-black/35 px-3 py-1.5 text-xs text-white backdrop-blur-md"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> {garden.name}
        </Link>
        <div className="absolute inset-x-0 bottom-0 px-5 pb-6 sm:px-8 lg:px-12">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] tracking-[0.16em] text-white/70 uppercase">
            <span>{ageLabel(plant.plantedDaysAgo)}</span>
            <span>·</span>
            <span>Day {plant.plantedDaysAgo}</span>
            {plant.slot ? (
              <>
                <span>·</span>
                <span>{plant.slot}</span>
              </>
            ) : null}
          </div>
          <h1 className="mt-1.5 font-display text-4xl text-white sm:text-6xl">{plant.name}</h1>
          <p className="mt-1 text-sm text-white/80">
            {plant.species} · <span className="italic">{plant.scientific}</span> · “{plant.variety}”
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 ring-1 ring-white/20 backdrop-blur-md">
            <span className={cn("h-1.5 w-1.5 rounded-full", statusMeta[plant.status].dot)} />
            <span className="text-xs text-white">
              {statusMeta[plant.status].label} — {plant.statusNote}
            </span>
          </div>
        </div>
      </div>

      {/* tools */}
      <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto px-5 sm:px-8 lg:px-12">
        <button
          onClick={() => openRecord()}
          className="press inline-flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2.5 text-sm shadow-soft"
        >
          <Plus className="h-4 w-4 text-primary" strokeWidth={1.8} />
          Record a Moment
        </button>
        {[
          { to: "/plants/$plantId/check", label: "AI Check", icon: ScanLine },
          { to: "/plants/$plantId/compare", label: "Compare", icon: GitCompareArrows },
          { to: "/plants/$plantId/film", label: "Growth Film", icon: Film },
        ].map((tool) => (
          <Link
            key={tool.label}
            to={tool.to}
            params={{ plantId: plant.id }}
            className="press inline-flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2.5 text-sm shadow-soft"
          >
            <tool.icon className="h-4 w-4 text-primary" strokeWidth={1.8} />
            {tool.label}
          </Link>
        ))}
        <button
          onClick={() => setShareOpen(true)}
          className="press inline-flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2.5 text-sm shadow-soft"
        >
          <Share2 className="h-4 w-4 text-primary" strokeWidth={1.8} />
          Share Story
        </button>
        <Link
          to="/plants/$plantId/ask"
          params={{ plantId: plant.id }}
          search={{ from: undefined, prompt: undefined }}
          className="press inline-flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2.5 text-sm shadow-soft"
        >
          <MessageCircle className="h-4 w-4 text-primary" strokeWidth={1.8} />
          Ask Garden
        </Link>
      </div>

      {/* identity strip */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border/70 bg-border/60 sm:grid-cols-4 mx-5 sm:mx-8 lg:mx-12">
        {[
          { k: "Planted", v: formatDate(plant.plantedDaysAgo) },
          ...storyFacts(plant, store.events).map((f) => ({ k: f.label, v: f.value })),
        ].map((cell) => (
          <div key={cell.k} className="bg-card px-4 py-3.5">
            <p className="eyebrow">{cell.k}</p>
            <p className="numeral mt-1 text-sm">{cell.v}</p>
          </div>
        ))}
      </div>

      {/* tabs */}
      <div className="sticky top-0 z-30 mt-8 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="no-scrollbar flex gap-1 overflow-x-auto px-5 sm:px-8 lg:px-12">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative shrink-0 px-3 py-3.5 text-sm transition-colors",
                tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
              {tab === t ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-8 sm:px-8 lg:px-12">
        {/* ------------------------------------------------ HISTORY */}
        {tab === "History" ? (
          <div className="rise max-w-4xl">
            {first && latest && first.id !== latest.id ? (
              <div className="mb-12 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-lift">
                <div className="grid grid-cols-2 gap-1 bg-border/60">
                  {[first, latest].map((p, i) => (
                    <figure key={p.id} className="relative bg-card">
                      <button type="button" onClick={() => photoViewer.open(p.src, p.caption)} aria-label={`View ${p.caption} larger`} className="block w-full">
                        <img src={p.src} alt={p.caption} loading="lazy" className="aspect-[3/4] w-full object-cover sm:aspect-[4/3]" />
                      </button>
                      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <p className="text-[0.65rem] tracking-[0.14em] text-white/70 uppercase">
                          {i === 0 ? "Then" : "Now"}
                        </p>
                        <p className="text-xs text-white">{formatDate(p.daysAgo)}</p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div><p className="eyebrow">A real passage of time</p><p className="mt-1 font-display text-2xl">{Math.round((first.daysAgo - latest.daysAgo) / 7)} weeks, held in two photographs</p><p className="mt-1.5 text-sm text-muted-foreground">{first.caption} → {latest.caption}</p></div>
                  <Link to="/plants/$plantId/compare" params={{ plantId: plant.id }} search={{ from: undefined }} className="text-sm text-primary hover:underline">Look closer</Link>
                </div>
              </div>
            ) : null}

            <SectionTitle action={<button onClick={() => setShareOpen(true)} className="inline-flex items-center gap-1.5 text-primary hover:underline"><Share2 className="h-3.5 w-3.5" /> Share selection</button>}>What this plant has lived through</SectionTitle>
            <p className="mb-9 max-w-2xl text-sm leading-relaxed text-muted-foreground">A reading of recorded moments, not a rewritten biography. The complete log remains in Timeline.</p>

            <ol className="space-y-5">
              {history.map((e, i) => {
                const Icon = eventIcons[e.type];
                const photo = store.photos.find((p) => p.id === e.photoId);
                const day = plant.plantedDaysAgo - e.daysAgo;
                return (
                  <li key={e.id} className={cn("grid gap-5 border-t border-border/70 pt-5", photo && "sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)] sm:items-center", !e.milestone && !photo && "ml-3 border-l border-t-0 py-1 pl-5")}>
                    <div className="min-w-0"><p className="eyebrow">Day {Math.max(day, 0)} · {formatDate(e.daysAgo)}</p><div className={cn("flex items-start gap-3", e.milestone ? "mt-3" : "mt-2")}><span className={cn("grid shrink-0 place-items-center rounded-full bg-secondary text-primary", e.milestone ? "h-8 w-8" : "h-6 w-6")}><Icon className={e.milestone ? "h-4 w-4" : "h-3 w-3"} /></span><div><h3 className={cn(e.milestone ? "font-display text-2xl" : "text-sm font-medium")}>{e.title}</h3>{e.detail ? <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{e.detail}</p> : null}<div className="mt-3"><ProvenanceTag kind={e.provenance === "recorded" ? "recorded" : e.provenance === "observed" ? "observed" : "inferred"} /></div></div></div></div>
                    {photo ? <figure className="overflow-hidden rounded-2xl shadow-soft"><button type="button" onClick={() => photoViewer.open(photo.src, photo.caption)} aria-label={`View ${photo.caption} larger`} className="block w-full"><img src={photo.src} alt={photo.caption} loading="lazy" className="aspect-[4/3] w-full object-cover" /></button><figcaption className="bg-card px-3 py-2 text-xs text-muted-foreground">{photo.caption}</figcaption></figure> : null}
                    {i === history.length - 1 ? (
                      <p className="font-display text-lg text-primary sm:col-span-2">
                        …and {relativeDay(e.daysAgo).toLowerCase()} the story is still open.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <div className="mt-12 rounded-3xl border border-border/70 bg-card p-5 shadow-soft">
              <SectionTitle>Journal entry</SectionTitle>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What did you notice today?" className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
              <Button onClick={() => { if (!note.trim()) return; store.addEvent({ plantId: plant.id, daysAgo: 0, type: "note", title: note.trim().slice(0, 60), detail: note.trim(), provenance: "recorded" }); setNote(""); toast.success("Journal entry added to history"); }} className="mt-3 rounded-full"><Plus className="h-4 w-4" /> Save entry</Button>
            </div>
          </div>
        ) : null}

        {/* ------------------------------------------------ TIMELINE */}
        {tab === "Timeline" ? (
          <div className="rise max-w-3xl">
            <SectionTitle>Everything recorded</SectionTitle>
            <ul className="space-y-2">
              {events.map((e) => {
                const Icon = eventIcons[e.type];
                const photo = store.photos.find((p) => p.id === e.photoId);
                return (
                  <li
                    key={e.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-border/60 bg-card p-4"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                        <p className="truncate text-sm font-medium">{e.title}</p>
                        <span className="numeral shrink-0 text-xs text-muted-foreground">
                          {formatDate(e.daysAgo)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {eventLabels[e.type]} · {relativeDay(e.daysAgo)}
                      </p>
                      {e.detail ? <p className="mt-2 text-sm text-muted-foreground">{e.detail}</p> : null}
                      {photo ? (
                        <button
                          type="button"
                          onClick={() => photoViewer.open(photo.src, photo.caption)}
                          aria-label={`View ${photo.caption} larger`}
                          className="press mt-3 block"
                        >
                          <img
                            src={photo.src}
                            alt={photo.caption}
                            loading="lazy"
                            className="h-24 w-24 rounded-xl object-cover"
                          />
                        </button>
                      ) : null}
                      <div className="mt-2.5">
                        <ProvenanceTag
                          kind={e.provenance === "recorded" ? "recorded" : e.provenance === "observed" ? "observed" : "inferred"}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

          </div>
        ) : null}

        {/* ------------------------------------------------ PHOTOS */}
        {tab === "Photos" ? (
          <div className="rise">
            <SectionTitle
              action={
                <Link to="/plants/$plantId/film" params={{ plantId: plant.id }} className="text-primary hover:underline">
                  Make a film
                </Link>
              }
            >
              Photographic evidence
            </SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {chronological(photos).map((photo) => (
                <figure key={photo.id} className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft">
                  <button type="button" onClick={() => photoViewer.open(photo.src, photo.caption)} aria-label={`View ${photo.caption} larger`} className="block w-full">
                    <img src={photo.src} alt={photo.caption} loading="lazy" className="aspect-square w-full object-cover" />
                  </button>
                  <figcaption className="p-3.5">
                    <p className="eyebrow">{formatDate(photo.daysAgo)}</p>
                    <p className="mt-1 text-sm leading-snug">{photo.caption}</p>
                    <p className="numeral mt-2 text-xs text-muted-foreground">
                      {photo.metrics.heightCm}cm · {photo.metrics.leafCount} leaves · density {photo.metrics.density}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="mt-5 max-w-xl text-xs text-muted-foreground">
              Adding a photo creates a timeline event automatically, so the series stays honest about when each
              frame was taken.
            </p>
          </div>
        ) : null}

        {/* ------------------------------------------------ CARE */}
        {tab === "Care" ? (
          <div className="rise max-w-3xl">
            <SectionTitle
              action={
                <Link to="/care" className="text-primary hover:underline">
                  Guided session
                </Link>
              }
            >
              Open actions
            </SectionTitle>
            <ul className="surface divide-y divide-border/70 overflow-hidden">
              {tasks.length ? (
                tasks.map((task) => {
                  const Icon = maintenanceIcons[task.type];
                  return (
                    <li key={task.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm">{task.label}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {maintenanceLabels[task.type]} · {dueLabel(task.dueInDays)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          store.completeTask(task.id);
                          toast.success(`${task.label} logged`);
                        }}
                        className="press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                      >
                        <Check className="h-3.5 w-3.5" /> Done
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing open for {plant.name}.
                </li>
              )}
            </ul>

            <div className="mt-8">
              <SectionTitle
                action={
                  <button onClick={() => openRecord()} className="text-primary hover:underline">
                    All ways to record
                  </button>
                }
              >
                Log something now
              </SectionTitle>
              <p className="mb-3 text-xs text-muted-foreground">
                Shortcuts chosen for {plant.name} right now — each one opens the same recording flow.
              </p>
              <div className="flex flex-wrap gap-2">
                {careShortcuts(plant).map((type) => {
                  const Icon = maintenanceIcons[type];
                  return (
                    <button
                      key={type}
                      onClick={() => openRecord("care", type)}
                      className="press inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2.5 text-sm shadow-soft"
                    >
                      <Icon className="h-4 w-4 text-primary" /> {maintenanceLabels[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            {doneTasks.length ? (
              <div className="mt-8">
                <SectionTitle>Completed in this session</SectionTitle>
                <ul className="space-y-2">
                  {doneTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary" /> {t.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ------------------------------------------------ REFERENCE */}
        {tab === "Reference" ? (
          <div className="rise max-w-3xl">
            <SectionTitle
              action={
                <Link to="/library" className="text-primary hover:underline">
                  Full catalog
                </Link>
              }
            >
              Reference data
            </SectionTitle>
            <p className="mb-5 text-sm text-muted-foreground">
              Deterministic species reference. It never changes because of a photo or an AI reading.
            </p>
            {reference ? (
              <dl className="grid gap-px overflow-hidden rounded-3xl border border-border/70 bg-border/60 sm:grid-cols-2">
                {[
                  ["Common name", reference.common],
                  ["Scientific name", reference.scientific],
                  ["Variety", reference.variety],
                  ["Germination", reference.germinationDays],
                  ["Light", reference.light],
                  ["Temperature", reference.temperature],
                  ["pH", reference.ph],
                  ...(reference.ec ? [["EC", reference.ec]] : []),
                  ["Spacing", reference.spacing],
                  ["Pruning", reference.pruning],
                  ["Harvest", reference.harvest],
                  ["Expected cycle", reference.cycle],
                ].map(([k, v]) => (
                  <div key={k} className="bg-card px-4 py-3.5">
                    <dt className="eyebrow">{k}</dt>
                    <dd className="mt-1 text-sm">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {reference ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-border/70 bg-card p-5">
                  <p className="eyebrow">Common problems</p>
                  <ul className="mt-2.5 space-y-1.5 text-sm text-muted-foreground">
                    {reference.problems.map((p) => (
                      <li key={p}>· {p}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-3xl border border-border/70 bg-card p-5">
                  <p className="eyebrow">Recommendations</p>
                  <ul className="mt-2.5 space-y-1.5 text-sm text-muted-foreground">
                    {reference.recommendations.map((p) => (
                      <li key={p}>· {p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            {reference ? (
              <div className="mt-5 grid gap-px overflow-hidden rounded-3xl border border-border/70 bg-border/60 sm:grid-cols-2">
                <div className="bg-card p-5">
                  <p className="eyebrow">Good neighbors</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{companions.good.join(" · ")}</p>
                </div>
                <div className="bg-card p-5">
                  <p className="eyebrow">Better separate</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{companions.separate.join(" · ")}</p>
                </div>
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <StatusDot status={plant.status} />
              <span className="text-xs text-muted-foreground">
                Identity {plant.identityConfirmed ? "confirmed by you" : "unconfirmed"} · canonical data is only
                changed with your confirmation.
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <RecordMomentSheet
        plant={plant}
        open={recordOpen}
        initialFlow={recordFlow}
        initialCareType={recordCare}
        onClose={() => setRecordOpen(false)}
      />
      <HistoryShareDialog plant={plant} photos={photos} events={events} open={shareOpen} onOpenChange={setShareOpen} />
      {photoViewer.viewer}
    </div>
  );
}