import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Camera, Sprout, X } from "lucide-react";
import { toast } from "sonner";
import { useGarden } from "@/lib/garden-store";
import { Button } from "@/components/ui/button";

interface Props {
  gardenId: string;
  /** Pre-bound physical position; the flow never asks for it again. */
  slot?: string | undefined;
  open: boolean;
  onClose: () => void;
}

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const daysAgoFromDate = (value: string) => {
  if (!value) return 0;
  const then = new Date(`${value}T12:00:00`).getTime();
  const days = Math.round((Date.now() - then) / 86_400_000);
  return Number.isFinite(days) && days > 0 ? days : 0;
};

export function AddPlantSheet({ gardenId, slot, open, onClose }: Props) {
  const store = useGarden();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [scientific, setScientific] = useState("");
  const [variety, setVariety] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [photo, setPhoto] = useState<string | null>(null);
  const garden = store.gardens.find((g) => g.id === gardenId);

  useEffect(() => {
    if (!open) return;
    setName("");
    setSpecies("");
    setScientific("");
    setVariety("");
    setDate(todayInputValue());
    setPhoto(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const save = () => {
    const daysAgo = daysAgoFromDate(date);
    const id = store.addPlant(
      {
        gardenId,
        name: name.trim(),
        species: species.trim() || "Unrecorded species",
        scientific: scientific.trim(),
        variety: variety.trim(),
        knowledgeId: "",
        plantedDaysAgo: daysAgo,
        ...(slot && { slot }),
        status: "steady",
        statusNote: "Just added — nothing observed yet.",
        heroPhotoId: "",
        identityConfirmed: Boolean(species.trim()),
      },
      photo
        ? {
            src: photo,
            daysAgo,
            caption: "First photograph",
            metrics: { heightCm: 0, leafCount: 0, greenness: 0, density: 0 },
          }
        : undefined,
    );
    onClose();
    toast.success(`${name.trim() || "Plant"} added${slot ? ` to ${slot}` : ""}`);
    void navigate({ to: "/plants/$plantId", params: { plantId: id } });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]" />
      <div className="rise relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-border/70 bg-card shadow-lift sm:max-w-lg sm:rounded-[2rem]">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 px-5 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
            <Sprout className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow truncate">
              {garden?.name}
              {slot ? ` · ${slot}` : ""}
            </p>
            <p className="truncate font-display text-lg">Add a plant</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="press grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <label className="block min-w-0 text-sm">
            <span className="mb-2 block text-muted-foreground">Personal name</span>
            <input
              className="input-soft min-w-0"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Luna"
              maxLength={32}
              autoFocus
            />
            <span className="mt-1.5 block text-xs text-muted-foreground">
              The name you call it. Botanical identity is recorded separately below.
            </span>
          </label>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="block min-w-0 text-sm">
              <span className="mb-2 block text-muted-foreground">Species / common name</span>
              <input
                className="input-soft min-w-0"
                value={species}
                onChange={(event) => setSpecies(event.target.value)}
                placeholder="Genovese basil"
              />
            </label>
            <label className="block min-w-0 text-sm">
              <span className="mb-2 block text-muted-foreground">Scientific name</span>
              <input
                className="input-soft min-w-0"
                value={scientific}
                onChange={(event) => setScientific(event.target.value)}
                placeholder="Ocimum basilicum"
              />
            </label>
          </div>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="block min-w-0 text-sm">
              <span className="mb-2 block text-muted-foreground">Cultivar / variety (if known)</span>
              <input
                className="input-soft min-w-0"
                value={variety}
                onChange={(event) => setVariety(event.target.value)}
                placeholder="Genovese"
              />
            </label>
            <label className="block min-w-0 text-sm">
              <span className="mb-2 block text-muted-foreground">Planted / started</span>
              <input
                type="date"
                max={todayInputValue()}
                className="input-soft min-w-0 px-3"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-sm text-muted-foreground">First photograph (optional)</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => pickPhoto(event.target.files?.[0])}
            />
            <div className="flex items-center gap-3">
              {photo ? (
                <img src={photo} alt="" className="h-20 w-20 rounded-2xl object-cover" />
              ) : (
                <span className="grid h-20 w-20 place-items-center rounded-2xl border border-dashed border-border bg-secondary/50 text-muted-foreground">
                  <Camera className="h-4 w-4" />
                </span>
              )}
              <Button type="button" variant="outline" className="rounded-full" onClick={() => fileRef.current?.click()}>
                {photo ? "Choose another photo" : "Add a photo"}
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-border/60 px-5 py-4">
          <Button className="w-full rounded-full" disabled={!name.trim()} onClick={save}>
            Add to {slot ?? garden?.name}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}