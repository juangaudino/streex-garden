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
        setCatalogError(error instanceof Error ? error.message : "Garden Library is unavailable."),
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
    () => (selected && catalog && context ? evaluatePlanting(selected, catalog, context) : []),
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
        setCatalogError(error instanceof Error ? error.message : "Garden Library is unavailable."),
      );
  };
  const save = async () => {
    if (!selected || !positionId) {
      setSaveError("This physical position is unavailable. Refresh the system map and try again.");
      return;
    }
    if (precision !== "unknown" && !date) {
      setSaveError("Add the planting date or select Unknown.");
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
                metrics: { heightCm: 0, leafCount: 0, greenness: 0, density: 0 },
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
        error instanceof Error ? error.message : "Garden could not add this plant. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
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
            <p className="truncate font-display text-lg">{language === "es" ? "Añadir una planta" : "Add a plant"}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="press grid h-8 w-8 place-items-center rounded-full bg-secondary text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {!positionId ? (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              This position is not connected to the real system map yet. Refresh before adding a
              plant.
            </p>
          ) : null}
          {!selected ? (
            <>
              <div>
                <p className="eyebrow">Garden Library</p>
                <h2 className="mt-1 font-display text-2xl">{language === "es" ? "¿Qué vas a plantar?" : "What are you planting?"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a documented plant identity. Your personal details come next.
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
                  placeholder={language === "es" ? "Buscar albahaca, Ocimum, Genovese…" : "Search basil, Ocimum, Genovese…"}
                />
              </label>
              {!query && context ? (
                <button
                  type="button"
                  onClick={() => setShowSuggestions((value) => !value)}
                  className="flex w-full items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-left text-sm font-medium text-primary"
                >
                  <Sparkles className="h-4 w-4" />
                  {language === "es" ? "¿Qué podría plantar aquí?" : "What could I plant here?"}
                </button>
              ) : null}
              {catalogError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <p>{catalogError}</p>
                  <button className="mt-2 font-medium underline" onClick={retryCatalog}>
                    Try again
                  </button>
                </div>
              ) : null}
              {!catalog && !catalogError ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {language === "es" ? "Cargando Garden Library…" : "Loading Garden Library…"}
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
                      {language === "es"
                        ? "No está en Garden Library. Garden solo crea plantas a partir de identidades documentadas."
                        : "Not found in Garden Library. Garden only creates plants from documented Library identities."}
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
                <p className="eyebrow">Garden Library identity</p>
                <p className="mt-1 font-display text-2xl">{localizedLibraryName(selected, language)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[selected.cultivar, selected.scientificName].filter(Boolean).join(" · ")}
                </p>
              </div>
              <label className="block text-sm">
                <span className="mb-2 block text-muted-foreground">
                  {language === "es" ? "Nombre personal" : "Personal name"} <span className="text-xs">{language === "es" ? "opcional" : "optional"}</span>
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
                  <span className="mb-2 block text-muted-foreground">{language === "es" ? "Fecha de plantación" : "Planting date"}</span>
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
                  <span className="mb-2 block text-muted-foreground">{language === "es" ? "Precisión de fecha" : "Date precision"}</span>
                  <select
                    className="input-soft px-3"
                    value={precision}
                    onChange={(event) => setPrecision(event.target.value as typeof precision)}
                  >
                    <option value="exact">{language === "es" ? "Exacta" : "Exact"}</option>
                    <option value="approximate">{language === "es" ? "Aproximada" : "Approximate"}</option>
                    <option value="unknown">{language === "es" ? "Desconocida" : "Unknown"}</option>
                  </select>
                </label>
              </div>
              <div className="rounded-2xl bg-secondary/70 p-4">
                <p className="text-sm font-medium">{language === "es" ? "Orientación de plantación" : "Planting guidance"}</p>
                <div className="mt-2 space-y-2">
                  {guidance.map((item, index) => (
                    <p key={`${item.kind}-${index}`} className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {item.kind === "evidence-backed fit"
                          ? language === "es" ? "Buen encaje" : "Good fit"
                          : item.kind === "consideration"
                            ? language === "es" ? "Consideración" : "Consideration"
                            : language === "es" ? "Sin evidencia suficiente" : "Unknown"}
                        .
                      </span>{" "}
                      {item.message}
                    </p>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {language === "es" ? "La orientación es una recomendación. Nunca bloquea tu elección." : "Guidance is a recommendation. It never blocks your choice."}
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
                  {photo ? (language === "es" ? "Foto seleccionada" : "Photo selected") : language === "es" ? "Añadir primera foto" : "Add first photo"}
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
                {busy ? (language === "es" ? "Añadiendo al jardín…" : "Adding to Garden…") : language === "es" ? "Añadir a esta posición" : "Add to this position"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
