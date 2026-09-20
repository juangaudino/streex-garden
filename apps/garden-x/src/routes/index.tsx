import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera, Film, Sparkles, ChevronRight, UserRound } from "lucide-react";
import { useGarden } from "@/lib/garden-store";
import {
  ageLabel,
  byRecency,
  dueLabel,
  eventLabels,
  formatDate,
  openTasks,
  plantPhotos,
  relativeDay,
  comparePhotos,
} from "@/lib/garden-logic";
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
    return <HomeStatus language={store.language} message={isSpanish ? "Cargando tu jardín…" : "Loading your garden…"} />;
  }
  if (store.hydration === "reconnecting" || store.hydration === "offline") {
    return <HomeStatus language={store.language} message={isSpanish ? "Reconectando con tu jardín…" : "Reconnecting to your garden…"} />;
  }
  if (store.hydration === "error") {
    return <HomeStatus language={store.language} message={isSpanish ? "No pudimos cargar tu jardín." : "We couldn't load your garden."} error />;
  }

  const hero = store.highlightedPlantId
    ? store.plants.find((plant) => plant.id === store.highlightedPlantId)
    : undefined;
  if (!hero) return <HomeEmpty isSpanish={isSpanish} />;

  const photoById = (id?: string) => store.photos.find((p) => p.id === id);
  const plantById = (id: string) => store.plants.find((p) => p.id === id)!;
  const due = openTasks(store.tasks).filter((t) => t.dueInDays <= 1);
  const recent = byRecency(store.events).slice(0, 7);
  const newPhotos = byRecency(store.photos).slice(0, 6);

  // Deterministic "meaningful change": plants with >= 2 photos, largest recent delta.
  const changes = store.plants
    .map((plant) => {
      const pics = plantPhotos(store.photos, plant.id);
      if (pics.length < 2) return null;
      const a = pics[pics.length - 2]!;
      const b = pics[pics.length - 1]!;
      return { plant, a, b, cmp: comparePhotos(a, b, plant) };
    })
    .filter(Boolean)
    .slice(0, 3) as Array<{
    plant: ReturnType<typeof plantById>;
    a: NonNullable<ReturnType<typeof photoById>>;
    b: NonNullable<ReturnType<typeof photoById>>;
    cmp: ReturnType<typeof comparePhotos>;
  }>;

  const heroPhoto = photoById(hero.heroPhotoId);
  const heroPics = plantPhotos(store.photos, hero.id);
  const greeting = new Date().getHours() < 12
    ? isSpanish ? "Buenos días" : "Good morning"
    : new Date().getHours() < 18
      ? isSpanish ? "Buenas tardes" : "Good afternoon"
      : isSpanish ? "Buenas noches" : "Good evening";

  return (
    <div className="rise">
      <div className="relative">
        <PageHeader
          eyebrow={new Date().toLocaleDateString(isSpanish ? "es-ES" : "en-US", { weekday: "long", month: "long", day: "numeric" })}
          title={`${greeting}, ${store.profile.signedIn ? store.profile.name : isSpanish ? "jardinero" : "gardener"}`}
          subtitle={isSpanish
            ? `${store.plants.length} plantas en ${store.gardens.length} jardines. ${due.length} cosas necesitan tus manos hoy.`
            : `${store.plants.length} plants across ${store.gardens.length} gardens. ${due.length} things want your hands today.`}
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
                Highlighted today · {ageLabel(hero.plantedDaysAgo)}
              </p>
              <h2 className="mt-2 font-display text-3xl text-white sm:text-5xl">{hero.name}</h2>
              <p className="mt-1.5 max-w-md text-sm text-white/80">
                {hero.species} “{hero.variety}” · {hero.statusNote}
              </p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm text-white ring-1 ring-white/25 backdrop-blur-md">
                Open the story <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </Link>
        {heroPics.length >= 2 ? (
          <p className="mt-3 px-1 text-xs text-muted-foreground">
            {heroPics.length} photos on file — the first from {formatDate(heroPics[0]!.daysAgo)}.
          </p>
        ) : null}
      </section>

      {/* Needs attention */}
      <section className="mt-12 px-5 sm:px-8 lg:px-12">
        <SectionTitle
          action={
            <Link to="/care" className="inline-flex items-center gap-1 text-primary hover:underline">
              All care <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          Wants attention
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
            <span className="block text-sm font-medium">Start a maintenance session</span>
            <span className="block text-xs text-primary-foreground/70">
              Plant by plant, {openTasks(store.tasks).length} open actions
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      </section>

      {/* Meaningful changes */}
      <section className="mt-12 px-5 sm:px-8 lg:px-12">
        <SectionTitle>Meaningful changes</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-3">
          {changes.map(({ plant, a, b, cmp }) => (
            <Link
              key={plant.id}
              to="/plants/$plantId/compare"
              params={{ plantId: plant.id }}
              search={{ from: undefined }}
              className="press rounded-3xl border border-border/70 bg-card p-4 shadow-soft"
            >
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl">
                  <PhotoImage photo={a} alt="" rendition="preview" className="aspect-square w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded-full bg-black/45 px-2 py-0.5 text-[0.6rem] text-white backdrop-blur">
                    {formatDate(a.daysAgo)}
                  </span>
                </div>
                <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl">
                  <PhotoImage photo={b} alt="" rendition="preview" className="aspect-square w-full object-cover" />
                  <span className="absolute bottom-1 left-1 rounded-full bg-black/45 px-2 py-0.5 text-[0.6rem] text-white backdrop-blur">
                    {formatDate(b.daysAgo)}
                  </span>
                </div>
              </div>
              <p className="mt-3 font-display text-lg">{plant.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{cmp.observations[0]}</p>
              <div className="mt-3">
                <ProvenanceTag kind="observed" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Small intelligent summary */}
      <section className="mt-12 px-5 sm:px-8 lg:px-12">
        <div className="rounded-3xl border border-inference/25 bg-inference/6 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-inference" />
            <span className="eyebrow">Garden summary</span>
          </div>
          <p className="mt-3 max-w-2xl text-[0.975rem] leading-relaxed">
            Two of six plants have a recorded issue in the last three weeks. Ember's colour index dropped
            10 points between its two photos, while every other plant held or improved. The pattern points to
            a nutrient issue on Ember alone rather than a garden-wide cause.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ProvenanceTag kind="inferred" confidence="moderate" />
            <span className="text-xs text-muted-foreground">Built from 6 photos and 12 recorded events.</span>
          </div>
        </div>
      </section>

      {/* Recent activity + new photos */}
      <section className="mt-12 grid gap-10 px-5 pb-16 sm:px-8 lg:grid-cols-2 lg:px-12">
        <div>
          <SectionTitle>Recent activity</SectionTitle>
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
                        {plant.name} · {eventLabels[e.type]}
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
            New photos
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
          <div className="mt-4 flex flex-wrap gap-2">
            {store.plants.map((p) => (
              <Link
                key={p.id}
                to="/plants/$plantId"
                params={{ plantId: p.id }}
                className="press inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs"
              >
                {p.name} <StatusDot status={p.status} />
              </Link>
            ))}
          </div>
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
            <span className="block truncate text-foreground">{store.profile.signedIn ? store.profile.name : "Your Garden X"}</span>
            <span className="block text-xs">Profile &amp; settings</span>
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

function HomeEmpty({ isSpanish }: { isSpanish: boolean }) {
  return (
    <main className="rise pb-16">
      <PageHeader
        eyebrow={isSpanish ? "Tu jardín" : "Your garden"}
        title={isSpanish ? "Todavía no hay plantas" : "No plants yet"}
        subtitle={isSpanish ? "Crea tu primer jardín para empezar a guardar su historia." : "Create your first garden to begin keeping its story."}
      />
      <section className="px-5 sm:px-8 lg:px-12">
        <div className="surface grid min-h-64 place-items-center p-8 text-center">
          <div className="max-w-md">
            <p className="font-display text-2xl">{isSpanish ? "Empieza desde cero" : "Start from a clear beginning"}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {isSpanish ? "Tus plantas reales aparecerán aquí después de crear un jardín." : "Your real plants will appear here after you create a garden."}
            </p>
            <Link to="/gardens" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
              {isSpanish ? "Crear jardín" : "Create garden"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
