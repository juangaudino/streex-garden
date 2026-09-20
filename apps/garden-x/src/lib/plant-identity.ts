import type { Plant } from "./garden-data";
import type { GardenLibraryEntry } from "./garden-library";

export type PlantIdentityParts = {
  commonName: string;
  scientificName: string | null;
  cultivar: string | null;
};

function clean(value: string | null | undefined) {
  const trimmed = value?.trim() || "";
  return trimmed || null;
}

export function plantIdentityParts(
  plant: Plant,
  entry?: GardenLibraryEntry | null,
): PlantIdentityParts {
  return {
    commonName:
      clean(plant.libraryIdentitySnapshot?.commonName) || entry?.commonName || plant.species,
    scientificName:
      clean(plant.libraryIdentitySnapshot?.scientificName) ||
      entry?.scientificName ||
      clean(plant.scientific),
    cultivar:
      clean(plant.libraryIdentitySnapshot?.cultivar) || entry?.cultivar || clean(plant.variety),
  };
}

export function formatStatusLine(label: string, note: string | null | undefined) {
  const cleanNote = clean(note);
  return cleanNote ? `${label} — ${cleanNote}` : label;
}
