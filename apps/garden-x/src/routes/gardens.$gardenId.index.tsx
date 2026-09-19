import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, Cpu, Film, LayoutGrid, List, Plus } from "lucide-react";
import { useGarden } from "@/lib/garden-store";
import { ageLabel, dueLabel, gardenCoverPhoto, openTasks } from "@/lib/garden-logic";
import { PlantCard, SectionTitle } from "@/components/garden/atoms";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddPlantSheet } from "@/components/garden/add-plant";
import { PhotoImage } from "@/components/garden/photo-image";

export const Route = createFileRoute("/gardens/$gardenId/")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: search["view"] === "map" ? ("map" as const) : ("overview" as const),
  }),
  head: () => ({
    meta: [
      { title: "Garden detail — Garden X" },
      {
        name: "description",
        content: "Plants, pod positions and open care for one garden, with its conditions and history.",
      },
      { property: "og:title", content: "Garden detail — Garden X" },
      { property: "og:description", content: "Plants, pod positions and open care for one garden." },
    ],
  }),
  component: GardenDetail,
});

function GardenDetail() {
  const { gardenId } = Route.useParams();
  const { view } = Route.useSearch();
  const store = useGarden();
  const [adding, setAdding] = useState<{ slot?: string } | null>(null);
  const garden = store.gardens.find((g) => g.id === gardenId);
  if (!garden) throw notFound();

  const plants = store.plants.filter((p) => p.gardenId === garden.id);
  const photoById = (id?: string) => store.photos.find((p) => p.id === id);
  const tasks = openTasks(store.tasks.filter((t) => plants.some((p) => p.id === t.plantId)));
  const pods = garden.backendPositions?.length
    ? [...garden.backendPositions]
        .filter((position) => position.active !== false)
        .sort((a, b) => (a.gridY ?? 0) - (b.gridY ?? 0) || (a.gridX ?? 0) - (b.gridX ?? 0) || a.number - b.number)
        .map((position) => {
          const label = `Pod ${position.number}`;
          return { label, plant: plants.find((p) => p.backendPositionId === position.id || p.slot === label) };
        })
    : garden.machine
      ? Array.from({ length: garden.machine.pods }, (_, i) => {
          const label = `Pod ${i + 1}`;
          return { label, plant: plants.find((p) => p.slot === label) };
        })
      : null;
  const occupiedPods = pods?.filter(({ plant }) => plant).length ?? 0;

  return (
    <div className="rise pb-16">
      <div className="relative">
        <div className="relative aspect-[4/3] sm:aspect-[21/9]">
          {gardenCoverPhoto(garden, store.plants, store.photos) ? <PhotoImage
            photo={gardenCoverPhoto(garden, store.plants, store.photos)!}
            alt={garden.name}
            width={1280}
            height={960}
            className="h-full w-full object-cover"
            loading="eager"
          /> : <div className="h-full w-full bg-secondary" />}
          <div className="veil absolute inset-0" />
        </div>
        <Link
          to="/gardens"
          className="absolute top-5 left-5 inline-flex items-center gap-1 rounded-full bg-black/35 px-3 py-1.5 text-xs text-white backdrop-blur-md"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Gardens
        </Link>
        <nav
          aria-label="Garden view"
          className="absolute top-5 right-5 flex rounded-lg border border-border/50 bg-card/90 p-1 shadow-soft backdrop-blur-md"
        >
          <Button asChild variant="ghost" size="sm" className={cn("h-7 px-2.5", view === "overview" && "bg-background shadow-soft")}>
            <Link
              to="/gardens/$gardenId"
              params={{ gardenId }}
              search={{ view: "overview" }}
              resetScroll={false}
              aria-current={view === "overview" ? "page" : undefined}
            >
              <List className="h-3.5 w-3.5" /> Overview
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className={cn("h-7 px-2.5", view === "map" && "bg-background shadow-soft")}>
            <Link
              to="/gardens/$gardenId"
              params={{ gardenId }}
              search={{ view: "map" }}
              resetScroll={false}
              aria-current={view === "map" ? "page" : undefined}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Map
            </Link>
          </Button>
        </nav>
        <div className="absolute inset-x-0 bottom-0 px-5 pb-6 sm:px-8 lg:px-12">
          <p className="text-[0.65rem] tracking-[0.16em] text-white/70 uppercase">{garden.kind} garden</p>
          <h1 className="mt-1.5 font-display text-3xl text-white sm:text-5xl">{garden.name}</h1>
          <p className="mt-1 max-w-lg text-sm text-white/80">
            {garden.place} · {garden.note}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/gardens/$gardenId/film"
              params={{ gardenId: garden.id }}
              search={{ view: "overview" }}
              className="inline-flex items-center gap-2 rounded-full bg-card/15 px-3.5 py-2 text-xs text-primary-foreground ring-1 ring-card/25 backdrop-blur-md"
            >
              <Film className="h-3.5 w-3.5" /> Garden Growth Film
            </Link>
          </div>
        </div>
      </div>

      {view === "map" ? (
        <section className="mt-10 px-5 sm:px-8 lg:px-12">
          <SectionTitle
            action={
              garden.machine ? (
                <span className="numeral text-xs text-muted-foreground">
                  {occupiedPods} of {garden.machine.pods} occupied
                </span>
              ) : null
            }
          >
            System map
          </SectionTitle>
          {pods && garden.machine ? (
            <div className="surface overflow-hidden">
              <div className="flex items-center justify-between gap-4 border-b border-border/70 px-4 py-3.5 sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{garden.machine.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Physical pod arrangement · front view</p>
                </div>
                <Cpu className="h-4 w-4 shrink-0 text-primary" />
              </div>
              <div className="bg-secondary/35 p-4 sm:p-8">
                <div className={cn("mx-auto grid max-w-3xl gap-2.5 sm:gap-4", mapColumns(pods.length))}>
                  {pods.map(({ label, plant }) =>
                    plant ? (
                      <Link
                        key={label}
                        to="/plants/$plantId"
                        params={{ plantId: plant.id }}
                        aria-label={`${label}: ${plant.name}, ${plant.species}`}
                        className="press group grid min-w-0 place-items-center rounded-lg border border-border bg-card p-2.5 text-center shadow-soft transition-colors hover:border-primary/40 sm:p-4"
                      >
                        <span className="eyebrow mb-2 block">{label}</span>
                        <span className="block aspect-square w-full max-w-24 overflow-hidden rounded-full border-4 border-background shadow-soft">
                          {photoById(plant.heroPhotoId) ? <PhotoImage
                            photo={photoById(plant.heroPhotoId)!}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          /> : null}
                        </span>
                        <span className="mt-2 block min-w-0 max-w-full">
                          <span className="block truncate text-sm font-medium">{plant.name}</span>
                          <span className="block truncate text-[0.65rem] text-muted-foreground">{plant.species}</span>
                        </span>
                      </Link>
                    ) : (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setAdding({ slot: label })}
                        aria-label={`${label} is empty — add a plant here`}
                        className="press grid min-w-0 place-items-center rounded-lg border border-dashed border-border bg-background/45 p-2.5 text-center transition-colors hover:border-primary/50 sm:p-4"
                      >
                        <span className="eyebrow mb-2 block">{label}</span>
                        <span className="grid aspect-square w-full max-w-24 place-items-center rounded-full border border-dashed border-border bg-secondary/60 text-muted-foreground">
                          <Plus className="h-4 w-4" />
                        </span>
                        <span className="mt-2 block text-xs text-muted-foreground">Empty · add plant</span>
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="surface grid min-h-64 place-items-center px-6 text-center">
              <div className="max-w-sm">
                <LayoutGrid className="mx-auto h-5 w-5 text-muted-foreground" />
                <h2 className="mt-3 font-display text-xl">No system layout</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  This garden does not have a defined physical position map yet.
                </p>
              </div>
            </div>
          )}
        </section>
      ) : (
        <>
          {pods ? (
            <section className="mt-10 px-5 sm:px-8 lg:px-12">
              <SectionTitle
                action={
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5" /> {garden.machine?.name}
                  </span>
                }
              >
                Pod positions
              </SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {pods.map(({ label, plant }) =>
                  plant ? (
                    <Link
                      key={label}
                      to="/plants/$plantId"
                      params={{ plantId: plant.id }}
                      className="press overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft"
                    >
                      <div className="aspect-square overflow-hidden bg-secondary">
                        {photoById(plant.heroPhotoId) ? <PhotoImage
                          photo={photoById(plant.heroPhotoId)!}
                          alt={plant.name}
                          className="h-full w-full object-cover"
                        /> : null}
                      </div>
                      <div className="p-3">
                        <p className="eyebrow">{label}</p>
                        <p className="mt-0.5 truncate text-sm font-medium">{plant.name}</p>
                        <p className="numeral truncate text-xs text-muted-foreground">
                          {ageLabel(plant.plantedDaysAgo)}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setAdding({ slot: label })}
                      aria-label={`${label} is empty — add a plant here`}
                      className="press grid aspect-[3/4] place-items-center rounded-2xl border border-dashed border-border bg-secondary/40 text-center transition-colors hover:border-primary/50"
                    >
                      <div className="text-muted-foreground">
                        <Plus className="mx-auto h-4 w-4" />
                        <p className="mt-1.5 text-xs">{label}</p>
                        <p className="text-[0.65rem]">Empty · add plant</p>
                      </div>
                    </button>
                  ),
                )}
              </div>
            </section>
          ) : null}

          <section className="mt-12 px-5 sm:px-8 lg:px-12">
            <SectionTitle>Plants</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {plants.map((plant) => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  photo={photoById(plant.heroPhotoId)}
                  meta={ageLabel(plant.plantedDaysAgo)}
                />
              ))}
              <button
                type="button"
                onClick={() => setAdding({})}
                className="press grid aspect-[3/4] place-items-center rounded-2xl border border-dashed border-border bg-secondary/40 text-center transition-colors hover:border-primary/50"
              >
                <span className="text-muted-foreground">
                  <Plus className="mx-auto h-4 w-4" />
                  <span className="mt-1.5 block text-xs">Add plant</span>
                </span>
              </button>
            </div>
          </section>

          <section className="mt-12 px-5 sm:px-8 lg:px-12">
            <SectionTitle
              action={
                <Link to="/care" className="text-primary hover:underline">
                  Care session
                </Link>
              }
            >
              Open care in this garden
            </SectionTitle>
            <ul className="surface divide-y divide-border/70 overflow-hidden">
              {tasks.length ? (
                tasks.map((task) => {
                  const plant = plants.find((p) => p.id === task.plantId);
                  if (!plant) return null;
                  return (
                    <li key={task.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{task.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{plant.name}</p>
                      </div>
                      <span className={`numeral shrink-0 text-xs ${task.dueInDays < 0 ? "text-clay" : "text-muted-foreground"}`}>
                        {dueLabel(task.dueInDays)}
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing open here.</li>
              )}
            </ul>
          </section>
        </>
      )}

      <AddPlantSheet
        gardenId={garden.id}
        slot={adding?.slot}
        open={Boolean(adding)}
        onClose={() => setAdding(null)}
      />
    </div>
  );
}

function mapColumns(positionCount: number) {
  const columns = positionCount <= 3 ? positionCount : Math.ceil(positionCount / 2);
  if (columns <= 2) return "grid-cols-2";
  if (columns === 3) return "grid-cols-3";
  if (columns === 4) return "grid-cols-4";
  if (columns === 5) return "grid-cols-5";
  return "grid-cols-6";
}
