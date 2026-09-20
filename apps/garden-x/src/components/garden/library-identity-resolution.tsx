import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import type { Plant } from "@/lib/garden-data";
import {
  searchGardenLibrary,
  type GardenLibraryEntry,
  type GardenLibraryManifest,
} from "@/lib/garden-library";
import { classifyLegacyIdentity } from "@/lib/library-identity-resolver";
import { Button } from "@/components/ui/button";

type Props = {
  plant: Plant;
  catalog: GardenLibraryManifest | null;
  catalogError: string | undefined;
  onConfirm: (entry: GardenLibraryEntry) => Promise<void>;
};

export function LibraryIdentityResolution({ plant, catalog, catalogError, onConfirm }: Props) {
  const [query, setQuery] = useState("");
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
        error instanceof Error ? error.message : "Garden could not confirm this identity.",
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="mb-5 rounded-3xl border border-border/70 bg-card p-5 shadow-soft">
      <p className="eyebrow">Garden Library identity</p>
      <h3 className="mt-1 font-display text-2xl">Identity not confirmed</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        This plant predates Library identity. Garden will preserve its history and only link it
        after you confirm the documented identity.
      </p>
      {catalogError ? <p className="mt-3 text-sm text-destructive">{catalogError}</p> : null}
      {match?.kind === "exact" && match.candidates[0] ? (
        <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <p className="eyebrow text-primary">Match found in Garden Library</p>
          <p className="mt-1 font-medium">{match.candidates[0].commonName}</p>
          <p className="text-sm text-muted-foreground">
            {match.candidates[0].scientificName || "Scientific name not documented"}
            {match.candidates[0].cultivar ? ` · “${match.candidates[0].cultivar}”` : ""}
          </p>
          <Button
            type="button"
            className="mt-3 rounded-full"
            disabled={savingId !== null}
            onClick={() => void confirm(match.candidates[0]!)}
          >
            <Check className="mr-2 h-4 w-4" /> Confirm identity
          </Button>
        </div>
      ) : null}
      {match?.kind === "ambiguous" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Several Library identities could match this plant. Choose the documented identity below.
        </p>
      ) : null}
      {match?.kind === "none" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No unique match was found. Search Garden Library to resolve this plant manually.
        </p>
      ) : null}
      {match && match.kind !== "exact" ? (
        <label className="mt-4 block">
          <span className="eyebrow">Search Garden Library</span>
          <span className="relative mt-1.5 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Common, scientific or cultivar name"
              className="w-full rounded-2xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </span>
        </label>
      ) : null}
      {match && match.kind !== "exact" && candidates.length ? (
        <div className="mt-3 grid gap-2">
          {candidates.map((entry) => (
            <div
              key={entry.libraryPlantId}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{entry.commonName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {entry.scientificName || "Scientific name not documented"}
                  {entry.cultivar ? ` · “${entry.cultivar}”` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 rounded-full"
                disabled={savingId !== null}
                onClick={() => void confirm(entry)}
              >
                Confirm
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {saveError ? <p className="mt-3 text-sm text-destructive">{saveError}</p> : null}
    </section>
  );
}
