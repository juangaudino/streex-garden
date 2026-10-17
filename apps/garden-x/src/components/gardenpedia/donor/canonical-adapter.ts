import { gardenLibraryManifest } from "@/generated/garden-library-manifest";
import { gardenPlantProfileCatalog } from "@/generated/garden-plant-profile-index";
import { gardenSeedProfileIds } from "@/generated/garden-seed-profile-index";
import type { GardenLibraryEntry } from "@/lib/garden-library";
import harvestUseData from "../../../../../../labs/gardenpedia/data/harvest-use-v0.1.json";
import harvestUseRichnessAdditions from "../../../../../../labs/gardenpedia/data/harvest-use-richness-additions.json";
import legacyPlantData from "../../../../../../labs/gardenpedia/data/plants.json";
import legacySpanishTranslations from "../../../../../../labs/gardenpedia/data/translations-es.json";
import visualsData from "../../../../../../labs/gardenpedia/data/visuals.json";
import visualGuidesBatch10 from "../../../../../../labs/gardenpedia/data/visual-guides-batch-10.json";
import editorialScopeBatch100 from "../../../../../../labs/gardenpedia/data/editorial-scope-batch-100.json";
import editorialScopeExtra1 from "../../../../../../labs/gardenpedia/data/editorial-scope-remaining-waves-03-06.json";
import editorialScopeExtra2 from "../../../../../../labs/gardenpedia/data/editorial-scope-remaining-waves-07-12.json";
import editorialScopeExtra3 from "../../../../../../labs/gardenpedia/data/editorial-scope-remaining-waves-13-18.json";
import editorialScopeExtra4 from "../../../../../../labs/gardenpedia/data/editorial-scope-remaining-waves-19-26.json";
import editorialScopeExtra5 from "../../../../../../labs/gardenpedia/data/editorial-scope-remaining-waves-27-29.json";
import editorialScopeExtra6 from "../../../../../../labs/gardenpedia/data/editorial-scope-remaining-waves-30-37.json";
import editorialScopeExtra7 from "../../../../../../labs/gardenpedia/data/editorial-scope-remaining-waves-38-45.json";
import editorialScopeExtra8 from "../../../../../../labs/gardenpedia/data/editorial-scope-remaining-waves-46-53.json";
import editorialScopeExtra9 from "../../../../../../labs/gardenpedia/data/editorial-scope-remaining-waves-54-60.json";
import editorialScopeExtra10 from "../../../../../../labs/gardenpedia/data/editorial-scope-remaining-waves-61-63.json";
import editorialScopeExtra11 from "../../../../../../labs/gardenpedia/data/editorial-scope-base-profiles.json";
import editorialScopeExtra12 from "../../../../../../labs/gardenpedia/data/editorial-scope-current-gardens.json";

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
  avoid?: string | undefined;
  context?: string | undefined;
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
  timeline?:
    | {
        note: string;
        steps: { label: string; day: string; backed?: boolean }[];
        decide: string;
      }
    | undefined;
  evidence: { badge: string; backed: number; adapted: number; pending: number; coverage: string };
  seedProfileAvailable: boolean;
  harvestUse?:
    | {
        ediblePart: string;
        bestUse: string;
        quickUses: string[];
        options: DonorHarvestOption[];
      }
    | undefined;
  neighbors?:
    | {
        good: DonorNeighbor[];
        avoid: DonorNeighbor[];
      }
    | undefined;
  visualGuide?:
    | {
        kind: string;
        tag: string;
        publisher: string;
        title: string;
        description: string;
        url: string;
      }
    | undefined;
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

type PublicPlantProfileSection = {
  evidenceType: "source_backed" | "garden_adaptation" | "needs_validation";
  confidence: "high" | "medium" | "low" | "pending";
  sourceIds: readonly string[];
  en: { short: string; guidance: string; items: readonly string[]; avoid: string; context: string };
  es: { short: string; guidance: string; items: readonly string[]; avoid: string; context: string };
};
type PublicPlantProfile = {
  summary: { en: string; es: string };
  metrics: {
    en: readonly { label: string; value: string; note: string }[];
    es: readonly { label: string; value: string; note: string }[];
  };
  sections: Record<string, PublicPlantProfileSection>;
};

const harvestDocument = harvestUseData as {
  plants?: Record<string, HarvestRecord>;
  sources?: Record<string, { publisher: string; title: string; url: string }>;
};
const harvestRichnessDocument = harvestUseRichnessAdditions as {
  plants: Record<string, HarvestRecord>;
  sources: Record<string, { publisher: string; title: string; url: string }>;
};
const harvestCatalog: Record<string, HarvestRecord> = { ...(harvestDocument.plants ?? {}), ...harvestRichnessDocument.plants };
const harvestSources = { ...(harvestDocument.sources ?? {}), ...harvestRichnessDocument.sources };
const visualCatalog: Record<string, VisualRecord[]> = {
  ...(visualsData as Record<string, VisualRecord[]>),
  ...(visualGuidesBatch10 as Record<string, VisualRecord[]>),
};
const legacyCatalog = new Map((legacyPlantData as LegacyPlant[]).map((plant) => [plant.id, plant]));
const legacySpanishCatalog = legacySpanishTranslations as Record<string, SpanishTranslation>;
const publicPlantProfiles = gardenPlantProfileCatalog as Record<string, PublicPlantProfile>;
type EditorialScopeSection = { context: { en: string; es: string }; action?: { en: string; es: string } };
const editorialScopeProfiles: Record<string, { sections: Record<string, EditorialScopeSection> }> = {
  ...(editorialScopeBatch100.profiles as Record<string, { sections: Record<string, EditorialScopeSection> }>),
  ...(editorialScopeExtra1.profiles as Record<string, { sections: Record<string, EditorialScopeSection> }>),
  ...(editorialScopeExtra2.profiles as Record<string, { sections: Record<string, EditorialScopeSection> }>),
  ...(editorialScopeExtra3.profiles as Record<string, { sections: Record<string, EditorialScopeSection> }>),
  ...(editorialScopeExtra4.profiles as Record<string, { sections: Record<string, EditorialScopeSection> }>),
  ...(editorialScopeExtra5.profiles as Record<string, { sections: Record<string, EditorialScopeSection> }>),
  ...(editorialScopeExtra6.profiles as Record<string, { sections: Record<string, EditorialScopeSection> }>),
  ...(editorialScopeExtra7.profiles as Record<string, { sections: Record<string, EditorialScopeSection> }>),
  ...(editorialScopeExtra8.profiles as Record<string, { sections: Record<string, EditorialScopeSection> }>),
  ...(editorialScopeExtra9.profiles as Record<string, { sections: Record<string, EditorialScopeSection> }>),
  ...(editorialScopeExtra10.profiles as Record<string, { sections: Record<string, EditorialScopeSection> }>),
  ...(editorialScopeExtra11.profiles as Record<string, { sections: Record<string, EditorialScopeSection> }>),
  ...(editorialScopeExtra12.profiles as Record<string, { sections: Record<string, EditorialScopeSection> }>),
};
export const seedProfileIds = new Set<string>(gardenSeedProfileIds);
export const seedProfileCount = gardenSeedProfileIds.length;

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
  legumes: "🫘",
  "cover crops": "🌱",
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
    if (Array.isArray(record["evidence"])) {
      for (const item of record["evidence"]) {
        if (item && typeof item === "object") {
          const evidence = item as Record<string, unknown>;
          if (
            evidence["evidenceType"] === "source_backed" ||
            evidence["evidenceType"] === "garden_adaptation"
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
    if (typeof record["status"] === "string") records.push(record["status"]);
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

  // Outdoor exposure (full sun, partial sun/shade, or shade) is not an indoor
  // grow-light intensity. Only an explicit indoor/intensity statement above
  // can classify this independent dimension.
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
  if (!record) return undefined;
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
    identity: { title: language === "es" ? "Identidad" : "Identity", emoji: "🌱" },
    identityReview: {
      title: language === "es" ? "Revisión de identidad" : "Identity review",
      emoji: "🔎",
    },
    cultivation: { title: language === "es" ? "Cultivo" : "Cultivation", emoji: "🪴" },
    care: { title: language === "es" ? "Cuidados" : "Care", emoji: "🌿" },
    growth: { title: language === "es" ? "Crecimiento" : "Growth", emoji: "🌱" },
    maintenance: { title: language === "es" ? "Mantenimiento" : "Maintenance", emoji: "🧤" },
    needsValidation: { title: language === "es" ? "Por validar" : "Needs validation", emoji: "🧭" },
    propagation: { title: language === "es" ? "Propagación" : "Propagation", emoji: "🌱" },
    safety: { title: language === "es" ? "Seguridad" : "Safety", emoji: "⚠️" },
    support: { title: language === "es" ? "Soporte" : "Support", emoji: "🪴" },
    uses: { title: language === "es" ? "Usos" : "Uses", emoji: "🍽️" },
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
  const publicProfile = publicPlantProfiles[entry.libraryPlantId];
  const publicSections = Object.entries(publicProfile?.sections ?? {}).map(([id, guide]) => {
    const label = guideLabels[id] ?? { title: id, emoji: "🌱" };
    const localized = language === "es" ? guide.es : guide.en;
    const scoped = editorialScopeProfiles[entry.libraryPlantId]?.sections[id];
    const localizedAction = scoped?.action?.[language];
    const localizedContext = scoped?.context?.[language];
    const backing: DonorBacking =
      guide.evidenceType === "garden_adaptation"
        ? "garden"
        : guide.evidenceType === "needs_validation"
          ? "pending"
          : "source";
    const confidence: DonorConfidence =
      guide.confidence === "high"
        ? "alta"
        : guide.confidence === "medium"
          ? "media"
          : guide.confidence === "low"
            ? "baja"
            : "pendiente";
    return {
      id,
      emoji: label.emoji,
      title: label.title,
      subtitle:
        localized.short ||
        localized.guidance ||
        (language === "es" ? "Pendiente de validación." : "Pending validation."),
      body:
        localized.guidance ||
        localized.short ||
        (language === "es"
          ? "No establecido por la evidencia actual."
          : "Not established by current evidence."),
      bullets: localized.items.length ? [...localized.items] : localizedAction ? [localizedAction] : [],
      avoid: localized.avoid || undefined,
      context: localized.context || localizedContext || undefined,
      backing,
      confidence,
      sources: sourceRefsForIds(entry, guide.sourceIds),
    } satisfies DonorGuideSection;
  });
  const sections = publicProfile
    ? publicSections
    : legacySections.length
      ? legacySections
      : fallbackSections;
  // Germination belongs to Seed Profile V0; do not turn it into a Plant lifecycle timeline.
  const timeline = undefined;
  const visual = visualCatalog[entry.libraryPlantId]?.[0];
  const neighbors = gardenLibraryManifest.neighborRules.researchPairs
    .filter((pair) => pair.a === entry.libraryPlantId || pair.b === entry.libraryPlantId)
    .map((pair) => {
      const id = pair.a === entry.libraryPlantId ? pair.b : pair.a;
      const neighbor = (gardenLibraryManifest.entries as readonly GardenLibraryEntry[]).find(
        (item) => item.libraryPlantId === id,
      );
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
      publicProfile?.summary[language] ||
      (language === "es" ? legacySpanish?.summary : legacy?.summary) ||
      entry.reference.recommendations[0] ||
      (language === "es"
        ? "La ficha conserva la información canónica disponible y sus áreas pendientes."
        : "This profile preserves the available canonical information and its pending areas."),
    metrics: publicProfile
      ? [...publicProfile.metrics[language]]
      : legacy && (language === "es" ? legacySpanish?.metrics : legacy.metrics)
        ? (language === "es" ? legacySpanish?.metrics : legacy.metrics)!
        : [
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
const canonicalIdByAlias = new Map(
  gardenLibraryManifest.identityAliases.map((alias) => [alias.aliasId, alias.canonicalPlantId]),
);

export function findCanonicalEntry(id: string) {
  const canonicalId = canonicalIdByAlias.get(id) ?? id;
  return canonicalEntries.find((entry) => entry.libraryPlantId === canonicalId) ?? null;
}
