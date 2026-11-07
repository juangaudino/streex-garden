import type { GardenLibraryEntry } from "@/lib/garden-library";
import { buildDonorPlantDetail, canonicalEntries, type DonorBacking } from "./canonical-adapter";
import { buildSeedProfile, type SeedProfileLanguage } from "./seed-profile-adapter";

export type GardenpediaEvidenceSource = {
  id: string;
  label: string;
  url: string;
};

export type GardenpediaEvidence = {
  id: string;
  plantId: string;
  plantName: string;
  scientificName: string;
  section: string;
  text: string;
  evidenceType: "source_backed" | "garden_adaptation" | "needs_validation";
  confidence: string;
  sources: readonly GardenpediaEvidenceSource[];
  searchText: string;
};

export type GardenpediaEvidenceLanguage = SeedProfileLanguage;

export function classifyHarvestEvidence(sourceCount: number): GardenpediaEvidence["evidenceType"] {
  return sourceCount > 0 ? "source_backed" : "needs_validation";
}

const stopWords = new Set(
  `a an and are as at be can do for from how i in is it of on or the to was what when where which who why with you your best video un una unos unas y o de del la las los el que como para por en es está estan tengo tiene puedo se mi mis me un una cultivo cultivar planta plantas semilla semillas`.split(
    /\s+/,
  ),
);

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function stem(value: string) {
  const suffixes = [
    "amientos",
    "imientos",
    "aciones",
    "ation",
    "ments",
    "mente",
    "ando",
    "iendo",
    "ados",
    "adas",
    "idos",
    "idas",
    "ing",
    "ied",
    "ed",
    "es",
    "os",
    "as",
    "ar",
    "er",
    "ir",
    "o",
    "a",
  ];
  const suffix = suffixes.find(
    (candidate) => value.endsWith(candidate) && value.length - candidate.length >= 3,
  );
  return suffix ? value.slice(0, -suffix.length) : value;
}

function tokens(value: string) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token))
    .map(stem);
}

function evidenceType(backing: DonorBacking): GardenpediaEvidence["evidenceType"] {
  if (backing === "source") return "source_backed";
  if (backing === "garden") return "garden_adaptation";
  return "needs_validation";
}

function sourcesForIds(entry: GardenLibraryEntry, ids: readonly string[]) {
  const wanted = new Set(ids);
  return entry.reference.sources
    .filter((source) => wanted.has(source.id))
    .map((source) => ({
      id: source.id,
      label: `${source.publisher} · ${source.title}`,
      url: source.url,
    }));
}

function seedSourcesForIds(
  sources: readonly { id: string; label: string; url: string }[],
  ids: readonly string[],
) {
  const wanted = new Set(ids);
  return sources.filter((source) => wanted.has(source.id));
}

function identitySearchText(entry: GardenLibraryEntry, language: GardenpediaEvidenceLanguage) {
  return [
    entry.commonName,
    entry.spanishName,
    entry.scientificName,
    entry.cultivar,
    entry.category,
    ...entry.aliases,
    language === "es" ? "planta ficha cultivo cuidado" : "plant profile growing care",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildEvidenceForEntry(
  entry: GardenLibraryEntry,
  language: GardenpediaEvidenceLanguage,
): GardenpediaEvidence[] {
  const identity = identitySearchText(entry, language);
  const name = language === "es" ? entry.spanishName || entry.commonName : entry.commonName;
  const records: GardenpediaEvidence[] = [];
  const detail = buildDonorPlantDetail(entry, language);

  for (const guide of detail.guides) {
    const text = [guide.subtitle, guide.body, ...guide.bullets, guide.avoid, guide.context]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (!text) continue;
    const sources = sourcesForIds(entry, guide.sourceIds ?? []);
    const backing = guide.backing === "source" && sources.length === 0 ? "pending" : guide.backing;
    records.push({
      id: `${entry.libraryPlantId}:plant:${guide.id}`,
      plantId: entry.libraryPlantId,
      plantName: name,
      scientificName: entry.scientificName || "",
      section: guide.title,
      text,
      evidenceType: evidenceType(backing),
      confidence: backing === "pending" ? "pending" : guide.confidence,
      sources,
      searchText: `${identity} ${guide.title} ${text}`,
    });
  }

  if (detail.harvestUse) {
    for (const option of detail.harvestUse.options) {
      const text = [option.title, option.lead, ...option.steps].filter(Boolean).join(" ");
      if (!text) continue;
      const sources = option.sourceIds.flatMap((id, index) => {
        const source = option.sources[index];
        return source ? [{ id, label: source.label, url: source.url }] : [];
      });
      records.push({
        id: `${entry.libraryPlantId}:harvest:${normalize(option.title).replace(/\s+/g, "-")}`,
        plantId: entry.libraryPlantId,
        plantName: name,
        scientificName: entry.scientificName || "",
        section: language === "es" ? "Uso de la cosecha" : "Harvest use",
        text,
        evidenceType: classifyHarvestEvidence(sources.length),
        confidence: sources.length ? "source-backed" : "pending",
        sources,
        searchText: `${identity} ${text}`,
      });
    }
  }

  const seedProfile = buildSeedProfile(entry, language);
  if (seedProfile) {
    for (const metric of seedProfile.metrics) {
      const text = [metric.label, metric.value, metric.note].filter(Boolean).join(" ");
      if (!text) continue;
      const sources = seedSourcesForIds(seedProfile.sources, metric.sourceIds);
      const metricBacking =
        metric.evidenceType === "source_backed" && sources.length === 0
          ? "needs_validation"
          : metric.evidenceType;
      records.push({
        id: `${entry.libraryPlantId}:seed:metric:${metric.key}`,
        plantId: entry.libraryPlantId,
        plantName: name,
        scientificName: entry.scientificName || "",
        section: metric.label,
        text,
        evidenceType: metricBacking,
        confidence: metricBacking === "needs_validation" ? "pending" : metric.confidence,
        sources,
        searchText: `${identity} ${text}`,
      });
    }

    for (const section of seedProfile.protocol) {
      const items = [
        ...(section.body
          ? [
              {
                text: section.body,
                sourceIds: section.sources.map((source) => source.id),
                backing: section.backing,
              },
            ]
          : []),
        ...section.bullets.map((item) => ({
          text: item.text,
          sourceIds: item.sourceIds,
          backing:
            item.evidenceType === "source_backed"
              ? ("source" as const)
              : item.evidenceType === "garden_adaptation"
                ? ("garden" as const)
                : ("pending" as const),
        })),
      ];
      for (const item of items) {
        if (!item.text.trim()) continue;
        const sources = seedSourcesForIds(seedProfile.sources, item.sourceIds);
        const backing =
          item.backing === "source" && sources.length === 0 ? "pending" : item.backing;
        records.push({
          id: `${entry.libraryPlantId}:seed:${section.id}:${records.length}`,
          plantId: entry.libraryPlantId,
          plantName: name,
          scientificName: entry.scientificName || "",
          section: section.title,
          text: item.text,
          evidenceType: evidenceType(backing),
          confidence: backing === "pending" ? "pending" : section.confidence,
          sources,
          searchText: `${identity} ${section.title} ${item.text}`,
        });
      }
    }
  }

  return records;
}

const evidenceCache = new Map<GardenpediaEvidenceLanguage, GardenpediaEvidence[]>();
type SearchDocument = {
  record: GardenpediaEvidence;
  searchable: Set<string>;
  identity: Set<string>;
  section: Set<string>;
};
const searchCache = new Map<
  GardenpediaEvidenceLanguage,
  {
    documents: SearchDocument[];
    documentFrequency: Map<string, number>;
    identityVocabulary: Set<string>;
    distinctIdentityPhrases: Array<{ phrase: string; plantId: string }>;
  }
>();

export function retrieveGardenpediaEvidence(
  query: string,
  language: GardenpediaEvidenceLanguage,
  limit = 8,
): GardenpediaEvidence[] {
  const queryTokens = [...new Set(tokens(query))];
  if (!queryTokens.length) return [];

  let corpus = evidenceCache.get(language);
  if (!corpus) {
    corpus = (canonicalEntries as readonly GardenLibraryEntry[]).flatMap((entry) =>
      buildEvidenceForEntry(entry, language),
    );
    evidenceCache.set(language, corpus);
  }

  let index = searchCache.get(language);
  if (!index) {
    const documents = corpus.map((record) => ({
      record,
      searchable: new Set(tokens(record.searchText)),
      identity: new Set(tokens(`${record.plantName} ${record.scientificName}`)),
      section: new Set(tokens(record.section)),
    }));
    const documentFrequency = new Map<string, number>();
    const identityVocabulary = new Set<string>();
    for (const { searchable } of documents) {
      for (const token of searchable) {
        documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
      }
    }
    for (const { identity } of documents) {
      for (const token of identity) identityVocabulary.add(token);
    }
    const phraseOwners = new Map<string, Set<string>>();
    for (const entry of canonicalEntries as readonly GardenLibraryEntry[]) {
      for (const name of [entry.commonName, entry.spanishName, ...entry.aliases]) {
        const phrase = normalize(name || "");
        if (phrase.split(" ").length < 2) continue;
        const owners = phraseOwners.get(phrase) ?? new Set<string>();
        owners.add(entry.libraryPlantId);
        phraseOwners.set(phrase, owners);
      }
    }
    const distinctIdentityPhrases = [...phraseOwners]
      .filter(([, owners]) => owners.size === 1)
      .map(([phrase, owners]) => ({ phrase, plantId: [...owners][0]! }))
      .sort((a, b) => b.phrase.length - a.phrase.length || a.phrase.localeCompare(b.phrase));
    index = { documents, documentFrequency, identityVocabulary, distinctIdentityPhrases };
    searchCache.set(language, index);
  }
  const { documents, documentFrequency, identityVocabulary } = index;
  const topicVocabulary = new Set(
    tokens(
      "germination sowing seedling transplant propagation planting harvest pruning pinching flowering fruiting watering irrigation light sunlight shade hydroponics hydroponic nutrients fertilizer soil pests disease temperature spacing",
    ),
  );
  const commonTermThreshold = Math.max(5, Math.floor(corpus.length * 0.12));
  const informativeQueryTokens = queryTokens.filter((token) => {
    const frequency = documentFrequency.get(token);
    return (
      frequency !== undefined &&
      (identityVocabulary.has(token) ||
        topicVocabulary.has(token) ||
        frequency <= commonTermThreshold)
    );
  });
  if (!informativeQueryTokens.length) return [];

  const ranked = documents
    .map(({ record, searchable, identity, section }) => {
      const score = informativeQueryTokens.reduce(
        (total, token) =>
          total +
          (identity.has(token) ? 5 : section.has(token) ? 3 : searchable.has(token) ? 1 : 0),
        0,
      );
      return { record, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id));
  const resultLimit = Math.max(1, Math.min(limit, 12));

  // Explicitly named, unambiguous multiword identities get balanced evidence.
  // Do not infer identities from a shared species term or ambiguous alias.
  const normalizedQuery = ` ${normalize(query)} `;
  const occupied: Array<{ start: number; end: number }> = [];
  const namedPlants: string[] = [];
  for (const { phrase, plantId } of index.distinctIdentityPhrases) {
    const start = normalizedQuery.indexOf(` ${phrase} `);
    if (start < 0) continue;
    const end = start + phrase.length + 2;
    if (occupied.some((span) => start < span.end && end > span.start)) continue;
    occupied.push({ start, end });
    if (!namedPlants.includes(plantId)) namedPlants.push(plantId);
  }
  if (namedPlants.length > 1) {
    const groups = namedPlants.map((plantId) =>
      ranked.filter(({ record }) => record.plantId === plantId).map(({ record }) => record),
    );
    const balanced: GardenpediaEvidence[] = [];
    for (let rank = 0; balanced.length < resultLimit; rank++) {
      let added = false;
      for (const group of groups) {
        if (group[rank] && balanced.length < resultLimit) {
          balanced.push(group[rank]!);
          added = true;
        }
      }
      if (!added) break;
    }
    return balanced;
  }
  return ranked.slice(0, resultLimit).map(({ record }) => record);
}

export function clearGardenpediaEvidenceCacheForTests() {
  evidenceCache.clear();
  searchCache.clear();
}
