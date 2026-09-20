import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Film as FilmIcon, Music2, Pause, Play, Save, Share2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useGarden } from "@/lib/garden-store";
import { musicOptions } from "@/lib/garden-data";
import { ageLabel, eventsBetween, formatDate, plantPhotos, relativeDay } from "@/lib/garden-logic";
import { ProvenanceTag, SectionTitle } from "@/components/garden/atoms";
import { PhotoImage } from "@/components/garden/photo-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui-copy";

export const Route = createFileRoute("/plants/$plantId/film")({
  head: () => ({ meta: [
    { title: "Growth Film — Garden X" },
    { name: "description", content: "Revisit a plant through its real recorded moments and create a quiet, chronological clip." },
    { property: "og:title", content: "Growth Film — Garden X" },
    { property: "og:description", content: "Living botanical cinema built from a plant's recorded history." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: GrowthFilm,
});

type Step = "moments" | "music" | "preview";

function GrowthFilm() {
  const { plantId } = Route.useParams();
  const store = useGarden();
  const language = store.language;
  const plant = store.plants.find((item) => item.id === plantId);
  if (!plant) throw notFound();
  const photos = plantPhotos(store.photos, plant.id);
  const [selected, setSelected] = useState<string[]>(photos.map((photo) => photo.id));
  const [music, setMusic] = useState(musicOptions[0]?.name ?? "No music");
  const [volume, setVolume] = useState(65);
  const [titles, setTitles] = useState(true);
  const [step, setStep] = useState<Step>("moments");
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const [saving, setSaving] = useState(false);
  const [shareFilm, setShareFilm] = useState<string | null>(null);
  const sequence = useMemo(() => photos.filter((photo) => selected.includes(photo.id)), [photos, selected]);
  const existing = store.films.filter((film) => film.plantId === plant.id);
  const current = sequence[Math.min(frame, Math.max(sequence.length - 1, 0))];
  const previous = frame > 0 ? sequence[frame - 1] : undefined;
  const context = current && previous ? eventsBetween(store.events, plant.id, previous.daysAgo, current.daysAgo).filter((event) => event.type !== "photo" && event.type !== "ai") : [];
  const localizedMusicName = (trackName: string) => trackName === "No music" ? ui(language, "noMusic") : trackName;
  const localizedMusicMood = (track: typeof musicOptions[number]) => track.id === "none" ? ui(language, "silenceJustPhotos") : track.mood;

  useEffect(() => {
    if (!playing || sequence.length < 2) return;
    const id = window.setInterval(() => setFrame((value) => value + 1 >= sequence.length ? (setPlaying(false), value) : value + 1), 2200);
    return () => window.clearInterval(id);
  }, [playing, sequence.length]);

  const beginPlayback = () => {
    if (sequence.length < 2) {
      toast.error(ui(language, "selectTwoMoments"));
      return;
    }
    if (frame >= sequence.length - 1) setFrame(0);
    setPlaying((value) => !value);
  };

  const saveFilm = () => {
    if (sequence.length < 2) {
      toast.error(ui(language, "selectTwoMoments"));
      return;
    }
    setSaving(true);
    window.setTimeout(() => {
      const title = `${plant.name} · ${ageLabel(plant.plantedDaysAgo).toLowerCase()}`;
      store.addFilm({ plantId: plant.id, title, photoIds: sequence.map((photo) => photo.id), music });
      setSaving(false);
      setShareFilm(title);
      toast.success(ui(language, "growthFilmSaved"));
    }, 900);
  };

  return <div className="rise pb-20">
    <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-5 py-6 sm:px-8 lg:px-12">
      <Link to="/plants/$plantId" params={{ plantId: plant.id }} className="grid h-9 w-9 place-items-center rounded-full border border-border/70 bg-card"><ChevronLeft className="h-4 w-4" /></Link>
      <div className="min-w-0"><p className="eyebrow">Growth Film</p><h1 className="truncate font-display text-2xl">{plant.name}</h1></div>
    </header>

    <div className="grid gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,3fr)_minmax(19rem,1fr)] lg:px-12">
      <section>
        <div className="relative overflow-hidden rounded-3xl bg-ink shadow-lift">
          <div className="relative aspect-[4/5] sm:aspect-[16/10]">
            {sequence.map((photo, index) => <PhotoImage key={photo.id} photo={photo} alt={photo.caption} className={cn("absolute inset-0 h-full w-full object-cover transition-all duration-[1400ms] ease-out", index === frame ? "scale-100 opacity-100" : "scale-105 opacity-0")} loading={index === frame ? "eager" : "lazy"} />)}
            <div className="veil pointer-events-none absolute inset-0" />
            <div className="absolute inset-x-5 top-5 flex gap-1.5">{sequence.map((photo, index) => <span key={photo.id} className={cn("h-0.5 flex-1 rounded-full", index <= frame ? "bg-primary-foreground/90" : "bg-primary-foreground/30")} />)}</div>
            {titles ? <div className="absolute inset-x-0 bottom-0 p-6 text-primary-foreground"><p className="text-xs opacity-75">{frame + 1} / {sequence.length} · {current ? `${ui(language, "dayLabel")} ${Math.max(plant.plantedDaysAgo - current.daysAgo, 0)} · ${formatDate(current.daysAgo)}` : ui(language, "noMomentsSelected")}</p><h2 className="mt-1 font-display text-3xl">{current?.caption ?? ui(language, "chooseMomentsBelow")}</h2><p className="mt-1 text-xs opacity-70">{music === "No music" ? ui(language, "silence") : `${localizedMusicName(music)} · ${ui(language, "volume").toLowerCase()} ${volume}%`}</p></div> : null}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => { setPlaying(false); setFrame((value) => Math.max(0, value - 1)); }}><ChevronLeft /></Button>
          <Button className="rounded-full" onClick={beginPlayback}>{playing ? <Pause /> : <Play />}{playing ? ui(language, "pause") : ui(language, "playHistory")}</Button>
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => { setPlaying(false); setFrame((value) => Math.min(sequence.length - 1, value + 1)); }}><ChevronRight /></Button>
          <span className="numeral ml-auto text-xs text-muted-foreground">{frame + 1} / {sequence.length}</span>
        </div>
        {current ? <div className="mt-5 border-l border-border pl-4"><p className="eyebrow">{ui(language, "recordedContext")}</p><p className="mt-1 text-sm text-muted-foreground">{context[0]?.title ?? `${ui(language, "photo")} ${relativeDay(current.daysAgo).toLowerCase()}.`}</p><div className="mt-2"><ProvenanceTag kind="recorded" /></div></div> : null}
      </section>

      <aside>
        <div className="mb-6 flex rounded-xl bg-secondary p-1">{(["moments", "music", "preview"] as Step[]).map((item, index) => <Button key={item} variant="ghost" onClick={() => setStep(item)} className={cn("h-8 flex-1 rounded-lg px-2 text-xs capitalize", step === item && "bg-card shadow-soft")}>{index + 1}. {item === "moments" ? ui(language, "filmStepMoments") : item === "music" ? ui(language, "filmStepMusic") : ui(language, "filmStepPreview")}</Button>)}</div>
        {step === "moments" ? <div><SectionTitle>{ui(language, "chooseMoments")}</SectionTitle><p className="mb-4 text-xs leading-relaxed text-muted-foreground">{ui(language, "realPhotographsOnly")}</p><div className="grid grid-cols-3 gap-2">{photos.map((photo) => { const on = selected.includes(photo.id); return <Button key={photo.id} variant="ghost" onClick={() => { setPlaying(false); setFrame(0); setSelected((value) => on ? value.filter((id) => id !== photo.id) : [...value, photo.id]); }} className={cn("relative h-auto overflow-hidden rounded-2xl border-2 p-1", on ? "border-primary" : "border-transparent opacity-55")}><PhotoImage photo={photo} alt={photo.caption} className="aspect-square w-full rounded-xl object-cover" /><span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-card/90 text-primary">{on ? <Check className="h-3 w-3" /> : null}</span><span className="absolute inset-x-1 bottom-1 rounded-b-xl bg-ink/55 py-1 text-[0.6rem] text-primary-foreground">{formatDate(photo.daysAgo)}</span></Button>; })}</div><Button className="mt-5 w-full rounded-full" onClick={() => setStep("music")}>{ui(language, "continueToMusic")}</Button></div> : null}
        {step === "music" ? <div><SectionTitle>{ui(language, "chooseAmbience")}</SectionTitle><div className="space-y-2">{musicOptions.map((track) => <Button key={track.id} variant="ghost" onClick={() => setMusic(track.name)} className={cn("h-auto w-full justify-start rounded-2xl border px-4 py-3 text-left", music === track.name ? "border-primary bg-accent/40" : "border-border/70")}><Music2 className="text-primary" /><span className="min-w-0 whitespace-normal"><span className="block text-sm">{localizedMusicName(track.name)}</span><span className="block text-xs text-muted-foreground">{localizedMusicMood(track)}</span></span><Play className="ml-auto h-3.5 w-3.5" /></Button>)}</div><label className="mt-5 block"><span className="flex items-center gap-2 text-xs text-muted-foreground"><Volume2 className="h-3.5 w-3.5" /> {ui(language, "volume")} · {volume}%</span><input type="range" min={0} max={100} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="mt-2 w-full accent-[var(--color-primary)]" /></label><Button className="mt-5 w-full rounded-full" onClick={() => setStep("preview")}>{ui(language, "continueToPreview")}</Button></div> : null}
        {step === "preview" ? <div><SectionTitle>{ui(language, "readyToRemember")}</SectionTitle><div className="surface overflow-hidden">{current ? <PhotoImage photo={current} alt="" className="aspect-video w-full object-cover" loading="eager" /> : <div className="aspect-video bg-secondary" />}<div className="p-4"><p className="font-display text-xl">{plant.name}</p><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-foreground">{ui(language, "moments")}</dt><dd>{sequence.length}</dd></div><div><dt className="text-muted-foreground">{ui(language, "duration")}</dt><dd>{ui(language, "about")} {sequence.length * 3} sec</dd></div><div><dt className="text-muted-foreground">{ui(language, "music")}</dt><dd>{localizedMusicName(music)}</dd></div><div><dt className="text-muted-foreground">{ui(language, "framing")}</dt><dd>{ui(language, "portraitCrop")}</dd></div></dl><label className="mt-4 flex items-center justify-between text-sm"><span>{ui(language, "titles")}</span><input type="checkbox" checked={titles} onChange={(event) => setTitles(event.target.checked)} className="accent-[var(--color-primary)]" /></label></div></div><Button className="mt-5 w-full rounded-full" onClick={saveFilm}><Save /> {saving ? ui(language, "savingLayout") : ui(language, "saveGrowthFilm")}</Button></div> : null}

        {existing.length ? <div className="mt-9"><SectionTitle>{ui(language, "savedFilms")}</SectionTitle><div className="space-y-2">{existing.map((film) => <div key={film.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 bg-card p-3"><FilmIcon className="h-4 w-4 text-primary" /><div className="min-w-0"><p className="truncate text-sm">{film.title}</p><p className="text-xs text-muted-foreground">{film.photoIds.length} {ui(language, "moments").toLowerCase()} · {film.music}</p></div><Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShareFilm(film.title)}><Share2 /><span className="sr-only">{ui(language, "shareFilm")} {film.title}</span></Button></div>)}</div></div> : null}
      </aside>
    </div>

    <Dialog open={Boolean(shareFilm)} onOpenChange={(open) => { if (!open) setShareFilm(null); }}><DialogContent className="overflow-hidden rounded-3xl p-0 sm:max-w-md">{sequence[sequence.length - 1] ? <PhotoImage photo={sequence[sequence.length - 1]!} alt="" className="aspect-[4/3] w-full object-cover" loading="eager" /> : <div className="aspect-[4/3] bg-secondary" />}<div className="p-6"><DialogHeader className="text-left"><DialogTitle className="font-display text-2xl font-medium">{shareFilm}</DialogTitle><DialogDescription>{ui(language, "savedFilmDescription")} · {sequence.length} {ui(language, "moments").toLowerCase()} · {localizedMusicName(music)}.</DialogDescription></DialogHeader><p className="mt-4 text-xs text-muted-foreground">{ui(language, "curatedFilmDescription")}</p><Button className="mt-5 w-full rounded-full" onClick={() => toast.success(ui(language, "sharePreviewReady"))}><Share2 /> {ui(language, "sharePreview")}</Button></div></DialogContent></Dialog>
  </div>;
}
