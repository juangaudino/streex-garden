import type { Plant } from "./garden-data";
import type { GardenLibraryEntry, GardenLibraryManifest } from "./garden-library";

export type LegacyIdentityMatch = {
  kind: "confirmed" | "exact" | "ambiguous" | "none";
  candidates: readonly GardenLibraryEntry[];
};

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

function fieldMatches(
  value: string | null | undefined,
  candidateValues: Array<string | null | undefined>,
) {
  const needle = normalize(value);
  return Boolean(needle) && candidateValues.some((candidate) => normalize(candidate) === needle);
}

/**
 * Finds suggestions only. It never writes and never treats a suggestion as a
 * confirmed Library identity. A single exact candidate still requires a human
 * confirmation in the Plant Detail UI.
 */
export function classifyLegacyIdentity(
  plant: Pick<Plant, "libraryPlantId" | "species" | "scientific" | "variety" | "knowledgeId">,
  catalog: GardenLibraryManifest,
): LegacyIdentityMatch {
  if (plant.libraryPlantId) {
    const confirmed = catalog.entries.find(
      (entry) => entry.libraryPlantId === plant.libraryPlantId,
    );
    return { kind: "confirmed", candidates: confirmed ? [confirmed] : [] };
  }

  const common = normalize(plant.species);
  const scientific = normalize(plant.scientific);
  const cultivar = normalize(plant.variety);
  const referenceKey = normalize(plant.knowledgeId);
  const candidates = catalog.entries.filter((entry) => {
    const commonMatch = fieldMatches(common, [entry.commonName, ...entry.aliases]);
    const scientificMatch = fieldMatches(scientific, [entry.scientificName]);
    const cultivarMatch = fieldMatches(cultivar, [entry.cultivar, ...entry.aliases]);
    const idMatch = Boolean(referenceKey && referenceKey === normalize(entry.libraryPlantId));
    if (idMatch) return true;
    if (common && !commonMatch) return false;
    if (scientific && !scientificMatch) return false;
    if (cultivar && !cultivarMatch) return false;
    return commonMatch || scientificMatch || cultivarMatch;
  });

  if (candidates.length === 1) return { kind: "exact", candidates };
  if (candidates.length > 1) return { kind: "ambiguous", candidates };
  return { kind: "none", candidates: [] };
}
