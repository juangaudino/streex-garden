import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronDown, ChevronUp, Cpu, Eye, EyeOff, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useGarden } from "@/lib/garden-store";
import { PageHeader } from "@/components/garden/shell";
import { StatusDot } from "@/components/garden/atoms";
import { NewGarden } from "@/components/garden/new-garden";
import { EditGarden } from "@/components/garden/edit-garden";
import { gardenCoverPhoto } from "@/lib/garden-logic";
import { PhotoImage } from "@/components/garden/photo-image";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { RouteLoading } from "@/components/garden/route-loading";

export const Route = createFileRoute("/gardens/")({
  head: () => ({
    meta: [
      { title: "Your gardens — Garden X" },
      {
        name: "description",
        content:
          "Indoor hydroponics, balcony pots and backyard beds — every garden keeps its own plants, pods and history.",
      },
      { property: "og:title", content: "Your gardens — Garden X" },
      {
        property: "og:description",
        content: "Indoor hydroponics, balcony pots and backyard beds, each with its own living history.",
      },
    ],
  }),
  component: Gardens,
});

function Gardens() {
  const store = useGarden();
  if (store.hydration === "loading") return <RouteLoading label={store.language === "es" ? "Cargando tus jardines…" : "Loading your gardens…"} />;
  if (store.hydration === "reconnecting" || store.hydration === "offline") return <RouteLoading label={store.language === "es" ? "Reconectando con tus jardines…" : "Reconnecting to your gardens…"} />;
  const [editing, setEditing] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);

  const visible = editing ? store.gardens : store.gardens.filter((garden) => !garden.archived);
  const order = store.gardens.map((garden) => garden.id);
  const archiveTarget = store.gardens.find((garden) => garden.id === archiveId);

  const move = (id: string, direction: -1 | 1) => {
    const from = order.indexOf(id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]!);
    store.reorderGardens(next);
  };

  const dropOn = (id: string) => {
    if (!dragId || dragId === id) return;
    const next = order.filter((item) => item !== dragId);
    next.splice(order.indexOf(id), 0, dragId);
    store.reorderGardens(next);
    setDragId(null);
  };

  return (
    <div className="rise pb-16">
      <PageHeader
        eyebrow="Places"
        title="Gardens"
        subtitle="Each garden holds its own conditions, its own rhythm, and its own plants — pots, beds, or pod positions."
      />

      <div className="grid gap-5 px-5 sm:px-8 lg:grid-cols-2 lg:px-12">
        {visible.map((garden, index) => {
          const plants = store.plants.filter((p) => p.gardenId === garden.id);
          const attention = plants.filter((p) => p.status === "watching" || p.status === "recovering").length;
          const body = (
            <>
              <div className="relative aspect-[16/10] overflow-hidden">
                {gardenCoverPhoto(garden, store.plants, store.photos) ? <PhotoImage
                  photo={gardenCoverPhoto(garden, store.plants, store.photos)!}
                  alt={garden.name}
                  width={1280}
                  height={960}
                  rendition="preview"
                  className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-[1.04]"
                /> : <div className="h-full w-full bg-secondary" />}
                <div className="veil absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 p-5">
                  <div className="min-w-0">
                    <p className="text-[0.65rem] tracking-[0.16em] text-white/70 uppercase">{garden.kind}</p>
                    <h2 className="mt-1 truncate font-display text-2xl text-white">{garden.name}</h2>
                    <p className="truncate text-xs text-white/75">{garden.place}</p>
                  </div>
                  {editing ? (
                    <GripVertical className="h-5 w-5 shrink-0 text-white/80" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-white/80" />
                  )}
                </div>
              </div>
              <div className="space-y-3 p-5">
                <p className="text-sm leading-relaxed text-muted-foreground">{garden.note}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <span className="numeral">{plants.length} plants</span>
                  {garden.machine ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" /> {garden.machine.name} · {garden.machine.pods} pods
                    </span>
                  ) : null}
                  {attention ? <span className="text-clay">{attention} to watch</span> : <span>All steady</span>}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {plants.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-2 rounded-full bg-secondary px-2.5 py-1 text-xs"
                    >
                      {p.name} <StatusDot status={p.status} />
                    </span>
                  ))}
                </div>
              </div>
            </>
          );

          if (editing) {
            return (
              <div
                key={garden.id}
                draggable
                onDragStart={() => setDragId(garden.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropOn(garden.id)}
                className="group relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-soft"
              >
                <div className={cn(garden.archived && "opacity-60 grayscale")}>{body}</div>
                <div className="absolute left-4 top-4 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={garden.archived ? `Restore ${garden.name}` : `Archive ${garden.name}`}
                    onClick={() => {
                      if (garden.archived) {
                        void store.setGardenArchived(garden.id, false)
                          .then(() => toast.success(`${garden.name} restored`))
                          .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Garden could not be restored."));
                      } else {
                        setArchiveId(garden.id);
                      }
                    }}
                    className="rounded-full bg-card/20 text-white ring-1 ring-card/30 backdrop-blur-md hover:bg-card/30 hover:text-white"
                  >
                    {garden.archived ? <EyeOff /> : <Eye />}
                  </Button>
                  {garden.archived ? (
                    <span className="rounded-full bg-card/20 px-2.5 py-1 text-[0.625rem] font-medium tracking-wide text-white uppercase ring-1 ring-card/30 backdrop-blur-md">
                      Archived
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border/70 px-5 py-3">
                  <EditGarden
                    garden={garden}
                    plants={plants}
                    photos={store.photos}
                    className="bg-transparent text-foreground hover:bg-secondary hover:text-foreground ring-0"
                  />
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${garden.name} earlier`}
                      disabled={index === 0}
                      onClick={() => move(garden.id, -1)}
                      className="rounded-full"
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Move ${garden.name} later`}
                      disabled={index === visible.length - 1}
                      onClick={() => move(garden.id, 1)}
                      className="rounded-full"
                    >
                      <ChevronDown />
                    </Button>
                  </div>
                </div>
              </div>
            );
          }


          return (
            <Link
              key={garden.id}
              to="/gardens/$gardenId"
              params={{ gardenId: garden.id }}
              search={{ view: "overview" }}
              className="press group overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-soft hover:shadow-lift"
            >
              {body}
            </Link>
          );
        })}
      </div>

      <div className="mt-12 px-5 sm:px-8 lg:px-12">
        <div className="flex items-center gap-3 border-t border-border/70 pt-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full"
            aria-pressed={editing}
            onClick={() => setEditing((current) => !current)}
          >
            {editing ? "Done" : "Edit"}
          </Button>
          <NewGarden />
        </div>
      </div>

      <AlertDialog open={Boolean(archiveId)} onOpenChange={(open) => !open && setArchiveId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-medium">
              Archive {archiveTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Its plants, photographs, events, history and Growth Films are all kept. The garden stays visible here in
              Edit mode and can be restored at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Keep active</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full"
              onClick={() => {
                if (!archiveTarget) return;
                void store.setGardenArchived(archiveTarget.id, true)
                  .then(() => {
                    toast.success(`${archiveTarget.name} archived`);
                    setArchiveId(null);
                  })
                  .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Garden could not be archived."));
              }}
            >
              Archive garden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
