import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera, Film, ChevronRight, UserRound } from "lucide-react";
import { useGarden } from "@/lib/garden-store";
import {
  ageLabel,
  byRecency,
  dueLabel,
  localizedEventLabel,
  formatDate,
  openTasks,
  plantPhotos,
  recentPlantPhotos,
  plantsRepresentedInPhotos,
  relativeDay,
} from "@/lib/garden-logic";
import { rankMeaningfulChanges, type MeaningfulChangeResult } from "@/lib/meaningful-changes";
import { PageHeader } from "@/components/garden/shell";
import {
  ProvenanceTag,
  SectionTitle,
  StatusDot,
  PlantThumb,
  eventIcons,
  maintenanceIcons,
} from "@/components/garden/atoms";
import { PhotoImage } from "@/components/garden/photo-image";
import { ui } from "@/lib/ui-copy";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today in your garden — Garden X" },
      {
        name: "description",
        content:
          "A calm overview of your gardens: what needs attention, what changed, and the newest photos in every plant's history.",
      },
      { property: "og:title", content: "Today in your garden — Garden X" },
      {
        property: "og:description",
        content: "What needs attention, what changed, and the newest photos in every plant's history.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const store = useGarden();
  const isSpanish = store.language === "es";
  if (store.hydration === "loading") {
    return <HomeStatus language={store.language} message={ui(store.language, "loadingGarden")} />;
  }
  if (store.hydration === "error") {
    return <HomeStatus language={store.language} message={ui(store.language, "gardenLoadFailed")} error />;
  }

  const hero = store.highlightedPlantId
    ? store.plants.find((plant) => plant.id === store.highlightedPlantId)
    : undefined;
  if (!hero) return <HomeEmpty language={store.language} />;

  const photoById = (id?: string) => store.photos.find((p) => p.id === id);
  const plantById = (id: string) => store.plants.find((p) => p.id === id)!;
  const due = openTasks(store.tasks).filter((t) => t.dueInDays <= 1);
  const recent = byRecency(store.events).slice(0, 7);
  const newPhotos = byRecency(recentPlantPhotos(store.photos, store.plants)).slice(0, 6);

  const changes = rankMeaningfulChanges(store.meaningfulChanges, store.plants)
    .map((result) => ({
      result,
      plant: plantById(result.plantInstanceId),
      before: photoById(result.beforePhotoId),
      after: photoById(result.afterPhotoId),
    }))
    .filter((item): item is { result: MeaningfulChangeResult; plant: NonNullable<ReturnType<typeof plantById>>; before: NonNullable<ReturnType<typeof photoById>>; after: NonNullable<ReturnType<typeof photoById>> } => Boolean(item.plant && item.before && item.after))
    .slice(0, 3);

  const heroPhoto = photoById(hero.heroPhotoId);
  const heroPics = plantPhotos(store.photos, hero.id);
  const photoStripPlants = plantsRepresentedInPhotos(newPhotos, store.plants);
  const greeting = new Date().getHours() < 12
    ? ui(store.language, "goodMorning")
    : new Date().getHours() < 18
      ? ui(store.language, "goodAfternoon")
      : ui(store.language, "goodEvening");

  return (
    <div className="rise">
      <div className="relative">
        <PageHeader
          eyebrow={new Date().toLocaleDateString(isSpanish ? "es-ES" : "en-US", { weekday: "long", month: "long", day: "numeric" })}
          title={`${greeting}, ${store.profile.signedIn ? store.profile.name : ui(store.language, "gardener")}`}
          subtitle={isSpanish
            ? `${store.plants.length} ${ui(store.language, "plants").toLowerCase()} ${ui(store.language, "plantsAcrossGardens")} ${store.gardens.length} ${ui(store.language, "gardensTitle").toLowerCase()}. ${due.length} ${ui(store.language, "thingsNeedHands")}`
            : `${store.plants.length} ${ui(store.language, "plants").toLowerCase()} ${ui(store.language, "plantsAcrossGardens")} ${store.gardens.length} ${ui(store.language, "gardensTitle").toLowerCase()}. ${due.length} ${ui(store.language, "thingsNeedHands")}`}
        />
      </div>

      {/* Highlighted plant */}
      <section className="px-5 sm:px-8 lg:px-12">
        <Link
          to="/plants/$plantId"
          params={{ plantId: hero.id }}
          className="press group relative block overflow-hidden rounded-[1.75rem] shadow-lift"
        >
          <div className="relative aspect-[4/5] sm:aspect-[16/9]">
            {heroPhoto ? (
              <PhotoImage
                photo={heroPhoto}
                alt={`${hero.name}, ${hero.species}`}
                width={1024}
                height={1280}
                loading="eager"
                fetchPriority="high"
                rendition="display"
                className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-[1.03]"
              />
            ) : null}
            <div className="veil absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
              <p className="text-[0.65rem] tracking-[0.16em] text-white/70 uppercase">
                {ui(store.language, "highlightedToday")} · {ageLabel(hero.plantedDaysAgo)}
              </p>
              <h2 className="mt-2 font-display text-3xl text-white sm:text-5xl">{hero.name}</h2>
              <p className="mt-1.5 max-w-md text-sm text-white/80">
                {hero.species} “{hero.variety}” · {hero.statusNote}
              </p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm text-white ring-1 ring-white/25 backdrop-blur-md">
                {ui(store.language, "openStory")} <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </Link>
        {heroPics.length >= 2 ? (
          <p className="mt-3 px-1 text-xs text-muted-foreground">
            {heroPics.length} {ui(store.language, "photosOnFile")} — {ui(store.language, "firstFrom")} {formatDate(heroPics[0]!.daysAgo)}.
          </p>
        ) : null}
      </section>

      {/* Needs attention */}
      <section className="mt-12 px-5 sm:px-8 lg:px-12">
        <SectionTitle
          action={
            <Link to="/care" className="inline-flex items-center gap-1 text-primary hover:underline">
              {ui(store.language, "allCare")} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {ui(store.language, "wantsAttention")}
        </SectionTitle>
        <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 xl:grid-cols-3">
          {due.map((task) => {
            const plant = plantById(task.plantId);
            const Icon = maintenanceIcons[task.type];
            return (
              <Link
                key={task.id}
                to="/plants/$plantId"
                params={{ plantId: plant.id }}
                className="press w-[80vw] shrink-0 snap-start rounded-3xl border border-border/70 bg-card p-4 shadow-soft sm:w-auto"
              >
                <div className="flex items-start gap-3">
                  <PlantThumb plant={plant} photo={photoById(plant.heroPhotoId)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <p className="truncate font-medium">{plant.name}</p>
                      <span
                        className={`shrink-0 numeral text-xs ${task.dueInDays < 0 ? "text-clay" : "text-muted-foreground"}`}
                      >
                        {dueLabel(task.dueInDays)}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{task.label}</span>
                    </p>
                    {task.hint ? (
                      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground/80">{task.hint}</p>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <Link
          to="/care"
          className="press mt-3 flex items-center justify-between rounded-3xl bg-primary px-5 py-4 text-primary-foreground shadow-soft"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium">{ui(store.language, "startMaintenance")}</span>
            <span className="block text-xs text-primary-foreground/70">
              {ui(store.language, "plantByPlant")}, {openTasks(store.tasks).length} {ui(store.language, "openActions")}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      </section>

      {/* Meaningful changes */}
      {changes.length ? <section className="mt-12 px-5 sm:px-8 lg:px-12">
        <SectionTitle>{ui(store.language, "meaningfulChanges")}</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-3">
          {changes.map(({ plant, before, after, result }) => (
            <Link
              key={plant.id}
              to="/plants/$plantId/compare"
              params={{ plantId: plant.id }}
              search={{ from: undefined }}
              className="press rounded-3xl border border-border/70 bg-card p-4 shadow-soft"
            >
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl">
                  <PhotoImage photo={before} alt="" rendition="preview" className="aspect-square w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded-full bg-black/45 px-2 py-0.5 text-[0.6rem] text-white backdrop-blur">
                    {formatDate(before.daysAgo)}
                  </span>
                </div>
                <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl">
                  <PhotoImage photo={after} alt="" rendition="preview" className="aspect-square w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded-full bg-black/45 px-2 py-0.5 text-[0.6rem] text-white backdrop-blur">
                    {formatDate(after.daysAgo)}
                  </span>
                </div>
              </div>
              <p className="mt-3 font-display text-lg">{plant.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.primaryVisualObservation || (result.comparisonStatus === "limited_comparability"
                  ? ui(store.language, "limitedComparability")
                  : result.comparisonStatus === "no_meaningful_change"
                    ? ui(store.language, "noMeaningfulChange")
                    : ui(store.language, "comparisonUnavailable"))}
              </p>
              {result.relevantContextFacts[0] ? (
                <p className="mt-2 text-xs text-muted-foreground/80">{result.relevantContextFacts[0]}</p>
              ) : null}
              <div className="mt-3">
                <ProvenanceTag kind="observed" />
              </div>
            </Link>
          ))}
        </div>
      </section> : null}

      {/* Recent activity + new photos */}
      <section className="mt-12 grid gap-10 px-5 pb-16 sm:px-8 lg:grid-cols-2 lg:px-12">
        <div>
          <SectionTitle>{ui(store.language, "recentActivity")}</SectionTitle>
          <ul className="space-y-1">
            {recent.map((e) => {
              const Icon = eventIcons[e.type];
              const plant = plantById(e.plantId);
              return (
                <li key={e.id}>
                  <Link
                    to="/plants/$plantId"
                    params={{ plantId: plant.id }}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-accent/40"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{e.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {plant.name} · {localizedEventLabel(e.type, store.language)}
                      </span>
                    </span>
                    <span className="numeral shrink-0 text-xs text-muted-foreground">
                      {relativeDay(e.daysAgo)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <SectionTitle
            action={
              <Link to="/plants/$plantId/film" params={{ plantId: hero.id }} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Film className="h-3.5 w-3.5" /> Growth film
              </Link>
            }
          >
            {ui(store.language, "newPhotos")}
          </SectionTitle>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
            {newPhotos.map((photo) => (
              <Link
                key={photo.id}
                to="/plants/$plantId"
                params={{ plantId: photo.plantId }}
                className="press group relative overflow-hidden rounded-2xl"
              >
                <PhotoImage photo={photo} alt={photo.caption} rendition="preview" className="aspect-square w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 text-[0.6rem] text-white">
                  <Camera className="h-3 w-3" /> {relativeDay(photo.daysAgo)}
                </span>
              </Link>
            ))}
          </div>
          {photoStripPlants.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {photoStripPlants.map((plant) => (
                <Link
                  key={plant.id}
                  to="/plants/$plantId"
                  params={{ plantId: plant.id }}
                  className="press inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs"
                >
                  <span className="min-w-0 break-words">{plant.name}</span>
                  <StatusDot status={plant.status} className="shrink-0" />
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="px-5 pb-8 sm:px-8 lg:hidden">
        <Link
          to="/settings"
          className="flex items-center gap-3 border-t border-border/70 pt-5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground">
            <UserRound className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-foreground">{store.profile.signedIn ? store.profile.name : ui(store.language, "yourGardenX")}</span>
            <span className="block text-xs">{ui(store.language, "profileSettings")}</span>
          </span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function HomeStatus({ message, error = false, language }: { message: string; error?: boolean; language: "en" | "es" }) {
  return (
    <main className="grid min-h-[70vh] place-items-center bg-background px-5 text-center">
      <div className="surface max-w-md p-8">
        <div className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${error ? "bg-clay/12 text-clay" : "bg-secondary text-primary"}`}>
          {error ? "!" : <span className="breathe font-display text-xl">✦</span>}
        </div>
        <p className="mt-5 font-display text-2xl">{message}</p>
          {error ? <p className="mt-2 text-sm text-muted-foreground">{ui(language, "retryReconnect")}</p> : null}
      </div>
    </main>
  );
}

function HomeEmpty({ language }: { language: "en" | "es" }) {
  const isSpanish = language === "es";
  return (
    <main className="rise pb-16">
      <PageHeader
        eyebrow={ui(language, "yourGarden")}
        title={ui(language, "noPlantsYet")}
        subtitle={ui(language, "createFirstGarden")}
      />
      <section className="px-5 sm:px-8 lg:px-12">
        <div className="surface grid min-h-64 place-items-center p-8 text-center">
          <div className="max-w-md">
            <p className="font-display text-2xl">{ui(language, "startFromBeginning")}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {ui(language, "realPlantsAppear")}
            </p>
            <Link to="/gardens" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
              {ui(language, "createGarden")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
