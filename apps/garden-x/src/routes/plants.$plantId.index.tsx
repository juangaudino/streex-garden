import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ChevronLeft,
  Film,
  ScanLine,
  GitCompareArrows,
  MessageCircle,
  Move,
  Plus,
  Check,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { useGarden } from "@/lib/garden-store";
import {
  chronological,
  dueLabel,
  localizedEventLabel,
  formatDate,
  localizedMaintenanceLabel,
  openTasks,
  plantEvents,
  plantPhotos,
  relativeDay,
  isRedundantTimelineDetail,
  isTimelineTitleProjectionOfDetail,
  normalizeTimelineNote,
  latestPlantPhoto,
  photoPassageLabel,
  plantTimeline,
  sortPhotosByCapturedAt,
  photoMetricEntries,
  type SortOrder,
} from "@/lib/garden-logic";
import type { MaintenanceType } from "@/lib/garden-data";
import {
  ProvenanceTag,
  SectionTitle,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ChronologySelect } from "@/components/garden/chronology-select";
import { DeleteActionMenu } from "@/components/garden/delete-action-menu";
import { LibraryIdentityResolution } from "@/components/garden/library-identity-resolution";
import { loadGardenLibraryCatalog, localizedLibraryName, type GardenLibraryManifest } from "@/lib/garden-library";
import { localizeKnownError, ui, type UiCopyKey } from "@/lib/ui-copy";
import { plantIdentityParts } from "@/lib/plant-identity";
import { askGardenAccentClassName } from "@/lib/care-session";
import { useJournalEntry } from "@/components/garden/journal-entry-context";
import { buildPlantLifeHighlights } from "@/lib/plant-life-highlights";
import { PlantOriginEditor } from "@/components/garden/plant-origin-editor";
import { PlantStoryIntelligence } from "@/components/garden/plant-story-intelligence";
import { buildPlantStoryContext } from "@/lib/plant-story-context";
import { requestMeaningfulChange } from "@/lib/garden-backend";
import {
  buildPlantChangeReading,
  selectMeaningfulChangeCandidate,
  type MeaningfulChangeResult,
} from "@/lib/meaningful-changes";

export const Route = createFileRoute("/plants/$plantId/")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: ["Story", "Journal", "Timeline", "Photos", "Reference"].includes(String(search["tab"]))
      ? String(search["tab"]) as "Story" | "Journal" | "Timeline" | "Photos" | "Reference"
      : undefined,
    focusPhotoId: typeof search["focusPhotoId"] === "string" ? search["focusPhotoId"] : undefined,
    focusEventId: typeof search["focusEventId"] === "string" ? search["focusEventId"] : undefined,
  }),
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

const tabs = ["Story", "Journal", "Timeline", "Photos", "Reference"] as const;
type Tab = (typeof tabs)[number];

function timelineEventText(event: { title: string; detail?: string }) {
  return normalizeTimelineNote(
    isTimelineTitleProjectionOfDetail(event.title, event.detail) ? event.detail : event.title,
  );
}

function timelineEventNeedsExpansion(text: string) {
  return text.length > 120;
}

function PlantProfile() {
  const { plantId } = Route.useParams();
  const { tab: requestedTab, focusPhotoId, focusEventId } = Route.useSearch();
  const store = useGarden();
  const openJournalEntry = useJournalEntry();
  const plant = store.plants.find((p) => p.id === plantId) ?? store.historicalPlants?.find((p) => p.id === plantId);
  if (!plant) throw notFound();

  const [tab, setTab] = useState<Tab>(requestedTab ?? "Journal");
  const [note, setNote] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordFlow, setRecordFlow] = useState<MomentFlow | undefined>(undefined);
  const [recordCare, setRecordCare] = useState<MaintenanceType | undefined>(undefined);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [expandedTimelineEvents, setExpandedTimelineEvents] = useState<Set<string>>(() => new Set());
  const [libraryCatalog, setLibraryCatalog] = useState<GardenLibraryManifest | null>(null);
  const [libraryCatalogError, setLibraryCatalogError] = useState<string | undefined>(undefined);
  const [changeAnalyzing, setChangeAnalyzing] = useState(false);
  const [requestedChange, setRequestedChange] = useState<MeaningfulChangeResult | null>(null);
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
    if (!flow && !care) {
      openJournalEntry({ plantId: plant.id });
      return;
    }
    setRecordFlow(flow);
    setRecordCare(care);
    setRecordOpen(true);
  };

  const toggleTimelineEvent = (eventId: string) => {
    setExpandedTimelineEvents((current) => {
      const next = new Set(current);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
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

  useEffect(() => {
    if (requestedTab) setTab(requestedTab);
    if (focusEventId) setExpandedTimelineEvents((current) => new Set(current).add(focusEventId));
  }, [focusEventId, requestedTab]);

  useEffect(() => {
    if (requestedTab !== "Timeline" || !focusEventId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`event-evidence-${focusEventId}`)?.scrollIntoView({ block: "center" });
    });
  }, [focusEventId, requestedTab]);

  useEffect(() => {
    if (requestedTab !== "Photos" || !focusPhotoId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`photo-evidence-${focusPhotoId}`)?.scrollIntoView({ block: "center" });
    });
  }, [focusPhotoId, requestedTab]);
  const lifeHighlights = useMemo(
    () => buildPlantLifeHighlights(plant, events),
    [plant, events],
  );
  const storyContext = useMemo(
    () => buildPlantStoryContext(plant, garden, events, photos, libraryEntry, language),
    [plant, garden, events, photos, libraryEntry, language],
  );
  const changeCandidate = useMemo(
    () => selectMeaningfulChangeCandidate(plant, photos, events, []),
    [plant, photos, events],
  );
  const changeReading = useMemo(
    () => (changeCandidate ? buildPlantChangeReading(changeCandidate) : null),
    [changeCandidate],
  );
  const storedChange = useMemo(
    () =>
      changeCandidate
        ? store.meaningfulChanges.find(
            (result) =>
              result.plantInstanceId === changeCandidate.plantInstanceId &&
              result.growCycleId === changeCandidate.growCycleId &&
              result.beforePhotoId === changeCandidate.beforePhotoId &&
              result.afterPhotoId === changeCandidate.afterPhotoId &&
              (!result.language || result.language === language),
          ) ?? null
        : null,
    [changeCandidate, language, store.meaningfulChanges],
  );
  const changeResult = requestedChange ?? storedChange;

  useEffect(() => {
    setRequestedChange(null);
    setChangeAnalyzing(false);
  }, [plant.id]);

  const analyzeChange = async () => {
    if (!changeCandidate || !changeReading?.visualEvidenceAvailable || changeAnalyzing) return;
    setChangeAnalyzing(true);
    try {
      const { proposal } = await requestMeaningfulChange(
        changeCandidate.growCycleId,
        changeCandidate.beforePhotoId,
        changeCandidate.afterPhotoId,
        language,
      );
      setRequestedChange(proposal);
    } catch (error) {
      toast.error(localizeKnownError(error, language, ui(language, "storyChangeFailed")));
    } finally {
      setChangeAnalyzing(false);
    }
  };

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
            <PlantOriginEditor origin={plant.originType} plantId={plant.id} />
            {plant.plantedDatePrecision === "unknown" ? null : (
              <>
                <span aria-hidden="true">·</span>
                <span>{ui(language, "dayLabel")} {plant.plantedDaysAgo}</span>
              </>
            )}
            {plant.slot ? (
              <>
                <span>·</span>
                <button
                  type="button"
                  className="press inline-flex items-center underline decoration-white/40 underline-offset-4 hover:text-white"
                  onClick={() => setLocationMenuOpen(true)}
                  aria-label={`${ui(language, "location")}: ${plant.slot}`}
                >
                  {plant.slot}
                </button>
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
      <div className="mt-5 grid grid-cols-3 gap-1 px-5 sm:gap-3 sm:px-8 lg:px-12">
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

      {lifeHighlights.length ? (
        <section className="mx-5 mt-6 sm:mx-8 lg:mx-12" aria-labelledby="life-highlights-title">
          <h2 id="life-highlights-title" className="eyebrow mb-3">{ui(language, "lifeHighlights")}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {lifeHighlights.map((highlight) => (
              <div key={highlight.kind} className="rounded-2xl border border-border/70 bg-card px-4 py-3.5">
                <p className="eyebrow">{ui(language, highlight.kind)}</p>
                <p className="numeral mt-1 text-sm">
                  {highlight.count !== undefined
                    ? highlight.count
                    : formatDate(highlight.daysAgo ?? 0, language)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
              {t === "Story"
                ? ui(language, "storyTab")
                : t === "Journal"
                  ? ui(language, "journal")
                  : t === "Timeline"
                    ? ui(language, "timeline")
                    : t === "Photos"
                      ? ui(language, "photos")
                      : ui(language, "reference")}
              {tab === t ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-8 sm:px-8 lg:px-12">
        {/* ------------------------------------------------ STORY */}
        {tab === "Story" ? (
          <PlantStoryIntelligence
            context={storyContext}
            language={language}
            changeReading={changeReading}
            changeResult={changeResult}
            changeAnalyzing={changeAnalyzing}
            onAnalyzeChange={() => void analyzeChange()}
          />
        ) : null}

        {/* ------------------------------------------------ HISTORY */}
        {tab === "Journal" ? (
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
                      {photoPassageLabel(first.daysAgo - latest.daysAgo, language)}
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
                          {(() => {
                            const text = timelineEventText(e);
                            const expanded = expandedTimelineEvents.has(e.id);
                            const expandable = timelineEventNeedsExpansion(text);
                            return (
                              <>
                          <h3
                            className={cn(
                              e.milestone ? "font-display text-2xl" : "text-sm font-medium",
                              !expanded && expandable && "truncate",
                            )}
                          >
                            {text}
                          </h3>
                          {expandable ? (
                            <button
                              type="button"
                              aria-expanded={expanded}
                              onClick={() => toggleTimelineEvent(e.id)}
                              className="mt-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {ui(language, expanded ? "showLess" : "more")}
                            </button>
                          ) : null}
                              </>
                            );
                          })()}
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
                        {plant.cycleClosed
                          ? ui(language, "cycleStoryRemains")
                          : ui(language, "storyStillOpen").replace(
                              "{relativeDay}",
                              relativeDay(e.daysAgo).toLowerCase(),
                            )}
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
                    id={`event-evidence-${e.id}`}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 rounded-2xl border border-border/60 bg-card p-4"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      {(() => {
                        const text = timelineEventText(e);
                        const expanded = expandedTimelineEvents.has(e.id);
                        const expandable = timelineEventNeedsExpansion(text);
                        return (
                          <div className="min-w-0">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                        <p className={cn("text-sm font-medium", !expanded && expandable && "truncate")}>
                          {text}
                        </p>
                        <span className="numeral shrink-0 text-xs text-muted-foreground">
                          {formatDate(e.daysAgo)}
                        </span>
                      </div>
                      {expandable ? (
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => toggleTimelineEvent(e.id)}
                          className="mt-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {ui(language, expanded ? "showLess" : "more")}
                        </button>
                      ) : null}
                          </div>
                        );
                      })()}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {e.type === "maintenance" ? ui(language, "recordedActivity") : localizedEventLabel(e.type, language)} · {relativeDay(e.daysAgo)}
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
                  id={`photo-evidence-${photo.id}`}
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
              <span className="text-xs text-muted-foreground">
                {ui(language, "identity")} {plant.libraryPlantId ? ui(language, "identityConfirmedByYou") : ui(language, "identityStatusNotConfirmed")} · {ui(language, "canonicalDataConfirmation")}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={locationMenuOpen} onOpenChange={setLocationMenuOpen}>
        <DialogContent className="rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{ui(language, "location")}</DialogTitle>
            <DialogDescription>
              {garden.name} · {plant.slot || ui(language, "positionNotFound")}
            </DialogDescription>
          </DialogHeader>
          <Button
            type="button"
            className="w-full rounded-full"
            onClick={() => {
              setLocationMenuOpen(false);
              openRecord("move");
            }}
          >
            <Move className="h-4 w-4" /> {ui(language, "moveRelocate")}
          </Button>
        </DialogContent>
      </Dialog>

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
