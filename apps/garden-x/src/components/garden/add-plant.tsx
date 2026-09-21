import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Camera, Search, Sparkles, Sprout, X } from "lucide-react";
import { toast } from "sonner";
import { useGarden } from "@/lib/garden-store";
import {
  candidatesForPosition,
  evaluatePlanting,
  loadGardenLibraryCatalog,
  resolvePlantingContext,
  searchGardenLibrary,
  localizedLibraryName,
  type GardenLibraryEntry,
  type GardenLibraryManifest,
} from "@/lib/garden-library";
import { Button } from "@/components/ui/button";
import { localizeKnownError, ui } from "@/lib/ui-copy";

interface Props {
  gardenId: string;
  positionId?: string | undefined;
  slot?: string | undefined;
  open: boolean;
  onClose: () => void;
}

const todayInputValue = () => new Date().toISOString().slice(0, 10);

export function AddPlantSheet({ gardenId, positionId, slot, open, onClose }: Props) {
  const store = useGarden();
  const language = store.language;
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [catalog, setCatalog] = useState<GardenLibraryManifest | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GardenLibraryEntry | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [nickname, setNickname] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [precision, setPrecision] = useState<"exact" | "approximate" | "unknown">("exact");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const garden = store.gardens.find((g) => g.id === gardenId);

  useEffect(() => {
    if (!open) return;
    setCatalogError("");
    void loadGardenLibraryCatalog()
      .then(setCatalog)
      .catch((error: unknown) =>
        setCatalogError(localizeKnownError(error, language, ui(language, "libraryUnavailable"))),
      );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(null);
    setShowSuggestions(false);
    setNickname("");
    setDate(todayInputValue());
    setPrecision("exact");
    setPhoto(null);
    setBusy(false);
    setSaveError("");
  }, [open]);

  const context = useMemo(
    () => (garden && positionId ? resolvePlantingContext(garden, positionId, store.plants) : null),
    [garden, positionId, store.plants],
  );
  const results = useMemo(
    () => (catalog ? searchGardenLibrary(catalog, query).slice(0, 12) : []),
    [catalog, query],
  );
  const suggestions = useMemo(
    () => (catalog && context ? candidatesForPosition(catalog, context).slice(0, 8) : []),
    [catalog, context],
  );
  const guidance = useMemo(
    () => (selected && catalog && context ? evaluatePlanting(selected, catalog, context, language) : []),
    [selected, catalog, context],
  );

  if (!open || typeof document === "undefined") return null;

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };
  const choose = (entry: GardenLibraryEntry) => {
    setSelected(entry);
    setShowSuggestions(false);
    setSaveError("");
  };
  const retryCatalog = () => {
    setCatalog(null);
    setCatalogError("");
    void loadGardenLibraryCatalog(true)
      .then(setCatalog)
      .catch((error: unknown) =>
        setCatalogError(localizeKnownError(error, language, ui(language, "libraryUnavailable"))),
      );
  };
  const save = async () => {
    if (!selected || !positionId) {
      setSaveError(ui(language, "positionUnavailable"));
      return;
    }
    if (precision !== "unknown" && !date) {
      setSaveError(ui(language, "plantingDateRequired"));
      return;
    }
    setBusy(true);
    setSaveError("");
    try {
      const id = await store.createLibraryPlant({
        gardenId,
        positionId,
        libraryPlantId: selected.libraryPlantId,
        nickname,
        plantedOn: precision === "unknown" ? null : date,
        plantedOnPrecision: precision,
        ...(photo
          ? {
              photo: {
                src: photo,
                daysAgo: 0,
                caption: "First photograph",
                metrics: { heightCm: null, leafCount: null, greenness: 0, density: null },
              },
            }
          : {}),
      });
      onClose();
      toast.success(
        language === "es"
          ? `${localizedLibraryName(selected, language)} añadida${slot ? ` a ${slot}` : ""}`
          : `${localizedLibraryName(selected, language)} added${slot ? ` to ${slot}` : ""}`,
      );
      await navigate({ to: "/plants/$plantId", params: { plantId: id } });
    } catch (error) {
      setSaveError(
        localizeKnownError(error, language, ui(language, "plantAddFailed")),
      );
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label={ui(language, "close")}
        onClick={onClose}
        disabled={busy}
        className="absolute inset-0 bg-ink/45 backdrop-blur-[3px]"
      />
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
            <p className="truncate font-display text-lg">{ui(language, "addPlant")}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label={ui(language, "close")}
            className="press grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {!positionId ? (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {ui(language, "positionNotConnected")}
            </p>
          ) : null}
          {!selected ? (
            <>
              <div>
                <p className="eyebrow">{ui(language, "library")}</p>
                <h2 className="mt-1 font-display text-2xl">{ui(language, "whatPlanting")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {ui(language, "chooseDocumentedPlant")}
                </p>
              </div>
              <label className="relative block">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  autoFocus
                  className="input-soft pl-9"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setShowSuggestions(false);
                  }}
                  placeholder={ui(language, "searchCatalogExample")}
                />
              </label>
              {!query && context ? (
                <button
                  type="button"
                  onClick={() => setShowSuggestions((value) => !value)}
                  className="flex w-full items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-left text-sm font-medium text-primary"
                >
                  <Sparkles className="h-4 w-4" />
                  {ui(language, "whatCouldPlant")}
                </button>
              ) : null}
              {catalogError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <p>{catalogError}</p>
                  <button className="mt-2 font-medium underline" onClick={retryCatalog}>
                    {ui(language, "tryAgain")}
                  </button>
                </div>
              ) : null}
              {!catalog && !catalogError ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {ui(language, "loadingLibrary")}
                </p>
              ) : null}
              {catalog ? (
                <div className="space-y-2">
                  {(showSuggestions ? suggestions : results).map((entry) => (
                    <button
                      type="button"
                      key={entry.libraryPlantId}
                      onClick={() => choose(entry)}
                      className="press w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-left"
                    >
                      <p className="font-medium">{localizedLibraryName(entry, language)}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {[entry.cultivar, entry.scientificName].filter(Boolean).join(" · ")}
                      </p>
                    </button>
                  ))}
                  {query && !results.length ? (
                    <p className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">
                      {ui(language, "notFoundLibrary")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelected(null)}
                disabled={busy}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Change plant
              </button>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="eyebrow">{ui(language, "gardenLibraryIdentity")}</p>
                <p className="mt-1 font-display text-2xl">{localizedLibraryName(selected, language)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[selected.cultivar, selected.scientificName].filter(Boolean).join(" · ")}
                </p>
              </div>
              <label className="block text-sm">
                <span className="mb-2 block text-muted-foreground">
                  {ui(language, "personalName")} <span className="text-xs">{ui(language, "optional").toLowerCase()}</span>
                </span>
                <input
                  className="input-soft"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder={localizedLibraryName(selected, language)}
                  maxLength={32}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-2 block text-muted-foreground">{ui(language, "datePlanting")}</span>
                  <input
                    type="date"
                    max={todayInputValue()}
                    disabled={precision === "unknown"}
                    className="input-soft px-3"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-2 block text-muted-foreground">{ui(language, "datePrecision")}</span>
                  <select
                    className="input-soft px-3"
                    value={precision}
                    onChange={(event) => setPrecision(event.target.value as typeof precision)}
                  >
                    <option value="exact">{ui(language, "exact")}</option>
                    <option value="approximate">{ui(language, "approximate")}</option>
                    <option value="unknown">{ui(language, "unknown")}</option>
                  </select>
                </label>
              </div>
              <div className="rounded-2xl bg-secondary/70 p-4">
                <p className="text-sm font-medium">{ui(language, "plantingGuidance")}</p>
                <div className="mt-2 space-y-2">
                  {guidance.map((item, index) => (
                    <p key={`${item.kind}-${index}`} className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {item.kind === "evidence-backed fit"
                          ? ui(language, "goodFit")
                          : item.kind === "consideration"
                            ? ui(language, "consideration")
                            : ui(language, "insufficientEvidence")}
                        .
                      </span>{" "}
                      {item.message}
                    </p>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {ui(language, "guidanceDisclaimer")}
                </p>
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => pickPhoto(event.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-full"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {photo ? ui(language, "photoSelected") : ui(language, "addFirstPhoto")}
                </Button>
              </div>
              {saveError ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {saveError}
                </p>
              ) : null}
              <Button
                disabled={busy || !positionId}
                onClick={() => void save()}
                className="w-full rounded-full"
              >
                {busy ? ui(language, "addingToGarden") : ui(language, "addToPosition")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
