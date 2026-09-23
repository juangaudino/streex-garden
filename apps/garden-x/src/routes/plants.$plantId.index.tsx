import { useEffect, useMemo, useState } from "react";
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
import { useGarden } from "@/lib/garden-store";
import {
  ageLabel,
  chronological,
  dueLabel,
  localizedEventLabel,
  formatDate,
  localizedMaintenanceLabel,
  openTasks,
  plantEvents,
  plantPhotos,
  relativeDay,
  statusMeta,
  localizedStatusLabel,
  storyFacts,
  isRedundantTimelineDetail,
  isTimelineTitleProjectionOfDetail,
  latestPlantPhoto,
  plantTimeline,
  sortPhotosByCapturedAt,
  photoMetricEntries,
  type SortOrder,
} from "@/lib/garden-logic";
import type { MaintenanceType } from "@/lib/garden-data";
import {
  ProvenanceTag,
  SectionTitle,
  StatusDot,
  eventIcons,
  maintenanceIcons,
} from "@/components/garden/atoms";
import {
  RecordMomentSheet,
  careShortcuts,
  type MomentFlow,
} from "@/components/garden/record-moment";
import { HistoryShareDialog } from "@/components/garden/share-story";
import { usePhotoViewer } from "@/components/garden/photo-viewer";
import { PhotoImage } from "@/components/garden/photo-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChronologySelect } from "@/components/garden/chronology-select";
import { DeleteActionMenu } from "@/components/garden/delete-action-menu";
import { LibraryIdentityResolution } from "@/components/garden/library-identity-resolution";
import { loadGardenLibraryCatalog, localizedLibraryName, type GardenLibraryManifest } from "@/lib/garden-library";
import { localizeKnownError, ui } from "@/lib/ui-copy";
import { formatStatusLine, plantIdentityParts } from "@/lib/plant-identity";
import { askGardenAccentClassName } from "@/lib/care-session";

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
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [libraryCatalog, setLibraryCatalog] = useState<GardenLibraryManifest | null>(null);
  const [libraryCatalogError, setLibraryCatalogError] = useState<string | undefined>(undefined);
  const photoViewer = usePhotoViewer();

  useEffect(() => {
    let active = true;
    setLibraryCatalogError(undefined);
    void loadGardenLibraryCatalog()
      .then((catalog) => {
        if (active) setLibraryCatalog(catalog);
      })
      .catch((error) => {
        if (active)
          setLibraryCatalogError(
            localizeKnownError(error, language, ui(language, "libraryUnavailable")),
          );
      });
    return () => {
      active = false;
    };
  }, [plant.libraryPlantId]);

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
  const libraryEntry =
    libraryCatalog?.entries.find((entry) => entry.libraryPlantId === plant.libraryPlantId) || null;
  const identity = plantIdentityParts(plant, libraryEntry);
  const language = store.language;
  const displayCommonName =
    language === "es" && libraryEntry?.spanishName ? libraryEntry.spanishName : identity.commonName;
  const referenceFields: Array<[string, string | null]> = libraryEntry
    ? [
        [ui(language, "commonName"), localizedLibraryName(libraryEntry, language)],
        [ui(language, "scientificName"), libraryEntry.scientificName],
        [ui(language, "variety"), libraryEntry.cultivar],
        [ui(language, "germination"), libraryEntry.reference.germination],
        [ui(language, "light"), libraryEntry.reference.light],
        [ui(language, "temperature"), libraryEntry.reference.temperature],
        ["pH", libraryEntry.reference.ph],
        ["EC", libraryEntry.reference.ec],
        [ui(language, "spacing"), libraryEntry.reference.spacing],
        [ui(language, "pruning"), libraryEntry.reference.pruning],
        [ui(language, "harvest"), libraryEntry.reference.harvest],
        [ui(language, "expectedCycle"), libraryEntry.reference.expectedCycle],
      ]
    : [];
  const guidanceCards: Array<[string, readonly string[]]> = libraryEntry
    ? [
        [ui(language, "commonProblems"), libraryEntry.reference.commonProblems],
        [ui(language, "recommendations"), libraryEntry.reference.recommendations],
      ]
    : [];
  const neighborCards: Array<[string, readonly string[]]> = libraryEntry
    ? [
        [ui(language, "goodNeighbors"), libraryEntry.reference.goodNeighborIds],
        [ui(language, "betterSeparate"), libraryEntry.reference.betterSeparateIds],
      ]
    : [];
  const history = useMemo(() => chronological(events), [events]);
  const timeline = useMemo(
    () => plantTimeline(store.events, store.photos, plant.id, sortOrder, plant.gardenId),
    [store.events, store.photos, plant.id, plant.gardenId, sortOrder],
  );
  const orderedPhotos = useMemo(
    () => sortPhotosByCapturedAt(photos, sortOrder),
    [photos, sortOrder],
  );

  const removeEvent = async (event: (typeof events)[number], attachedPhotoCount: number) => {
    try {
      await store.deleteEvent(event.id);
      toast.success(
        attachedPhotoCount
          ? ui(language, "deleteEventKeepPhotos")
          : ui(language, "eventRemovedFromHistory"),
      );
      return true;
    } catch (error) {
            toast.error(localizeKnownError(error, language, ui(language, "eventRemoveFailed")));
      return false;
    }
  };

  const removePhoto = async (photo: (typeof photos)[number]) => {
    try {
      const result = await store.deletePhoto(photo.id);
      if (result.storageCleanupWarning) {
        toast.warning(ui(language, "photoStorageWarning"));
      } else {
        toast.success(ui(language, "photoRemoved"));
      }
      return true;
    } catch (error) {
      toast.error(localizeKnownError(error, language, ui(language, "photoRemoveFailed")));
      return false;
    }
  };

  const first = photos[0];
  const latest = photos[photos.length - 1];

  return (
    <div className="rise min-w-0 pb-20">
      {/* hero */}
      <div className="relative">
        <div className="relative aspect-[4/5] sm:aspect-[21/9]">
          {hero ? (
            <PhotoImage
              photo={hero}
              alt={`${plant.name}, ${plant.species}`}
              width={1024}
              height={1280}
              fetchPriority="high"
              loading="eager"
              rendition="display"
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
            <span>{ui(language, "dayLabel")} {plant.plantedDaysAgo}</span>
            {plant.slot ? (
              <>
                <span>·</span>
                <span>{plant.slot}</span>
              </>
            ) : null}
          </div>
          <h1 className="mt-1.5 font-display text-4xl text-white sm:text-6xl">{plant.name}</h1>
          <p className="mt-1 text-sm text-white/80">
            {displayCommonName}
            {identity.scientificName ? (
              <>
                <span aria-hidden="true"> · </span>
                <span className="italic">{identity.scientificName}</span>
              </>
            ) : null}
            {identity.cultivar ? (
              <>
                <span aria-hidden="true"> · </span>“{identity.cultivar}”
              </>
            ) : null}
          </p>
          <div className="mt-3 flex max-w-full flex-wrap items-center gap-1.5">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 ring-1 ring-white/20 backdrop-blur-md">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusMeta[plant.status].dot)} />
              <span className="truncate text-xs text-white">
                {formatStatusLine(localizedStatusLabel(plant.status, language), plant.statusNote)}
              </span>
            </div>
            <button
              onClick={() => setShareOpen(true)}
              className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border-l border-white/25 px-2.5 py-1.5 text-xs text-white/90 transition-colors hover:bg-black/20"
            >
              <Share2 className="h-3.5 w-3.5" strokeWidth={1.8} /> {ui(language, "share")}
            </button>
            <Link
              to="/plants/$plantId/film"
              params={{ plantId: plant.id }}
              className="press inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-white/90 transition-colors hover:bg-black/20"
            >
              <Film className="h-3.5 w-3.5" strokeWidth={1.8} /> {ui(language, "film")}
            </Link>
          </div>
        </div>
      </div>

      {/* tools */}
      <div className="mt-5 grid grid-cols-4 gap-1.5 px-5 sm:gap-3 sm:px-8 lg:px-12">
        <button
          onClick={() => openRecord()}
          className="press inline-flex min-w-0 items-center justify-center gap-1 rounded-full border border-border/70 bg-card px-0.5 py-2.5 text-[0.65rem] shadow-soft sm:gap-2 sm:px-4 sm:text-sm"
        >
          <Plus className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
          <span className="truncate sm:hidden">{ui(language, "recordShort")}</span>
          <span className="hidden truncate sm:inline">{ui(language, "recordMoment")}</span>
        </button>
        <Link
          to="/plants/$plantId/check"
          params={{ plantId: plant.id }}
          search={{ from: undefined }}
          className="press inline-flex min-w-0 items-center justify-center gap-1 rounded-full border border-border/70 bg-card px-0.5 py-2.5 text-[0.65rem] shadow-soft sm:gap-2 sm:px-4 sm:text-sm"
        >
          <ScanLine className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
          <span className="truncate">{ui(language, "aiCheck")}</span>
        </Link>
        <Link
          to="/plants/$plantId/compare"
          params={{ plantId: plant.id }}
          search={{ from: undefined }}
          className="press inline-flex min-w-0 items-center justify-center gap-1 rounded-full border border-border/70 bg-card px-0.5 py-2.5 text-[0.65rem] shadow-soft sm:gap-2 sm:px-4 sm:text-sm"
        >
          <GitCompareArrows className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
          <span className="truncate">{ui(language, "compare")}</span>
        </Link>
        <Link
          to="/plants/$plantId/ask"
          params={{ plantId: plant.id }}
          search={{ from: undefined, prompt: undefined }}
          className={`press inline-flex min-w-0 items-center justify-center gap-1 rounded-full border px-0.5 py-2.5 text-[0.65rem] shadow-soft sm:gap-2 sm:px-4 sm:text-sm ${askGardenAccentClassName}`}
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0 text-primary sm:h-4 sm:w-4" strokeWidth={1.8} />
          <span className="truncate">{ui(language, "askGarden")}</span>
        </Link>
      </div>

      {/* identity strip */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-border/70 bg-border/60 sm:grid-cols-4 mx-5 sm:mx-8 lg:mx-12">
        {[
          { k: ui(language, "planted"), v: formatDate(plant.plantedDaysAgo) },
          ...storyFacts(plant, store.events, language, store.gardens.find((garden) => garden.id === plant.gardenId)?.kind).map((f) => ({ k: f.label, v: f.value })),
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
              {t === "History" ? ui(language, "history") : t === "Timeline" ? ui(language, "timeline") : t === "Photos" ? ui(language, "photos") : t === "Care" ? ui(language, "care") : ui(language, "reference")}
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
                      <button
                        type="button"
                        onClick={() => photoViewer.openPhoto(p)}
                        aria-label={`${ui(language, "viewPhotoLarger")}: ${p.caption}`}
                        className="block w-full"
                      >
                        <PhotoImage
                          photo={p}
                          alt={p.caption}
                          rendition="display"
                          loading="eager"
                          className="aspect-[3/4] w-full object-cover sm:aspect-[4/3]"
                        />
                      </button>
                      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <p className="text-[0.65rem] tracking-[0.14em] text-white/70 uppercase">
          {i === 0 ? ui(language, "then") : ui(language, "now")}
                        </p>
                        <p className="text-xs text-white">{formatDate(p.daysAgo)}</p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <p className="eyebrow">{ui(language, "realPassage")}</p>
                    <p className="mt-1 font-display text-2xl">
                      {Math.round((first.daysAgo - latest.daysAgo) / 7)} {ui(language, "weeksHeld")}
                    </p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {first.caption} → {latest.caption}
                    </p>
                  </div>
                  <Link
                    to="/plants/$plantId/compare"
                    params={{ plantId: plant.id }}
                    search={{ from: undefined }}
                    className="text-sm text-primary hover:underline"
                  >
                    {ui(language, "lookCloser")}
                  </Link>
                </div>
              </div>
            ) : null}

            <SectionTitle>{ui(language, "livedThrough")}</SectionTitle>
            <p className="mb-9 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {ui(language, "timelineReading")}
            </p>

            <ol className="space-y-5">
              {history.map((e, i) => {
                const Icon = eventIcons[e.type];
                const eventPhotos = (e.photoIds ?? (e.photoId ? [e.photoId] : []))
                  .map((id) => store.photos.find((p) => p.id === id))
                  .filter(Boolean) as typeof store.photos;
                const photo = eventPhotos[0];
                const day = plant.plantedDaysAgo - e.daysAgo;
                return (
                  <li
                    key={e.id}
                    className={cn(
                      "grid gap-5 border-t border-border/70 pt-5",
                      photo && "sm:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)] sm:items-center",
                      !e.milestone && !photo && "ml-3 border-l border-t-0 py-1 pl-5",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="eyebrow">
                        {ui(language, "dayLabel")} {Math.max(day, 0)} · {formatDate(e.daysAgo)}
                      </p>
                      <div className={cn("flex items-start gap-3", e.milestone ? "mt-3" : "mt-2")}>
                        <span
                          className={cn(
                            "grid shrink-0 place-items-center rounded-full bg-secondary text-primary",
                            e.milestone ? "h-8 w-8" : "h-6 w-6",
                          )}
                        >
                          <Icon className={e.milestone ? "h-4 w-4" : "h-3 w-3"} />
                        </span>
                        <div>
                          <h3
                            className={cn(
                              e.milestone ? "font-display text-2xl" : "text-sm font-medium",
                            )}
                          >
                            {isTimelineTitleProjectionOfDetail(e.title, e.detail) ? e.detail : e.title}
                          </h3>
                          {e.detail && !isRedundantTimelineDetail(e.title, e.detail) && !isTimelineTitleProjectionOfDetail(e.title, e.detail) ? (
                            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                              {e.detail}
                            </p>
                          ) : null}
                          <div className="mt-3">
                            <ProvenanceTag
                              kind={
                                e.provenance === "recorded"
                                  ? "recorded"
                                  : e.provenance === "observed"
                                    ? "observed"
                                    : "inferred"
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    {photo ? (
                      <figure className="overflow-hidden rounded-2xl shadow-soft">
                        <button
                          type="button"
                          onClick={() => photoViewer.openPhoto(photo)}
                          aria-label={`${ui(language, "viewPhotoLarger")}: ${photo.caption}`}
                          className="block w-full"
                        >
                          <PhotoImage
                            photo={photo}
                            alt={photo.caption}
                            rendition="display"
                            className="aspect-[4/3] w-full object-cover"
                          />
                        </button>
                        <figcaption className="bg-card px-3 py-2 text-xs text-muted-foreground">
                          {photo.caption}
                          {eventPhotos.length > 1 ? ` · +${eventPhotos.length - 1} more` : ""}
                        </figcaption>
                      </figure>
                    ) : null}
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
              <SectionTitle>{ui(language, "journalEntry")}</SectionTitle>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder={ui(language, "journalPlaceholder")}
                className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
              />
              <Button
                onClick={() => {
                  if (!note.trim()) return;
                  store.addEvent({
                    plantId: plant.id,
                    daysAgo: 0,
                    type: "note",
                    title: note.trim().slice(0, 60),
                    detail: note.trim(),
                    provenance: "recorded",
                  });
                  setNote("");
                  toast.success(ui(language, "journalAdded"));
                }}
                className="mt-3 rounded-full"
              >
                <Plus className="h-4 w-4" /> {ui(language, "saveEntry")}
              </Button>
            </div>
          </div>
        ) : null}

        {/* ------------------------------------------------ TIMELINE */}
        {tab === "Timeline" ? (
          <div className="rise max-w-3xl">
            <SectionTitle action={<ChronologySelect value={sortOrder} onChange={setSortOrder} />}>
              {ui(language, "everythingRecorded")}
            </SectionTitle>
            <ul className="space-y-2">
              {timeline.map((entry) => {
                if (entry.kind === "photo") {
                  const photo = entry.photo;
                  return (
                    <li
                      key={`photo-${photo.id}`}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-2xl border border-border/60 bg-card p-4"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                        <Film className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                          <p className="truncate text-sm font-medium">{ui(language, "photo")}</p>
                          <span className="numeral shrink-0 text-xs text-muted-foreground">
                            {formatDate(photo.daysAgo)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {ui(language, "photographicEvidence")} · {relativeDay(photo.daysAgo)}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">{photo.caption}</p>
                        <button
                          type="button"
                          onClick={() => photoViewer.openPhoto(photo)}
                          aria-label={`${ui(language, "viewPhotoLarger")}: ${photo.caption}`}
                          className="press mt-3 block"
                        >
                          <PhotoImage
                            photo={photo}
                            alt={photo.caption}
                            rendition="preview"
                            className="h-24 w-24 rounded-xl object-cover"
                          />
                        </button>
                        <div className="mt-2.5">
                          <ProvenanceTag kind="observed" />
                        </div>
                      </div>
                      <DeleteActionMenu
                        itemLabel="photo"
                        actionLabel={ui(language, "deletePhoto")}
                        title={ui(language, "deletePhotoQuestion")}
                        description={ui(language, "deletePhotoKeepEvent")}
                        onConfirm={() => removePhoto(photo)}
                      />
                    </li>
                  );
                }
                const e = entry.event;
                const Icon = eventIcons[e.type];
                const photo = entry.photos[0];
                return (
                  <li
                    key={e.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-2xl border border-border/60 bg-card p-4"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                        <p className="truncate text-sm font-medium">
                          {isTimelineTitleProjectionOfDetail(e.title, e.detail) ? e.detail : e.title}
                        </p>
                        <span className="numeral shrink-0 text-xs text-muted-foreground">
                          {formatDate(e.daysAgo)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {localizedEventLabel(e.type, language)} · {relativeDay(e.daysAgo)}
                      </p>
                      {e.detail && !isRedundantTimelineDetail(e.title, e.detail) && !isTimelineTitleProjectionOfDetail(e.title, e.detail) ? (
                        <p className="mt-2 text-sm text-muted-foreground">{e.detail}</p>
                      ) : null}
                      {photo ? (
                        <button
                          type="button"
                          onClick={() => photoViewer.openPhoto(photo)}
                          aria-label={`${ui(language, "viewPhotoLarger")}: ${photo.caption}`}
                          className="press mt-3 block"
                        >
                          <span className="relative block h-24 w-24">
                            <PhotoImage
                              photo={photo}
                              alt={photo.caption}
                              rendition="preview"
                              className="h-24 w-24 rounded-xl object-cover"
                            />
                            {entry.photos.length > 1 ? (
                              <span className="absolute right-1 bottom-1 rounded-full bg-ink/70 px-1.5 py-0.5 text-[0.6rem] text-white">
                                +{entry.photos.length - 1}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      ) : null}
                      <div className="mt-2.5">
                        <ProvenanceTag
                          kind={
                            e.provenance === "recorded"
                              ? "recorded"
                              : e.provenance === "observed"
                                ? "observed"
                                : "inferred"
                          }
                        />
                      </div>
                    </div>
                    <DeleteActionMenu
                      itemLabel="event"
                      actionLabel={ui(language, "deleteEvent")}
                      title={ui(language, "deleteEventQuestion")}
                      description={
                        entry.photos.length
                          ? `${ui(language, "deleteEventKeepPhotos")} ${entry.photos.length} ${ui(language, "photoEvidence").toLowerCase()}.`
                          : ui(language, "deleteEventNoPhotos")
                      }
                      onConfirm={() => removeEvent(e, entry.photos.length)}
                    />
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
                <div className="flex items-center gap-2">
                  <ChronologySelect value={sortOrder} onChange={setSortOrder} />
                  <Link
                    to="/plants/$plantId/film"
                    params={{ plantId: plant.id }}
                    className="text-primary hover:underline"
                  >
                    {ui(language, "makeFilm")}
                  </Link>
                </div>
              }
            >
              {ui(language, "photographicEvidence")}
            </SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {orderedPhotos.map((photo) => (
                <figure
                  key={photo.id}
                  className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft"
                >
                  <button
                    type="button"
                    onClick={() => photoViewer.openPhoto(photo)}
                    aria-label={`${ui(language, "viewPhotoLarger")}: ${photo.caption}`}
                    className="block w-full"
                  >
                    <PhotoImage
                      photo={photo}
                      alt={photo.caption}
                      rendition="preview"
                      className="aspect-square w-full object-cover"
                    />
                  </button>
                  <figcaption className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="eyebrow">{formatDate(photo.daysAgo)}</p>
                        <p className="mt-1 text-sm leading-snug">{photo.caption}</p>
                      </div>
                      <DeleteActionMenu
                        itemLabel="photo"
                        actionLabel={ui(language, "deletePhoto")}
                        title={ui(language, "deletePhotoQuestion")}
                        description={
                          photo.backendEventId
                            ? ui(language, "deletePhotoKeepEvent")
                            : ui(language, "deletePhotoStorage")
                        }
                        onConfirm={() => removePhoto(photo)}
                      />
                    </div>
                    {photoMetricEntries(photo.metrics).length ? (
                      <p className="numeral mt-2 text-xs text-muted-foreground">
                        {photoMetricEntries(photo.metrics)
                          .map(({ kind, value }) => {
                            if (kind === "height") return `${value}cm`;
                            if (kind === "leaves") return `${ui(language, "leavesApprox")} ${value}`;
                            return `${ui(language, "canopyDensity")} ${value}`;
                          })
                          .join(" · ")}
                      </p>
                    ) : null}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="mt-5 max-w-xl text-xs text-muted-foreground">
              {ui(language, "recordedMomentsAndEvidence")}
            </p>
          </div>
        ) : null}

        {/* ------------------------------------------------ CARE */}
        {tab === "Care" ? (
          <div className="rise max-w-3xl">
            <SectionTitle
              action={
                <Link to="/care" className="text-primary hover:underline">
                  {ui(language, "guidedSession")}
                </Link>
              }
            >
              {ui(language, "openActions")}
            </SectionTitle>
            <ul className="surface divide-y divide-border/70 overflow-hidden">
              {tasks.length ? (
                tasks.map((task) => {
                  const Icon = maintenanceIcons[task.type];
                  return (
                    <li
                      key={task.id}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm">{task.label}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {localizedMaintenanceLabel(task.type, language)} · {dueLabel(task.dueInDays)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          store.completeTask(task.id);
                          toast.success(`${task.label} ${ui(language, "logged")}`);
                        }}
                        className="press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                      >
                        <Check className="h-3.5 w-3.5" /> {ui(language, "done")}
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {ui(language, "nothingOpenFor")} {plant.name}.
                </li>
              )}
            </ul>

            <div className="mt-8">
              <SectionTitle
                action={
                  <button onClick={() => openRecord()} className="text-primary hover:underline">
                    {ui(language, "allWaysToRecord")}
                  </button>
                }
              >
                {ui(language, "logSomethingNow")}
              </SectionTitle>
              <p className="mb-3 text-xs text-muted-foreground">
                {ui(language, "shortcutsChosenFor")} {plant.name} {ui(language, "eachOpensRecording")}
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
                      <Icon className="h-4 w-4 text-primary" /> {localizedMaintenanceLabel(type, language)}
                    </button>
                  );
                })}
              </div>
            </div>

            {doneTasks.length ? (
              <div className="mt-8">
                <SectionTitle>{ui(language, "completedSession")}</SectionTitle>
                <ul className="space-y-2">
                  {doneTasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
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
                <div className="flex items-center gap-3">
                  {libraryEntry ? (
                    <a
                      href={`/gardenpedia#${encodeURIComponent(libraryEntry.libraryPlantId)}`}
                      className="text-primary hover:underline"
                    >
                      {ui(language, "fullCatalog")}
                    </a>
                  ) : null}
                </div>
              }
            >
              {ui(language, "reference")}
            </SectionTitle>
            {!plant.libraryPlantId ? (
              <LibraryIdentityResolution
                plant={plant}
                catalog={libraryCatalog}
                catalogError={libraryCatalogError}
                onConfirm={async (entry) => {
                  await store.confirmPlantLibraryIdentity(plant.id, entry.libraryPlantId);
                  toast.success(ui(language, "identityConfirmed"));
                }}
              />
            ) : null}
            {plant.libraryPlantId && !libraryCatalog && !libraryCatalogError ? (
              <p className="rounded-3xl border border-border/70 bg-card p-5 text-sm text-muted-foreground">
                {ui(language, "loadingReference")}
              </p>
            ) : null}
            {plant.libraryPlantId && libraryCatalogError ? (
              <p className="rounded-3xl border border-border/70 bg-card p-5 text-sm text-destructive">
                {libraryCatalogError}
              </p>
            ) : null}
            {plant.libraryPlantId && libraryEntry ? (
              <>
                <dl className="grid gap-px overflow-hidden rounded-3xl border border-border/70 bg-border/60 sm:grid-cols-2">
                  {referenceFields.map(([label, value]) => (
                    <div key={label} className="bg-card px-4 py-3.5">
                      <dt className="eyebrow">{label}</dt>
                      <dd className={cn("mt-1 text-sm", !value && "text-muted-foreground")}>
                        {value || ui(language, "notDocumented")}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {guidanceCards.map(([label, values]) => (
                    <div key={label} className="rounded-3xl border border-border/70 bg-card p-5">
                      <p className="eyebrow">{label}</p>
                      {values.length ? (
                        <ul className="mt-2.5 space-y-1.5 text-sm text-muted-foreground">
                          {values.slice(0, 6).map((value) => (
                            <li key={value}>· {value}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2.5 text-sm text-muted-foreground">
                          {ui(language, "noGuidance")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-5 grid gap-px overflow-hidden rounded-3xl border border-border/70 bg-border/60 sm:grid-cols-2">
                  {neighborCards.map(([label, ids]) => {
                    const names = ids.map(
                      (id) =>
                        libraryCatalog!.entries.find((entry) => entry.libraryPlantId === id)
                          ? localizedLibraryName(
                              libraryCatalog!.entries.find((entry) => entry.libraryPlantId === id)!,
                              language,
                            )
                          : id,
                    );
                    return (
                      <div key={label} className="bg-card p-5">
                        <p className="eyebrow">{label}</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {names.length ? names.join(" · ") : ui(language, "noRelationships")}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {libraryEntry.reference.sources.length ? (
                  <div className="mt-5 rounded-3xl border border-border/70 bg-card p-5">
                    <p className="eyebrow">{ui(language, "sources")}</p>
                    <ul className="mt-2.5 space-y-1.5 text-sm text-muted-foreground">
                      {libraryEntry.reference.sources.slice(0, 6).map((source) => (
                        <li key={source.id}>
                          <a
                            className="hover:text-foreground hover:underline"
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {source.title}
                          </a>
                          <span> · {source.publisher}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <StatusDot status={plant.status} />
              <span className="text-xs text-muted-foreground">
                {ui(language, "identity")} {plant.libraryPlantId ? ui(language, "identityConfirmedByYou") : ui(language, "identityStatusNotConfirmed")} · {ui(language, "canonicalDataConfirmation")}
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
      <HistoryShareDialog
        plant={plant}
        photos={photos}
        events={events}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
      {photoViewer.viewer}
    </div>
  );
}
