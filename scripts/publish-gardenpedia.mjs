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

function buildReference(plant, neighborData, sourceById) {
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

function buildCatalogManifest(plants) {
  const neighborData = readJson("data/neighbor-profiles.json");
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
    "data/sources-requests.json",
  ].flatMap((file) => filterPublicSources(file));
  const sourceById = new Map(
    sourceRecords.map((source) => [source.id, source]),
  );
  const knownSourceIds = new Set(sourceById.keys());
  const entries = plants
    .map((plant) => ({
      libraryPlantId: plant.id,
      commonName: plant.name,
      spanishName: plant.spanishName || null,
      scientificName: plant.scientificName || null,
      cultivar: publicCultivar(plant),
      aliases: uniqueStrings([
        plant.name,
        plant.spanishName,
        plant.scientificName,
        publicCultivar(plant),
        ...(plant.tags || []).filter((tag) => !PUBLIC_TAG_EXCLUSIONS.test(tag)),
      ]).filter((alias) => !PUBLIC_TAG_EXCLUSIONS.test(alias)),
      category: plant.category || "uncategorized",
      status: "active",
      provenance: uniqueStrings([
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
      reference: buildReference(plant, neighborData, sourceById),
    }))
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
  const publicProfileFiles = plantFiles.filter(
    (file) =>
      file === "data/plants.json" ||
      /data\/plants-expansion-(?:batch-[ab]1|wave-\d+)\.json$/.test(file),
  );
  const publicPlants = publicProfileFiles.flatMap((file) => readJson(file));
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
  const publicMetric = (metric) =>
    !/germination|sowing|seed|owned|user zero|inventory|purchase|garden position|yCube/i.test(
      `${metric?.label || ""} ${metric?.value || ""} ${metric?.note || ""}`,
    );
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
          const localized = (locale) => ({
            short:
              locale === "es"
                ? publicText(translatedSection.short, "es") || publicText(section.short, "en")
                : publicText(section.short, "en"),
            guidance:
              locale === "es"
                ? publicText(translatedSection.guidance, "es") ||
                  publicText(section.guidance, "en")
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
        (locale === "es" ? translated.metrics || plant.metrics : plant.metrics)
          ?.filter(publicMetric)
          .map((metric) => ({
            label: textOf(metric.label, locale),
            value: textOf(metric.value, locale),
            note: textOf(metric.note, locale),
          })) || [];
      return [
        plant.id,
        {
          summary: {
            en:
              publicText(plant.summary, "en") ||
              publicText(plant.sections?.identity?.short, "en"),
            es:
              publicText(translated.summary, "es") ||
              publicText(translated.sections?.identity?.short, "es") ||
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
  for (const file of seedProfileFiles) {
    for (const [id, profile] of Object.entries(readJson(file).profiles || {})) {
      profiles.set(id, profile);
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
  const ids = new Set(allPlants.map((plant) => plant.id));
  if (allPlants.length < 500 || ids.size !== allPlants.length) {
    throw new Error(
      `Gardenpedia library must contain at least 500 unique varieties; got ${allPlants.length}/${ids.size}.`,
    );
  }
  const catalogManifest = buildCatalogManifest(allPlants);

  return { allPlants, ids, catalogManifest };
}

function prepareGeneratedArtifacts() {
  const { ids, allPlants, catalogManifest } = loadPublicationManifest();
  writeGeneratedManifest(catalogManifest);
  writeGeneratedPlantProfileIndex(allPlants, catalogManifest);
  writeGeneratedMachineFacts();
  writeGeneratedSeedProfileIndex();
  console.log(
    `Prepared Gardenpedia React artifacts with ${ids.size} varieties.`,
  );
}

function prepareLegacy() {
  const { ids, allPlants, catalogManifest } = loadPublicationManifest();

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

  for (const file of dataFiles) {
    if (file.startsWith("data/sources-"))
      writeJson(file, publicize(filterPublicSources(file)));
    else if (file === "data/seed-inventory.json") continue;
    else if (file === "data/machine-inventory-v1.json") {
      const catalog = publicize(readJson(file));
      writeJson(file, { ...catalog, instances: [] });
    } else writeJson(file, publicize(readJson(file)));
  }
  writeJson("data/catalog-manifest.json", catalogManifest);
  writeGeneratedManifest(catalogManifest);
  writeGeneratedPlantProfileIndex(allPlants, catalogManifest);
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
