import { gardenLibraryManifest } from "@/generated/garden-library-manifest";
import type { GardenLibraryEntry } from "@/lib/garden-library";
import harvestUseData from "../../../../../../labs/gardenpedia/data/harvest-use-v0.1.json";
import visualsData from "../../../../../../labs/gardenpedia/data/visuals.json";

export type DonorSourceRef = { label: string; url: string };
export type DonorBacking = "source" | "garden" | "pending";
export type DonorConfidence = "alta" | "media" | "baja" | "pendiente";

export type DonorPlant = {
  id: string;
  name: string;
  spanishName: string;
  scientificName: string;
  variety: string | null;
  category: string;
  emoji: string;
  tags: string[];
  light: "alta" | "media" | "baja" | "unknown";
  inventory: "none";
  sourceCount: number;
  guideCompletion: number;
};

export type DonorGuideSection = {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  body: string;
  bullets: string[];
  avoid?: string;
  context?: string;
  backing: DonorBacking;
  confidence: DonorConfidence;
  sources: DonorSourceRef[];
};

export type DonorHarvestOption = {
  emoji: string;
  rank: "Mejor opción" | "Buena opción" | "Posible";
  title: string;
  lead: string;
  steps: string[];
  sources: DonorSourceRef[];
};

export type DonorPlantDetail = {
  id: string;
  name: string;
  spanishName: string;
  scientificName: string;
  category: string;
  emoji: string;
  summary: string;
  metrics: { label: string; value: string; note: string }[];
  timeline?: {
    note: string;
    steps: { label: string; day: string; backed?: boolean }[];
    decide: string;
  };
  evidence: { badge: string; backed: number; adapted: number; pending: number; coverage: string };
  harvestUse?: {
    ediblePart: string;
    bestUse: string;
    quickUses: string[];
    options: DonorHarvestOption[];
  };
  neighbors?: {
    good: {
      emoji: string;
      name: string;
      reason: string;
      action: string;
      basis: string;
      source?: DonorSourceRef;
    }[];
    avoid: DonorHarvestOption[];
  };
  visualGuide?: {
    kind: string;
    tag: string;
    publisher: string;
    title: string;
    description: string;
    url: string;
  };
  guides: DonorGuideSection[];
};

type HarvestRecord = {
  edibleParts?: { en?: string; es?: string };
  bestUse?: { en?: string; es?: string };
  quickUses?: { en?: string[]; es?: string[] };
};

type VisualRecord = {
  mediaType?: string;
  title?: { en?: string; es?: string };
  description?: { en?: string; es?: string };
  sourceName?: string;
  sourceUrl?: string;
};

const harvestCatalog = (harvestUseData as { plants?: Record<string, HarvestRecord> }).plants ?? {};
const visualCatalog = visualsData as Record<string, VisualRecord[]>;

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

const PUBLIC_TAG_EXCLUSIONS = /owned seed|home grown|user zero|uruq|packet|inventory/i;

function canonicalText(value: string | null | undefined): string | null {
  if (!value || /^pending$/i.test(value.trim())) return value?.trim() || null;
  return value.trim();
}

function evidenceRecords(entry: GardenLibraryEntry) {
  const records: {
    evidenceType: "source_backed" | "garden_adaptation";
    confidence: "high" | "medium" | "low";
    sourceIds: readonly string[];
  }[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.evidence)) {
      for (const item of record.evidence) {
        if (item && typeof item === "object") {
          const evidence = item as Record<string, unknown>;
          if (
            evidence.evidenceType === "source_backed" ||
            evidence.evidenceType === "garden_adaptation"
          ) {
            records.push(evidence as (typeof records)[number]);
          }
        }
      }
    }
    Object.values(record).forEach(visit);
  };
  visit(entry.compatibilityProfile);
  visit(entry.lifeCapabilities);
  return records;
}

function statusEvidence(entry: GardenLibraryEntry) {
  const records: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.status === "string") records.push(record.status);
    Object.values(record).forEach(visit);
  };
  visit(entry.compatibilityProfile);
  visit(entry.lifeCapabilities);
  return records;
}

function confidenceLabel(value: "high" | "medium" | "low" | undefined): DonorConfidence {
  return value === "high"
    ? "alta"
    : value === "medium"
      ? "media"
      : value === "low"
        ? "baja"
        : "pendiente";
}

function lightLevel(entry: GardenLibraryEntry): DonorPlant["light"] {
  const requirement =
    entry.compatibilityProfile?.light.status === "known"
      ? entry.compatibilityProfile.light.value[0]?.requirement
      : undefined;
  if (!requirement || !("kind" in requirement)) return "unknown";
  return requirement.kind === "full_sun"
    ? "alta"
    : requirement.kind === "partial_sun"
      ? "media"
      : "baja";
}

export function toDonorPlants(entries: readonly GardenLibraryEntry[]): DonorPlant[] {
  return entries.map((entry) => {
    const evidence = evidenceRecords(entry);
    const sourceCount = new Set(entry.reference.sourceIds).size;
    const coverage = Math.min(99, Math.round((sourceCount / 6) * 100));
    return {
      id: entry.libraryPlantId,
      name: entry.commonName,
      spanishName: entry.spanishName || entry.commonName,
      scientificName: entry.scientificName || "",
      variety: entry.cultivar,
      category: entry.category,
      emoji: CATEGORY_EMOJI[entry.category] ?? "🌱",
      tags: entry.aliases.filter((alias) => !PUBLIC_TAG_EXCLUSIONS.test(alias)),
      light: lightLevel(entry),
      inventory: "none",
      sourceCount,
      guideCompletion: Math.max(0, Math.min(99, coverage + evidence.length * 4)),
    };
  });
}

function sourceRefs(entry: GardenLibraryEntry): DonorSourceRef[] {
  return entry.reference.sources.map((source) => ({
    label: `${source.publisher} · ${source.title}`,
    url: source.url,
  }));
}

function section(
  entry: GardenLibraryEntry,
  id: string,
  title: string,
  emoji: string,
  value: string | null,
  language: "en" | "es",
): DonorGuideSection | null {
  const sourceIds = new Set(entry.reference.sourceIds);
  const statuses = statusEvidence(entry);
  const backing: DonorBacking =
    value && sourceIds.size ? "source" : statuses.includes("pending") ? "pending" : "garden";
  const confidence = backing === "source" ? "media" : backing === "pending" ? "pendiente" : "baja";
  if (!value && backing !== "pending") return null;
  const label =
    value ||
    (language === "es"
      ? "No establecido por la evidencia actual."
      : "Not established by current evidence.");
  return {
    id,
    emoji,
    title,
    subtitle: label,
    body: label,
    bullets: value
      ? [
          language === "es"
            ? "El alcance de la evidencia se conserva desde Gardenpedia."
            : "Evidence scope is preserved from Gardenpedia.",
        ]
      : [],
    backing,
    confidence,
    sources: sourceRefs(entry),
  };
}

function harvestDetail(entry: GardenLibraryEntry, language: "en" | "es") {
  const record = harvestCatalog[entry.libraryPlantId];
  if (!record && !entry.reference.harvest) return undefined;
  const locale = language === "es" ? "es" : "en";
  const ediblePart =
    record?.edibleParts?.[locale] ||
    (language === "es" ? "Parte comestible no establecida" : "Edible part not established");
  const bestUse =
    record?.bestUse?.[locale] ||
    entry.reference.harvest ||
    (language === "es" ? "Uso no establecido" : "Use not established");
  const quickUses = record?.quickUses?.[locale] ?? [];
  return { ediblePart, bestUse, quickUses, options: [] as DonorHarvestOption[] };
}

export function buildDonorPlantDetail(
  entry: GardenLibraryEntry,
  language: "en" | "es",
): DonorPlantDetail {
  const evidence = evidenceRecords(entry);
  const statuses = statusEvidence(entry);
  const sources = sourceRefs(entry);
  const knownClaims = evidence.filter((item) => item.evidenceType === "source_backed").length;
  const adaptations = evidence.filter((item) => item.evidenceType === "garden_adaptation").length;
  const pending = statuses.filter((status) => status === "pending" || status === "unknown").length;
  const sourceCoverage = entry.reference.sourceIds.length
    ? `${new Set(entry.reference.sourceIds).size} sources`
    : language === "es"
      ? "sin fuentes"
      : "no sources";
  const sections = [
    section(
      entry,
      "light",
      language === "es" ? "Luz" : "Light",
      "☀️",
      canonicalText(entry.reference.light),
      language,
    ),
    section(
      entry,
      "hydroponics",
      language === "es" ? "Hidroponía" : "Hydroponics",
      "💧",
      canonicalText(entry.reference.ph || entry.reference.ec),
      language,
    ),
    section(
      entry,
      "spacing",
      language === "es" ? "Separación" : "Spacing",
      "↔",
      canonicalText(entry.reference.spacing),
      language,
    ),
    section(
      entry,
      "pruning",
      language === "es" ? "Poda y manejo" : "Pruning and management",
      "🌿",
      canonicalText(entry.reference.pruning),
      language,
    ),
    section(
      entry,
      "harvest",
      language === "es" ? "Cosecha / uso" : "Harvest / use",
      "🥬",
      canonicalText(entry.reference.harvest),
      language,
    ),
    section(
      entry,
      "problems",
      language === "es" ? "Problemas comunes" : "Common problems",
      "⚠️",
      entry.reference.commonProblems.join(" · ") || null,
      language,
    ),
  ].filter((item): item is DonorGuideSection => Boolean(item));
  const germination = canonicalText(entry.reference.germination);
  const timeline =
    germination || entry.reference.harvest
      ? {
          note:
            language === "es"
              ? "Ventanas publicadas por Gardenpedia; no se convierten en fechas exactas."
              : "Gardenpedia-published windows; not converted into fake exact dates.",
          steps: [
            { label: language === "es" ? "Siembra" : "Sowing", day: "Day 0" },
            ...(germination
              ? [
                  {
                    label: language === "es" ? "Germinación esperada" : "Expected germination",
                    day: germination,
                    backed: entry.reference.sourceIds.length > 0,
                  },
                ]
              : []),
            ...(entry.reference.harvest
              ? [
                  {
                    label: language === "es" ? "Cosecha" : "Harvest",
                    day: entry.reference.harvest,
                    backed: entry.reference.sourceIds.length > 0,
                  },
                ]
              : []),
          ],
          decide:
            entry.reference.harvest ||
            (language === "es"
              ? "Observar el desarrollo y conservar la incertidumbre publicada."
              : "Observe development and preserve published uncertainty."),
        }
      : undefined;
  const visual = visualCatalog[entry.libraryPlantId]?.[0];
  const neighbors = gardenLibraryManifest.neighborRules.researchPairs
    .filter((pair) => pair.a === entry.libraryPlantId || pair.b === entry.libraryPlantId)
    .map((pair) => {
      const id = pair.a === entry.libraryPlantId ? pair.b : pair.a;
      const neighbor = gardenLibraryManifest.entries.find((item) => item.libraryPlantId === id);
      const source = neighbor?.reference.sources.find((item) => item.id === pair.sourceId);
      return neighbor
        ? {
            emoji: CATEGORY_EMOJI[neighbor.category] ?? "🌱",
            name:
              language === "es" ? neighbor.spanishName || neighbor.commonName : neighbor.commonName,
            reason: pair.label,
            action: language === "es" ? "Evidencia explícita" : "Explicit evidence",
            basis: pair.sourceId,
            ...(source
              ? { source: { label: `${source.publisher} · ${source.title}`, url: source.url } }
              : {}),
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  return {
    id: entry.libraryPlantId,
    name: entry.commonName,
    spanishName: entry.spanishName || entry.commonName,
    scientificName: entry.scientificName || "",
    category: entry.category,
    emoji: CATEGORY_EMOJI[entry.category] ?? "🌱",
    summary:
      entry.reference.recommendations[0] ||
      (language === "es"
        ? "La ficha conserva la información canónica disponible y sus áreas pendientes."
        : "This profile preserves the available canonical information and its pending areas."),
    metrics: [
      germination && {
        label: language === "es" ? "Germinación" : "Germination",
        value: germination,
        note: language === "es" ? "Referencia publicada" : "Published reference",
      },
      entry.reference.ph && {
        label: language === "es" ? "pH hidro" : "Hydro pH",
        value: entry.reference.ph,
        note: language === "es" ? "Alcance de la fuente preservado" : "Source scope preserved",
      },
      entry.reference.ec && {
        label: "EC hidro",
        value: entry.reference.ec,
        note:
          language === "es"
            ? "No es una recomendación universal"
            : "Not a universal recommendation",
      },
      entry.reference.harvest && {
        label: language === "es" ? "Cosecha" : "Harvest",
        value: entry.reference.harvest,
        note: language === "es" ? "Guía publicada" : "Published guidance",
      },
    ].filter((item): item is { label: string; value: string; note: string } => Boolean(item)),
    timeline,
    evidence: {
      badge:
        pending === 0 && knownClaims > 0
          ? language === "es"
            ? "Base sólida"
            : "Strong base"
          : pending > 0
            ? language === "es"
              ? "En construcción"
              : "Building"
            : language === "es"
              ? "Base mixta"
              : "Mixed base",
      backed: knownClaims,
      adapted: adaptations,
      pending,
      coverage: sourceCoverage,
    },
    harvestUse: harvestDetail(entry, language),
    neighbors: neighbors.length ? { good: neighbors, avoid: [] } : undefined,
    visualGuide: visual?.sourceUrl
      ? {
          kind: visual.mediaType || "guide",
          tag: language === "es" ? "Acción documentada" : "Documented action",
          publisher: visual.sourceName || "Gardenpedia source",
          title: visual.title?.[language] || visual.title?.en || entry.commonName,
          description: visual.description?.[language] || visual.description?.en || "",
          url: visual.sourceUrl,
        }
      : undefined,
    guides: sections,
  };
}

export const canonicalEntries = gardenLibraryManifest.entries.filter(
  (entry) => entry.status === "active",
);
export const donorPlants = toDonorPlants(canonicalEntries);
export const donorPlantsById = new Map(donorPlants.map((plant) => [plant.id, plant]));

export function findCanonicalEntry(id: string) {
  return canonicalEntries.find((entry) => entry.libraryPlantId === id) ?? null;
}
