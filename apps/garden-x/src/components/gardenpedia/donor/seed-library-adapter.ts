import { gardenLibraryManifest } from "@/generated/garden-library-manifest";
import {
  gardenSeedProfileCatalog,
  gardenSeedProfileIds,
} from "@/generated/garden-seed-profile-index";

export type SeedLibraryLanguage = "en" | "es";

export type SeedLibraryCardViewModel = {
  id: string;
  name: string;
  spanishName: string;
  scientificName: string;
  category: string;
  emoji: string;
  summary: string;
  quickFactCount: number;
  sourceCount: number;
};

type Localized = { en: string; es: string };

const CATEGORY_EMOJI: Record<string, string> = {
  herbs: "🌿",
  "leafy greens": "🥬",
  fruits: "🍅",
  fruiting: "🍅",
  flowers: "🌼",
  vegetables: "🌱",
  "root vegetables": "🥕",
  alliums: "🌱",
};

function localize(value: Localized, language: SeedLibraryLanguage) {
  return value[language] || value.en || value.es;
}

export function buildSeedLibraryCards(language: SeedLibraryLanguage) {
  const metadataById = new Map(gardenSeedProfileCatalog.map((profile) => [profile.id, profile]));
  const publishedIds = new Set(gardenSeedProfileIds);

  return gardenLibraryManifest.entries
    .filter((entry) => entry.status === "active" && publishedIds.has(entry.libraryPlantId))
    .map((entry) => {
      const metadata = metadataById.get(entry.libraryPlantId);
      if (!metadata) return null;
      return {
        id: entry.libraryPlantId,
        name: entry.commonName,
        spanishName: entry.spanishName || entry.commonName,
        scientificName: entry.scientificName || "",
        category: entry.category,
        emoji: CATEGORY_EMOJI[entry.category] ?? "🌱",
        summary: localize(metadata.summary, language),
        quickFactCount: metadata.quickFactCount,
        sourceCount: metadata.sourceCount,
      } satisfies SeedLibraryCardViewModel;
    })
    .filter((profile): profile is SeedLibraryCardViewModel => Boolean(profile));
}
