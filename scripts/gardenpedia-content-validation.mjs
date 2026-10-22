import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCompatibilityProfile } from "./gardenpedia-compatibility-profile.mjs";
import { loadSourceRegistry } from "./gardenpedia-source-registry.mjs";
import { validateTaxonomyReconciliation } from "./gardenpedia-taxonomy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "labs", "gardenpedia", "data");
const plantFiles = [
  "plants.json",
  "plants-current-gardens.json",
  "plants-owned-seeds.json",
  "plants-expansion-batch-a1.json",
  "plants-expansion-batch-b1.json",
  "plants-expansion-wave-1.json",
  "plants-expansion-wave-2.json",
  "plants-expansion-wave-3.json",
  "plants-expansion-wave-4.json",
  "plants-expansion-wave-5.json",
  "plants-expansion-wave-6.json",
  "plants-expansion-wave-7.json",
  "plants-expansion-wave-8.json",
  "plants-expansion-wave-9.json",
  "plants-expansion-wave-10.json",
  "plants-expansion-wave-11.json",
  "plants-expansion-wave-12.json",
  "plants-expansion-wave-13.json",
  "plants-expansion-wave-14.json",
  "plants-expansion-wave-15.json",
  "plants-expansion-wave-16.json",
  "plants-expansion-wave-17.json",
  "plants-expansion-wave-18.json",
  "plants-expansion-wave-19.json",
  "plants-expansion-wave-20.json",
  "plants-expansion-wave-21.json",
  "plants-expansion-wave-22.json",
  "plants-expansion-wave-23.json",
  "plants-expansion-wave-24.json",
  "plants-expansion-wave-25.json",
  "plants-expansion-wave-26.json",
  "plants-expansion-wave-27.json",
  "plants-expansion-wave-28.json",
  "plants-expansion-wave-29.json",
  "plants-expansion-wave-30.json",
  "plants-expansion-wave-31.json",
  "plants-expansion-wave-32.json",
  "plants-expansion-wave-33.json",
  "plants-expansion-wave-34.json",
  "plants-expansion-wave-35.json",
  "plants-expansion-wave-36.json",
  "plants-expansion-wave-37.json",
  "plants-expansion-wave-38.json",
  "plants-expansion-wave-39.json",
  "plants-expansion-wave-40.json",
  "plants-expansion-wave-41.json",
  "plants-expansion-wave-42.json",
  "plants-expansion-wave-43.json",
  "plants-expansion-wave-44.json",
  "plants-expansion-wave-45.json",
  "plants-expansion-wave-46.json",
  "plants-expansion-wave-47.json",
  "plants-expansion-wave-48.json",
  "plants-expansion-wave-49.json",
  "plants-expansion-wave-50.json",
  "plants-expansion-wave-51.json",
  "plants-expansion-wave-52.json",
  "plants-expansion-wave-53.json",
  "plants-expansion-wave-54.json",
  "plants-expansion-wave-55.json",
  "plants-expansion-wave-56.json",
  "plants-expansion-wave-57.json",
  "plants-expansion-wave-58.json",
  "plants-expansion-wave-59.json",
  "plants-expansion-wave-60.json",
  "plants-expansion-wave-61.json",
  "plants-expansion-wave-62.json",
  "plants-expansion-wave-63.json",
  "plants-requests.json",
];
const sourceFiles = [
  "sources.json",
  "sources-current-gardens.json",
  "sources-owned-seeds.json",
  "sources-expansion-batch-a1.json",
  "sources-expansion-batch-b1.json",
  "sources-expansion-wave-1.json",
  "sources-expansion-wave-2.json",
  "sources-expansion-wave-3.json",
  "sources-expansion-wave-4.json",
  "sources-expansion-wave-5.json",
  "sources-expansion-wave-6.json",
  "sources-expansion-wave-7.json",
  "sources-expansion-wave-8.json",
  "sources-expansion-wave-9.json",
  "sources-expansion-wave-10.json",
  "sources-expansion-wave-11.json",
  "sources-expansion-wave-12.json",
  "sources-expansion-wave-13.json",
  "sources-expansion-wave-14.json",
  "sources-expansion-wave-15.json",
  "sources-expansion-wave-16.json",
  "sources-expansion-wave-17.json",
  "sources-expansion-wave-18.json",
  "sources-expansion-wave-19.json",
  "sources-expansion-wave-20.json",
  "sources-expansion-wave-21.json",
  "sources-expansion-wave-22.json",
  "sources-expansion-wave-23.json",
  "sources-expansion-wave-24.json",
  "sources-expansion-wave-25.json",
  "sources-expansion-wave-26.json",
  "sources-expansion-wave-27.json",
  "sources-expansion-wave-28.json",
  "sources-expansion-wave-29.json",
  "sources-expansion-wave-30.json",
  "sources-expansion-wave-31.json",
  "sources-expansion-wave-32.json",
  "sources-expansion-wave-33.json",
  "sources-expansion-wave-34.json",
  "sources-expansion-wave-35.json",
  "sources-expansion-wave-36.json",
  "sources-expansion-wave-37.json",
  "sources-expansion-wave-38.json",
  "sources-expansion-wave-39.json",
  "sources-expansion-wave-40.json",
  "sources-expansion-wave-41.json",
  "sources-expansion-wave-42.json",
  "sources-expansion-wave-43.json",
  "sources-expansion-wave-44.json",
  "sources-expansion-wave-45.json",
  "sources-expansion-wave-46.json",
  "sources-expansion-wave-47.json",
  "sources-expansion-wave-48.json",
  "sources-expansion-wave-49.json",
  "sources-expansion-wave-50.json",
  "sources-expansion-wave-51.json",
  "sources-expansion-wave-52.json",
  "sources-expansion-wave-53.json",
  "sources-expansion-wave-54.json",
  "sources-expansion-wave-55.json",
  "sources-expansion-wave-56.json",
  "sources-expansion-wave-57.json",
  "sources-expansion-wave-58.json",
  "sources-expansion-wave-59.json",
  "sources-expansion-wave-60.json",
  "sources-expansion-wave-61.json",
  "sources-expansion-wave-62.json",
  "sources-expansion-wave-63.json",
  "sources-requests.json",
];
const read = (file) =>
  JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
const plants = plantFiles.flatMap(read);
const identityAliases = read("plant-identity-aliases-v1.json").aliases;
const aliasIds = new Set(identityAliases.map((alias) => alias.aliasId));
const canonicalIdByAlias = new Map(
  identityAliases.map((alias) => [alias.aliasId, alias.canonicalPlantId]),
);
const profileEnrichments = read("plant-profile-enrichment-v1.json");
const sources = loadSourceRegistry(dataDir, sourceFiles);
const publicSources = loadSourceRegistry(dataDir, sourceFiles, { publicOnly: true });
const sourceIds = new Set(sources.map((source) => source.id));
const plantIds = new Set();
const wave1Plants = read("plants-expansion-wave-1.json");
const wave2Plants = read("plants-expansion-wave-2.json");
const wave3Plants = read("plants-expansion-wave-3.json");
const wave4Plants = read("plants-expansion-wave-4.json");
const wave5Plants = read("plants-expansion-wave-5.json");
const wave6Plants = read("plants-expansion-wave-6.json");
const wave7Plants = read("plants-expansion-wave-7.json");
const wave8Plants = read("plants-expansion-wave-8.json");
const wave9Plants = read("plants-expansion-wave-9.json");
const wave10Plants = read("plants-expansion-wave-10.json");
const wave11Plants = read("plants-expansion-wave-11.json");
const wave12Plants = read("plants-expansion-wave-12.json");
const wave13Plants = read("plants-expansion-wave-13.json");
const wave14Plants = read("plants-expansion-wave-14.json");
const wave15Plants = read("plants-expansion-wave-15.json");
const wave16Plants = read("plants-expansion-wave-16.json");
const wave17Plants = read("plants-expansion-wave-17.json");
const wave18Plants = read("plants-expansion-wave-18.json");
const wave19Plants = read("plants-expansion-wave-19.json");
const wave20Plants = read("plants-expansion-wave-20.json");
const wave21Plants = read("plants-expansion-wave-21.json");
const wave22Plants = read("plants-expansion-wave-22.json");
const wave23Plants = read("plants-expansion-wave-23.json");
const wave24Plants = read("plants-expansion-wave-24.json");
const wave25Plants = read("plants-expansion-wave-25.json");
const wave26Plants = read("plants-expansion-wave-26.json");
const wave27Plants = read("plants-expansion-wave-27.json");
const wave28Plants = read("plants-expansion-wave-28.json");
const wave29Plants = read("plants-expansion-wave-29.json");
const wave30Plants = read("plants-expansion-wave-30.json");
const wave31Plants = read("plants-expansion-wave-31.json");
const wave32Plants = read("plants-expansion-wave-32.json");
const wave33Plants = read("plants-expansion-wave-33.json");
const wave34Plants = read("plants-expansion-wave-34.json");
const wave35Plants = read("plants-expansion-wave-35.json");
const wave36Plants = read("plants-expansion-wave-36.json");
const wave37Plants = read("plants-expansion-wave-37.json");
const wave38Plants = read("plants-expansion-wave-38.json");
const wave39Plants = read("plants-expansion-wave-39.json");
const wave40Plants = read("plants-expansion-wave-40.json");
const wave41Plants = read("plants-expansion-wave-41.json");
const wave42Plants = read("plants-expansion-wave-42.json");
const wave43Plants = read("plants-expansion-wave-43.json");
const wave44Plants = read("plants-expansion-wave-44.json");
const wave45Plants = read("plants-expansion-wave-45.json");
const wave46Plants = read("plants-expansion-wave-46.json");
const wave47Plants = read("plants-expansion-wave-47.json");
const wave48Plants = read("plants-expansion-wave-48.json");
const wave49Plants = read("plants-expansion-wave-49.json");
const wave50Plants = read("plants-expansion-wave-50.json");
const wave51Plants = read("plants-expansion-wave-51.json");
const wave52Plants = read("plants-expansion-wave-52.json");
const wave53Plants = read("plants-expansion-wave-53.json");
const wave54Plants = read("plants-expansion-wave-54.json");
const wave55Plants = read("plants-expansion-wave-55.json");
const wave56Plants = read("plants-expansion-wave-56.json");
const wave57Plants = read("plants-expansion-wave-57.json");
const wave58Plants = read("plants-expansion-wave-58.json");
const wave59Plants = read("plants-expansion-wave-59.json");
const wave60Plants = read("plants-expansion-wave-60.json");
const wave61Plants = read("plants-expansion-wave-61.json");
const wave62Plants = read("plants-expansion-wave-62.json");
const wave63Plants = read("plants-expansion-wave-63.json");
const wave1Translations = read("translations-expansion-wave-1-es.json");
const wave2Translations = read("translations-expansion-wave-2-es.json");
const wave3Translations = read("translations-expansion-wave-3-es.json");
const wave4Translations = read("translations-expansion-wave-4-es.json");
const wave5Translations = read("translations-expansion-wave-5-es.json");
const wave6Translations = read("translations-expansion-wave-6-es.json");
const wave7Translations = read("translations-expansion-wave-7-es.json");
const wave8Translations = read("translations-expansion-wave-8-es.json");
const wave9Translations = read("translations-expansion-wave-9-es.json");
const wave10Translations = read("translations-expansion-wave-10-es.json");
const wave11Translations = read("translations-expansion-wave-11-es.json");
const wave12Translations = read("translations-expansion-wave-12-es.json");
const wave13Translations = read("translations-expansion-wave-13-es.json");
const wave14Translations = read("translations-expansion-wave-14-es.json");
const wave15Translations = read("translations-expansion-wave-15-es.json");
const wave16Translations = read("translations-expansion-wave-16-es.json");
const wave17Translations = read("translations-expansion-wave-17-es.json");
const wave18Translations = read("translations-expansion-wave-18-es.json");
const wave19Translations = read("translations-expansion-wave-19-es.json");
const wave20Translations = read("translations-expansion-wave-20-es.json");
const wave21Translations = read("translations-expansion-wave-21-es.json");
const wave22Translations = read("translations-expansion-wave-22-es.json");
const wave23Translations = read("translations-expansion-wave-23-es.json");
const wave24Translations = read("translations-expansion-wave-24-es.json");
const wave25Translations = read("translations-expansion-wave-25-es.json");
const wave26Translations = read("translations-expansion-wave-26-es.json");
const wave27Translations = read("translations-expansion-wave-27-es.json");
const wave28Translations = read("translations-expansion-wave-28-es.json");
const wave29Translations = read("translations-expansion-wave-29-es.json");
const wave30Translations = read("translations-expansion-wave-30-es.json");
const wave31Translations = read("translations-expansion-wave-31-es.json");
const wave32Translations = read("translations-expansion-wave-32-es.json");
const wave33Translations = read("translations-expansion-wave-33-es.json");
const wave34Translations = read("translations-expansion-wave-34-es.json");
const wave35Translations = read("translations-expansion-wave-35-es.json");
const wave36Translations = read("translations-expansion-wave-36-es.json");
const wave37Translations = read("translations-expansion-wave-37-es.json");
const wave38Translations = read("translations-expansion-wave-38-es.json");
const wave39Translations = read("translations-expansion-wave-39-es.json");
const wave40Translations = read("translations-expansion-wave-40-es.json");
const wave41Translations = read("translations-expansion-wave-41-es.json");
const wave42Translations = read("translations-expansion-wave-42-es.json");
const wave43Translations = read("translations-expansion-wave-43-es.json");
const wave44Translations = read("translations-expansion-wave-44-es.json");
const wave45Translations = read("translations-expansion-wave-45-es.json");
const wave46Translations = read("translations-expansion-wave-46-es.json");
const wave47Translations = read("translations-expansion-wave-47-es.json");
const wave48Translations = read("translations-expansion-wave-48-es.json");
const wave49Translations = read("translations-expansion-wave-49-es.json");
const wave50Translations = read("translations-expansion-wave-50-es.json");
const wave51Translations = read("translations-expansion-wave-51-es.json");
const wave52Translations = read("translations-expansion-wave-52-es.json");
const wave53Translations = read("translations-expansion-wave-53-es.json");
const wave54Translations = read("translations-expansion-wave-54-es.json");
const wave55Translations = read("translations-expansion-wave-55-es.json");
const wave56Translations = read("translations-expansion-wave-56-es.json");
const wave57Translations = read("translations-expansion-wave-57-es.json");
const wave58Translations = read("translations-expansion-wave-58-es.json");
const wave59Translations = read("translations-expansion-wave-59-es.json");
const wave60Translations = read("translations-expansion-wave-60-es.json");
const wave61Translations = read("translations-expansion-wave-61-es.json");
const wave62Translations = read("translations-expansion-wave-62-es.json");
const wave63Translations = read("translations-expansion-wave-63-es.json");
const wave1SeedProfiles = read("seed-profiles-expansion-wave-1.json");
const wave2SeedProfiles = read("seed-profiles-expansion-wave-2.json");
const wave3SeedProfiles = read("seed-profiles-expansion-wave-3.json");
const wave4SeedProfiles = read("seed-profiles-expansion-wave-4.json");
const wave5SeedProfiles = read("seed-profiles-expansion-wave-5.json");
const wave6SeedProfiles = read("seed-profiles-expansion-wave-6.json");
const wave7SeedProfiles = read("seed-profiles-expansion-wave-7.json");
const wave8SeedProfiles = read("seed-profiles-expansion-wave-8.json");
const wave9SeedProfiles = read("seed-profiles-expansion-wave-9.json");
const wave10SeedProfiles = read("seed-profiles-expansion-wave-10.json");
const wave13SeedProfiles = read("seed-profiles-expansion-wave-13.json");
const wave1PlantIds = new Set(wave1Plants.map((plant) => plant.id));
const wave2PlantIds = new Set(wave2Plants.map((plant) => plant.id));
const wave3PlantIds = new Set(wave3Plants.map((plant) => plant.id));
const wave4PlantIds = new Set(wave4Plants.map((plant) => plant.id));
const wave5PlantIds = new Set(wave5Plants.map((plant) => plant.id));
const wave6PlantIds = new Set(wave6Plants.map((plant) => plant.id));
const wave7PlantIds = new Set(wave7Plants.map((plant) => plant.id));
const wave8PlantIds = new Set(wave8Plants.map((plant) => plant.id));
const wave9PlantIds = new Set(wave9Plants.map((plant) => plant.id));
const wave10PlantIds = new Set(wave10Plants.map((plant) => plant.id));
const wave11PlantIds = new Set(wave11Plants.map((plant) => plant.id));
const wave12PlantIds = new Set(wave12Plants.map((plant) => plant.id));
const wave13PlantIds = new Set(wave13Plants.map((plant) => plant.id));
const wave14PlantIds = new Set(wave14Plants.map((plant) => plant.id));
const wave15PlantIds = new Set(wave15Plants.map((plant) => plant.id));
const wave16PlantIds = new Set(wave16Plants.map((plant) => plant.id));
const wave17PlantIds = new Set(wave17Plants.map((plant) => plant.id));
const wave18PlantIds = new Set(wave18Plants.map((plant) => plant.id));
const wave19PlantIds = new Set(wave19Plants.map((plant) => plant.id));
const wave20PlantIds = new Set(wave20Plants.map((plant) => plant.id));
const wave21PlantIds = new Set(wave21Plants.map((plant) => plant.id));
const wave22PlantIds = new Set(wave22Plants.map((plant) => plant.id));
const wave23PlantIds = new Set(wave23Plants.map((plant) => plant.id));
const wave24PlantIds = new Set(wave24Plants.map((plant) => plant.id));
const wave25PlantIds = new Set(wave25Plants.map((plant) => plant.id));
const wave26PlantIds = new Set(wave26Plants.map((plant) => plant.id));
const wave27PlantIds = new Set(wave27Plants.map((plant) => plant.id));
const wave28PlantIds = new Set(wave28Plants.map((plant) => plant.id));
const wave29PlantIds = new Set(wave29Plants.map((plant) => plant.id));
const wave30PlantIds = new Set(wave30Plants.map((plant) => plant.id));
const wave31PlantIds = new Set(wave31Plants.map((plant) => plant.id));
const wave32PlantIds = new Set(wave32Plants.map((plant) => plant.id));
const wave33PlantIds = new Set(wave33Plants.map((plant) => plant.id));
const wave34PlantIds = new Set(wave34Plants.map((plant) => plant.id));
const wave35PlantIds = new Set(wave35Plants.map((plant) => plant.id));
const wave36PlantIds = new Set(wave36Plants.map((plant) => plant.id));
const wave37PlantIds = new Set(wave37Plants.map((plant) => plant.id));
const wave38PlantIds = new Set(wave38Plants.map((plant) => plant.id));
const wave39PlantIds = new Set(wave39Plants.map((plant) => plant.id));
const wave40PlantIds = new Set(wave40Plants.map((plant) => plant.id));
const wave41PlantIds = new Set(wave41Plants.map((plant) => plant.id));
const wave42PlantIds = new Set(wave42Plants.map((plant) => plant.id));
const wave43PlantIds = new Set(wave43Plants.map((plant) => plant.id));
const wave44PlantIds = new Set(wave44Plants.map((plant) => plant.id));
const wave45PlantIds = new Set(wave45Plants.map((plant) => plant.id));
const wave46PlantIds = new Set(wave46Plants.map((plant) => plant.id));
const wave47PlantIds = new Set(wave47Plants.map((plant) => plant.id));
const wave48PlantIds = new Set(wave48Plants.map((plant) => plant.id));
const wave49PlantIds = new Set(wave49Plants.map((plant) => plant.id));
const wave50PlantIds = new Set(wave50Plants.map((plant) => plant.id));
const wave51PlantIds = new Set(wave51Plants.map((plant) => plant.id));
const wave52PlantIds = new Set(wave52Plants.map((plant) => plant.id));
const wave53PlantIds = new Set(wave53Plants.map((plant) => plant.id));
const wave54PlantIds = new Set(wave54Plants.map((plant) => plant.id));
const wave55PlantIds = new Set(wave55Plants.map((plant) => plant.id));
const wave56PlantIds = new Set(wave56Plants.map((plant) => plant.id));
const wave57PlantIds = new Set(wave57Plants.map((plant) => plant.id));
const wave58PlantIds = new Set(wave58Plants.map((plant) => plant.id));
const wave59PlantIds = new Set(wave59Plants.map((plant) => plant.id));
const wave60PlantIds = new Set(wave60Plants.map((plant) => plant.id));
const wave61PlantIds = new Set(wave61Plants.map((plant) => plant.id));
const wavePlantIds = new Set([
  ...wave1PlantIds,
  ...wave2PlantIds,
  ...wave3PlantIds,
  ...wave4PlantIds,
  ...wave5PlantIds,
  ...wave6PlantIds,
  ...wave7PlantIds,
  ...wave8PlantIds,
  ...wave9PlantIds,
  ...wave10PlantIds,
  ...wave11PlantIds,
  ...wave12PlantIds,
  ...wave13PlantIds,
  ...wave14PlantIds,
  ...wave15PlantIds,
  ...wave16PlantIds,
  ...wave17PlantIds,
  ...wave18PlantIds,
  ...wave19PlantIds,
  ...wave20PlantIds,
  ...wave21PlantIds,
  ...wave22PlantIds,
  ...wave23PlantIds,
  ...wave24PlantIds,
  ...wave25PlantIds,
  ...wave26PlantIds,
  ...wave27PlantIds,
  ...wave28PlantIds,
  ...wave29PlantIds,
  ...wave30PlantIds,
  ...wave31PlantIds,
  ...wave32PlantIds,
  ...wave33PlantIds,
  ...wave34PlantIds,
  ...wave35PlantIds,
  ...wave36PlantIds,
  ...wave37PlantIds,
  ...wave38PlantIds,
  ...wave39PlantIds,
  ...wave40PlantIds,
  ...wave41PlantIds,
  ...wave42PlantIds,
  ...wave43PlantIds,
  ...wave44PlantIds,
  ...wave45PlantIds,
  ...wave46PlantIds,
  ...wave47PlantIds,
  ...wave48PlantIds,
  ...wave49PlantIds,
  ...wave50PlantIds,
  ...wave51PlantIds,
  ...wave52PlantIds,
  ...wave53PlantIds,
  ...wave54PlantIds,
  ...wave55PlantIds,
  ...wave56PlantIds,
  ...wave57PlantIds,
  ...wave58PlantIds,
  ...wave59PlantIds,
  ...wave60PlantIds,
  ...wave61PlantIds,
  ...new Set(wave62Plants.map((plant) => plant.id)),
  ...new Set(wave63Plants.map((plant) => plant.id)),
]);
for (const aliasId of aliasIds) wavePlantIds.delete(aliasId);

function collectSourceIds(value, result = new Set()) {
  if (Array.isArray(value))
    value.forEach((item) => collectSourceIds(item, result));
  else if (value && typeof value === "object") {
    if (Array.isArray(value.sourceIds))
      value.sourceIds.forEach((id) => result.add(id));
    Object.values(value).forEach((item) => collectSourceIds(item, result));
  }
  return result;
}

for (const plant of plants) {
  if (!plant.id || plantIds.has(plant.id))
    throw new Error(`Duplicate or missing plant ID: ${plant.id}`);
  plantIds.add(plant.id);
  if (
    !plant.name ||
    !plant.spanishName ||
    !plant.scientificName
  )
    throw new Error(`Incomplete identity fields: ${plant.id}`);
  for (const [sectionName, section] of Object.entries(plant.sections || {})) {
    if (
      !["source_backed", "garden_adaptation", "needs_validation"].includes(
        section.evidenceType,
      )
    )
      throw new Error(`Invalid evidence type at ${plant.id}.${sectionName}`);
    if (
      wavePlantIds.has(plant.id) &&
      section.evidenceType !== "needs_validation" &&
      (!Array.isArray(section.sourceIds) || section.sourceIds.length === 0)
    )
      throw new Error(
        `Expansion sourced section has no source IDs: ${plant.id}.${sectionName}`,
      );
  }
  validateCompatibilityProfile(plant.compatibilityProfile, sourceIds);
  for (const sourceId of collectSourceIds(plant))
    if (!sourceIds.has(sourceId))
      throw new Error(`Dangling plant source ID ${sourceId} in ${plant.id}`);
}

if (plants.length < 500 || plantIds.size !== plants.length)
  throw new Error(
    `Expected at least 500 unique identities, got ${plants.length}/${plantIds.size}`,
  );
for (const alias of identityAliases) {
  if (
    !alias.aliasId ||
    !alias.canonicalPlantId ||
    alias.aliasId === alias.canonicalPlantId ||
    !plantIds.has(alias.aliasId) ||
    !plantIds.has(alias.canonicalPlantId) ||
    !Array.isArray(alias.sourceIds) ||
    alias.sourceIds.length === 0 ||
    alias.sourceIds.some((id) => !sourceIds.has(id))
  )
    throw new Error(`Invalid Gardenpedia identity alias: ${alias.aliasId}`);
}
if (aliasIds.size !== identityAliases.length)
  throw new Error("Duplicate Gardenpedia identity alias IDs");
const canonicalPlantIds = new Set(
  [...plantIds].filter((id) => !aliasIds.has(id)),
);
if (canonicalPlantIds.size < 500)
  throw new Error(
    `Expected at least 500 distinct canonical identities after alias reconciliation, got ${canonicalPlantIds.size}`,
  );
if (
  wave1Plants.length !== 29 ||
  Object.keys(wave1Translations).length !== wave1Plants.length ||
  Object.keys(wave1SeedProfiles.profiles).length !== wave1Plants.length
)
  throw new Error(
    "Wave 1 plant, translation, and seed-profile counts do not match",
  );
if (
  wave2Plants.length !== 36 ||
  Object.keys(wave2Translations).length !== wave2Plants.length ||
  Object.keys(wave2SeedProfiles.profiles).length !== wave2Plants.length
)
  throw new Error(
    "Wave 2 plant, translation, and seed-profile counts do not match",
  );
if (
  wave3Plants.length !== 47 ||
  Object.keys(wave3Translations).length !== wave3Plants.length ||
  Object.keys(wave3SeedProfiles.profiles).length !== wave3Plants.length
)
  throw new Error(
    "Wave 3 plant, translation, and seed-profile counts do not match",
  );
if (
  wave4Plants.length !== 59 ||
  Object.keys(wave4Translations).length !== wave4Plants.length ||
  Object.keys(wave4SeedProfiles.profiles).length !== wave4Plants.length
)
  throw new Error(
    "Wave 4 plant, translation, and seed-profile counts do not match",
  );
if (
  wave5Plants.length !== 4 ||
  Object.keys(wave5Translations).length !== wave5Plants.length ||
  Object.keys(wave5SeedProfiles.profiles).length !== wave5Plants.length
)
  throw new Error(
    "Wave 5 plant, translation, and seed-profile counts do not match",
  );
if (
  wave6Plants.length !== 4 ||
  Object.keys(wave6Translations).length !== wave6Plants.length ||
  Object.keys(wave6SeedProfiles.profiles).length !== 2
)
  throw new Error(
    "Wave 6 plant, translation, and propagation-profile counts do not match",
  );
if (
  wave7Plants.length !== 10 ||
  Object.keys(wave7Translations).length !== wave7Plants.length ||
  Object.keys(wave7SeedProfiles.profiles).length !== 8
)
  throw new Error(
    "Wave 7 plant, translation, and seed/propagation-profile counts do not match",
  );
if (
  wave8Plants.length !== 5 ||
  Object.keys(wave8Translations).length !== wave8Plants.length ||
  Object.keys(wave8SeedProfiles.profiles).length !== 3
)
  throw new Error(
    "Wave 8 plant, translation, and seed-profile counts do not match",
  );
if (
  wave9Plants.length !== 7 ||
  Object.keys(wave9Translations).length !== wave9Plants.length ||
  Object.keys(wave9SeedProfiles.profiles).length !== wave9Plants.length
)
  throw new Error(
    "Wave 9 plant, translation, and seed-profile counts do not match",
  );
if (
  wave10Plants.length !== 8 ||
  Object.keys(wave10Translations).length !== wave10Plants.length ||
  Object.keys(wave10SeedProfiles.profiles).length !== wave10Plants.length
)
  throw new Error(
    "Wave 10 plant, translation, and seed-profile counts do not match",
  );
if (wave11Plants.length !== 1 || Object.keys(wave11Translations).length !== 1)
  throw new Error("Wave 11 plant and translation counts do not match");
if (wave12Plants.length !== 4 || Object.keys(wave12Translations).length !== wave12Plants.length)
  throw new Error("Wave 12 plant and translation counts do not match");
if (wave13Plants.length !== 3 || Object.keys(wave13Translations).length !== wave13Plants.length || Object.keys(wave13SeedProfiles.profiles).length !== wave13Plants.length)
  throw new Error("Wave 13 plant, translation, and seed-profile counts do not match");
if (wave14Plants.length !== 4 || Object.keys(wave14Translations).length !== wave14Plants.length)
  throw new Error("Wave 14 plant and translation counts do not match");
if (wave15Plants.length !== 2 || Object.keys(wave15Translations).length !== wave15Plants.length || Object.keys(read("seed-profiles-expansion-wave-15.json").profiles).length !== wave15Plants.length)
  throw new Error("Wave 15 plant, translation, and seed-profile counts do not match");
if (wave16Plants.length !== 4 || Object.keys(wave16Translations).length !== wave16Plants.length)
  throw new Error("Wave 16 plant and translation counts do not match");
if (wave17Plants.length !== 4 || Object.keys(wave17Translations).length !== wave17Plants.length)
  throw new Error("Wave 17 plant and translation counts do not match");
if (wave18Plants.length !== 3 || Object.keys(wave18Translations).length !== wave18Plants.length)
  throw new Error("Wave 18 plant and translation counts do not match");
if (wave19Plants.length !== 3 || Object.keys(wave19Translations).length !== wave19Plants.length || Object.keys(read("seed-profiles-expansion-wave-19.json").profiles).length !== wave19Plants.length)
  throw new Error("Wave 19 plant, translation, and seed-profile counts do not match");
if (wave20Plants.length !== 5 || Object.keys(wave20Translations).length !== wave20Plants.length || Object.keys(read("seed-profiles-expansion-wave-20.json").profiles).length !== wave20Plants.length)
  throw new Error("Wave 20 plant, translation, and seed-profile counts do not match");
if (wave21Plants.length !== 3 || Object.keys(wave21Translations).length !== wave21Plants.length || Object.keys(read("seed-profiles-expansion-wave-21.json").profiles).length !== wave21Plants.length)
  throw new Error("Wave 21 plant, translation, and seed-profile counts do not match");
if (wave22Plants.length !== 5 || Object.keys(wave22Translations).length !== wave22Plants.length)
  throw new Error("Wave 22 plant and translation counts do not match");
if (wave23Plants.length !== 3 || Object.keys(wave23Translations).length !== wave23Plants.length || Object.keys(read("seed-profiles-expansion-wave-23.json").profiles).length !== wave23Plants.length)
  throw new Error("Wave 23 plant, translation, and seed-profile counts do not match");
if (wave24Plants.length !== 6 || Object.keys(wave24Translations).length !== wave24Plants.length || Object.keys(read("seed-profiles-expansion-wave-24.json").profiles).length !== wave24Plants.length)
  throw new Error("Wave 24 plant, translation, and seed-profile counts do not match");
if (wave25Plants.length !== 4 || Object.keys(wave25Translations).length !== wave25Plants.length || Object.keys(read("seed-profiles-expansion-wave-25.json").profiles).length !== wave25Plants.length)
  throw new Error("Wave 25 plant, translation, and seed-profile counts do not match");
if (wave26Plants.length !== 5 || Object.keys(wave26Translations).length !== wave26Plants.length || Object.keys(read("seed-profiles-expansion-wave-26.json").profiles).length !== wave26Plants.length)
  throw new Error("Wave 26 plant, translation, and seed-profile counts do not match");
if (wave27Plants.length !== 4 || Object.keys(wave27Translations).length !== wave27Plants.length)
  throw new Error("Wave 27 plant and translation counts do not match");
if (wave28Plants.length !== 3 || Object.keys(wave28Translations).length !== wave28Plants.length || Object.keys(read("seed-profiles-expansion-wave-28.json").profiles).length !== wave28Plants.length)
  throw new Error("Wave 28 plant, translation, and seed-profile counts do not match");
if (wave29Plants.length !== 3 || Object.keys(wave29Translations).length !== wave29Plants.length || Object.keys(read("seed-profiles-expansion-wave-29.json").profiles).length !== wave29Plants.length)
  throw new Error("Wave 29 plant, translation, and seed-profile counts do not match");
if (wave30Plants.length !== 3 || Object.keys(wave30Translations).length !== wave30Plants.length || Object.keys(read("seed-profiles-expansion-wave-30.json").profiles).length !== wave30Plants.length)
  throw new Error("Wave 30 plant, translation, and seed-profile counts do not match");
if (wave31Plants.length !== 2 || Object.keys(wave31Translations).length !== wave31Plants.length || Object.keys(read("seed-profiles-expansion-wave-31.json").profiles).length !== wave31Plants.length)
  throw new Error("Wave 31 plant, translation, and seed-profile counts do not match");
if (wave32Plants.length !== 2 || Object.keys(wave32Translations).length !== wave32Plants.length)
  throw new Error("Wave 32 plant and translation counts do not match");
if (wave33Plants.length !== 5 || Object.keys(wave33Translations).length !== wave33Plants.length)
  throw new Error("Wave 33 plant and translation counts do not match");
if (wave34Plants.length !== 4 || Object.keys(wave34Translations).length !== wave34Plants.length)
  throw new Error("Wave 34 plant and translation counts do not match");
if (wave35Plants.length !== 4 || Object.keys(wave35Translations).length !== wave35Plants.length)
  throw new Error("Wave 35 plant and translation counts do not match");
if (wave36Plants.length !== 1 || Object.keys(wave36Translations).length !== wave36Plants.length || Object.keys(read("seed-profiles-expansion-wave-32.json").profiles).length !== wave36Plants.length)
  throw new Error("Wave 36 plant, translation, and seed-profile counts do not match");
if (wave37Plants.length !== 9 || Object.keys(wave37Translations).length !== wave37Plants.length || Object.keys(read("seed-profiles-expansion-wave-37.json").profiles).length !== 2)
  throw new Error("Wave 37 plant, translation, and seed-profile counts do not match");
if (wave38Plants.length !== 5 || Object.keys(wave38Translations).length !== wave38Plants.length || Object.keys(read("seed-profiles-expansion-wave-38.json").profiles).length !== 0)
  throw new Error("Wave 38 must contain five bilingual plant profiles and no unsupported seed profiles");
if (wave39Plants.length !== 4 || Object.keys(wave39Translations).length !== wave39Plants.length || Object.keys(read("seed-profiles-expansion-wave-39.json").profiles).length !== 0)
  throw new Error("Wave 39 must contain four bilingual plant profiles and no unsupported seed profiles");
if (wave40Plants.length !== 5 || Object.keys(wave40Translations).length !== wave40Plants.length || Object.keys(read("seed-profiles-expansion-wave-40.json").profiles).length !== 0)
  throw new Error("Wave 40 must contain five bilingual plant profiles and no unsupported seed profiles");
if (wave41Plants.length !== 8 || Object.keys(wave41Translations).length !== wave41Plants.length || Object.keys(read("seed-profiles-expansion-wave-41.json").profiles).length !== 0)
  throw new Error("Wave 41 must contain eight bilingual plant profiles and no unsupported seed profiles");
if (wave42Plants.length !== 8 || Object.keys(wave42Translations).length !== wave42Plants.length || Object.keys(read("seed-profiles-expansion-wave-42.json").profiles).length !== 0)
  throw new Error("Wave 42 must contain eight bilingual plant profiles and no unsupported seed profiles");
if (wave43Plants.length !== 4 || Object.keys(wave43Translations).length !== wave43Plants.length || Object.keys(read("seed-profiles-expansion-wave-43.json").profiles).length !== 1)
  throw new Error("Wave 43 must contain four bilingual plant profiles and one evidenced seed profile");
if (wave44Plants.length !== 4 || Object.keys(wave44Translations).length !== wave44Plants.length || Object.keys(read("seed-profiles-expansion-wave-44.json").profiles).length !== 1)
  throw new Error("Wave 44 must contain four bilingual plant profiles and one evidenced seed profile");
if (wave45Plants.length !== 5 || Object.keys(wave45Translations).length !== wave45Plants.length || Object.keys(read("seed-profiles-expansion-wave-45.json").profiles).length !== wave45Plants.length)
  throw new Error("Wave 45 must contain five bilingual plant profiles and five evidence-supported seed profiles");
if (wave46Plants.length !== 5 || Object.keys(wave46Translations).length !== wave46Plants.length || Object.keys(read("seed-profiles-expansion-wave-46.json").profiles).length !== 0)
  throw new Error("Wave 46 must contain five bilingual houseplant profiles and no unsupported Seed Profiles");
if (wave47Plants.length !== 1 || Object.keys(wave47Translations).length !== wave47Plants.length || Object.keys(read("seed-profiles-expansion-wave-47.json").profiles).length !== 1)
  throw new Error("Wave 47 must contain one bilingual profile and one source-supported seed profile");
if (wave48Plants.length !== 5 || Object.keys(wave48Translations).length !== wave48Plants.length || Object.keys(read("seed-profiles-expansion-wave-48.json").profiles).length !== 4)
  throw new Error("Wave 48 must contain five bilingual profiles and four evidence-supported seed profiles");
if (wave49Plants.length !== 6 || Object.keys(wave49Translations).length !== wave49Plants.length || Object.keys(read("seed-profiles-expansion-wave-49.json").profiles).length !== 5)
  throw new Error("Wave 49 must contain six bilingual profiles and five evidence-supported seed profiles");
if (wave50Plants.length !== 5 || Object.keys(wave50Translations).length !== wave50Plants.length || Object.keys(read("seed-profiles-expansion-wave-50.json").profiles).length !== 0)
  throw new Error("Wave 50 must contain five bilingual plant profiles and no unsupported Seed Profiles");
if (wave51Plants.length !== 9 || Object.keys(wave51Translations).length !== wave51Plants.length || Object.keys(read("seed-profiles-expansion-wave-51.json").profiles).length !== 0)
  throw new Error("Wave 51 must contain nine bilingual plant profiles and no unsupported Seed Profiles");
if (wave52Plants.length !== 10 || Object.keys(wave52Translations).length !== wave52Plants.length || Object.keys(read("seed-profiles-expansion-wave-52.json").profiles).length !== 0)
  throw new Error("Wave 52 must contain ten bilingual plant profiles and no unsupported Seed Profiles");
if (wave53Plants.length !== 3 || Object.keys(wave53Translations).length !== wave53Plants.length || Object.keys(read("seed-profiles-expansion-wave-53.json").profiles).length !== 2)
  throw new Error("Wave 53 must contain three bilingual plant profiles and two evidence-supported Seed Profiles");
if (wave54Plants.length !== 4 || Object.keys(wave54Translations).length !== wave54Plants.length || Object.keys(read("seed-profiles-expansion-wave-54.json").profiles).length !== 3)
  throw new Error("Wave 54 must contain four bilingual plant profiles and three evidence-supported Seed Profiles");
if (wave55Plants.length !== 4 || Object.keys(wave55Translations).length !== wave55Plants.length || Object.keys(read("seed-profiles-expansion-wave-55.json").profiles).length !== 0)
  throw new Error("Wave 55 must contain four bilingual plant profiles with documented vegetative propagation and no unsupported Seed Profiles");
if (wave56Plants.length !== 2 || Object.keys(wave56Translations).length !== wave56Plants.length || Object.keys(read("seed-profiles-expansion-wave-56.json").profiles).length !== 2)
  throw new Error("Wave 56 must contain two bilingual flower profiles and two evidence-supported Seed Profiles");
if (wave57Plants.length !== 2 || Object.keys(wave57Translations).length !== wave57Plants.length || Object.keys(read("seed-profiles-expansion-wave-57.json").profiles).length !== 2)
  throw new Error("Wave 57 must contain two bilingual profiles and two evidence-supported Seed Profiles");
if (wave58Plants.length !== 4 || Object.keys(wave58Translations).length !== wave58Plants.length || Object.keys(read("seed-profiles-expansion-wave-58.json").profiles).length !== 4)
  throw new Error("Wave 58 must contain four bilingual profiles and four evidence-supported Seed Profiles");
if (wave59Plants.length !== 10 || Object.keys(wave59Translations).length !== wave59Plants.length || Object.keys(read("seed-profiles-expansion-wave-59.json").profiles).length !== 0)
  throw new Error("Wave 59 must contain ten bilingual profiles and no unsupported Seed Profiles");
if (wave60Plants.length !== 12 || Object.keys(wave60Translations).length !== wave60Plants.length || Object.keys(read("seed-profiles-expansion-wave-60.json").profiles).length !== 4)
  throw new Error("Wave 60 must contain twelve bilingual profiles and four evidence-supported Seed Profiles");
if (wave61Plants.length !== 24 || Object.keys(wave61Translations).length !== wave61Plants.length || Object.keys(read("seed-profiles-expansion-wave-61.json").profiles).length !== 1)
  throw new Error("Wave 61 must contain twenty-four bilingual profiles and one evidence-supported Seed Profile");
if (
  wave62Plants.length !== 3 ||
  Object.keys(wave62Translations).length !== wave62Plants.length ||
  Object.keys(read("seed-profiles-expansion-wave-62.json").profiles).length !== 1
)
  throw new Error("Wave 62 must contain three bilingual profiles and one evidence-supported Seed Profile");
if (
  wave63Plants.length !== 3 ||
  wave63Plants.some((plant) => !wave63Translations[plant.id]) ||
  Object.keys(read("seed-profiles-expansion-wave-63.json").profiles).length !== 2
)
  throw new Error("Wave 63 must contain three bilingual profiles and two evidence-supported Seed Profiles");
if (
  [...wave1PlantIds].some(
    (id) =>
      wave2PlantIds.has(id) || wave3PlantIds.has(id) || wave4PlantIds.has(id) || wave5PlantIds.has(id) || wave6PlantIds.has(id) || wave7PlantIds.has(id),
  ) ||
  [...wave2PlantIds].some(
    (id) => wave3PlantIds.has(id) || wave4PlantIds.has(id) || wave5PlantIds.has(id) || wave6PlantIds.has(id) || wave7PlantIds.has(id),
  ) ||
  [...wave3PlantIds].some((id) => wave4PlantIds.has(id) || wave5PlantIds.has(id) || wave6PlantIds.has(id) || wave7PlantIds.has(id)) ||
  [...wave4PlantIds].some((id) => wave5PlantIds.has(id) || wave6PlantIds.has(id) || wave7PlantIds.has(id)) ||
  [...wave5PlantIds].some((id) => wave6PlantIds.has(id) || wave7PlantIds.has(id)) ||
  [...wave6PlantIds].some((id) => wave7PlantIds.has(id))
)
  throw new Error("Expansion wave plant IDs overlap");
for (const [waveName, waveData, translations] of [
  ["Wave 1", wave1Plants, wave1Translations],
  ["Wave 2", wave2Plants, wave2Translations],
  ["Wave 3", wave3Plants, wave3Translations],
  ["Wave 4", wave4Plants, wave4Translations],
  ["Wave 5", wave5Plants, wave5Translations],
  ["Wave 6", wave6Plants, wave6Translations],
  ["Wave 7", wave7Plants, wave7Translations],
  ["Wave 8", wave8Plants, wave8Translations],
  ["Wave 9", wave9Plants, wave9Translations],
  ["Wave 10", wave10Plants, wave10Translations],
  ["Wave 11", wave11Plants, wave11Translations],
  ["Wave 12", wave12Plants, wave12Translations],
  ["Wave 13", wave13Plants, wave13Translations],
  ["Wave 14", wave14Plants, wave14Translations],
  ["Wave 15", wave15Plants, wave15Translations],
  ["Wave 16", wave16Plants, wave16Translations],
  ["Wave 17", wave17Plants, wave17Translations],
  ["Wave 18", wave18Plants, wave18Translations],
  ["Wave 19", wave19Plants, wave19Translations],
  ["Wave 20", wave20Plants, wave20Translations],
  ["Wave 21", wave21Plants, wave21Translations],
  ["Wave 22", wave22Plants, wave22Translations],
  ["Wave 23", wave23Plants, wave23Translations],
  ["Wave 24", wave24Plants, wave24Translations],
  ["Wave 25", wave25Plants, wave25Translations],
  ["Wave 26", wave26Plants, wave26Translations],
  ["Wave 29", wave29Plants, wave29Translations],
  ["Wave 30", wave30Plants, wave30Translations],
  ["Wave 31", wave31Plants, wave31Translations],
  ["Wave 32", wave32Plants, wave32Translations],
  ["Wave 33", wave33Plants, wave33Translations],
  ["Wave 34", wave34Plants, wave34Translations],
  ["Wave 35", wave35Plants, wave35Translations],
  ["Wave 36", wave36Plants, wave36Translations],
  ["Wave 37", wave37Plants, wave37Translations],
  ["Wave 38", wave38Plants, wave38Translations],
  ["Wave 39", wave39Plants, wave39Translations],
  ["Wave 40", wave40Plants, wave40Translations],
  ["Wave 41", wave41Plants, wave41Translations],
  ["Wave 42", wave42Plants, wave42Translations],
  ["Wave 43", wave43Plants, wave43Translations],
  ["Wave 44", wave44Plants, wave44Translations],
  ["Wave 45", wave45Plants, wave45Translations],
  ["Wave 46", wave46Plants, wave46Translations],
  ["Wave 47", wave47Plants, wave47Translations],
  ["Wave 48", wave48Plants, wave48Translations],
  ["Wave 49", wave49Plants, wave49Translations],
  ["Wave 50", wave50Plants, wave50Translations],
  ["Wave 51", wave51Plants, wave51Translations],
  ["Wave 52", wave52Plants, wave52Translations],
  ["Wave 53", wave53Plants, wave53Translations],
  ["Wave 54", wave54Plants, wave54Translations],
  ["Wave 55", wave55Plants, wave55Translations],
  ["Wave 56", wave56Plants, wave56Translations],
  ["Wave 57", wave57Plants, wave57Translations],
  ["Wave 58", wave58Plants, wave58Translations],
  ["Wave 59", wave59Plants, wave59Translations],
  ["Wave 60", wave60Plants, wave60Translations],
  ["Wave 61", wave61Plants, wave61Translations],
  ["Wave 62", wave62Plants, wave62Translations],
  ["Wave 63", wave63Plants, wave63Translations],
])
  for (const plant of waveData) {
    const translation = translations[plant.id];
    if (!translation?.summary || !translation.sections)
      throw new Error(`Incomplete ${waveName} translation: ${plant.id}`);
    for (const sectionName of Object.keys(plant.sections))
      if (!translation.sections[sectionName]?.guidance)
        throw new Error(
          `Missing ${waveName} section translation: ${plant.id}.${sectionName}`,
        );
  }
const allSourceRefs = collectSourceIds(plants);
identityAliases.forEach((alias) =>
  alias.sourceIds.forEach((id) => allSourceRefs.add(id)),
);
if ([...allSourceRefs].some((id) => !sourceIds.has(id)))
  throw new Error("Unresolved source reference in catalog");
const profileEnrichmentIds = new Set();
for (const profile of profileEnrichments) {
  if (!plantIds.has(profile.id) || profileEnrichmentIds.has(profile.id))
    throw new Error(`Profile enrichment is duplicate or unpublished: ${profile.id}`);
  profileEnrichmentIds.add(profile.id);
  if (!profile.summary?.en || !profile.summary?.es)
    throw new Error(`Profile enrichment is not bilingual: ${profile.id}`);
  if (/user zero|owned seed|seed lot|inventory|garden position|ycube|owner_id|seed_package_id/i.test(JSON.stringify(profile.summary)))
    throw new Error(`Private-context text found in public profile summary: ${profile.id}`);
  for (const [sectionId, section] of Object.entries(profile.sections || {})) {
    if (/germination|sowing|seed/i.test(sectionId))
      throw new Error(`Seed-stage content must stay out of Plant Profile: ${profile.id}.${sectionId}`);
    if (
      !section.short?.en ||
      !section.short?.es ||
      !section.guidance?.en ||
      !section.guidance?.es
    )
      throw new Error(`Profile enrichment section is incomplete: ${profile.id}.${sectionId}`);
    if (!['source_backed', 'garden_adaptation', 'needs_validation'].includes(section.evidenceType))
      throw new Error(`Invalid profile enrichment evidence type: ${profile.id}.${sectionId}`);
    if (!['high', 'medium', 'low', 'pending'].includes(section.confidence))
      throw new Error(`Invalid profile enrichment confidence: ${profile.id}.${sectionId}`);
    if (section.evidenceType !== 'needs_validation' && !(section.sourceIds || []).length)
      throw new Error(`Sourced profile enrichment has no provenance: ${profile.id}.${sectionId}`);
    for (const sourceId of section.sourceIds || [])
      if (!sourceIds.has(sourceId))
        throw new Error(`Unresolved profile enrichment source ${sourceId} in ${profile.id}`);
    if (/user zero|owned seed|seed lot|inventory|garden position|ycube|owner_id|seed_package_id/i.test(JSON.stringify(section)))
      throw new Error(`Private-context text found in public profile enrichment: ${profile.id}.${sectionId}`);
  }
}
const taxonomy = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "labs",
      "gardenpedia",
      "taxonomy",
      "reconciliation-v1.json",
    ),
    "utf8",
  ),
);
validateTaxonomyReconciliation(taxonomy, wavePlantIds);
if (
  new Set(taxonomy.records.map((record) => record.plantIdentityId)).size !==
  wavePlantIds.size
)
  throw new Error("Expansion taxonomy records do not cover every new identity");
const allSeedProfileFiles = [
  read("seed-profiles-v0.json"),
  wave1SeedProfiles,
  wave2SeedProfiles,
  wave3SeedProfiles,
  wave4SeedProfiles,
  wave5SeedProfiles,
  wave6SeedProfiles,
  wave7SeedProfiles,
  wave8SeedProfiles,
  wave9SeedProfiles,
  wave10SeedProfiles,
  wave13SeedProfiles,
  read("seed-profiles-expansion-wave-15.json"),
  read("seed-profiles-expansion-wave-18.json"),
  read("seed-profiles-expansion-wave-19.json"),
  read("seed-profiles-expansion-wave-20.json"),
  read("seed-profiles-expansion-wave-21.json"),
  read("seed-profiles-expansion-wave-23.json"),
  read("seed-profiles-expansion-wave-24.json"),
  read("seed-profiles-expansion-wave-25.json"),
  read("seed-profiles-expansion-wave-26.json"),
  read("seed-profiles-expansion-wave-28.json"),
  read("seed-profiles-expansion-wave-29.json"),
  read("seed-profiles-expansion-wave-30.json"),
  read("seed-profiles-expansion-wave-31.json"),
  read("seed-profiles-expansion-wave-32.json"),
  read("seed-profiles-expansion-wave-37.json"),
  read("seed-profiles-expansion-wave-43.json"),
  read("seed-profiles-expansion-wave-44.json"),
  read("seed-profiles-expansion-wave-45.json"),
  read("seed-profiles-expansion-wave-47.json"),
  read("seed-profiles-expansion-wave-48.json"),
  read("seed-profiles-expansion-wave-49.json"),
  read("seed-profiles-expansion-wave-50.json"),
  read("seed-profiles-expansion-wave-51.json"),
  read("seed-profiles-expansion-wave-52.json"),
  read("seed-profiles-expansion-wave-53.json"),
  read("seed-profiles-expansion-wave-54.json"),
  read("seed-profiles-expansion-wave-56.json"),
  read("seed-profiles-expansion-wave-57.json"),
  read("seed-profiles-expansion-wave-58.json"),
  read("seed-profiles-expansion-wave-59.json"),
  read("seed-profiles-expansion-wave-60.json"),
  read("seed-profiles-expansion-wave-61.json"),
  read("seed-profiles-expansion-wave-62.json"),
  read("seed-profiles-expansion-wave-63.json"),
];
const seedProfileByCanonicalId = new Map();
for (const bundle of allSeedProfileFiles) {
  for (const [id, profile] of Object.entries(bundle.profiles || {})) {
    if (!aliasIds.has(id)) seedProfileByCanonicalId.set(id, profile);
  }
}
for (const bundle of allSeedProfileFiles) {
  for (const [id, profile] of Object.entries(bundle.profiles || {})) {
    const canonicalId = canonicalIdByAlias.get(id);
    if (canonicalId && !seedProfileByCanonicalId.has(canonicalId))
      seedProfileByCanonicalId.set(canonicalId, profile);
  }
}
const seedProfileIds = new Set(seedProfileByCanonicalId.keys());
const seedProfileCount = seedProfileIds.size;
if ([...seedProfileIds].some((id) => !canonicalPlantIds.has(id)))
  throw new Error("Seed Profile references an unpublished plant identity");
const propagationGuidance = read("propagation-guidance-v1.json");
if (
  propagationGuidance.schemaVersion !== "gardenpedia_propagation_guidance_v1" ||
  !propagationGuidance.records ||
  typeof propagationGuidance.records !== "object"
)
  throw new Error("Propagation guidance registry has an invalid schema");
for (const [plantId, record] of Object.entries(propagationGuidance.records)) {
  if (!plantIds.has(plantId))
    throw new Error(
      `Propagation guidance references unknown plant ID: ${plantId}`,
    );
  if (
    !new Set(["vegetative_preferred", "insufficient_documentation"]).has(
      record.classification,
    )
  )
    throw new Error(`Invalid propagation classification: ${plantId}`);
  if (!new Set(["source_backed", "pending", "needs_validation"]).has(record.status))
    throw new Error(`Invalid propagation status: ${plantId}`);
  if (!record.summary?.en?.trim?.() || !record.summary?.es?.trim?.())
    throw new Error(`Propagation guidance lacks EN/ES: ${plantId}`);
  if (
    !Array.isArray(record.sourceIds) ||
    record.sourceIds.some((id) => !sourceIds.has(id))
  )
    throw new Error(`Propagation guidance has unresolved sources: ${plantId}`);
  if (record.status === "source_backed" && record.sourceIds.length === 0)
    throw new Error(
      `Source-backed propagation guidance has no sources: ${plantId}`,
    );
  if (record.status === "pending" && record.sourceIds.length !== 0)
    throw new Error(
      `Pending propagation guidance must not cite unsupported sources: ${plantId}`,
    );
}
for (const plantId of canonicalPlantIds) {
  const hasSeedProfile = seedProfileIds.has(plantId);
  const aliasPropagation = [...canonicalIdByAlias].find(
    ([aliasId, canonicalId]) =>
      canonicalId === plantId &&
      Object.hasOwn(propagationGuidance.records, aliasId),
  );
  const propagationRecord =
    propagationGuidance.records[plantId] ||
    (aliasPropagation
      ? propagationGuidance.records[aliasPropagation[0]]
      : null);
  const hasPropagationGuidance = Boolean(propagationRecord);
  if (!hasSeedProfile && !hasPropagationGuidance)
    throw new Error(`Identity is missing from public Seeds / Propagation: ${plantId}`);
  if (
    hasSeedProfile &&
    hasPropagationGuidance &&
    propagationRecord.classification !== "vegetative_preferred"
  )
    throw new Error(`Identity has incompatible seed and propagation records: ${plantId}`);
}
for (const id of [
  "italian-oregano",
  "fragrant-dwarf-dianthus-mix",
  "monterey-strawberry",
])
  if (wave3SeedProfiles.profiles?.[id])
    throw new Error(`Wave 3 must not create a Seed Profile for ${id}`);
const publicText = JSON.stringify({
  plants: [...wave1Plants, ...wave2Plants, ...wave3Plants, ...wave4Plants, ...wave5Plants, ...wave6Plants, ...wave7Plants, ...wave8Plants, ...wave9Plants, ...wave10Plants, ...wave11Plants, ...wave12Plants, ...wave13Plants, ...wave14Plants, ...wave15Plants, ...wave16Plants, ...wave17Plants, ...wave18Plants, ...wave19Plants, ...wave20Plants, ...wave21Plants, ...wave22Plants, ...wave23Plants, ...wave24Plants, ...wave25Plants, ...wave26Plants, ...wave27Plants, ...wave28Plants, ...wave29Plants, ...wave30Plants, ...wave31Plants, ...wave32Plants, ...wave33Plants, ...wave34Plants, ...wave35Plants, ...wave36Plants, ...wave37Plants, ...wave38Plants, ...wave39Plants, ...wave40Plants, ...wave41Plants, ...wave42Plants, ...wave43Plants, ...wave44Plants, ...wave45Plants, ...wave46Plants, ...wave47Plants, ...wave48Plants, ...wave49Plants, ...wave50Plants, ...wave51Plants, ...wave52Plants, ...wave53Plants, ...wave54Plants, ...wave55Plants, ...wave56Plants, ...wave57Plants, ...wave58Plants, ...wave59Plants, ...wave60Plants, ...wave61Plants, ...wave62Plants, ...wave63Plants],
  sources: publicSources,
  wave1Translations,
  wave2Translations,
  wave3Translations,
  wave4Translations,
  wave5Translations,
  wave6Translations,
  wave7Translations,
  wave8Translations,
  wave9Translations,
  wave10Translations,
  wave11Translations,
  wave12Translations,
  wave13Translations,
  wave14Translations,
  wave15Translations,
  wave16Translations,
  wave17Translations,
  wave18Translations,
  wave19Translations,
  wave20Translations,
  wave21Translations,
  wave22Translations,
  wave23Translations,
  wave24Translations,
  wave25Translations,
  wave26Translations,
  wave27Translations,
  wave28Translations,
  wave29Translations,
  wave30Translations,
  wave31Translations,
  wave32Translations,
  wave33Translations,
  wave34Translations,
  wave35Translations,
  wave36Translations,
  wave37Translations,
  wave38Translations,
  wave39Translations,
  wave40Translations,
  wave41Translations,
  wave42Translations,
  wave43Translations,
  wave44Translations,
  wave45Translations,
  wave46Translations,
  wave47Translations,
  wave48Translations,
  wave49Translations,
  wave50Translations,
  wave51Translations,
  wave52Translations,
  wave53Translations,
  wave54Translations,
  wave55Translations,
  wave56Translations,
  wave57Translations,
  wave58Translations,
  wave59Translations,
  wave60Translations,
  wave61Translations,
  wave62Translations,
  wave63Translations,
  seedProfiles: [
    wave1SeedProfiles,
    wave2SeedProfiles,
    wave3SeedProfiles,
    wave4SeedProfiles,
    wave5SeedProfiles,
    wave6SeedProfiles,
    wave7SeedProfiles,
    wave8SeedProfiles,
    wave9SeedProfiles,
    wave10SeedProfiles,
    wave13SeedProfiles,
    read("seed-profiles-expansion-wave-15.json"),
    read("seed-profiles-expansion-wave-16.json"),
    read("seed-profiles-expansion-wave-17.json"),
    read("seed-profiles-expansion-wave-18.json"),
    read("seed-profiles-expansion-wave-19.json"),
    read("seed-profiles-expansion-wave-20.json"),
    read("seed-profiles-expansion-wave-21.json"),
    read("seed-profiles-expansion-wave-23.json"),
    read("seed-profiles-expansion-wave-24.json"),
    read("seed-profiles-expansion-wave-25.json"),
    read("seed-profiles-expansion-wave-26.json"),
    read("seed-profiles-expansion-wave-28.json"),
    read("seed-profiles-expansion-wave-29.json"),
    read("seed-profiles-expansion-wave-30.json"),
    read("seed-profiles-expansion-wave-31.json"),
    read("seed-profiles-expansion-wave-32.json"),
    read("seed-profiles-expansion-wave-37.json"),
    read("seed-profiles-expansion-wave-43.json"),
    read("seed-profiles-expansion-wave-44.json"),
    read("seed-profiles-expansion-wave-45.json"),
    read("seed-profiles-expansion-wave-47.json"),
    read("seed-profiles-expansion-wave-48.json"),
    read("seed-profiles-expansion-wave-49.json"),
    read("seed-profiles-expansion-wave-50.json"),
    read("seed-profiles-expansion-wave-51.json"),
    read("seed-profiles-expansion-wave-52.json"),
    read("seed-profiles-expansion-wave-53.json"),
    read("seed-profiles-expansion-wave-54.json"),
    read("seed-profiles-expansion-wave-56.json"),
    read("seed-profiles-expansion-wave-57.json"),
    read("seed-profiles-expansion-wave-58.json"),
    read("seed-profiles-expansion-wave-59.json"),
  read("seed-profiles-expansion-wave-60.json"),
  read("seed-profiles-expansion-wave-61.json"),
    read("seed-profiles-expansion-wave-62.json"),
    read("seed-profiles-expansion-wave-63.json"),
    read("seed-profiles-expansion-wave-46.json"),
  ],
  identityAliases: read("plant-identity-aliases-v1.json"),
  curatedPlantProfileEnrichment: read("plant-profile-enrichment-v1.json"),
  propagationGuidance,
});
if (
  /user zero|owner_id|user_id|seed_package_id|system_instance_id/i.test(
    publicText,
  )
)
  throw new Error("Private data marker detected in expansion public data");
const generatedPublicArtifactText = [
  "apps/garden-x/src/generated/garden-library-manifest.ts",
  "apps/garden-x/src/generated/garden-plant-profile-index.ts",
  "apps/garden-x/src/generated/garden-seed-profile-index.ts",
]
  .map((file) => path.join(root, file))
  .filter((file) => fs.existsSync(file))
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
if (
  /user[\s_-]*zero|owner_?id|user_?id|seed_package_?id|system_instance_?id/i.test(
    generatedPublicArtifactText,
  )
)
  throw new Error("Private data marker detected in generated Gardenpedia artifacts");
console.log(
  JSON.stringify({
    plants: plants.length,
    sources: sources.length,
    wave1Plants: wave1Plants.length,
    wave2Plants: wave2Plants.length,
    wave3Plants: wave3Plants.length,
    wave4Plants: wave4Plants.length,
    wave5Plants: wave5Plants.length,
    wave6Plants: wave6Plants.length,
    wave7Plants: wave7Plants.length,
    wave8Plants: wave8Plants.length,
    wave9Plants: wave9Plants.length,
    wave10Plants: wave10Plants.length,
    wave11Plants: wave11Plants.length,
    wave12Plants: wave12Plants.length,
    wave13Plants: wave13Plants.length,
    seedProfiles: seedProfileCount,
    unresolvedSourceIds: 0,
    taxonomyRecords: taxonomy.records.length,
  }),
);
