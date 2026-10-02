import { gardenLibraryManifest } from "@/generated/garden-library-manifest";
import type { GardenLibraryEntry } from "@/lib/garden-library";
import harvestUseData from "../../../../../../labs/gardenpedia/data/harvest-use-v0.1.json";
import legacyPlantData from "../../../../../../labs/gardenpedia/data/plants.json";
import legacySpanishTranslations from "../../../../../../labs/gardenpedia/data/translations-es.json";
import seedProfilesV0 from "../../../../../../labs/gardenpedia/data/seed-profiles-v0.json";
import seedProfilesWave1 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-1.json";
import seedProfilesWave2 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-2.json";
import seedProfilesWave3 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-3.json";
import seedProfilesWave4 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-4.json";
import visualsData from "../../../../../../labs/gardenpedia/data/visuals.json";

export type DonorSourceRef = { label: string; url: string };
export type DonorBacking = "source" | "garden" | "pending";
export type DonorConfidence = "alta" | "media" | "baja" | "pendiente";
export type LightRequirement = "high" | "medium" | "low" | "unknown";
/** @deprecated Use LightRequirement; retained for callers from the prior two-axis pass. */
export type IndoorLightRequirement = LightRequirement;
export type OutdoorExposure = "full_sun" | "partial_sun" | "partial_shade" | "shade" | "unknown";

export type DonorPlant = {
  id: string;
  name: string;
  spanishName: string;
  scientificName: string;
  variety: string | null;
  category: string;
  emoji: string;
  tags: string[];
  /** All supported growing-phase outdoor exposures, kept separate from indoor intensity. */
  outdoorExposures: readonly OutdoorExposure[];
  /** Conservative growing-light tier derived from explicit canonical light evidence. */
  lightRequirement: LightRequirement;
  /** User-facing category key; fruiting and fruits intentionally share one filter. */
  categoryKey: string;
  hydroponicSuitability: "compatible" | "conditional" | "incompatible" | "unknown" | "pending";
  growthHabits: readonly string[];
  matureSizeKnown: boolean;
  harvestable: boolean;
  seedProfileAvailable: boolean;
  evidence: EvidenceHealth;
  inventory: "none";
  sourceCount: number;
  /** Retained for donor compatibility; never used as agronomic evidence. */
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
  rank: "Mejor opción" | "Buena opción" | "Posible" | "Best option" | "Good option" | "Possible";
  title: string;
  lead: string;
  steps: string[];
  sources: DonorSourceRef[];
};

export type DonorNeighbor = {
  emoji: string;
  name: string;
  reason: string;
  action: string;
  basis: string;
  source?: DonorSourceRef;
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
  seedProfileAvailable: boolean;
  harvestUse?: {
    ediblePart: string;
    bestUse: string;
    quickUses: string[];
    options: DonorHarvestOption[];
  };
  neighbors?: {
    good: DonorNeighbor[];
    avoid: DonorNeighbor[];
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
  methods?: {
    id: string;
    icon: string;
    status: "best" | "good" | "possible";
    title: { en?: string; es?: string };
    summary: { en?: string; es?: string };
    steps: { en?: string[]; es?: string[] };
    sourceIds: string[];
  }[];
};

type LegacyGuide = {
  short?: string;
  guidance?: string;
  items?: string[];
  avoid?: string[];
  context?: string;
  evidenceType?: "source_backed" | "garden_adaptation";
  confidence?: "high" | "medium" | "low";
  sourceIds?: string[];
};

type LegacyPlant = {
  id: string;
  summary?: string;
  metrics?: { label: string; value: string; note: string }[];
  sections?: Record<string, LegacyGuide>;
};

type SpanishTranslation = {
  summary?: string;
  metrics?: { label: string; value: string; note: string }[];
  sections?: Record<
    string,
    { short?: string; guidance?: string; items?: string[]; avoid?: string[]; context?: string }
  >;
};

type VisualRecord = {
  mediaType?: string;
  title?: { en?: string; es?: string };
  description?: { en?: string; es?: string };
  sourceName?: string;
  sourceUrl?: string;
};

const harvestDocument = harvestUseData as {
  plants?: Record<string, HarvestRecord>;
  sources?: Record<string, { publisher: string; title: string; url: string }>;
};
const harvestCatalog = harvestDocument.plants ?? {};
const harvestSources = harvestDocument.sources ?? {};
const visualCatalog = visualsData as Record<string, VisualRecord[]>;
const legacyCatalog = new Map((legacyPlantData as LegacyPlant[]).map((plant) => [plant.id, plant]));
const legacySpanishCatalog = legacySpanishTranslations as Record<string, SpanishTranslation>;
const seedProfileCatalogs = [
  seedProfilesV0,
  seedProfilesWave1,
  seedProfilesWave2,
  seedProfilesWave3,
  seedProfilesWave4,
] as const;
export const seedProfileIds = new Set(
  seedProfileCatalogs.flatMap((catalog) => Object.keys(catalog.profiles)),
);
export const seedProfileCount = seedProfileIds.size;

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

function outdoorExposureLevels(entry: GardenLibraryEntry): OutdoorExposure[] {
  const requirements =
    entry.compatibilityProfile?.light.status === "known"
      ? entry.compatibilityProfile.light.value
          .filter((item) => item.phase === "growing")
          .map((item) => item.requirement)
      : [];
  const levels: OutdoorExposure[] = requirements.flatMap((requirement) =>
    "kind" in requirement && (requirement.kind === "full_sun" || requirement.kind === "partial_sun")
      ? [requirement.kind]
      : [],
  );
  const legacyLight = entry.reference.light?.trim().toLocaleLowerCase("en") ?? "";
  if (/\bpartial\s+shade\b|\bpart\s+shade\b/.test(legacyLight)) levels.push("partial_shade");
  if (/^shade$/.test(legacyLight)) levels.push("shade");
  return levels.length ? [...new Set(levels)] : ["unknown"];
}

function lightRequirement(entry: GardenLibraryEntry): LightRequirement {
  // Seed Profile light fields describe germination light/dark handling and are not
  // consulted here. Full sun alone is intentionally insufficient for a tier.
  // A tier is published only when canonical evidence expresses intensity,
  // photoperiod, or tolerance for lower-than-full exposure.
  const explicit = entry.reference.light?.trim().toLocaleLowerCase("en") ?? "";
  if (/\bhigh\s+light\b|\bluz\s+alta\b|(?:≥|>=)\s*14\s*h(?:ours?)?\s*\/\s*day/.test(explicit)) {
    return "high";
  }
  if (/\bmedium\s+light\b|\bluz\s+media\b/.test(explicit)) return "medium";
  if (/\blow\s+light\b|\bluz\s+baja\b/.test(explicit)) return "low";

  const growingRequirements =
    entry.compatibilityProfile?.light.status === "known"
      ? entry.compatibilityProfile.light.value.filter((item) => item.phase === "growing")
      : [];
  const hasPartialExposure = growingRequirements.some(
    (item) => "kind" in item.requirement && item.requirement.kind === "partial_sun",
  );
  const hasPartialShadeText = /\bpartial\s+shade\b|\bpart\s+shade\b/.test(explicit);
  if (hasPartialExposure || hasPartialShadeText) return "medium";

  // A growing-phase shade value is retained as outdoor evidence, but is not
  // silently promoted to low indoor light without an explicit intensity claim.
  return "unknown";
}

export function normalizeCategory(category: string) {
  return category === "fruiting" ? "fruits" : category;
}

/**
 * Normalize only the published outdoor-exposure vocabulary and its explicit
 * aliases. Indoor intensity has a separate normalizer and filter.
 */
export function normalizeOutdoorExposureFilter(value: string): OutdoorExposure | "all" | null {
  const normalized = value
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[-\s]+/g, "_");
  if (normalized === "all" || normalized === "any" || normalized === "any_outdoor_exposure") {
    return "all";
  }
  if (normalized === "full_sun" || normalized === "sun") return "full_sun";
  if (normalized === "partial_sun") return "partial_sun";
  if (normalized === "partial_shade" || normalized === "part_shade") return "partial_shade";
  if (normalized === "shade") return "shade";
  if (
    normalized === "unknown" ||
    normalized === "pending" ||
    normalized === "needs_validation" ||
    normalized === "not_established" ||
    normalized === "light_not_established"
  ) {
    return "unknown";
  }
  return null;
}

export function normalizeLightFilter(value: string): LightRequirement | "all" | null {
  const normalized = value
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[-\s]+/g, "_");
  if (normalized === "all" || normalized === "any" || normalized === "any_light") return "all";
  if (normalized === "high" || normalized === "high_light" || normalized === "luz_alta") {
    return "high";
  }
  if (normalized === "medium" || normalized === "medium_light" || normalized === "luz_media") {
    return "medium";
  }
  if (normalized === "low" || normalized === "low_light" || normalized === "luz_baja") {
    return "low";
  }
  if (
    normalized === "unknown" ||
    normalized === "pending" ||
    normalized === "needs_validation" ||
    normalized === "not_established" ||
    normalized === "light_not_established"
  ) {
    return "unknown";
  }
  return null;
}

/** @deprecated Use normalizeLightFilter. */
export const normalizeIndoorLightFilter = normalizeLightFilter;

function hydroponicSuitability(entry: GardenLibraryEntry): DonorPlant["hydroponicSuitability"] {
  return entry.compatibilityProfile?.hydroponicSuitability.status ?? "unknown";
}

function growthHabits(entry: GardenLibraryEntry) {
  const habit = entry.compatibilityProfile?.growthHabits;
  return habit?.status === "known" ? [...habit.value] : [];
}

function matureSizeKnown(entry: GardenLibraryEntry) {
  const size = entry.compatibilityProfile?.matureSize;
  return size?.height.status === "known" || size?.spread.status === "known";
}

function harvestable(entry: GardenLibraryEntry) {
  return Boolean(
    entry.reference.harvest ||
    entry.lifeCapabilities?.harvestable_leaf?.status === "known" ||
    entry.lifeCapabilities?.harvestable_fruit?.status === "known",
  );
}

export type EvidenceHealth = {
  backed: number;
  adapted: number;
  pending: number;
  assessed: number;
  coverage: number;
};

function evidenceHealth(entry: GardenLibraryEntry): EvidenceHealth {
  const records = evidenceRecords(entry);
  const legacy = legacyCatalog.get(entry.libraryPlantId);
  for (const guide of Object.values(legacy?.sections ?? {})) {
    if (guide.evidenceType === "source_backed" || guide.evidenceType === "garden_adaptation") {
      records.push({
        evidenceType: guide.evidenceType,
        confidence: guide.confidence ?? "medium",
        sourceIds: guide.sourceIds ?? [],
      });
    }
  }
  const pending = statusEvidence(entry).filter(
    (status) => status === "pending" || status === "unknown",
  ).length;
  const backed = records.filter((item) => item.evidenceType === "source_backed").length;
  const adapted = records.filter((item) => item.evidenceType === "garden_adaptation").length;
  const assessed = backed + adapted + pending;
  return {
    backed,
    adapted,
    pending,
    assessed,
    coverage: assessed ? Math.round((backed / assessed) * 100) : 0,
  };
}

export function toDonorPlants(entries: readonly GardenLibraryEntry[]): DonorPlant[] {
  return entries.map((entry) => {
    const evidence = evidenceHealth(entry);
    const sourceCount = new Set(entry.reference.sourceIds).size;
    return {
      id: entry.libraryPlantId,
      name: entry.commonName,
      spanishName: entry.spanishName || entry.commonName,
      scientificName: entry.scientificName || "",
      variety: entry.cultivar,
      category: entry.category,
      emoji: CATEGORY_EMOJI[entry.category] ?? "🌱",
      tags: entry.aliases.filter((alias) => !PUBLIC_TAG_EXCLUSIONS.test(alias)),
      outdoorExposures: outdoorExposureLevels(entry),
      lightRequirement: lightRequirement(entry),
      categoryKey: normalizeCategory(entry.category),
      hydroponicSuitability: hydroponicSuitability(entry),
      growthHabits: growthHabits(entry),
      matureSizeKnown: matureSizeKnown(entry),
      harvestable: harvestable(entry),
      seedProfileAvailable: seedProfileIds.has(entry.libraryPlantId),
      evidence,
      inventory: "none",
      sourceCount,
      guideCompletion: evidence.coverage,
    };
  });
}

function sourceRefs(entry: GardenLibraryEntry): DonorSourceRef[] {
  return entry.reference.sources.map((source) => ({
    label: `${source.publisher} · ${source.title}`,
    url: source.url,
  }));
}

function sourceRefsForIds(entry: GardenLibraryEntry, sourceIds: readonly string[]) {
  const wanted = new Set(sourceIds);
  return entry.reference.sources
    .filter((source) => wanted.has(source.id))
    .map((source) => ({ label: `${source.publisher} · ${source.title}`, url: source.url }));
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
  const options = (record?.methods ?? []).map((method) => {
    const title = method.title[locale] || method.title.en || method.id;
    const steps = method.steps[locale] || method.steps.en || [];
    const sourceRefs = method.sourceIds
      .map((sourceId) => {
        const source = harvestSources[sourceId];
        return source
          ? { label: `${source.publisher} · ${source.title}`, url: source.url }
          : undefined;
      })
      .filter((source): source is DonorSourceRef => Boolean(source));
    const rank: DonorHarvestOption["rank"] =
      method.status === "best"
        ? language === "es"
          ? "Mejor opción"
          : "Best option"
        : method.status === "good"
          ? language === "es"
            ? "Buena opción"
            : "Good option"
          : language === "es"
            ? "Posible"
            : "Possible";
    return {
      emoji: method.icon,
      rank,
      title,
      lead: method.summary[locale] || method.summary.en || "",
      steps,
      sources: sourceRefs,
    };
  });
  return { ediblePart, bestUse, quickUses, options };
}

export function buildDonorPlantDetail(
  entry: GardenLibraryEntry,
  language: "en" | "es",
): DonorPlantDetail {
  const health = evidenceHealth(entry);
  const sources = sourceRefs(entry);
  const sourceCoverage = health.assessed
    ? `${health.backed}/${health.assessed} ${language === "es" ? "unidades" : "units"}`
    : language === "es"
      ? "sin unidades evaluadas"
      : "no assessed units";
  const fallbackSections = [
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
  const legacy = legacyCatalog.get(entry.libraryPlantId);
  const legacySpanish = legacySpanishCatalog[entry.libraryPlantId];
  const guideLabels: Record<string, { title: string; emoji: string }> = {
    germination: { title: language === "es" ? "Germinación" : "Germination", emoji: "🌱" },
    thinning: { title: language === "es" ? "Raleo" : "Thinning", emoji: "✂️" },
    pruning: { title: language === "es" ? "Poda" : "Pruning", emoji: "🌿" },
    harvest: { title: language === "es" ? "Cosecha" : "Harvest", emoji: "🥬" },
    flowering: { title: language === "es" ? "Floración" : "Flowering", emoji: "🌼" },
    hydroponics: { title: language === "es" ? "Hidroponía" : "Hydroponics", emoji: "💧" },
    problems: { title: language === "es" ? "Problemas comunes" : "Common problems", emoji: "⚠️" },
  };
  const legacySections = Object.entries(legacy?.sections ?? {}).map(([id, guide]) => {
    const translated = legacySpanish?.sections?.[id];
    const label = guideLabels[id] ?? { title: id, emoji: "🌱" };
    const value = language === "es" ? (translated ?? guide) : guide;
    const sourceIds = guide.sourceIds ?? [];
    const guideSources = sourceRefsForIds(entry, sourceIds);
    const resolvedSources = guideSources.length ? guideSources : sources;
    return {
      id,
      emoji: label.emoji,
      title: label.title,
      subtitle: value.short || value.guidance || "",
      body: value.guidance || value.short || "",
      bullets: value.items ?? [],
      avoid: value.avoid?.join(" "),
      context: value.context,
      backing: guide.evidenceType === "garden_adaptation" ? "garden" : "source",
      confidence: confidenceLabel(guide.confidence),
      sources: resolvedSources,
    } satisfies DonorGuideSection;
  });
  const sections = legacySections.length ? legacySections : fallbackSections;
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
      (language === "es" ? legacySpanish?.summary : legacy?.summary) ||
      entry.reference.recommendations[0] ||
      (language === "es"
        ? "La ficha conserva la información canónica disponible y sus áreas pendientes."
        : "This profile preserves the available canonical information and its pending areas."),
    metrics:
      legacy && (language === "es" ? legacySpanish?.metrics : legacy.metrics)
        ? (language === "es" ? legacySpanish?.metrics : legacy.metrics)!
        : [
            germination && {
              label: language === "es" ? "Germinación" : "Germination",
              value: germination,
              note: language === "es" ? "Referencia publicada" : "Published reference",
            },
            entry.reference.ph && {
              label: language === "es" ? "pH hidro" : "Hydro pH",
              value: entry.reference.ph,
              note:
                language === "es" ? "Alcance de la fuente preservado" : "Source scope preserved",
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
        health.pending === 0 && health.backed > 0
          ? language === "es"
            ? "Base sólida"
            : "Strong base"
          : health.pending > 0
            ? language === "es"
              ? "En construcción"
              : "Building"
            : language === "es"
              ? "Base mixta"
              : "Mixed base",
      backed: health.backed,
      adapted: health.adapted,
      pending: health.pending,
      coverage: sourceCoverage,
    },
    seedProfileAvailable: seedProfileIds.has(entry.libraryPlantId),
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
