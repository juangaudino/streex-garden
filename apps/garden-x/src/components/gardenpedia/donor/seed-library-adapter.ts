import { gardenLibraryManifest } from "@/generated/garden-library-manifest";
import {
  gardenSeedProfileCatalog,
  gardenSeedProfileIds,
} from "@/generated/garden-seed-profile-index";
import propagationGuidance from "../../../../../../labs/gardenpedia/data/propagation-guidance-v1.json";

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
  propagationClass: "seed_supported" | "vegetative_preferred" | "insufficient_documentation";
  propagationStatus: "source_backed" | "pending" | "needs_validation";
  propagationSummary: string;
  sources: readonly { id: string; label: string; url: string }[];
  aliases: readonly string[];
  hasSeedProfile: boolean;
};

type Localized = { en: string; es: string };

const CATEGORY_EMOJI: Record<string, string> = {
  herbs: "🌿",
  "leafy greens": "🥬",
  fruits: "🍅",
  fruiting: "🍅",
  flowers: "🌼",
  ornamentals: "🪴",
  vegetables: "🌱",
  "root vegetables": "🥕",
  alliums: "🌱",
  "cover crops": "🌱",
};

type PropagationGuidance = {
  classification: "vegetative_preferred" | "insufficient_documentation";
  status: "source_backed" | "pending" | "needs_validation";
  summary: Localized;
  sourceIds: readonly string[];
};

const propagationRecords = (
  propagationGuidance as {
    schemaVersion: string;
    records: Record<string, PropagationGuidance>;
  }
).records;

function localize(value: Localized, language: SeedLibraryLanguage) {
  return value[language] || value.en || value.es;
}

export function undocumentedPropagationSummary(language: SeedLibraryLanguage) {
  return language === "es"
    ? "Las fuentes públicas disponibles no establecen un protocolo de semilla ni una vía alternativa verificada para esta identidad. Es una brecha de evidencia, no una afirmación de que la planta no pueda propagarse."
    : "Available public sources do not establish a seed protocol or a verified alternative route for this identity. This is an evidence gap, not a claim that the plant cannot be propagated.";
}

export function buildSeedLibraryCards(language: SeedLibraryLanguage) {
  const metadataById = new Map(gardenSeedProfileCatalog.map((profile) => [profile.id, profile]));
  const publishedIds = new Set(gardenSeedProfileIds);
  const propagationSourceById = new Map(
    gardenLibraryManifest.entries
      .flatMap((entry) => entry.reference.sources)
      .map((source) => [source.id, source]),
  );

  return gardenLibraryManifest.entries
    .filter((entry) => entry.status === "active")
    .map((entry) => {
      const metadata = metadataById.get(entry.libraryPlantId);
      const hasSeedProfile = publishedIds.has(entry.libraryPlantId) && Boolean(metadata);
      const specificGuidance = propagationRecords[entry.libraryPlantId];
      const sourceIds = specificGuidance?.sourceIds ?? [];
      const sources = sourceIds
        .map((id) => {
          const source = propagationSourceById.get(id);
          return source
            ? { id, label: `${source.publisher} · ${source.title}`, url: source.url }
            : null;
        })
        .filter((source): source is { id: string; label: string; url: string } => Boolean(source));
      return {
        id: entry.libraryPlantId,
        name: entry.commonName,
        spanishName: entry.spanishName || entry.commonName,
        scientificName: entry.scientificName || "",
        category: entry.category,
        emoji: CATEGORY_EMOJI[entry.category] ?? "🌱",
        summary:
          hasSeedProfile && metadata
            ? localize(metadata.summary, language)
            : (specificGuidance?.summary[language] ?? undocumentedPropagationSummary(language)),
        quickFactCount: metadata?.quickFactCount ?? 0,
        sourceCount: metadata?.sourceCount ?? sources.length,
        propagationClass:
          specificGuidance?.classification ??
          (hasSeedProfile ? ("seed_supported" as const) : ("insufficient_documentation" as const)),
        propagationStatus:
          specificGuidance?.status ??
          (hasSeedProfile ? ("source_backed" as const) : ("pending" as const)),
        propagationSummary:
          specificGuidance?.summary[language] ??
          (hasSeedProfile && metadata
            ? localize(metadata.summary, language)
            : undocumentedPropagationSummary(language)),
        sources,
        aliases: entry.aliases,
        hasSeedProfile,
      } satisfies SeedLibraryCardViewModel;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

export function filterSeedLibraryCards(
  cards: readonly SeedLibraryCardViewModel[],
  options: {
    query?: string;
    category?: string;
    mode?: "seeds" | "propagation";
    propagationClass?: "all" | SeedLibraryCardViewModel["propagationClass"];
  } = {},
) {
  const query = normalizeSearch(options.query ?? "");
  return cards.filter((card) => {
    if (options.mode === "seeds" && !card.hasSeedProfile) return false;
    if (options.category && options.category !== "all" && card.category !== options.category)
      return false;
    if (
      options.mode === "propagation" &&
      options.propagationClass &&
      options.propagationClass !== "all" &&
      card.propagationClass !== options.propagationClass
    )
      return false;
    if (!query) return true;
    return [card.name, card.spanishName, card.scientificName, ...card.aliases]
      .filter(Boolean)
      .some((value) => normalizeSearch(value).includes(query));
  });
}
