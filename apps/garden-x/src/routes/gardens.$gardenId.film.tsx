import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Pause, Play, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useGarden } from "@/lib/garden-store";
import { formatDate, gardenPhotos } from "@/lib/garden-logic";
import { Button } from "@/components/ui/button";
import { PhotoImage } from "@/components/garden/photo-image";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui-copy";

export const Route = createFileRoute("/gardens/$gardenId/film")({
  head: () => ({ meta: [
    { title: "Garden Growth Film — Garden X" },
    { name: "description", content: "Revisit a garden through the real recorded moments of the plants growing there." },
    { property: "og:title", content: "Garden Growth Film — Garden X" },
    { property: "og:description", content: "The visual history of a garden across its plants." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: GardenFilm,
});

function GardenFilm() {
  const { gardenId } = Route.useParams();
  const store = useGarden();
  const language = store.language;
  const garden = store.gardens.find((item) => item.id === gardenId);
  if (!garden) throw notFound();
  const plants = store.plants.filter((plant) => plant.gardenId === garden.id);
  const moments = gardenPhotos(store.photos, plants, garden.id);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = moments[Math.min(frame, Math.max(moments.length - 1, 0))];
  const plant = current ? plants.find((item) => item.id === current.plantId) : undefined;
  useEffect(() => {
    if (!playing || moments.length < 2) return;
    const id = window.setInterval(() => setFrame((value) => value + 1 >= moments.length ? (setPlaying(false), value) : value + 1), 2200);
    return () => window.clearInterval(id);
  }, [moments.length, playing]);
  return <div className="rise pb-20">
    <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-5 py-6 sm:px-8 lg:px-12">
      <Link to="/gardens/$gardenId" params={{ gardenId }} search={{ view: "overview" }} className="grid h-9 w-9 place-items-center rounded-full border border-border/70 bg-card"><ChevronLeft className="h-4 w-4" /></Link>
      <div><p className="eyebrow">{ui(language, "gardenGrowthFilm")}</p><h1 className="font-display text-2xl">{garden.name}</h1></div>
    </header>
    <div className="grid gap-6 px-5 sm:px-8 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,1fr)] lg:px-12">
      <div>
        <div className="relative overflow-hidden rounded-3xl bg-ink shadow-lift">
          <div className="relative aspect-[4/5] sm:aspect-[16/10]">
            {moments.map((moment, index) => <PhotoImage key={moment.id} photo={moment} alt={moment.caption} rendition="display" className={cn("absolute inset-0 h-full w-full object-cover transition-all duration-1000", index === frame ? "scale-100 opacity-100" : "scale-105 opacity-0")} loading={index === frame ? "eager" : "lazy"} />)}
            <div className="veil absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground"><p className="text-xs opacity-75">{frame + 1} {ui(language, "of")} {moments.length} · {current ? formatDate(current.daysAgo) : ui(language, "noMoments")}</p><h2 className="mt-1 font-display text-3xl">{plant?.name ?? garden.name}</h2><p className="mt-1 text-sm opacity-80">{current?.caption}</p></div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => setFrame((value) => Math.max(0, value - 1))}><ChevronLeft /></Button>
          <Button className="rounded-full" onClick={() => { if (frame >= moments.length - 1) setFrame(0); setPlaying((value) => !value); }}>{playing ? <Pause /> : <Play />}{playing ? ui(language, "pause") : ui(language, "gardenStory")}</Button>
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => setFrame((value) => Math.min(moments.length - 1, value + 1))}><ChevronRight /></Button>
          <Button variant="ghost" size="icon" className="ml-auto rounded-full" onClick={() => toast.success(ui(language, "gardenFilmShareReady"))}><Share2 /><span className="sr-only">{ui(language, "shareGardenFilm")}</span></Button>
        </div>
      </div>
      <aside><p className="eyebrow">{ui(language, "acrossGarden")}</p><h2 className="mt-2 font-display text-2xl">{ui(language, "manyPlantsOneSeason")}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{ui(language, "filmDescription")}</p><div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto lg:grid lg:grid-cols-2">{moments.map((moment, index) => <Button key={moment.id} variant="ghost" onClick={() => { setFrame(index); setPlaying(false); }} className={cn("h-auto min-w-24 overflow-hidden rounded-2xl border p-1", index === frame ? "border-primary" : "border-border/70 opacity-65")}><PhotoImage photo={moment} alt="" rendition="preview" className="aspect-square w-full rounded-xl object-cover" /></Button>)}</div></aside>
    </div>
  </div>;
}
