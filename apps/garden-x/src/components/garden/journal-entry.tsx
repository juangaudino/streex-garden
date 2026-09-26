import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Leaf, X } from "lucide-react";
import { toast } from "sonner";
import { PhotoSourcePicker } from "@/components/garden/photo-source-picker";
import { useGarden } from "@/lib/garden-store";
import type { EventType, JournalMilestone, Photo, Plant } from "@/lib/garden-data";
import { normalizePhotoDataUrl } from "@/lib/photo-input";
import { dateOnlyToUtcNoon } from "@/lib/temporal";
import { ui, type UiCopyKey } from "@/lib/ui-copy";
import {
  JournalEntryContextProvider,
  type JournalEntryContext,
  type JournalEntryApi,
} from "@/components/garden/journal-entry-context";

type JournalEntryRequest = JournalEntryContext & { sequence: number };

export function JournalEntryProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<JournalEntryRequest | null>(null);
  const sequence = useRef(0);
  const open = useCallback((context: JournalEntryContext = {}) => {
    sequence.current += 1;
    setRequest({ ...context, sequence: sequence.current });
  }, []);
  const api = useMemo(() => ({ open }), [open]);
  return (
    <JournalEntryContextProvider.Provider value={api}>
      {children}
      <JournalEntrySheet request={request} onClose={() => setRequest(null)} />
    </JournalEntryContextProvider.Provider>
  );
}

const milestoneType: Record<JournalMilestone, EventType> = {
  germinated: "germinated",
  sprouted: "sprouted",
  flowering: "flowering",
  fruiting: "fruiting",
  harvest: "harvest",
};

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function JournalEntrySheet({
  request,
  onClose,
}: {
  request: JournalEntryRequest | null;
  onClose: () => void;
}) {
  const store = useGarden();
  const language = store.language;
  const fixedPlant = request?.plantId
    ? store.plants.find((plant) => plant.id === request.plantId && !plant.cycleClosed)
    : undefined;
  const fixedGardenId = fixedPlant?.gardenId ?? request?.gardenId;
  const requestSequence = request?.sequence;
  const [gardenId, setGardenId] = useState("");
  const [plantId, setPlantId] = useState("");
  const [note, setNote] = useState("");
  const [milestone, setMilestone] = useState<JournalMilestone | "">("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (requestSequence === undefined) return;
    setGardenId(fixedGardenId ?? "");
    setPlantId(fixedPlant?.id ?? "");
    setNote("");
    setMilestone("");
    setPhotoDataUrl(null);
    setPhotoName("");
    setSaving(false);
  }, [requestSequence, fixedGardenId, fixedPlant?.id]);

  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, saving, onClose]);

  const gardens = store.gardens.filter((garden) => !garden.archived);
  const effectiveGardenId = fixedGardenId ?? gardenId;
  const selectedGarden = gardens.find((garden) => garden.id === effectiveGardenId);
  const plants = store.plants.filter(
    (plant) => plant.gardenId === effectiveGardenId && !plant.cycleClosed,
  );
  const selectedPlant: Plant | undefined =
    fixedPlant ?? plants.find((plant) => plant.id === plantId);
  const canSave = Boolean(
    selectedPlant?.backendGrowCycleId && (photoDataUrl || note.trim() || milestone) && !saving,
  );

  if (!request) return null;

  const readPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setPhotoDataUrl(normalizePhotoDataUrl(reader.result, file));
      setPhotoName(file.name);
    };
    reader.onerror = () => toast.error(ui(language, "journalPhotoReadFailed"));
    reader.readAsDataURL(file);
  };

  const milestoneLabel = (value: JournalMilestone) =>
    ui(language, `journalMilestone_${value}` as UiCopyKey);
  const saveMoment = async () => {
    if (!selectedPlant || !canSave) return;
    setSaving(true);
    const date = localToday();
    const daysAgo = 0;
    let attachedPhoto: Photo | undefined;
    let photoId: string | undefined;
    if (photoDataUrl) {
      const draft: Omit<Photo, "id"> = {
        plantId: selectedPlant.id,
        src: photoDataUrl,
        daysAgo,
        capturedAt: dateOnlyToUtcNoon(date),
        capturedAtPrecision: "date",
        caption:
          note.trim() ||
          (milestone ? milestoneLabel(milestone) : ui(language, "journalPhotoCaption")),
        metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
      };
      photoId = store.addPhoto(draft);
      attachedPhoto = { ...draft, id: photoId };
    }
    const title =
      note.trim() || (milestone ? milestoneLabel(milestone) : ui(language, "journalPhotoCaption"));
    const type = milestone ? milestoneType[milestone] : photoDataUrl ? "photo" : "note";
    try {
      await store.addEvent(
        {
          plantId: selectedPlant.id,
          gardenId: selectedPlant.gardenId,
          daysAgo,
          occurredAt: dateOnlyToUtcNoon(date),
          type,
          title,
          ...(note.trim()
            ? { detail: note.trim() }
            : milestone
              ? { detail: milestoneLabel(milestone) }
              : {}),
          provenance: milestone ? "recorded" : "observed",
          ...(milestone ? { journalMilestone: milestone } : {}),
          ...(photoId ? { photoId } : {}),
        },
        { ...(attachedPhoto ? { photo: attachedPhoto } : {}), waitForPersistence: true },
      );
      toast.success(ui(language, "journalMomentSaved"));
      onClose();
    } catch {
      toast.error(ui(language, photoDataUrl ? "momentPhotoSaveFailed" : "momentSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const selectionRequired = !fixedPlant;
  const showGardenSelect = selectionRequired && !request.gardenId;
  const showPlantSelect = selectionRequired;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label={ui(language, "close")}
        disabled={saving}
        onClick={() => {
          if (!saving) onClose();
        }}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="journal-entry-title"
        className="rise relative flex max-h-[min(92dvh,48rem)] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-border/70 bg-card shadow-lift sm:max-w-xl sm:rounded-[1.75rem]"
      >
        <header className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Leaf className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{ui(language, "journalEntryEyebrow")}</p>
            <h2 id="journal-entry-title" className="truncate font-display text-xl">
              {ui(language, "recordMoment")}
            </h2>
          </div>
          <button
            type="button"
            aria-label={ui(language, "close")}
            onClick={onClose}
            disabled={saving}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {showGardenSelect || showPlantSelect ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {showGardenSelect ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="text-muted-foreground">{ui(language, "selectGarden")}</span>
                  <select
                    value={gardenId}
                    onChange={(event) => {
                      setGardenId(event.target.value);
                      setPlantId("");
                    }}
                    className="min-h-12 rounded-2xl border border-border/70 bg-background px-3 text-base outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">{ui(language, "chooseGardenPrompt")}</option>
                    {gardens.map((garden) => (
                      <option key={garden.id} value={garden.id}>
                        {garden.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : selectedGarden ? (
                <p className="self-end pb-3 text-sm text-muted-foreground">{selectedGarden.name}</p>
              ) : null}
              {showPlantSelect ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="text-muted-foreground">
                    {ui(language, "selectPlantPosition")}
                  </span>
                  <select
                    value={plantId}
                    onChange={(event) => setPlantId(event.target.value)}
                    disabled={!gardenId}
                    className="min-h-12 min-w-0 rounded-2xl border border-border/70 bg-background px-3 text-base outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                  >
                    <option value="">{ui(language, "choosePlantPrompt")}</option>
                    {plants.map((plant) => (
                      <option key={plant.id} value={plant.id}>
                        {plant.name}
                        {plant.slot ? ` · ${plant.slot}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {selectedPlant ? (
            <p className="mt-3 rounded-2xl bg-secondary/60 px-3.5 py-2.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedPlant.name}</span>
              {selectedPlant.slot ? ` · ${selectedPlant.slot}` : ""}
              {selectedGarden ? ` · ${selectedGarden.name}` : ""}
            </p>
          ) : selectionRequired && gardenId && plants.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-secondary/60 px-3.5 py-3 text-sm text-muted-foreground">
              {ui(language, "journalNoPlantsHere")}
            </p>
          ) : null}

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">{ui(language, "journalPhotoOptional")}</p>
            {photoDataUrl ? (
              <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-secondary/40">
                <img
                  src={photoDataUrl}
                  alt={photoName || ui(language, "journalPhotoPreview")}
                  className="max-h-52 w-full object-cover"
                />
                <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">{photoName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoDataUrl(null);
                      setPhotoName("");
                    }}
                    className="min-h-9 shrink-0 rounded-full px-3 text-primary"
                  >
                    {ui(language, "removePhoto")}
                  </button>
                </div>
                <div className="px-3 pb-3">
                  <PhotoSourcePicker language={language} onFile={readPhoto} />
                </div>
              </div>
            ) : (
              <PhotoSourcePicker
                language={language}
                onFile={readPhoto}
                className="rounded-2xl border border-dashed border-border/80 bg-secondary/25 p-3"
              />
            )}
          </div>

          <label className="mt-4 grid gap-1.5 text-sm">
            <span className="font-medium">{ui(language, "journalNoteOptional")}</span>
            <textarea
              value={note}
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
              placeholder={ui(language, "journalNotePlaceholder")}
              rows={2}
              className="min-h-20 resize-y rounded-2xl border border-border/70 bg-background px-3.5 py-3 text-base outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-medium">
              {ui(language, "journalMilestoneOptional")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {(["germinated", "sprouted", "flowering", "fruiting", "harvest"] as const).map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={milestone === value}
                    onClick={() => setMilestone((current) => (current === value ? "" : value))}
                    className={`min-h-10 rounded-full border px-3.5 text-sm transition-colors ${milestone === value ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background text-muted-foreground hover:bg-accent/50"}`}
                  >
                    {milestoneLabel(value)}
                  </button>
                ),
              )}
            </div>
          </fieldset>
        </div>

        <footer className="border-t border-border/60 bg-card/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => void saveMoment()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving ? (
              <span className="animate-pulse">{ui(language, "savingMoment")}</span>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {ui(language, "saveMoment")}
              </>
            )}
          </button>
          {!selectedPlant ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {ui(language, "choosePlantBeforeSave")}
            </p>
          ) : !selectedPlant.backendGrowCycleId ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {ui(language, "journalPlantNotReady")}
            </p>
          ) : null}
        </footer>
      </section>
    </div>,
    document.body,
  );
}
