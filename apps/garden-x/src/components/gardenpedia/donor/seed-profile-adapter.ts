import { gardenLibraryManifest } from "@/generated/garden-library-manifest";
import type { GardenLibraryEntry } from "@/lib/garden-library";

import seedProfilesV0 from "../../../../../../labs/gardenpedia/data/seed-profiles-v0.json";
import seedProfilesWave1 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-1.json";
import seedProfilesWave2 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-2.json";
import seedProfilesWave3 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-3.json";
import seedProfilesWave4 from "../../../../../../labs/gardenpedia/data/seed-profiles-expansion-wave-4.json";
import sources from "../../../../../../labs/gardenpedia/data/sources.json";
import sourcesOwnedSeeds from "../../../../../../labs/gardenpedia/data/sources-owned-seeds.json";
import sourcesWave1 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-1.json";
import sourcesWave2 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-2.json";
import sourcesWave3 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-3.json";
import sourcesWave4 from "../../../../../../labs/gardenpedia/data/sources-expansion-wave-4.json";

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
] as readonly SeedProfileBundle[];

const profileById = new Map<string, SeedProfileRecord>();
for (const bundle of profileBundles) {
  for (const [id, profile] of Object.entries(bundle.profiles)) profileById.set(id, profile);
}

const sourceById = new Map<string, SourceRecord>();
for (const source of [
  sources,
  sourcesOwnedSeeds,
  sourcesWave1,
  sourcesWave2,
  sourcesWave3,
  sourcesWave4,
].flat()) {
  sourceById.set(source.id, source);
}

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
  return profileById.get(id) ?? null;
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
    summary: localize(profile.summary, language),
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
