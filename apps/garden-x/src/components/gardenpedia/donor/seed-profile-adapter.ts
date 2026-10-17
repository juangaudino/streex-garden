import { gardenLibraryManifest } from "@/generated/garden-library-manifest";
import type { GardenLibraryEntry } from "@/lib/garden-library";

import seedProfilesV0 from "../../../../../../labs/gardenpedia/data/seed-profiles-v0.json";
import seedProfilesWave1 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-1.json";
import seedProfilesWave2 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-2.json";
import seedProfilesWave3 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-3.json";
import seedProfilesWave4 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-4.json";
import seedProfilesWave5 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-5.json";
import seedProfilesWave6 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-6.json";
import seedProfilesWave7 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-7.json";
import seedProfilesWave8 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-8.json";
import seedProfilesWave9 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-9.json";
import seedProfilesWave10 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-10.json";
import seedProfilesWave13 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-13.json";
import seedProfilesWave15 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-15.json";
import seedProfilesWave18 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-18.json";
import seedProfilesWave19 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-19.json";
import seedProfilesWave20 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-20.json";
import seedProfilesWave21 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-21.json";
import seedProfilesWave23 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-23.json";
import seedProfilesWave24 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-24.json";
import seedProfilesWave25 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-25.json";
import seedProfilesWave26 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-26.json";
import seedProfilesWave28 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-28.json";
import seedProfilesWave29 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-29.json";
import seedProfilesWave30 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-30.json";
import seedProfilesWave31 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-31.json";
import seedProfilesWave32 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-32.json";
import seedProfilesWave37 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-37.json";
import seedProfilesWave43 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-43.json";
import seedProfilesWave44 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-44.json";
import seedProfilesWave45 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-45.json";
import seedProfilesWave47 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-47.json";
import seedProfilesWave48 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-48.json";
import seedProfilesWave49 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-49.json";
import seedProfilesWave53 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-53.json";
import seedProfilesWave54 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-54.json";
import seedProfilesWave56 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-56.json";
import seedProfilesWave57 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-57.json";
import seedProfilesWave58 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-58.json";
import seedProfilesWave59 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-59.json";
import seedProfilesWave60 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-60.json";
import seedProfilesWave61 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-61.json";
import seedProfilesWave62 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-62.json";
import seedProfilesWave63 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-63.json";
import sources from "../../../../../../labs/gardenpedia/data/sources.json";
import sourcesOwnedSeeds from "../../../../../../labs/gardenpedia/data/sources-owned-seeds.json";
import sourcesWave1 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-1.json";
import sourcesWave2 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-2.json";
import sourcesWave3 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-3.json";
import sourcesWave4 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-4.json";
import sourcesWave5 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-5.json";
import sourcesWave6 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-6.json";
import sourcesWave7 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-7.json";
import sourcesWave8 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-8.json";
import sourcesWave9 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-9.json";
import sourcesWave10 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-10.json";
import sourcesWave11 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-11.json";
import sourcesWave12 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-12.json";
import sourcesWave13 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-13.json";
import sourcesWave14 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-14.json";
import sourcesWave15 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-15.json";
import sourcesWave16 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-16.json";
import sourcesWave17 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-17.json";
import sourcesWave18 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-18.json";
import sourcesWave19 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-19.json";
import sourcesWave20 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-20.json";
import sourcesWave21 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-21.json";
import sourcesWave22 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-22.json";
import sourcesWave23 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-23.json";
import sourcesWave24 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-24.json";
import sourcesWave25 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-25.json";
import sourcesWave26 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-26.json";
import sourcesWave28 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-28.json";
import sourcesWave29 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-29.json";
import sourcesWave30 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-30.json";
import sourcesWave31 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-31.json";
import sourcesWave32 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-32.json";
import sourcesWave33 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-33.json";
import sourcesWave34 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-34.json";
import sourcesWave35 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-35.json";
import sourcesWave36 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-36.json";
import sourcesWave37 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-37.json";
import sourcesWave43 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-43.json";
import sourcesWave44 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-44.json";
import sourcesWave45 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-45.json";
import sourcesWave46 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-46.json";
import sourcesWave47 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-47.json";
import sourcesWave48 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-48.json";
import sourcesWave49 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-49.json";
import sourcesWave53 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-53.json";
import sourcesWave54 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-54.json";
import sourcesWave56 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-56.json";
import sourcesWave57 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-57.json";
import sourcesWave58 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-58.json";
import sourcesWave60 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-60.json";
import sourcesWave61 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-61.json";
import sourcesWave62 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-62.json";
import sourcesWave63 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-63.json";
import {
  seedProfileContentLevel,
  seedProfileSummaryForDisplay,
  type SeedProfileContentLevel,
} from "./seed-profile-quality";

export type SeedProfileLanguage = "en" | "es";
type Localized = { en: string; es: string };
type Confidence = "high" | "medium" | "low" | "pending";
type EvidenceType = "source_backed" | "garden_adaptation" | "needs_validation";

type SeedFact = {
  key: string;
  label: Localized;
  value: Localized;
  note: Localized;
  evidenceType: EvidenceType;
  confidence: Confidence;
  sourceIds: readonly string[];
};

type SeedSectionItem = {
  text: Localized;
  evidenceType: EvidenceType;
  confidence: Confidence;
  sourceIds: readonly string[];
};

type SeedSection = {
  key: string;
  title: Localized;
  icon: string;
  short: Localized;
  guidance: Localized;
  items: readonly SeedSectionItem[];
  evidenceType: EvidenceType;
  confidence: Confidence;
  sourceIds: readonly string[];
};

type SeedProfileRecord = {
  plantIdentityId: string;
  label: Localized;
  summary: Localized;
  quickFacts: readonly SeedFact[];
  sections: readonly SeedSection[];
};

type SeedProfileBundle = { profiles: Record<string, SeedProfileRecord> };
type SourceRecord = { id: string; publisher: string; title: string; url: string };

const profileBundles = [
  seedProfilesV0,
  seedProfilesWave1,
  seedProfilesWave2,
  seedProfilesWave3,
  seedProfilesWave4,
  seedProfilesWave5,
  seedProfilesWave6,
  seedProfilesWave7,
  seedProfilesWave8,
  seedProfilesWave9,
  seedProfilesWave10,
  seedProfilesWave13,
  seedProfilesWave15,
  seedProfilesWave18,
  seedProfilesWave19,
  seedProfilesWave20,
  seedProfilesWave21,
  seedProfilesWave23,
  seedProfilesWave24,
  seedProfilesWave25,
  seedProfilesWave26,
  seedProfilesWave28,
  seedProfilesWave29,
  seedProfilesWave30,
  seedProfilesWave31,
  seedProfilesWave32,
  seedProfilesWave37,
  seedProfilesWave43,
  seedProfilesWave44,
  seedProfilesWave45,
  seedProfilesWave47,
  seedProfilesWave48,
  seedProfilesWave49,
  seedProfilesWave53,
  seedProfilesWave54,
  seedProfilesWave56,
  seedProfilesWave57,
  seedProfilesWave58,
  seedProfilesWave59,
  seedProfilesWave60,
  seedProfilesWave61,
  seedProfilesWave62,
  seedProfilesWave63,
] as readonly SeedProfileBundle[];

const profileById = new Map<string, SeedProfileRecord>();
const canonicalIdByAlias = new Map(
  gardenLibraryManifest.identityAliases.map((alias) => [alias.aliasId, alias.canonicalPlantId]),
);
for (const bundle of profileBundles) {
  for (const [id, profile] of Object.entries(bundle.profiles)) {
    if (canonicalIdByAlias.has(id)) continue;
    profileById.set(id, { ...profile, plantIdentityId: id });
  }
}
for (const bundle of profileBundles) {
  for (const [id, profile] of Object.entries(bundle.profiles)) {
    const canonicalId = canonicalIdByAlias.get(id);
    if (canonicalId && !profileById.has(canonicalId)) {
      profileById.set(canonicalId, {
        ...profile,
        plantIdentityId: canonicalId,
      });
    }
  }
}

const sourceById = new Map<string, SourceRecord>();
for (const source of [
  sources,
  sourcesOwnedSeeds,
  sourcesWave1,
  sourcesWave2,
  sourcesWave3,
  sourcesWave4,
  sourcesWave5,
  sourcesWave6,
  sourcesWave7,
  sourcesWave8,
  sourcesWave9,
  sourcesWave10,
  sourcesWave11,
  sourcesWave12,
  sourcesWave13,
  sourcesWave14,
  sourcesWave15,
  sourcesWave16,
  sourcesWave17,
  sourcesWave18,
  sourcesWave19,
  sourcesWave20,
  sourcesWave21,
  sourcesWave22,
  sourcesWave23,
  sourcesWave24,
  sourcesWave25,
  sourcesWave26,
  sourcesWave28,
  sourcesWave29,
  sourcesWave30,
  sourcesWave31,
  sourcesWave32,
  sourcesWave33,
  sourcesWave34,
  sourcesWave35,
  sourcesWave36,
  sourcesWave37,
  sourcesWave43,
  sourcesWave44,
  sourcesWave45,
  sourcesWave46,
  sourcesWave47,
  sourcesWave48,
  sourcesWave49,
  sourcesWave53,
  sourcesWave54,
  sourcesWave56,
  sourcesWave57,
  sourcesWave58,
  sourcesWave60,
  sourcesWave61,
  sourcesWave62,
  sourcesWave63,
].flat()) {
  sourceById.set(source.id, source);
}

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
};

export type SeedSourceRef = { id: string; label: string; url: string };

export type SeedMetricViewModel = {
  key: string;
  label: string;
  value: string;
  note: string;
  evidenceType: EvidenceType;
  confidence: Confidence;
  sourceIds: readonly string[];
};

export type SeedStepViewModel = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  body: string;
  bullets: readonly {
    text: string;
    evidenceType: EvidenceType;
    confidence: Confidence;
    sourceIds: readonly string[];
  }[];
  backing: "source" | "garden" | "pending";
  confidence: Confidence;
  sources: readonly SeedSourceRef[];
};

export type SeedProfileViewModel = {
  id: string;
  plantIdentityId: string;
  name: string;
  spanishName: string;
  scientificName: string;
  family: string | null;
  category: string;
  emoji: string;
  summary: string;
  contentLevel: SeedProfileContentLevel;
  metrics: readonly SeedMetricViewModel[];
  protocol: readonly SeedStepViewModel[];
  sources: readonly SeedSourceRef[];
  plantHref: string;
  evidence: {
    sourceBacked: number;
    gardenAdaptation: number;
    needsValidation: number;
  };
};

export const seedProfileIds = new Set(profileById.keys());
export const seedProfileCount = seedProfileIds.size;

export const canonicalSeedEntries = gardenLibraryManifest.entries.filter(
  (entry) => entry.status === "active" && seedProfileIds.has(entry.libraryPlantId),
);

function localize(value: Localized, language: SeedProfileLanguage) {
  return value[language] || value.en || value.es;
}

function backingFor(evidenceType: EvidenceType): SeedStepViewModel["backing"] {
  if (evidenceType === "source_backed") return "source";
  if (evidenceType === "garden_adaptation") return "garden";
  return "pending";
}

function sourceRefs(entry: GardenLibraryEntry, sourceIds: readonly string[]): SeedSourceRef[] {
  const wanted = new Set(sourceIds);
  const records = new Map<string, SourceRecord>();
  for (const source of entry.reference.sources) records.set(source.id, source);
  for (const id of wanted) {
    const source = sourceById.get(id);
    if (source) records.set(id, source);
  }
  return [...wanted]
    .map((id) => records.get(id))
    .filter((source): source is SourceRecord => Boolean(source))
    .map((source) => ({
      id: source.id,
      label: `${source.publisher} · ${source.title}`,
      url: source.url,
    }));
}

function allProfileSourceIds(profile: SeedProfileRecord) {
  return [
    ...profile.quickFacts.flatMap((fact) => fact.sourceIds),
    ...profile.sections.flatMap((section) => [
      ...section.sourceIds,
      ...section.items.flatMap((item) => item.sourceIds),
    ]),
  ];
}

function evidenceCounts(profile: SeedProfileRecord) {
  const types = [
    ...profile.quickFacts.map((fact) => fact.evidenceType),
    ...profile.sections.flatMap((section) => [
      section.evidenceType,
      ...section.items.map((item) => item.evidenceType),
    ]),
  ];
  return {
    sourceBacked: types.filter((type) => type === "source_backed").length,
    gardenAdaptation: types.filter((type) => type === "garden_adaptation").length,
    needsValidation: types.filter((type) => type === "needs_validation").length,
  };
}

export function findSeedProfile(id: string) {
  return profileById.get(canonicalIdByAlias.get(id) ?? id) ?? null;
}

export function buildSeedProfile(
  entry: GardenLibraryEntry,
  language: SeedProfileLanguage,
): SeedProfileViewModel | null {
  const profile = profileById.get(entry.libraryPlantId);
  if (!profile) return null;
  const sources = sourceRefs(entry, [...new Set(allProfileSourceIds(profile))]);
  return {
    id: entry.libraryPlantId,
    plantIdentityId: profile.plantIdentityId,
    name: entry.commonName,
    spanishName: entry.spanishName || entry.commonName,
    scientificName: entry.scientificName || "",
    family: null,
    category: entry.category,
    emoji: CATEGORY_EMOJI[entry.category] ?? "🌱",
    summary: seedProfileSummaryForDisplay(localize(profile.summary, language), language),
    contentLevel: seedProfileContentLevel(profile.summary.en),
    metrics: profile.quickFacts.map((fact) => ({
      key: fact.key,
      label: localize(fact.label, language),
      value: localize(fact.value, language),
      note: localize(fact.note, language),
      evidenceType: fact.evidenceType,
      confidence: fact.confidence,
      sourceIds: fact.sourceIds,
    })),
    protocol: profile.sections.map((section) => ({
      id: section.key,
      icon: section.icon,
      title: localize(section.title, language),
      subtitle: localize(section.short, language),
      body: localize(section.guidance, language),
      bullets: section.items.map((item) => ({
        text: localize(item.text, language),
        evidenceType: item.evidenceType,
        confidence: item.confidence,
        sourceIds: item.sourceIds,
      })),
      backing: backingFor(section.evidenceType),
      confidence: section.confidence,
      sources: sourceRefs(entry, section.sourceIds),
    })),
    sources,
    plantHref: `/gardenpedia/?plant=${encodeURIComponent(entry.libraryPlantId)}`,
    evidence: evidenceCounts(profile),
  };
}

export function buildSeedProfiles(language: SeedProfileLanguage) {
  return canonicalSeedEntries
    .map((entry) => buildSeedProfile(entry, language))
    .filter((profile): profile is SeedProfileViewModel => Boolean(profile));
}

export function seedProfileForEntry(id: string, language: SeedProfileLanguage) {
  const entry = canonicalSeedEntries.find((candidate) => candidate.libraryPlantId === id);
  return entry ? buildSeedProfile(entry, language) : null;
}
