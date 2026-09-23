import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ExternalLink, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import type { Photo, Plant, PlantEvent } from "@/lib/garden-data";
import { chronological, formatDate, localizedEventLabel } from "@/lib/garden-logic";
import { ProvenanceTag } from "@/components/garden/atoms";
import { PublicStoryView } from "@/components/garden/public-story";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PhotoImage } from "@/components/garden/photo-image";
import { useGarden } from "@/lib/garden-store";
import type { PublicStory, PublicStoryMoment } from "@/lib/public-story";
import { createPublicPlantStory, suggestShareCaption } from "@/lib/garden-backend";
import { localizeKnownError, ui } from "@/lib/ui-copy";

type ShareItem =
  | { id: string; daysAgo: number; kind: "photo"; photo: Photo }
  | { id: string; daysAgo: number; kind: "event"; event: PlantEvent };

function shareableEvent(event: PlantEvent) {
  return event.milestone || ["germinated", "sprouted", "flowering", "fruiting", "harvest", "transplant"].includes(event.type);
}

export function HistoryShareDialog({ plant, photos, events, open, onOpenChange }: {
  plant: Plant;
  photos: Photo[];
  events: PlantEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { savePublicStory, language } = useGarden();
  const items = useMemo<ShareItem[]>(() => chronological([
    ...photos.map((photo) => ({ id: `photo:${photo.id}`, daysAgo: photo.daysAgo, kind: "photo" as const, photo })),
    ...events.filter(shareableEvent).map((event) => ({ id: `event:${event.id}`, daysAgo: event.daysAgo, kind: "event" as const, event })),
  ]), [events, photos]);
  const [selected, setSelected] = useState<string[]>(items.map((item) => item.id));
  const [heroPhotoId, setHeroPhotoId] = useState<string | null>(items.filter((item): item is Extract<ShareItem, { kind: "photo" }> => item.kind === "photo").at(-1)?.photo.id ?? null);
  const [captionOverrides, setCaptionOverrides] = useState<Record<string, string>>({});
  const [suggestingPhotoId, setSuggestingPhotoId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const chosen = items.filter((item) => selected.includes(item.id));
  const chosenPhotos = chosen.filter((item): item is Extract<ShareItem, { kind: "photo" }> => item.kind === "photo");
  const effectiveHeroPhotoId = chosenPhotos.some((item) => item.photo.id === heroPhotoId) ? heroPhotoId : chosenPhotos.at(-1)?.photo.id ?? null;
  const story: PublicStory = {
    id: `story-${plant.id}`,
    plant: {
      id: plant.id,
      name: plant.name,
      species: plant.species,
      scientific: plant.scientific,
      variety: plant.variety,
      plantedDaysAgo: plant.plantedDaysAgo,
    },
    moments: chosen.map((item) => item.kind === "photo" ? { ...item, photo: { ...item.photo, caption: captionOverrides[item.photo.id] ?? "" } } : item) as PublicStoryMoment[],
    heroPhotoId: effectiveHeroPhotoId,
    captionOverrides,
  };

  const openPreview = () => {
    savePublicStory(story);
    setPreview(true);
  };

  const openPublicLink = () => {
    const canonicalSelection: Array<{ event_id?: string; photo_id?: string; include_note?: boolean }> = [];
    for (const item of chosen) {
      if (item.kind === "photo" && item.photo.backendStoragePath) canonicalSelection.push({ photo_id: item.photo.id });
      if (item.kind === "event" && item.event.backendEventType) canonicalSelection.push({ event_id: item.event.id, include_note: true });
    }
    if (plant.backendGrowCycleId && canonicalSelection.length) {
      void createPublicPlantStory(plant, canonicalSelection, { heroPhotoId: effectiveHeroPhotoId, captionOverrides })
        .then((token) => {
          onOpenChange(false);
          void navigate({ to: "/shared/$storyId", params: { storyId: token } });
        })
        .catch((error: unknown) => {
          toast.error(localizeKnownError(error, language, ui(language, "createStoryFailed")));
        });
      return;
    }
    savePublicStory(story);
    onOpenChange(false);
    void navigate({ to: "/shared/$storyId", params: { storyId: story.id } });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setPreview(false); }}>
      <DialogContent className={cn("max-h-[92vh] rounded-3xl border-border/70 p-0", preview ? "sm:max-w-5xl" : "sm:max-w-2xl")}>
        {preview ? (
          <div className="relative">
            <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-6">
              <Button variant="ghost" className="rounded-full" onClick={() => setPreview(false)}><ArrowLeft /> {ui(language, "editSelection")}</Button>
              <div className="hidden text-center sm:block">
                <p className="text-sm font-medium">{ui(language, "publicStoryPreview")}</p>
                <p className="text-xs text-muted-foreground">{ui(language, "storyVisitorsSee")}</p>
              </div>
              <Button className="rounded-full" onClick={openPublicLink}><ExternalLink /> {ui(language, "shareLink")}</Button>
            </div>
            <PublicStoryView story={story} preview />
          </div>
        ) : (
          <div className="p-6">
            <DialogHeader className="pr-8 text-left">
              <DialogTitle className="font-display text-2xl font-medium">{ui(language, "chooseStoryToShare")}</DialogTitle>
              <DialogDescription>{ui(language, "storySelectionDescription")}</DialogDescription>
            </DialogHeader>
            <div className="mt-5 space-y-2">
              {items.map((item) => {
                const on = selected.includes(item.id);
                return <div key={item.id} className="space-y-2">
                  <Button variant="ghost" onClick={() => setSelected((value) => on ? value.filter((id) => id !== item.id) : [...value, item.id])} className={cn("h-auto w-full justify-start rounded-2xl border p-3 text-left", on ? "border-primary bg-accent/40" : "border-border/70")}>
                  {item.kind === "photo" ? <PhotoImage photo={item.photo} alt="" rendition="preview" className="h-14 w-14 rounded-xl object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-secondary"><Check className="h-4 w-4" /></span>}
                  <span className="min-w-0 flex-1 whitespace-normal">
                    <span className="block text-xs text-muted-foreground">{formatDate(item.daysAgo)} · {item.kind === "photo" ? (language === "es" ? "Foto" : "Photo") : localizedEventLabel(item.event.type, language)}</span>
                    <span className="mt-0.5 block text-sm">{item.kind === "photo" ? (captionOverrides[item.photo.id] || ui(language, "noCaption")) : item.event.title}</span>
                    {item.kind === "event" ? <span className="mt-1.5 block"><ProvenanceTag kind={item.event.provenance === "recorded" ? "recorded" : item.event.provenance === "observed" ? "observed" : "inferred"} /></span> : null}
                  </span>
                  <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}><Check className="h-3 w-3" /></span>
                  </Button>
                  {item.kind === "photo" && on ? <div className="ml-16 grid gap-2 rounded-xl border border-border/60 bg-secondary/30 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                    <input value={captionOverrides[item.photo.id] ?? ""} onChange={(event) => setCaptionOverrides((current) => ({ ...current, [item.photo.id]: event.target.value }))} placeholder={ui(language, "publicCaption")} className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40" maxLength={240} />
                    <Button type="button" size="sm" variant="outline" onClick={() => setHeroPhotoId(item.photo.id)} className={cn("rounded-full", effectiveHeroPhotoId === item.photo.id && "border-primary bg-primary/10")}><Star className="h-3.5 w-3.5" /> {effectiveHeroPhotoId === item.photo.id ? ui(language, "hero") : ui(language, "useAsHero")}</Button>
                    <Button type="button" size="sm" variant="ghost" disabled={suggestingPhotoId === item.photo.id || !plant.backendGrowCycleId} onClick={() => { setSuggestingPhotoId(item.photo.id); void suggestShareCaption(plant.backendGrowCycleId ?? "", item.photo.id, language).then((caption) => { if (caption) setCaptionOverrides((current) => ({ ...current, [item.photo.id]: caption })); }).catch(() => undefined).finally(() => setSuggestingPhotoId(null)); }} className="rounded-full"><Sparkles className="h-3.5 w-3.5" /> {suggestingPhotoId === item.photo.id ? "…" : ui(language, "suggestCaption")}</Button>
                  </div> : null}
                </div>;
              })}
            </div>
            <Button className="mt-5 w-full rounded-full" disabled={!chosen.length} onClick={openPreview}>{ui(language, "previewPublicStory")} · {chosen.length}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
