import { useState } from "react";
import type { Plant } from "@/lib/garden-data";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, Cpu, Film, LayoutGrid, List, Plus } from "lucide-react";
import { useGarden } from "@/lib/garden-store";
import {
  ageLabel,
  dueLabel,
  gardenCoverPhoto,
  openTasks,
  plantsAtPosition,
} from "@/lib/garden-logic";
import { PlantCard, SectionTitle, StatusDot } from "@/components/garden/atoms";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddPlantSheet } from "@/components/garden/add-plant";
import { PhotoImage } from "@/components/garden/photo-image";
import { activeGridCells, allGridCells } from "@/lib/custom-system";
import { ui } from "@/lib/ui-copy";
import { selectStaleSummary } from "@/lib/garden-summaries";
import { GardenSummaryCard } from "@/components/garden/garden-summary";
import { RecordMomentSheet } from "@/components/garden/record-moment";

export const Route = createFileRoute("/gardens/$gardenId/")({
  validateSearch: (search: Record<string, unknown>) => ({
    view: search["view"] === "map" ? ("map" as const) : ("overview" as const),
  }),
  head: () => ({
    meta: [
      { title: "Garden detail — Garden X" },
      {
        name: "description",
        content:
          "Plants, pod positions and open care for one garden, with its conditions and history.",
      },
      { property: "og:title", content: "Garden detail — Garden X" },
      {
        property: "og:description",
        content: "Plants, pod positions and open care for one garden.",
      },
    ],
  }),
  component: GardenDetail,
});

function GardenDetail() {
  const { gardenId } = Route.useParams();
  const { view } = Route.useSearch();
  const store = useGarden();
  const language = store.language;
  const [adding, setAdding] = useState<{ slot?: string; positionId?: string | undefined } | null>(
    null,
  );
  const [selectedPositionKey, setSelectedPositionKey] = useState<string | null>(null);
  const [recordingPlant, setRecordingPlant] = useState<Plant | null>(null);
  const garden = store.gardens.find((g) => g.id === gardenId);
  if (!garden) throw notFound();

  const plants = store.plants.filter((p) => p.gardenId === garden.id);
  const photoById = (id?: string) => store.photos.find((p) => p.id === id);
  const tasks = openTasks(store.tasks.filter((t) => plants.some((p) => p.id === t.plantId)));
  const gardenSummary = selectStaleSummary(store.gardenSummaries, "garden", garden.id, language);
  const pods = garden.backendPositions?.length
    ? [...garden.backendPositions]
        .filter((position) => position.active !== false)
        .sort(
          (a, b) =>
            (a.levelNumber ?? 1) - (b.levelNumber ?? 1) ||
            (a.rowNumber ?? a.gridY ?? 0) - (b.rowNumber ?? b.gridY ?? 0) ||
            (a.columnNumber ?? a.gridX ?? 0) - (b.columnNumber ?? b.gridX ?? 0) ||
            a.number - b.number,
        )
        .map((position) => {
          const label = `Pod ${position.number}`;
          const positionPlants = plantsAtPosition(plants, position.id);
          return {
            label,
            position,
            plant: positionPlants[0],
            plants: positionPlants,
          };
        })
    : garden.machine
      ? Array.from({ length: garden.machine.pods }, (_, i) => {
          const label = `Pod ${i + 1}`;
          return {
            label,
            position: {
              number: i + 1,
              levelNumber: 1,
              rowNumber: i + 1,
              columnNumber: 1,
              gridY: i + 1,
              gridX: 1,
            },
            plant: plants.find((p) => p.slot === label),
            plants: plants.filter((p) => p.slot === label),
          };
        })
      : null;
  const occupiedPods = pods?.filter(({ plant }) => plant).length ?? 0;
  const podLevels = pods
    ? Array.from(new Set(pods.map(({ position }) => position.levelNumber ?? 1))).sort(
        (a, b) => a - b,
      )
    : [];
  const layoutLevels = garden.systemLayoutLevels?.length
    ? garden.systemLayoutLevels
    : podLevels.map((levelNumber) => ({
        levelNumber,
        rows: Math.max(
          ...(pods
            ?.filter(({ position }) => (position.levelNumber ?? 1) === levelNumber)
            .map(({ position }) => position.rowNumber ?? position.gridY ?? 1) ?? [1]),
        ),
        columns: Math.max(
          ...(pods
            ?.filter(({ position }) => (position.levelNumber ?? 1) === levelNumber)
            .map(({ position }) => position.columnNumber ?? position.gridX ?? 1) ?? [1]),
        ),
        activeCells:
          pods
            ?.filter(({ position }) => (position.levelNumber ?? 1) === levelNumber)
            .map(({ position }) => ({
              row: position.rowNumber ?? position.gridY ?? 1,
              column: position.columnNumber ?? position.gridX ?? 1,
            })) ?? [],
      }));
  const positionKey = (label: string, position: { id?: string }) =>
    position.id ?? `${garden.id}:${label}`;
  const selectedPod =
    pods?.find(({ label, position }) => positionKey(label, position) === selectedPositionKey) ??
    null;
  const selectedPlants = selectedPod?.plants ?? [];

  return (
    <div className="rise pb-16">
      <div className="relative">
        <div className="relative aspect-[4/3] sm:aspect-[21/9]">
          {gardenCoverPhoto(garden, store.plants, store.photos) ? (
            <PhotoImage
              photo={gardenCoverPhoto(garden, store.plants, store.photos)!}
              alt={garden.name}
              width={1280}
              height={960}
              fetchPriority="high"
              rendition="display"
              className="h-full w-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="h-full w-full bg-secondary" />
          )}
          <div className="veil absolute inset-0" />
        </div>
        <Link
          to="/gardens"
          className="absolute top-5 left-5 inline-flex items-center gap-1 rounded-full bg-black/35 px-3 py-1.5 text-xs text-white backdrop-blur-md"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> {ui(language, "gardensTitle")}
        </Link>
        <nav
          aria-label={ui(language, "overview")}
          className="absolute top-5 right-5 flex rounded-lg border border-border/50 bg-card/90 p-1 shadow-soft backdrop-blur-md"
        >
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn("h-7 px-2.5", view === "overview" && "bg-background shadow-soft")}
          >
            <Link
              to="/gardens/$gardenId"
              params={{ gardenId }}
              search={{ view: "overview" }}
              resetScroll={false}
              aria-current={view === "overview" ? "page" : undefined}
            >
              <List className="h-3.5 w-3.5" /> {ui(language, "overview")}
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn("h-7 px-2.5", view === "map" && "bg-background shadow-soft")}
          >
            <Link
              to="/gardens/$gardenId"
              params={{ gardenId }}
              search={{ view: "map" }}
              resetScroll={false}
              aria-current={view === "map" ? "page" : undefined}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> {ui(language, "map")}
            </Link>
          </Button>
        </nav>
        <div className="absolute inset-x-0 bottom-0 px-5 pb-6 sm:px-8 lg:px-12">
          <p className="text-[0.65rem] tracking-[0.16em] text-white/70 uppercase">
            {garden.kind} garden
          </p>
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
              <Film className="h-3.5 w-3.5" /> {ui(language, "gardenGrowthFilm")}
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
                  {occupiedPods} / {garden.machine.pods} {ui(language, "occupied")}
                </span>
              ) : null
            }
          >
            {ui(language, "systemMap")}
          </SectionTitle>
          {pods && garden.machine ? (
            <div className="surface overflow-hidden">
              <div className="flex items-center justify-between gap-4 border-b border-border/70 px-4 py-3.5 sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{garden.machine.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ui(language, "physicalPodArrangement")}
                  </p>
                </div>
                <Cpu className="h-4 w-4 shrink-0 text-primary" />
              </div>
              <div className="grid gap-6 bg-secondary/35 p-4 sm:p-8 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-7">
                  <p className="eyebrow mb-3">{ui(language, "systemBlueprint")}</p>
                  <div className="space-y-6">
                    {layoutLevels.map((level) => {
                      const levelNumber = level.levelNumber;
                      const levelPods = pods.filter(
                        ({ position }) => (position.levelNumber ?? 1) === levelNumber,
                      );
                      const podByCoordinate = new Map(
                        levelPods.map((pod) => [
                          `${pod.position.rowNumber ?? pod.position.gridY ?? 1}:${pod.position.columnNumber ?? pod.position.gridX ?? 1}`,
                          pod,
                        ]),
                      );
                      const activeCells = activeGridCells(level);
                      return (
                        <div key={levelNumber}>
                          {podLevels.length > 1 ? (
                            <p className="eyebrow mb-3">
                              {ui(language, "level")} {levelNumber}
                            </p>
                          ) : null}
                          <div
                            className={cn(
                              "mx-auto grid max-w-3xl gap-2.5 sm:gap-4",
                              mapColumns(level.columns),
                            )}
                          >
                            {allGridCells(level).map((cell) => {
                              const cellKey = `${cell.row}:${cell.column}`;
                              const isActive = activeCells.some(
                                (active) =>
                                  active.row === cell.row && active.column === cell.column,
                              );
                              if (!isActive) {
                                return (
                                  <span
                                    key={cellKey}
                                    aria-hidden="true"
                                    className="aspect-square"
                                  />
                                );
                              }
                              const pod = podByCoordinate.get(cellKey);
                              if (!pod)
                                return (
                                  <span
                                    key={cellKey}
                                    aria-hidden="true"
                                    className="aspect-square"
                                  />
                                );
                              const { label, plant, plants: positionPlants, position } = pod;
                              const key = positionKey(label, position);
                              const selected = selectedPositionKey === key;
                              const shared = positionPlants.length > 1;
                              return (
                                <button
                                  key={cellKey}
                                  type="button"
                                  aria-pressed={selected}
                                  aria-label={`${label}: ${positionPlants.length ? positionPlants.map((item) => item.name).join(", ") : ui(language, "emptyPosition")}`}
                                  onClick={() => setSelectedPositionKey(key)}
                                  className={cn(
                                    "press group grid min-w-0 place-items-center rounded-xl border border-transparent bg-transparent p-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:p-2",
                                    selected ? "bg-primary/5" : "hover:border-primary/35",
                                  )}
                                >
                                  <span className="relative grid w-full max-w-14 place-items-center sm:max-w-[4.375rem]">
                                    <span
                                      className={cn(
                                        "relative grid aspect-square w-full place-items-center overflow-hidden rounded-full border-2 shadow-soft transition-[box-shadow,border-color] sm:border-4",
                                        plant
                                          ? "border-background bg-secondary"
                                          : "border-dashed border-border bg-background/60 text-muted-foreground",
                                        selected &&
                                          "ring-2 ring-primary/60 ring-offset-2 ring-offset-secondary/40",
                                      )}
                                    >
                                      {plant && photoById(plant.heroPhotoId) ? (
                                        <PhotoImage
                                          photo={photoById(plant.heroPhotoId)!}
                                          alt=""
                                          rendition="preview"
                                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                      ) : plant ? (
                                        <span className="text-xs text-muted-foreground">
                                          P{position.number}
                                        </span>
                                      ) : (
                                        <Plus className="h-4 w-4" />
                                      )}
                                    </span>
                                    <span className="absolute -top-1 -left-1 z-10 rounded-full border border-background bg-card px-1.5 py-0.5 text-[0.55rem] leading-none font-medium text-muted-foreground shadow-sm sm:text-[0.6rem]">
                                      P{position.number}
                                    </span>
                                  </span>
                                  {plant ? (
                                    <span className="mt-1.5 line-clamp-2 min-h-[1.8rem] max-w-full overflow-hidden text-[0.62rem] leading-[0.9rem] font-medium text-foreground sm:mt-2 sm:text-xs sm:leading-4">
                                      {plant.name}
                                    </span>
                                  ) : (
                                    <span className="mt-1 max-w-full truncate text-[0.55rem] leading-3 text-muted-foreground sm:text-[0.6rem]">
                                      {ui(language, "emptyPosition")}
                                    </span>
                                  )}
                                  {shared ? (
                                    <span className="mt-1 max-w-full text-[0.58rem] leading-3 font-medium text-amber-700 dark:text-amber-300">
                                      {ui(language, "sharedPositionWarning").replace(
                                        "{count}",
                                        String(positionPlants.length),
                                      )}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <aside
                  className="min-w-0 rounded-2xl border border-border/70 bg-card p-4 shadow-soft sm:p-5 lg:col-span-5"
                  aria-live="polite"
                >
                  <p className="eyebrow">{ui(language, "positionInspector")}</p>
                  {!selectedPod ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      {ui(language, "selectPosition")}
                    </p>
                  ) : (
                    <>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <h3 className="font-display text-xl">{selectedPod.label}</h3>
                        {selectedPlants.length > 1 ? (
                          <span className="text-right text-xs font-medium text-amber-700 dark:text-amber-300">
                            {ui(language, "plantsInPosition").replace(
                              "{count}",
                              String(selectedPlants.length),
                            )}
                          </span>
                        ) : null}
                      </div>
                      {selectedPlants.length === 0 ? (
                        <div className="mt-5 rounded-xl border border-dashed border-border p-4">
                          <p className="text-sm font-medium">{ui(language, "emptyPosition")}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {ui(language, "emptyAddPlant")}
                          </p>
                          <Button
                            className="mt-4"
                            size="sm"
                            onClick={() =>
                              setAdding({
                                slot: selectedPod.label,
                                positionId:
                                  "id" in selectedPod.position
                                    ? selectedPod.position.id
                                    : undefined,
                              })
                            }
                          >
                            <Plus /> {ui(language, "addPlant")}
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-5 space-y-4">
                          {selectedPlants.map((selectedPlant) => (
                            <div
                              key={selectedPlant.id}
                              className="rounded-xl border border-border/70 p-3"
                            >
                              <div className="flex items-start gap-3">
                                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                                  {photoById(selectedPlant.heroPhotoId) ? (
                                    <PhotoImage
                                      photo={photoById(selectedPlant.heroPhotoId)!}
                                      alt={selectedPlant.name}
                                      rendition="preview"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : null}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{selectedPlant.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {selectedPlant.variety || selectedPlant.species}
                                  </p>
                                  <p className="truncate text-xs italic text-muted-foreground">
                                    {selectedPlant.scientific}
                                  </p>
                                  <StatusDot status={selectedPlant.status} className="mt-1" />
                                </div>
                              </div>
                              <p className="mt-3 text-xs text-muted-foreground">
                                {ageLabel(selectedPlant.plantedDaysAgo, language)}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button asChild size="sm" variant="outline">
                                  <Link
                                    to="/plants/$plantId"
                                    params={{ plantId: selectedPlant.id }}
                                  >
                                    {ui(language, "viewPlant")}
                                  </Link>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setRecordingPlant(selectedPlant)}
                                >
                                  {ui(language, "recordMoment")}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </aside>
              </div>
            </div>
          ) : (
            <div className="surface grid min-h-64 place-items-center px-6 text-center">
              <div className="max-w-sm">
                <LayoutGrid className="mx-auto h-5 w-5 text-muted-foreground" />
                <h2 className="mt-3 font-display text-xl">{ui(language, "noSystemLayout")}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {ui(language, "noSystemLayoutBody")}
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
                {ui(language, "podPositions")}
              </SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {pods.map(({ label, plants: positionPlants, position }) => {
                  if (!positionPlants.length) {
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          setAdding({
                            slot: label,
                            positionId: "id" in position ? position.id : undefined,
                          })
                        }
                        aria-label={`${label}: ${ui(language, "emptyAddPlant")}`}
                        className="press grid aspect-[3/4] place-items-center rounded-2xl border border-dashed border-border bg-secondary/40 text-center transition-colors hover:border-primary/50"
                      >
                        <div className="text-muted-foreground">
                          <Plus className="mx-auto h-4 w-4" />
                          <p className="mt-1.5 text-xs">{label}</p>
                          <p className="text-[0.65rem]">{ui(language, "emptyAddPlant")}</p>
                        </div>
                      </button>
                    );
                  }
                  return (
                    <div
                      key={label}
                      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft"
                    >
                      <p className="eyebrow px-3 pt-3">{label}</p>
                      {positionPlants.map((positionPlant) => (
                        <Link
                          key={positionPlant.id}
                          to="/plants/$plantId"
                          params={{ plantId: positionPlant.id }}
                          className="press block border-t border-border/50 first:border-t-0"
                        >
                          <div className="aspect-square overflow-hidden bg-secondary">
                            {photoById(positionPlant.heroPhotoId) ? (
                              <PhotoImage
                                photo={photoById(positionPlant.heroPhotoId)!}
                                alt={positionPlant.name}
                                rendition="preview"
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="p-3">
                            <p className="truncate text-sm font-medium">{positionPlant.name}</p>
                            <p className="numeral truncate text-xs text-muted-foreground">
                              {ageLabel(positionPlant.plantedDaysAgo)}
                            </p>
                          </div>
                        </Link>
                      ))}
                      {positionPlants.length > 1 ? (
                        <p className="px-3 pb-3 text-[0.65rem] font-medium text-amber-700 dark:text-amber-300">
                          {ui(language, "sharedPositionWarning").replace(
                            "{count}",
                            String(positionPlants.length),
                          )}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="mt-12 px-5 sm:px-8 lg:px-12">
            <SectionTitle>{ui(language, "plantsSection")}</SectionTitle>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {plants.map((plant) => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  photo={photoById(plant.heroPhotoId)}
                  meta={ageLabel(plant.plantedDaysAgo)}
                />
              ))}
              {pods?.find((pod) => !pod.plant && "id" in pod.position) ? (
                <button
                  type="button"
                  onClick={() => {
                    const empty = pods.find((pod) => !pod.plant && "id" in pod.position);
                    if (empty && "id" in empty.position)
                      setAdding({ slot: empty.label, positionId: empty.position.id });
                  }}
                  className="press grid aspect-[3/4] place-items-center rounded-2xl border border-dashed border-border bg-secondary/40 text-center transition-colors hover:border-primary/50"
                >
                  <span className="text-muted-foreground">
                    <Plus className="mx-auto h-4 w-4" />
                    <span className="mt-1.5 block text-xs">{ui(language, "addPlant")}</span>
                  </span>
                </button>
              ) : null}
            </div>
          </section>

          {gardenSummary ? (
            <section className="mt-8 px-5 sm:px-8 lg:px-12">
              <GardenSummaryCard summary={gardenSummary} language={language} />
            </section>
          ) : null}

          <section className="mt-12 px-5 sm:px-8 lg:px-12">
            <SectionTitle
              action={
                <Link to="/care" className="text-primary hover:underline">
                  {ui(language, "careSession")}
                </Link>
              }
            >
              {ui(language, "openCareGarden")}
            </SectionTitle>
            <ul className="surface divide-y divide-border/70 overflow-hidden">
              {tasks.length ? (
                tasks.map((task) => {
                  const plant = plants.find((p) => p.id === task.plantId);
                  if (!plant) return null;
                  return (
                    <li
                      key={task.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{task.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{plant.name}</p>
                      </div>
                      <span
                        className={`numeral shrink-0 text-xs ${task.dueInDays < 0 ? "text-clay" : "text-muted-foreground"}`}
                      >
                        {dueLabel(task.dueInDays)}
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {ui(language, "nothingOpenHere")}
                </li>
              )}
            </ul>
          </section>
        </>
      )}

      {recordingPlant ? (
        <RecordMomentSheet
          plant={recordingPlant}
          open={Boolean(recordingPlant)}
          onClose={() => setRecordingPlant(null)}
        />
      ) : null}

      <AddPlantSheet
        gardenId={garden.id}
        positionId={adding?.positionId}
        slot={adding?.slot}
        open={Boolean(adding)}
        onClose={() => setAdding(null)}
      />
    </div>
  );
}

function mapColumns(positionCount: number) {
  const columns = Math.max(1, Math.min(8, positionCount));
  if (columns === 1) return "grid-cols-1";
  if (columns === 2) return "grid-cols-2";
  if (columns === 3) return "grid-cols-3";
  if (columns === 4) return "grid-cols-4";
  if (columns === 5) return "grid-cols-5";
  if (columns === 6) return "grid-cols-6";
  if (columns === 7) return "grid-cols-7";
  return "grid-cols-8";
}
