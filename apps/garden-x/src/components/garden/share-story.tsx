import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, ExternalLink } from "lucide-react";
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
import { createPublicPlantStory } from "@/lib/garden-backend";
import { localizeKnownError, ui } from "@/lib/ui-copy";

type ShareItem =
  | { id: string; daysAgo: number; kind: "photo"; photo: Photo }
  | { id: string; daysAgo: number; kind: "event"; event: PlantEvent };

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
    ...events.filter((event) => event.milestone).map((event) => ({ id: `event:${event.id}`, daysAgo: event.daysAgo, kind: "event" as const, event })),
  ]), [events, photos]);
  const [selected, setSelected] = useState<string[]>(items.map((item) => item.id));
  const [preview, setPreview] = useState(false);
  const chosen = items.filter((item) => selected.includes(item.id));
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
    moments: chosen as PublicStoryMoment[],
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
      void createPublicPlantStory(plant, canonicalSelection)
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
      <DialogContent className={cn("max-h-[92vh] overflow-y-auto rounded-3xl border-border/70 p-0", preview ? "sm:max-w-5xl" : "sm:max-w-2xl")}>
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
                return <Button key={item.id} variant="ghost" onClick={() => setSelected((value) => on ? value.filter((id) => id !== item.id) : [...value, item.id])} className={cn("h-auto w-full justify-start rounded-2xl border p-3 text-left", on ? "border-primary bg-accent/40" : "border-border/70")}>
                  {item.kind === "photo" ? <PhotoImage photo={item.photo} alt="" rendition="preview" className="h-14 w-14 rounded-xl object-cover" /> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-secondary"><Check className="h-4 w-4" /></span>}
                  <span className="min-w-0 flex-1 whitespace-normal">
                    <span className="block text-xs text-muted-foreground">{formatDate(item.daysAgo)} · {item.kind === "photo" ? (language === "es" ? "Foto" : "Photo") : localizedEventLabel(item.event.type, language)}</span>
                    <span className="mt-0.5 block text-sm">{item.kind === "photo" ? item.photo.caption : item.event.title}</span>
                    {item.kind === "event" ? <span className="mt-1.5 block"><ProvenanceTag kind={item.event.provenance === "recorded" ? "recorded" : item.event.provenance === "observed" ? "observed" : "inferred"} /></span> : null}
                  </span>
                  <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}><Check className="h-3 w-3" /></span>
                </Button>;
              })}
            </div>
            <Button className="mt-5 w-full rounded-full" disabled={!chosen.length} onClick={openPreview}>{ui(language, "previewPublicStory")} · {chosen.length}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
