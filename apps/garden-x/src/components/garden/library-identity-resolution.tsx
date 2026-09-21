import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import type { Plant } from "@/lib/garden-data";
import {
  localizedLibraryName,
  searchGardenLibrary,
  type GardenLibraryEntry,
  type GardenLibraryManifest,
} from "@/lib/garden-library";
import { classifyLegacyIdentity } from "@/lib/library-identity-resolver";
import { Button } from "@/components/ui/button";
import { useGarden } from "@/lib/garden-store";
import { localizeKnownError, ui } from "@/lib/ui-copy";

type Props = {
  plant: Plant;
  catalog: GardenLibraryManifest | null;
  catalogError: string | undefined;
  onConfirm: (entry: GardenLibraryEntry) => Promise<void>;
};

export function LibraryIdentityResolution({ plant, catalog, catalogError, onConfirm }: Props) {
  const { language } = useGarden();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GardenLibraryEntry | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const match = useMemo(
    () => (catalog ? classifyLegacyIdentity(plant, catalog) : null),
    [catalog, plant],
  );
  const candidates = useMemo(() => {
    if (!catalog) return [];
    if (query.trim()) return searchGardenLibrary(catalog, query).slice(0, 8);
    return match?.candidates || [];
  }, [catalog, match, query]);

  if (plant.libraryPlantId && match?.kind === "confirmed") return null;

  const confirm = async (entry: GardenLibraryEntry) => {
    setSavingId(entry.libraryPlantId);
    setSaveError(null);
    try {
      await onConfirm(entry);
    } catch (error) {
      setSaveError(
        localizeKnownError(error, language, ui(language, "identityConfirmFailed")),
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="mb-5 rounded-3xl border border-border/70 bg-card p-5 shadow-soft">
      <p className="eyebrow">{ui(language, "gardenLibraryIdentity")}</p>
      <h3 className="mt-1 font-display text-2xl">{ui(language, "identityUnconfirmedTitle")}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {ui(language, "identityUnconfirmedBody")}
      </p>
      {catalogError ? <p className="mt-3 text-sm text-destructive">{catalogError}</p> : null}
      {match?.kind === "exact" && match.candidates[0] && !selectedEntry ? (
        <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <p className="eyebrow text-primary">{ui(language, "matchFound")}</p>
          <p className="mt-1 font-medium">{localizedLibraryName(match.candidates[0], language)}</p>
          <p className="text-sm text-muted-foreground">
            {match.candidates[0].scientificName || ui(language, "scientificNameNotDocumented")}
            {match.candidates[0].cultivar ? ` · “${match.candidates[0].cultivar}”` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              className="rounded-full"
              disabled={savingId !== null}
              onClick={() => void confirm(match.candidates[0]!)}
            >
              <Check className="mr-2 h-4 w-4" /> {ui(language, "confirmIdentity")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={savingId !== null}
              onClick={() => {
                setSearching(true);
                setQuery("");
              }}
            >
              <Search className="mr-2 h-4 w-4" /> {ui(language, "searchAnother")}
            </Button>
          </div>
        </div>
      ) : null}
      {match?.kind === "ambiguous" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {ui(language, "severalIdentityMatches")}
        </p>
      ) : null}
      {match?.kind === "none" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {ui(language, "noUniqueIdentity")}
        </p>
      ) : null}
      {selectedEntry ? (
        <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <p className="eyebrow text-primary">{ui(language, "proposedIdentity")}</p>
          <p className="mt-1 font-medium">{localizedLibraryName(selectedEntry, language)}</p>
          <p className="text-sm text-muted-foreground">
            {selectedEntry.scientificName || ui(language, "scientificNameNotDocumented")}
            {selectedEntry.cultivar ? ` · “${selectedEntry.cultivar}”` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              className="rounded-full"
              disabled={savingId !== null}
              onClick={() => void confirm(selectedEntry)}
            >
              <Check className="mr-2 h-4 w-4" /> {ui(language, "confirmIdentity")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={savingId !== null}
              onClick={() => {
                setSelectedEntry(null);
                setSearching(true);
                setQuery("");
              }}
            >
              <Search className="mr-2 h-4 w-4" /> {ui(language, "searchAnother")}
            </Button>
          </div>
        </div>
      ) : null}
      {!selectedEntry && match && (searching || match.kind !== "exact") ? (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <label className="eyebrow" htmlFor="legacy-library-search">
              {ui(language, "searchGardenLibrary")}
            </label>
            {searching ? (
              <Button
                type="button"
                variant="ghost"
                className="h-auto rounded-full px-2 py-1 text-xs"
                disabled={savingId !== null}
                onClick={() => {
                  setSearching(false);
                  setSelectedEntry(null);
                  setQuery("");
                }}
              >
                {ui(language, "cancel")}
              </Button>
            ) : null}
          </div>
          <span className="relative mt-1.5 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="legacy-library-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={ui(language, "commonScientificCultivar")}
              className="w-full rounded-2xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </span>
        </div>
      ) : null}
      {!selectedEntry && match && (searching || match.kind !== "exact") && candidates.length ? (
        <div className="mt-3 grid gap-2">
          {candidates.map((entry) => (
            <div
              key={entry.libraryPlantId}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{localizedLibraryName(entry, language)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.scientificName || ui(language, "scientificNameNotDocumented")}
                  {entry.cultivar ? ` · “${entry.cultivar}”` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 rounded-full"
                disabled={savingId !== null}
                onClick={() => {
                  setSelectedEntry(entry);
                  setSearching(false);
                  setQuery("");
                }}
              >
                {ui(language, "selectIdentity")}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {saveError ? <p className="mt-3 text-sm text-destructive">{saveError}</p> : null}
    </section>
  );
}
