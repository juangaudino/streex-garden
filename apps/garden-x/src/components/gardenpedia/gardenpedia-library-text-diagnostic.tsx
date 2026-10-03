import { useMemo, useState } from "react";

import { canonicalEntries } from "./donor/canonical-adapter";

/**
 * Temporary P0 bisection stage: canonical Library data rendered as text only.
 * Keep this surface intentionally separate from the production Library UI so
 * no image, profile, or secondary Gardenpedia feature can enter this stage.
 */
export function GardenpediaLibraryTextDiagnostic() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("en");
  const entries = useMemo(
    () =>
      canonicalEntries.filter((entry) => {
        if (!normalizedQuery) return true;
        return [entry.commonName, entry.spanishName, entry.scientificName]
          .filter(Boolean)
          .some((value) => value.toLocaleLowerCase("en").includes(normalizedQuery));
      }),
    [normalizedQuery],
  );

  return (
    <main
      aria-labelledby="gardenpedia-diagnostic-title"
      className="min-h-screen bg-background px-6 py-10"
    >
      <div className="mx-auto flex max-w-xl flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Garden X
          </p>
          <h1 id="gardenpedia-diagnostic-title" className="font-display text-3xl">
            Gardenpedia
          </h1>
          <p className="text-base text-muted-foreground">Library text-only diagnostic</p>
        </div>

        <label className="flex flex-col gap-2 text-sm" htmlFor="gardenpedia-library-search">
          Search catalog
          <input
            id="gardenpedia-library-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-base"
          />
        </label>

        <p className="text-sm text-muted-foreground">
          Library · {entries.length} of {canonicalEntries.length} identities
        </p>

        <ul
          aria-label="Gardenpedia catalog"
          className="flex flex-col divide-y divide-border border-y border-border"
        >
          {entries.map((entry) => (
            <li key={entry.libraryPlantId} className="flex min-w-0 flex-col gap-1 py-3">
              <span className="break-words font-medium">{entry.commonName}</span>
              <span className="break-words text-sm text-muted-foreground">
                {entry.scientificName || entry.spanishName || "Scientific name not established"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
