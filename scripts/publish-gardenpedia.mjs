import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { validateCompatibilityProfile } from "./gardenpedia-compatibility-profile.mjs";
import { validateGardenpediaLifeCapabilities } from "./gardenpedia-life-capabilities.mjs";
import { loadSourceRegistry } from "./gardenpedia-source-registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "labs", "gardenpedia");
const destination = path.join(
  root,
  "apps",
  "garden-x",
  "public",
  "gardenpedia",
);
const generatedManifest = path.join(
  root,
  "apps",
  "garden-x",
  "src",
  "generated",
  "garden-library-manifest.ts",
);
const generatedMachineFacts = path.join(
  root,
  "apps",
  "garden-x",
  "src",
  "generated",
  "garden-machine-facts.ts",
);
const generatedSeedProfileIndex = path.join(
  root,
  "apps",
  "garden-x",
  "src",
  "generated",
  "garden-seed-profile-index.ts",
);
const generatedPlantProfileIndex = path.join(
  root,
  "apps",
  "garden-x",
  "src",
  "generated",
  "garden-plant-profile-index.ts",
);
const gardenXProjectRef = "fnhggqqnkhkrfwmnsqmy";
const PUBLIC_TAG_EXCLUSIONS = /owned seed|home grown|user zero|uruq|packet|inventory/i;
const NON_CULTIVAR_DESCRIPTORS = /\bpacket\b|species pending|cultivar pending|identity unresolved/i;

function publicCultivar(plant) {
  const variety = typeof plant.variety === "string" ? plant.variety.trim() : "";
  if (!variety || NON_CULTIVAR_DESCRIPTORS.test(variety)) return null;
  return variety;
}

// These stable Garden system-definition keys are explicitly linked to the
// corresponding machine-inventory model records. Custom definitions are not
// inferred from their editable names or position counts.
const systemDefinitionMachineModels = {
  uruq_8_v1: "uruq-hp-gc001",
  uruq_12_v1: "uruq-hp-gc202",
};

const plantFiles = [
  "data/plants.json",
  "data/plants-current-gardens.json",
  "data/plants-owned-seeds.json",
  "data/plants-expansion-batch-a1.json",
  "data/plants-expansion-batch-b1.json",
  "data/plants-expansion-wave-1.json",
  "data/plants-expansion-wave-2.json",
  "data/plants-expansion-wave-3.json",
  "data/plants-expansion-wave-4.json",
  "data/plants-expansion-wave-5.json",
  "data/plants-expansion-wave-6.json",
  "data/plants-expansion-wave-7.json",
  "data/plants-expansion-wave-8.json",
  "data/plants-expansion-wave-9.json",
  "data/plants-expansion-wave-10.json",
  "data/plants-expansion-wave-11.json",
  "data/plants-expansion-wave-12.json",
  "data/plants-expansion-wave-13.json",
  "data/plants-expansion-wave-14.json",
  "data/plants-expansion-wave-15.json",
  "data/plants-expansion-wave-16.json",
  "data/plants-expansion-wave-17.json",
  "data/plants-expansion-wave-18.json",
  "data/plants-expansion-wave-19.json",
  "data/plants-expansion-wave-20.json",
  "data/plants-expansion-wave-21.json",
  "data/plants-expansion-wave-22.json",
  "data/plants-expansion-wave-23.json",
  "data/plants-expansion-wave-24.json",
  "data/plants-expansion-wave-25.json",
  "data/plants-expansion-wave-26.json",
  "data/plants-expansion-wave-27.json",
  "data/plants-expansion-wave-28.json",
  "data/plants-expansion-wave-29.json",
  "data/plants-expansion-wave-30.json",
  "data/plants-expansion-wave-31.json",
  "data/plants-expansion-wave-32.json",
  "data/plants-expansion-wave-33.json",
  "data/plants-expansion-wave-34.json",
  "data/plants-expansion-wave-35.json",
  "data/plants-expansion-wave-36.json",
  "data/plants-expansion-wave-37.json",
  "data/plants-expansion-wave-38.json",
  "data/plants-expansion-wave-39.json",
  "data/plants-expansion-wave-40.json",
  "data/plants-expansion-wave-41.json",
  "data/plants-expansion-wave-42.json",
  "data/plants-expansion-wave-43.json",
  "data/plants-expansion-wave-44.json",
  "data/plants-expansion-wave-45.json",
  "data/plants-expansion-wave-46.json",
  "data/plants-expansion-wave-47.json",
  "data/plants-expansion-wave-48.json",
  "data/plants-expansion-wave-49.json",
  "data/plants-expansion-wave-50.json",
  "data/plants-expansion-wave-51.json",
  "data/plants-expansion-wave-52.json",
  "data/plants-expansion-wave-53.json",
  "data/plants-expansion-wave-54.json",
  "data/plants-expansion-wave-55.json",
  "data/plants-expansion-wave-56.json",
  "data/plants-expansion-wave-57.json",
  "data/plants-expansion-wave-58.json",
  "data/plants-expansion-wave-59.json",
  "data/plants-expansion-wave-60.json",
  "data/plants-expansion-wave-61.json",
  "data/plants-expansion-wave-62.json",
  "data/plants-expansion-wave-63.json",
  "data/plants-requests.json",
];

const publicFiles = [
  "styles.css",
  "language.css",
  "visual.css",
  "inventory-neighbors.css",
  "garden-labs.css",
  "harvest-use-v0.1.css",
  "harvest-use-v0.1.js",
  "timeline-quality-v0.1.js",
  "app.js",
  "expansion-batch-a1.js",
  "expansion-batch-b1.js",
  "expansion-wave-1.js",
  "expansion-wave-2.js",
  "expansion-wave-3.js",
  "expansion-wave-4.js",
  "machines-v1.css",
  "machines-v1.js",
  "supabase-lab-transport.js",
  "identity-resolver-v1.js",
  "gardenpedia-account-v1.js",
  "manifest.json",
];

const dataFiles = [
  ...plantFiles,
  "data/sources.json",
  "data/sources-current-gardens.json",
  "data/sources-owned-seeds.json",
  "data/sources-expansion-batch-a1.json",
  "data/sources-expansion-batch-b1.json",
  "data/sources-expansion-wave-1.json",
  "data/sources-expansion-wave-2.json",
  "data/sources-expansion-wave-3.json",
  "data/sources-expansion-wave-4.json",
  "data/sources-expansion-wave-5.json",
  "data/sources-expansion-wave-6.json",
  "data/sources-expansion-wave-7.json",
  "data/sources-expansion-wave-8.json",
  "data/sources-expansion-wave-9.json",
  "data/sources-expansion-wave-10.json",
  "data/sources-expansion-wave-11.json",
  "data/sources-expansion-wave-12.json",
  "data/sources-expansion-wave-13.json",
  "data/sources-expansion-wave-14.json",
  "data/sources-expansion-wave-15.json",
  "data/sources-expansion-wave-16.json",
  "data/sources-expansion-wave-17.json",
  "data/sources-expansion-wave-18.json",
  "data/sources-expansion-wave-19.json",
  "data/sources-expansion-wave-20.json",
  "data/sources-expansion-wave-21.json",
  "data/sources-expansion-wave-22.json",
  "data/sources-expansion-wave-23.json",
  "data/sources-expansion-wave-24.json",
  "data/sources-expansion-wave-25.json",
  "data/sources-expansion-wave-26.json",
  "data/sources-expansion-wave-27.json",
  "data/sources-expansion-wave-28.json",
  "data/sources-expansion-wave-29.json",
  "data/sources-expansion-wave-30.json",
  "data/sources-expansion-wave-31.json",
  "data/sources-expansion-wave-32.json",
  "data/sources-expansion-wave-33.json",
  "data/sources-expansion-wave-34.json",
  "data/sources-expansion-wave-35.json",
  "data/sources-expansion-wave-36.json",
  "data/sources-expansion-wave-37.json",
  "data/sources-expansion-wave-38.json",
  "data/sources-expansion-wave-39.json",
  "data/sources-expansion-wave-40.json",
  "data/sources-expansion-wave-41.json",
  "data/sources-expansion-wave-42.json",
  "data/sources-expansion-wave-43.json",
  "data/sources-expansion-wave-44.json",
  "data/sources-expansion-wave-45.json",
  "data/sources-expansion-wave-46.json",
  "data/sources-expansion-wave-47.json",
  "data/sources-expansion-wave-48.json",
  "data/sources-expansion-wave-49.json",
  "data/sources-expansion-wave-50.json",
  "data/sources-expansion-wave-51.json",
  "data/sources-expansion-wave-52.json",
  "data/sources-expansion-wave-53.json",
  "data/sources-expansion-wave-54.json",
  "data/sources-expansion-wave-55.json",
  "data/sources-expansion-wave-56.json",
  "data/sources-expansion-wave-57.json",
  "data/sources-expansion-wave-58.json",
  "data/sources-expansion-wave-59.json",
  "data/sources-expansion-wave-60.json",
  "data/sources-expansion-wave-61.json",
  "data/sources-expansion-wave-62.json",
  "data/sources-expansion-wave-63.json",
  "data/sources-requests.json",
  "data/translations-es.json",
  "data/translations-owned-seeds-es.json",
  "data/translations-expansion-batch-a1-es.json",
  "data/translations-expansion-batch-b1-es.json",
  "data/translations-expansion-wave-1-es.json",
  "data/translations-expansion-wave-2-es.json",
  "data/translations-expansion-wave-3-es.json",
  "data/translations-expansion-wave-4-es.json",
  "data/translations-expansion-wave-5-es.json",
  "data/translations-expansion-wave-6-es.json",
  "data/translations-expansion-wave-7-es.json",
  "data/translations-expansion-wave-8-es.json",
  "data/translations-expansion-wave-9-es.json",
  "data/translations-expansion-wave-10-es.json",
  "data/translations-expansion-wave-11-es.json",
  "data/translations-expansion-wave-12-es.json",
  "data/translations-expansion-wave-13-es.json",
  "data/translations-expansion-wave-14-es.json",
  "data/translations-expansion-wave-15-es.json",
  "data/translations-expansion-wave-16-es.json",
  "data/translations-expansion-wave-17-es.json",
  "data/translations-expansion-wave-18-es.json",
  "data/translations-expansion-wave-19-es.json",
  "data/translations-expansion-wave-20-es.json",
  "data/translations-expansion-wave-21-es.json",
  "data/translations-expansion-wave-22-es.json",
  "data/translations-expansion-wave-23-es.json",
  "data/translations-expansion-wave-24-es.json",
  "data/translations-expansion-wave-25-es.json",
  "data/translations-expansion-wave-26-es.json",
  "data/translations-expansion-wave-27-es.json",
  "data/translations-expansion-wave-28-es.json",
  "data/translations-expansion-wave-29-es.json",
  "data/translations-expansion-wave-30-es.json",
  "data/translations-expansion-wave-31-es.json",
  "data/translations-expansion-wave-32-es.json",
  "data/translations-expansion-wave-33-es.json",
  "data/translations-expansion-wave-34-es.json",
  "data/translations-expansion-wave-35-es.json",
  "data/translations-expansion-wave-36-es.json",
  "data/translations-expansion-wave-37-es.json",
  "data/translations-expansion-wave-38-es.json",
  "data/translations-expansion-wave-39-es.json",
  "data/translations-expansion-wave-40-es.json",
  "data/translations-expansion-wave-41-es.json",
  "data/translations-expansion-wave-42-es.json",
  "data/translations-expansion-wave-43-es.json",
  "data/translations-expansion-wave-44-es.json",
  "data/translations-expansion-wave-45-es.json",
  "data/translations-expansion-wave-46-es.json",
  "data/translations-expansion-wave-47-es.json",
  "data/translations-expansion-wave-48-es.json",
  "data/translations-expansion-wave-49-es.json",
  "data/translations-expansion-wave-50-es.json",
  "data/translations-expansion-wave-51-es.json",
  "data/translations-expansion-wave-52-es.json",
  "data/translations-expansion-wave-53-es.json",
  "data/translations-expansion-wave-54-es.json",
  "data/translations-expansion-wave-55-es.json",
  "data/translations-expansion-wave-56-es.json",
  "data/translations-expansion-wave-57-es.json",
  "data/translations-expansion-wave-58-es.json",
  "data/translations-expansion-wave-59-es.json",
  "data/translations-expansion-wave-60-es.json",
  "data/translations-expansion-wave-61-es.json",
  "data/translations-expansion-wave-62-es.json",
  "data/translations-expansion-wave-63-es.json",
  "data/translations-requests-es.json",
  "data/visuals.json",
  "data/neighbor-profiles.json",
  "data/machine-inventory-v1.json",
  "data/harvest-use-v0.1.json",
  "data/seed-profiles-v0.json",
  "data/seed-profiles-expansion-wave-1.json",
  "data/seed-profiles-expansion-wave-2.json",
  "data/seed-profiles-expansion-wave-3.json",
  "data/seed-profiles-expansion-wave-4.json",
  "data/seed-profiles-expansion-wave-5.json",
  "data/seed-profiles-expansion-wave-6.json",
  "data/seed-profiles-expansion-wave-7.json",
  "data/seed-profiles-expansion-wave-8.json",
  "data/seed-profiles-expansion-wave-9.json",
  "data/seed-profiles-expansion-wave-10.json",
  "data/seed-profiles-expansion-wave-13.json",
  "data/seed-profiles-expansion-wave-15.json",
  "data/seed-profiles-expansion-wave-16.json",
  "data/seed-profiles-expansion-wave-17.json",
  "data/seed-profiles-expansion-wave-18.json",
  "data/seed-profiles-expansion-wave-19.json",
  "data/seed-profiles-expansion-wave-20.json",
  "data/seed-profiles-expansion-wave-21.json",
  "data/seed-profiles-expansion-wave-23.json",
  "data/seed-profiles-expansion-wave-24.json",
  "data/seed-profiles-expansion-wave-25.json",
  "data/seed-profiles-expansion-wave-26.json",
  "data/seed-profiles-expansion-wave-28.json",
  "data/seed-profiles-expansion-wave-29.json",
  "data/seed-profiles-expansion-wave-30.json",
  "data/seed-profiles-expansion-wave-31.json",
  "data/seed-profiles-expansion-wave-32.json",
  "data/seed-profiles-expansion-wave-37.json",
  "data/seed-profiles-expansion-wave-38.json",
  "data/seed-profiles-expansion-wave-39.json",
  "data/seed-profiles-expansion-wave-40.json",
  "data/seed-profiles-expansion-wave-41.json",
  "data/seed-profiles-expansion-wave-42.json",
  "data/seed-profiles-expansion-wave-43.json",
  "data/seed-profiles-expansion-wave-44.json",
  "data/seed-profiles-expansion-wave-45.json",
  "data/seed-profiles-expansion-wave-46.json",
  "data/seed-profiles-expansion-wave-47.json",
  "data/seed-profiles-expansion-wave-48.json",
  "data/seed-profiles-expansion-wave-49.json",
  "data/seed-profiles-expansion-wave-50.json",
  "data/seed-profiles-expansion-wave-51.json",
  "data/seed-profiles-expansion-wave-52.json",
  "data/seed-profiles-expansion-wave-53.json",
  "data/seed-profiles-expansion-wave-54.json",
  "data/seed-profiles-expansion-wave-56.json",
  "data/seed-profiles-expansion-wave-57.json",
  "data/seed-profiles-expansion-wave-58.json",
  "data/seed-profiles-expansion-wave-59.json",
  "data/seed-profiles-expansion-wave-60.json",
  "data/seed-profiles-expansion-wave-61.json",
  "data/seed-profiles-expansion-wave-62.json",
  "data/seed-profiles-expansion-wave-63.json",
  "data/plant-identity-aliases-v1.json",
  "data/propagation-guidance-v1.json",
];

const seedProfileFiles = [
  "data/seed-profiles-v0.json",
  "data/seed-profiles-expansion-wave-1.json",
  "data/seed-profiles-expansion-wave-2.json",
  "data/seed-profiles-expansion-wave-3.json",
  "data/seed-profiles-expansion-wave-4.json",
  "data/seed-profiles-expansion-wave-5.json",
  "data/seed-profiles-expansion-wave-6.json",
  "data/seed-profiles-expansion-wave-7.json",
  "data/seed-profiles-expansion-wave-8.json",
  "data/seed-profiles-expansion-wave-9.json",
  "data/seed-profiles-expansion-wave-10.json",
  "data/seed-profiles-expansion-wave-13.json",
  "data/seed-profiles-expansion-wave-15.json",
  "data/seed-profiles-expansion-wave-16.json",
  "data/seed-profiles-expansion-wave-17.json",
  "data/seed-profiles-expansion-wave-18.json",
  "data/seed-profiles-expansion-wave-19.json",
  "data/seed-profiles-expansion-wave-20.json",
  "data/seed-profiles-expansion-wave-21.json",
  "data/seed-profiles-expansion-wave-23.json",
  "data/seed-profiles-expansion-wave-24.json",
  "data/seed-profiles-expansion-wave-25.json",
  "data/seed-profiles-expansion-wave-26.json",
  "data/seed-profiles-expansion-wave-28.json",
  "data/seed-profiles-expansion-wave-29.json",
  "data/seed-profiles-expansion-wave-30.json",
  "data/seed-profiles-expansion-wave-31.json",
  "data/seed-profiles-expansion-wave-32.json",
  "data/seed-profiles-expansion-wave-37.json",
  "data/seed-profiles-expansion-wave-43.json",
  "data/seed-profiles-expansion-wave-44.json",
  "data/seed-profiles-expansion-wave-45.json",
  "data/seed-profiles-expansion-wave-46.json",
  "data/seed-profiles-expansion-wave-47.json",
  "data/seed-profiles-expansion-wave-48.json",
  "data/seed-profiles-expansion-wave-49.json",
  "data/seed-profiles-expansion-wave-50.json",
  "data/seed-profiles-expansion-wave-51.json",
  "data/seed-profiles-expansion-wave-52.json",
  "data/seed-profiles-expansion-wave-53.json",
  "data/seed-profiles-expansion-wave-54.json",
  "data/seed-profiles-expansion-wave-56.json",
  "data/seed-profiles-expansion-wave-57.json",
  "data/seed-profiles-expansion-wave-58.json",
  "data/seed-profiles-expansion-wave-59.json",
  "data/seed-profiles-expansion-wave-60.json",
  "data/seed-profiles-expansion-wave-61.json",
  "data/seed-profiles-expansion-wave-62.json",
  "data/seed-profiles-expansion-wave-63.json",
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(source, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const target = path.join(destination, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function publicize(value) {
  if (typeof value === "string") {
    return value
      .replaceAll(/User Zero/gi, "the grower")
      .replaceAll(/purchase listing/gi, "seller listing")
      .replaceAll(/packet evidence/gi, "source evidence");
  }
  if (Array.isArray(value)) return value.map(publicize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, publicize(item)]),
    );
  }
  return value;
}

function copy(relativePath) {
  const from = path.join(source, relativePath);
  const to = path.join(destination, relativePath);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function configureGardenXAuthTransport() {
  const url = String(process.env.VITE_SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const publishableKey = String(
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
  ).trim();
  const expectedUrl = `https://${gardenXProjectRef}.supabase.co`;
  if (url !== expectedUrl || !publishableKey) {
    throw new Error(
      `Gardenpedia requires VITE_SUPABASE_URL=${expectedUrl} and a publishable key at build time.`,
    );
  }
  const target = path.join(destination, "supabase-lab-transport.js");
  const transport = fs
    .readFileSync(target, "utf8")
    .replace("__GARDEN_X_SUPABASE_URL__", JSON.stringify(url))
    .replace(
      "__GARDEN_X_SUPABASE_PUBLISHABLE_KEY__",
      JSON.stringify(publishableKey),
    );
  fs.writeFileSync(target, transport);
}

function uniqueStrings(values) {
  return [
    ...new Set(
      values.map((value) => String(value || "").trim()).filter(Boolean),
    ),
  ];
}

function metricValue(plant, labels) {
  const metric = (plant.metrics || []).find((item) =>
    labels.includes(item.label) &&
    !/user\s*zero|owned|inventory|purchase|bare[ -]?root/i.test(
      `${item.label || ""} ${item.value || ""} ${item.note || ""}`,
    ),
  );
  return metric?.value || null;
}

function sectionItems(plant, sectionNames, sourceById = null) {
  return uniqueStrings(
    sectionNames.flatMap((name) => {
      const section = plant.sections?.[name];
      if (
        sourceById &&
        !(section?.sourceIds || []).every((sourceId) => sourceById.has(sourceId))
      ) {
        return [];
      }
      return [section?.short, ...(section?.items || [])];
    }),
  );
}

function firstTemperature(plant, sourceById) {
  const values = sectionItems(plant, ["germination", "hydroponics"], sourceById);
  return (
    values.find((value) => /temperature|°f|°c|warm|cool/i.test(value)) || null
  );
}

function buildReference(plant, neighborData, sourceById, additionalSourceIds = []) {
  const problems = sectionItems(plant, ["problems"], sourceById);
  const recommendations = uniqueStrings([
    ...sectionItems(plant, [
      "pruning",
      "harvest",
      "germination",
      "hydroponics",
    ], sourceById),
  ]).filter((value) => !problems.includes(value));
  const goodNeighborIds = uniqueStrings(
    (neighborData.meta?.researchPairs || [])
      .filter((pair) => pair.a === plant.id || pair.b === plant.id)
      .map((pair) => (pair.a === plant.id ? pair.b : pair.a)),
  );
  const sourceIds = uniqueStrings([
    ...additionalSourceIds,
    ...Object.values(plant.sections || {}).flatMap(
      (section) => section?.sourceIds || [],
    ),
    ...Object.values(plant.lifeCapabilities || {}).flatMap((claim) =>
      claim?.status === "known"
        ? claim.evidence.flatMap((item) => item.sourceIds || [])
        : [],
    ),
    ...Object.values(plant.compatibilityProfile || {}).flatMap((claim) => {
      if (!claim || typeof claim !== "object") return [];
      if (Array.isArray(claim.evidence)) {
        return claim.evidence.flatMap((item) => item.sourceIds || []);
      }
      return Object.values(claim).flatMap((nestedClaim) =>
        nestedClaim &&
        typeof nestedClaim === "object" &&
        Array.isArray(nestedClaim.evidence)
          ? nestedClaim.evidence.flatMap((item) => item.sourceIds || [])
          : [],
      );
    }),
  ]);
  const publicSourceIds = sourceIds.filter((id) => sourceById.has(id));
  return {
    germination: metricValue(plant, ["Germination", "Best germination"]),
    light: metricValue(plant, ["Light"]),
    temperature: firstTemperature(plant, sourceById),
    ph: metricValue(plant, ["Hydro pH", "Hydro pH / EC"]),
    ec: metricValue(plant, ["Hydro EC", "Hydro pH / EC"]),
    spacing: metricValue(plant, ["Leaf spacing"]),
    pruning:
      metricValue(plant, ["Pruning"]) ||
      sectionItems(plant, ["pruning"], sourceById)[0] ||
      null,
    harvest:
      metricValue(plant, [
        "First harvest",
        "Harvest mode",
        "Harvest style",
        "Leaf harvest",
      ]) ||
      sectionItems(plant, ["harvest"], sourceById)[0] ||
      null,
    expectedCycle: null,
    commonProblems: problems,
    recommendations,
    goodNeighborIds,
    betterSeparateIds: [],
    sourceIds: publicSourceIds,
    sources: publicSourceIds
      .map((id) => sourceById.get(id))
      .filter(Boolean)
      .map((source) => ({
        id: source.id,
        title: source.title || source.name || source.id,
        publisher: source.publisher || source.type || "Gardenpedia source",
        url: source.url,
      })),
  };
}

function buildCatalogManifest(plants, identityAliases) {
  const neighborData = readJson("data/neighbor-profiles.json");
  const profileEnrichmentByPlant = new Map(
    readJson("data/plant-profile-enrichment-v1.json").map((profile) => [
      profile.id,
      profile,
    ]),
  );
  const sourceRecords = [
    "data/sources.json",
    "data/sources-current-gardens.json",
    "data/sources-owned-seeds.json",
    "data/sources-expansion-batch-a1.json",
    "data/sources-expansion-batch-b1.json",
    "data/sources-expansion-wave-1.json",
    "data/sources-expansion-wave-2.json",
    "data/sources-expansion-wave-3.json",
    "data/sources-expansion-wave-4.json",
    "data/sources-expansion-wave-5.json",
    "data/sources-expansion-wave-6.json",
    "data/sources-expansion-wave-7.json",
    "data/sources-expansion-wave-8.json",
    "data/sources-expansion-wave-9.json",
    "data/sources-expansion-wave-10.json",
    "data/sources-expansion-wave-11.json",
    "data/sources-expansion-wave-12.json",
    "data/sources-expansion-wave-13.json",
    "data/sources-expansion-wave-14.json",
    "data/sources-expansion-wave-15.json",
    "data/sources-expansion-wave-16.json",
    "data/sources-expansion-wave-17.json",
    "data/sources-expansion-wave-18.json",
    "data/sources-expansion-wave-19.json",
    "data/sources-expansion-wave-20.json",
    "data/sources-expansion-wave-21.json",
    "data/sources-expansion-wave-22.json",
    "data/sources-expansion-wave-23.json",
    "data/sources-expansion-wave-24.json",
    "data/sources-expansion-wave-25.json",
    "data/sources-expansion-wave-26.json",
    "data/sources-expansion-wave-27.json",
    "data/sources-expansion-wave-28.json",
    "data/sources-expansion-wave-29.json",
    "data/sources-expansion-wave-30.json",
    "data/sources-expansion-wave-31.json",
    "data/sources-expansion-wave-32.json",
    "data/sources-expansion-wave-33.json",
    "data/sources-expansion-wave-34.json",
    "data/sources-expansion-wave-35.json",
    "data/sources-expansion-wave-36.json",
    "data/sources-expansion-wave-37.json",
    "data/sources-expansion-wave-38.json",
    "data/sources-expansion-wave-39.json",
    "data/sources-expansion-wave-40.json",
    "data/sources-expansion-wave-41.json",
    "data/sources-expansion-wave-42.json",
    "data/sources-expansion-wave-43.json",
    "data/sources-expansion-wave-44.json",
    "data/sources-expansion-wave-45.json",
    "data/sources-expansion-wave-46.json",
    "data/sources-expansion-wave-47.json",
    "data/sources-expansion-wave-48.json",
    "data/sources-expansion-wave-49.json",
    "data/sources-expansion-wave-50.json",
    "data/sources-expansion-wave-51.json",
    "data/sources-expansion-wave-52.json",
    "data/sources-expansion-wave-53.json",
    "data/sources-expansion-wave-54.json",
    "data/sources-expansion-wave-55.json",
    "data/sources-expansion-wave-56.json",
    "data/sources-expansion-wave-57.json",
    "data/sources-expansion-wave-58.json",
    "data/sources-expansion-wave-59.json",
    "data/sources-expansion-wave-60.json",
    "data/sources-expansion-wave-61.json",
    "data/sources-expansion-wave-62.json",
    "data/sources-expansion-wave-63.json",
    "data/sources-requests.json",
  ].flatMap((file) => filterPublicSources(file));
  const sourceById = new Map(
    sourceRecords.map((source) => [source.id, source]),
  );
  const knownSourceIds = new Set(sourceById.keys());
  const canonicalIds = new Set(plants.map((plant) => plant.id));
  const aliasIds = new Set();
  const aliasesByCanonicalId = new Map();
  for (const alias of identityAliases) {
    if (
      !alias?.aliasId ||
      !alias.canonicalPlantId ||
      aliasIds.has(alias.aliasId) ||
      canonicalIds.has(alias.aliasId) ||
      !canonicalIds.has(alias.canonicalPlantId)
    ) {
      throw new Error(`Invalid or duplicate Gardenpedia identity alias: ${alias?.aliasId}`);
    }
    if ((alias.sourceIds || []).some((id) => !knownSourceIds.has(id))) {
      throw new Error(`Identity alias has unresolved source references: ${alias.aliasId}`);
    }
    aliasIds.add(alias.aliasId);
    aliasesByCanonicalId.set(alias.canonicalPlantId, [
      ...(aliasesByCanonicalId.get(alias.canonicalPlantId) || []),
      alias,
    ]);
  }
  const entries = plants
    .map((plant) => {
      const enrichment = profileEnrichmentByPlant.get(plant.id);
      const enrichmentSourceIds = uniqueStrings(
        Object.values(enrichment?.sections || {}).flatMap(
          (section) => section?.sourceIds || [],
        ),
      );
      const publicIdentity = {
        ...plant,
        ...(typeof enrichment?.scientificName === "string"
          ? { scientificName: enrichment.scientificName }
          : {}),
        ...(typeof enrichment?.variety === "string"
          ? { variety: enrichment.variety }
          : {}),
      };
      return {
        libraryPlantId: plant.id,
        commonName: publicIdentity.name,
        spanishName: publicIdentity.spanishName || null,
        scientificName: publicIdentity.scientificName || null,
        cultivar: publicCultivar(publicIdentity),
        aliases: uniqueStrings([
          publicIdentity.name,
          publicIdentity.spanishName,
          publicIdentity.scientificName,
          publicCultivar(publicIdentity),
          ...(aliasesByCanonicalId.get(plant.id) || []).flatMap((alias) => [
            alias.aliasId,
            alias.aliasName,
            alias.aliasScientificName,
          ]),
          ...(plant.tags || []).filter((tag) => !PUBLIC_TAG_EXCLUSIONS.test(tag)),
        ]).filter((alias) => !PUBLIC_TAG_EXCLUSIONS.test(alias)),
        category: plant.category || "uncategorized",
        status: "active",
        provenance: uniqueStrings([
          ...enrichmentSourceIds,
          ...Object.values(plant.sections || {}).flatMap(
            (section) => section?.sourceIds || [],
          ),
          ...Object.values(plant.lifeCapabilities || {}).flatMap((claim) =>
            claim?.status === "known"
              ? claim.evidence.flatMap((item) => item.sourceIds)
              : [],
          ),
        ]).filter((id) => knownSourceIds.has(id)),
        guidanceProfile: neighborData.profiles?.[plant.id] || null,
        ...(Object.hasOwn(plant, "compatibilityProfile")
          ? {
              compatibilityProfile: validateCompatibilityProfile(
                plant.compatibilityProfile,
                knownSourceIds,
              ),
            }
          : {}),
        ...(Object.hasOwn(plant, "lifeCapabilities")
          ? {
              lifeCapabilities: validateGardenpediaLifeCapabilities(
                plant.lifeCapabilities,
                knownSourceIds,
              ),
            }
          : {}),
        reference: buildReference(
          plant,
          neighborData,
          sourceById,
          enrichmentSourceIds,
        ),
      };
    })
    .sort((a, b) => a.libraryPlantId.localeCompare(b.libraryPlantId));
  const identityDigest = crypto
    .createHash("sha256")
    .update(JSON.stringify(entries))
    .digest("hex")
    .slice(0, 16);
  return {
    schemaVersion: 1,
    catalogVersion: `gardenpedia-${identityDigest}`,
    generatedAt: new Date().toISOString(),
    entries,
    identityAliases,
    neighborRules: {
      researchPairs: neighborData.meta?.researchPairs || [],
      beneficialRoles: neighborData.meta?.beneficialRoles || {},
    },
  };
}

function writeGeneratedManifest(manifest) {
  fs.mkdirSync(path.dirname(generatedManifest), { recursive: true });
  fs.writeFileSync(
    generatedManifest,
    `// Generated by scripts/publish-gardenpedia.mjs. Do not edit manually.\nexport const gardenLibraryManifest = ${JSON.stringify(manifest, null, 2)} as const;\n\nexport type GardenLibraryManifest = typeof gardenLibraryManifest;\n`,
  );
}

function writeGeneratedPlantProfileIndex(allPlants, catalogManifest) {
  const aliasIds = new Set(
    (catalogManifest.identityAliases || []).map((alias) => alias.aliasId),
  );
  const publicProfileFiles = plantFiles.filter(
    (file) =>
      file === "data/plants.json" ||
      /data\/plants-expansion-(?:batch-[ab]1|wave-\d+)\.json$/.test(file),
  );
  const publicPlants = [
    ...publicProfileFiles.flatMap((file) => readJson(file)),
    // Curated public-only enrichments for catalog identities whose original
    // candidate notes live in private Garden/seed context files. This file is
    // independently reviewed content; those private files are never published.
    ...readJson("data/plant-profile-enrichment-v1.json"),
  ].filter((plant) => !aliasIds.has(plant.id));
  if (
    new Set(publicPlants.map((plant) => plant.id)).size !== publicPlants.length
  ) {
    throw new Error("Public Plant Profile inputs contain duplicate identity IDs.");
  }
  const translations = new Map();
  const publicTranslationFiles = [
    "data/translations-es.json",
    ...dataFiles.filter(
      (file) =>
        /^data\/translations-expansion-batch-[ab]1-es\.json$/.test(file) ||
        /^data\/translations-expansion-wave-\d+-es\.json$/.test(file),
    ),
  ];
  for (const file of publicTranslationFiles) {
    for (const [id, record] of Object.entries(readJson(file))) {
      translations.set(id, { ...(translations.get(id) || {}), ...record });
    }
  }

  const textOf = (value, locale) => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object")
      return value[locale] || value.en || "";
    return "";
  };
  const publicText = (value, locale) => {
    const text = textOf(value, locale);
    return text
      .replace(/User Zero[^.!?]*(?:[.!?]|$)/gi, "")
      .replace(/El material de referencia es planta a raíz desnuda, no semilla;\s*/gi, "")
      .replace(
        /El contexto del producto identifica material de fresa a raíz desnuda\.\s*Por eso no se publican instrucciones de semilla; la producción específica de estolones y propagación del cultivar siguen pendientes\./gi,
        "La propagación específica del cultivar sigue pendiente; no se infiere un protocolo de semilla.",
      )
      .replace(/la condición de llegada bare-root también es evidencia prioritaria\.?/gi, "")
      .replace(/el origen del stock a raíz desnuda\s*/gi, "")
      .replace(/owner_?id|user_?id|seed_package_?id|system_instance_?id/gi, "")
      .trim();
  };
  const publicSourceIds = new Set(
    catalogManifest.entries.flatMap((entry) =>
      entry.reference.sources.map((source) => source.id),
    ),
  );
  const itemsOf = (items, locale, translatedItems) => {
    const candidates = Array.isArray(translatedItems) ? translatedItems : items;
    return uniqueStrings(
      (Array.isArray(candidates) ? candidates : []).map((item) =>
        typeof item === "string"
          ? publicText(item, locale)
          : publicText(item?.text ?? item, locale),
      ).filter(Boolean),
    );
  };
  const publicMetric = (metric, translatedMetric) => {
    const labels = [metric?.label, translatedMetric?.label]
      .flatMap((value) =>
        typeof value === "string"
          ? [value]
          : value && typeof value === "object"
            ? Object.values(value)
            : [],
      )
      .filter((value) => typeof value === "string")
      .join(" ");
    const allFields = [metric, translatedMetric]
      .flatMap((item) => [item?.label, item?.value, item?.note])
      .flatMap((value) =>
        typeof value === "string"
          ? [value]
          : value && typeof value === "object"
            ? Object.values(value)
            : [],
      )
      .filter((value) => typeof value === "string")
      .join(" ");
    const seedStageMetric =
      /germination|sowing|emergence|seedling|seed packet|seed type|seed form|seed storage|seed treatment|transplant|germinaci[oó]n|siembra|emergencia|pl[aá]ntula|paquete de semillas|tipo de semilla|forma de semilla|almacenamiento de semillas|tratamiento de semillas|trasplante/i;
    const privateMetric = /owned|user zero|inventory|purchase|garden position|yCube/i;
    return !seedStageMetric.test(labels) && !privateMetric.test(allFields);
  };
  const profiles = Object.fromEntries(
    publicPlants.map((plant) => {
      const translated = translations.get(plant.id) || {};
      const sections = Object.fromEntries(
        Object.entries(plant.sections || {})
          .filter(([id]) => !["germination", "sowing", "seed"].includes(id))
          .filter(([, section]) =>
            (section.sourceIds || []).every((sourceId) => publicSourceIds.has(sourceId)),
          )
          .map(([id, section]) => {
          const translatedSection = translated.sections?.[id] || {};
          const spanishValue = (value, translatedValue) => {
            const inlineSpanish =
              value && typeof value === "object" && typeof value.es === "string"
                ? publicText(value, "es")
                : "";
            return inlineSpanish || publicText(translatedValue, "es") || publicText(value, "en");
          };
          const localized = (locale) => ({
            short:
              locale === "es"
                ? spanishValue(section.short, translatedSection.short)
                : publicText(section.short, "en"),
            guidance:
              locale === "es"
                ? spanishValue(section.guidance, translatedSection.guidance)
                : publicText(section.guidance, "en"),
            items: itemsOf(
              section.items,
              locale,
              locale === "es" ? translatedSection.items : undefined,
            ),
            avoid:
              locale === "es"
                ? publicText(translatedSection.avoid, "es") || publicText(section.avoid, "en")
                : publicText(section.avoid, "en"),
            context:
              locale === "es"
                ? publicText(translatedSection.context, "es") ||
                  publicText(section.context, "en")
                : publicText(section.context, "en"),
          });
          return [
            id,
            {
              evidenceType: section.evidenceType || "needs_validation",
              confidence: section.confidence || "pending",
              sourceIds: uniqueStrings(section.sourceIds || []),
              en: localized("en"),
              es: localized("es"),
            },
          ];
        }),
      );
      const metrics = (locale) =>
        (plant.metrics || []).flatMap((metric, index) => {
          const translatedMetric = translated.metrics?.[index];
          if (!publicMetric(metric, translatedMetric)) return [];
          const localizedMetric =
            locale === "es" && translatedMetric ? translatedMetric : metric;
          return [
            {
              label: textOf(localizedMetric.label, locale),
              value: textOf(localizedMetric.value, locale),
              note: textOf(localizedMetric.note, locale),
            },
          ];
        });
      return [
        plant.id,
        {
          summary: {
            en:
              publicText(plant.summary, "en") ||
              publicText(plant.sections?.identity?.short, "en"),
            es:
              (plant.summary &&
              typeof plant.summary === "object" &&
              typeof plant.summary.es === "string"
                ? publicText(plant.summary, "es")
                : publicText(translated.summary, "es")) ||
              publicText(translated.sections?.identity?.short, "es") ||
              publicText(plant.sections?.identity?.short, "es") ||
              publicText(plant.sections?.identity?.short, "en"),
          },
          metrics: { en: metrics("en"), es: metrics("es") },
          sections,
        },
      ];
    }),
  );
  const publishedIds = new Set(allPlants.map((plant) => plant.id));
  for (const id of Object.keys(profiles)) {
    if (!publishedIds.has(id))
      throw new Error(`Plant profile index contains unpublished identity: ${id}`);
  }
  fs.mkdirSync(path.dirname(generatedPlantProfileIndex), { recursive: true });
  fs.writeFileSync(
    generatedPlantProfileIndex,
    `// Generated by scripts/publish-gardenpedia.mjs from public editorial Plant Profiles only.\nexport const gardenPlantProfileCatalog = ${JSON.stringify(profiles, null, 2)} as const;\n\nexport type GardenPlantProfileCatalog = typeof gardenPlantProfileCatalog;\n`,
  );
}

function writeGeneratedMachineFacts() {
  const inventory = readJson("data/machine-inventory-v1.json");
  const modelsById = new Map(
    inventory.models.map((model) => [model.id, model]),
  );
  const systemDefinitions = Object.fromEntries(
    Object.entries(systemDefinitionMachineModels).map(
      ([definitionKey, modelId]) => {
        const model = modelsById.get(modelId);
        const inches = model?.light?.maxHeightIn;
        if (
          !model ||
          !Number.isFinite(inches) ||
          inches <= 0 ||
          !model.referenceUrl
        ) {
          throw new Error(
            `Missing source-backed machine facts for ${definitionKey}/${modelId}.`,
          );
        }
        return [
          definitionKey,
          {
            modelId,
            modelName: model.name,
            modelNumber: model.model,
            maxGrowHeightCm: Math.round(inches * 2.54 * 10) / 10,
            originalMaxGrowHeightIn: inches,
            source: {
              title: `${model.name} (${model.model}) product specification`,
              publisher: new URL(model.referenceUrl).hostname.replace(
                /^www\./,
                "",
              ),
              url: model.referenceUrl,
              note: `${inches} in converted to ${Math.round(inches * 2.54 * 10) / 10} cm.`,
            },
          },
        ];
      },
    ),
  );
  fs.mkdirSync(path.dirname(generatedMachineFacts), { recursive: true });
  fs.writeFileSync(
    generatedMachineFacts,
    `// Generated by scripts/publish-gardenpedia.mjs from machine-inventory-v1.json. Models only; personal machine instances are excluded.\nexport const gardenMachineFacts = ${JSON.stringify({ schemaVersion: 1, systemDefinitions }, null, 2)} as const;\n\nexport type GardenMachineFacts = typeof gardenMachineFacts;\n`,
  );
}

function writeGeneratedSeedProfileIndex() {
  const profiles = new Map();
  const aliases = readJson("data/plant-identity-aliases-v1.json").aliases;
  const canonicalIdFor = new Map(
    aliases.map((alias) => [alias.aliasId, alias.canonicalPlantId]),
  );
  for (const file of seedProfileFiles) {
    for (const [id, profile] of Object.entries(readJson(file).profiles || {})) {
      if (canonicalIdFor.has(id)) continue;
      profiles.set(id, { ...profile, plantIdentityId: id });
    }
  }
  for (const file of seedProfileFiles) {
    for (const [id, profile] of Object.entries(readJson(file).profiles || {})) {
      const canonicalId = canonicalIdFor.get(id) || id;
      if (canonicalId !== id && !profiles.has(canonicalId)) {
        profiles.set(canonicalId, {
          ...profile,
          plantIdentityId: canonicalId,
        });
      }
    }
  }
  const ids = [...profiles.keys()].sort();
  const catalog = ids.map((id) => {
    const profile = profiles.get(id);
    const sourceIds = new Set([
      ...(profile.quickFacts || []).flatMap((fact) => fact.sourceIds || []),
      ...(profile.sections || []).flatMap((section) => [
        ...(section.sourceIds || []),
        ...(section.items || []).flatMap((item) => item.sourceIds || []),
      ]),
    ]);
    return {
      id,
      summary: publicize(profile.summary),
      quickFactCount: (profile.quickFacts || []).length,
      sourceCount: sourceIds.size,
    };
  });
  fs.mkdirSync(path.dirname(generatedSeedProfileIndex), { recursive: true });
  fs.writeFileSync(
    generatedSeedProfileIndex,
    `// Generated by scripts/publish-gardenpedia.mjs. Card metadata only; profile bodies remain lazy-loaded.\nexport const gardenSeedProfileIds = ${JSON.stringify(ids, null, 2)} as const;\n\nexport const gardenSeedProfileCatalog = ${JSON.stringify(catalog, null, 2)} as const;\n\nexport const gardenSeedProfileCount = gardenSeedProfileIds.length;\n`,
  );
}

function filterPublicSources(relativePath) {
  return loadSourceRegistry(source, [relativePath], { publicOnly: true });
}

function loadPublicationManifest() {
  const allPlants = plantFiles.flatMap((file) => readJson(file));
  const allIds = new Set(allPlants.map((plant) => plant.id));
  const aliases = readJson("data/plant-identity-aliases-v1.json").aliases;
  const aliasIds = new Set(aliases.map((alias) => alias.aliasId));
  if (allIds.size !== allPlants.length) {
    throw new Error(
      `Gardenpedia source files contain duplicate plant record IDs: ${allPlants.length}/${allIds.size}.`,
    );
  }
  const canonicalPlants = allPlants.filter((plant) => !aliasIds.has(plant.id));
  const ids = new Set(canonicalPlants.map((plant) => plant.id));
  if (ids.size < 500) {
    throw new Error(
      `Gardenpedia requires at least 500 distinct canonical identities after alias reconciliation; got ${ids.size}.`,
    );
  }
  const catalogManifest = buildCatalogManifest(canonicalPlants, aliases);

  return { allPlants, canonicalPlants, ids, aliasIds, aliases, catalogManifest };
}

function prepareGeneratedArtifacts() {
  const { ids, canonicalPlants, catalogManifest } = loadPublicationManifest();
  writeGeneratedManifest(catalogManifest);
  writeGeneratedPlantProfileIndex(canonicalPlants, catalogManifest);
  writeGeneratedMachineFacts();
  writeGeneratedSeedProfileIndex();
  console.log(
    `Prepared Gardenpedia React artifacts with ${ids.size} varieties.`,
  );
}

function prepareLegacy() {
  const { ids, canonicalPlants, aliasIds, aliases, catalogManifest } = loadPublicationManifest();

  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  for (const file of publicFiles) copy(file);
  configureGardenXAuthTransport();
  fs.cpSync(path.join(source, "assets"), path.join(destination, "assets"), {
    recursive: true,
  });

  for (const file of [
    "expansion-batch-a1.js",
    "expansion-batch-b1.js",
    "harvest-use-v0.1.js",
  ]) {
    const target = path.join(destination, file);
    fs.writeFileSync(
      target,
      fs.readFileSync(target, "utf8").replaceAll("Garden Labs", "Gardenpedia"),
    );
  }

  const canonicalIdFor = new Map(
    aliases.map((alias) => [alias.aliasId, alias.canonicalPlantId]),
  );
  for (const file of dataFiles) {
    if (file.startsWith("data/sources-"))
      writeJson(file, publicize(filterPublicSources(file)));
    else if (file === "data/seed-inventory.json") continue;
    else if (file.startsWith("data/plants-") || file === "data/plants.json")
      writeJson(
        file,
        publicize(readJson(file).filter((plant) => !aliasIds.has(plant.id))),
      );
    else if (file.startsWith("data/seed-profiles-")) {
      const bundle = readJson(file);
      const profiles = {};
      for (const [id, profile] of Object.entries(bundle.profiles || {})) {
        const canonicalId = canonicalIdFor.get(id) || id;
        profiles[canonicalId] = { ...profile, plantIdentityId: canonicalId };
      }
      writeJson(file, publicize({ ...bundle, profiles }));
    }
    else if (file === "data/propagation-guidance-v1.json") {
      const bundle = readJson(file);
      const records = Object.fromEntries(
        Object.entries(bundle.records || {}).filter(
          ([id]) => !aliasIds.has(id),
        ),
      );
      for (const [aliasId, canonicalId] of canonicalIdFor) {
        if (!records[canonicalId] && bundle.records?.[aliasId])
          records[canonicalId] = bundle.records[aliasId];
      }
      writeJson(file, publicize({ ...bundle, records }));
    }
    else if (file === "data/machine-inventory-v1.json") {
      const catalog = publicize(readJson(file));
      writeJson(file, { ...catalog, instances: [] });
    } else writeJson(file, publicize(readJson(file)));
  }
  writeJson("data/catalog-manifest.json", catalogManifest);
  writeJson("data/plant-identity-aliases-v1.json", {
    schemaVersion: "gardenpedia_plant_identity_aliases_v1",
    publicationBoundary: "public-search-and-route-aliases-only",
    aliases,
  });
  writeGeneratedManifest(catalogManifest);
  writeGeneratedPlantProfileIndex(canonicalPlants, catalogManifest);
  writeGeneratedMachineFacts();
  writeJson("data/seed-inventory.json", {
    capturedAt: null,
    source: "public Gardenpedia",
    count: 0,
    items: [],
  });

  let index = fs.readFileSync(path.join(source, "index.html"), "utf8");
  index = index
    .replace("<head>", '<head><base href="/gardenpedia/" />')
    .replace(
      /<link rel="stylesheet" href="\.\/homegrown-source-comparison\.css[^"]*" \/>/,
      "",
    )
    .replace(/<script src="\.\/sites-storage-bootstrap[^>]*><\/script>/, "")
    .replace(/<script src="\.\/sites-storage-v1[^>]*><\/script>/, "")
    .replace(/<script src="\.\/vercel-storage-loader-v1[^>]*><\/script>/, "")
    .replace(/<script src="\.\/demo-shell[^>]*><\/script>/, "")
    .replace(/<script src="\.\/homegrown-source-comparison[^>]*><\/script>/, "")
    .replace(/<script src="\.\/seed-purchase-date[^>]*><\/script>/, "")
    .replace(
      /<link rel="manifest" href="[^"]+"/,
      '<link rel="manifest" href="./manifest.json"',
    )
    .replace(/<title>[^<]*<\/title>/, "<title>Gardenpedia · Garden X</title>")
    .replaceAll("PROTOTYPE STUDIO · 01", "PUBLIC LIBRARY")
    .replaceAll(
      "PROTOTIPO INTERACTIVO · DATOS DE DEMOSTRACIÓN",
      "BIBLIOTECA PÚBLICA · CONOCIMIENTO ESTRUCTURADO",
    )
    .replaceAll(
      "INTERACTIVE PROTOTYPE · DEMO DATA",
      "PUBLIC LIBRARY · STRUCTURED KNOWLEDGE",
    )
    .replace(
      /Garden Labs — experimental Garden X experiences for User Zero validation\./g,
      "Gardenpedia — public plant knowledge from Garden X.",
    )
    .replace(/Garden Labs/g, "Gardenpedia")
    .replace(/Laboratorio activo · User Zero/g, "Biblioteca pública · Garden X")
    .replace(/GARDEN LABS · LIBRARY/g, "GARDENPEDIA · LIBRARY")
    .replace(/GARDEN LABS · SEEDS/g, "GARDENPEDIA · LOCAL NOTES")
    .replace(/GARDEN LABS · GUÍA/g, "GARDENPEDIA · GUÍA")
    .replace(
      /BIBLIOTECA DE CULTIVOS USER ZERO/g,
      "BIBLIOTECA PÚBLICA DE CULTIVOS",
    )
    .replace(
      /Tu inventario real de semillas y material de cultivo, separado de la evidencia del Grow Guide\./g,
      "Notas locales de semillas, guardadas sólo en este dispositivo.",
    )
    .replace(/INVENTARIO USER ZERO/g, "NOTAS LOCALES")
    .replace(
      /Estado personal · evidencia separada/g,
      "Sólo en este dispositivo · sin datos de Garden X",
    );
  fs.writeFileSync(path.join(destination, "index.html"), index);

  let app = fs.readFileSync(path.join(destination, "app.js"), "utf8");
  app = app
    .replaceAll("gardenLabsLibraryView", "gardenpediaPublicLibraryView")
    .replaceAll("growGuideLanguage", "gardenpediaPublicLanguage")
    .replaceAll("GARDEN LABS · EXPERIMENTAL", "GARDENPEDIA · PUBLIC")
    .replaceAll("Active lab · User Zero", "Public knowledge library")
    .replaceAll("Laboratorio activo · User Zero", "Biblioteca pública")
    .replaceAll("USER ZERO validation", "Public source layers")
    .replaceAll("User Zero validation", "Public source layers")
    .replaceAll("Validación User Zero", "Fuentes públicas")
    .replaceAll("User Zero", "the grower")
    .replaceAll("Garden Labs", "Gardenpedia")
    .replaceAll("USER ZERO CROP LIBRARY", "PUBLIC PLANT LIBRARY")
    .replaceAll(
      "BIBLIOTECA DE CULTIVOS USER ZERO",
      "BIBLIOTECA PÚBLICA DE CULTIVOS",
    )
    .replaceAll("USER ZERO INVENTORY", "LOCAL SEED NOTES")
    .replaceAll("INVENTARIO USER ZERO", "NOTAS LOCALES")
    .replaceAll(
      "The packets you actually own, their approximate state and where they are. Lab changes are stored only on this device.",
      "Local seed notes are stored only on this device; Garden X account data is never read.",
    )
    .replaceAll(
      "Qué paquetes tienes realmente, su estado aproximado y dónde están. Los cambios de este Lab se guardan solo en este dispositivo.",
      "Notas locales de semillas, guardadas sólo en este dispositivo; no se lee la cuenta de Garden X.",
    )
    .replaceAll(
      "Garden Library brings growing knowledge and personal inventory together inside Garden Labs. Each layer keeps its own source of truth.",
      "Gardenpedia shares structured plant knowledge and sources without accessing private Garden X history.",
    )
    .replaceAll(
      "Garden Library reúne conocimiento de cultivo e inventario personal dentro de Garden Labs. Cada capa conserva su propia fuente de verdad.",
      "Gardenpedia comparte conocimiento estructurado y fuentes sin acceder al historial privado de Garden X.",
    )
    .replaceAll(
      'function registerServiceWorker() { if (!window.GROW_GUIDE_DISABLE_SW && "serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {}); }',
      'function registerServiceWorker() { if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistrations().then((registrations) => registrations.filter((registration) => registration.scope.includes("/gardenpedia/")).forEach((registration) => registration.unregister())).catch(() => {}); }',
    )
    .replaceAll("V0.6 · 29 guides", "V1.0 · 41 guides")
    .replaceAll("V0.6 · 29 guías", "V1.0 · 41 guías")
    .replaceAll(
      "V0.10 · 41 guides · ES/EN · source-aware + 36 inventory items",
      "V1.0 · 41 guides · ES/EN · public knowledge",
    )
    .replaceAll(
      "V0.10 · 41 guías · ES/EN · fuentes reconciliadas + 36 materiales",
      "V1.0 · 41 guías · ES/EN · conocimiento público",
    );
  fs.writeFileSync(path.join(destination, "app.js"), app);

  let manifest = fs
    .readFileSync(path.join(destination, "manifest.json"), "utf8")
    .replaceAll("Garden Labs", "Gardenpedia")
    .replaceAll(
      "Garden X experimental laboratory for User Zero product validation.",
      "Public plant knowledge from Garden X.",
    );
  fs.writeFileSync(path.join(destination, "manifest.json"), manifest);
  console.log(
    `Prepared legacy Gardenpedia artifact with ${ids.size} varieties.`,
  );
}

function clean() {
  fs.rmSync(destination, { recursive: true, force: true });
}

if (process.argv.includes("--clean")) clean();
else if (process.argv.includes("--legacy")) prepareLegacy();
else prepareGeneratedArtifacts();
