import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCompatibilityProfile } from "./gardenpedia-compatibility-profile.mjs";
import { loadSourceRegistry } from "./gardenpedia-source-registry.mjs";
import { validateTaxonomyReconciliation } from "./gardenpedia-taxonomy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "labs", "gardenpedia", "data");
const plantFiles = ["plants.json", "plants-current-gardens.json", "plants-owned-seeds.json", "plants-expansion-batch-a1.json", "plants-expansion-batch-b1.json", "plants-expansion-wave-1.json", "plants-requests.json"];
const sourceFiles = ["sources.json", "sources-current-gardens.json", "sources-owned-seeds.json", "sources-expansion-batch-a1.json", "sources-expansion-batch-b1.json", "sources-expansion-wave-1.json", "sources-requests.json"];
const read = (file) => JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
const plants = plantFiles.flatMap(read);
const sources = loadSourceRegistry(dataDir, sourceFiles);
const sourceIds = new Set(sources.map((source) => source.id));
const plantIds = new Set();
const wavePlants = read("plants-expansion-wave-1.json");
const waveTranslations = read("translations-expansion-wave-1-es.json");
const waveSeedProfiles = read("seed-profiles-expansion-wave-1.json");
const wavePlantIds = new Set(wavePlants.map((plant) => plant.id));

function collectSourceIds(value, result = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => collectSourceIds(item, result));
  else if (value && typeof value === "object") {
    if (Array.isArray(value.sourceIds)) value.sourceIds.forEach((id) => result.add(id));
    Object.values(value).forEach((item) => collectSourceIds(item, result));
  }
  return result;
}

for (const plant of plants) {
  if (!plant.id || plantIds.has(plant.id)) throw new Error(`Duplicate or missing plant ID: ${plant.id}`);
  plantIds.add(plant.id);
  if (!plant.name || !plant.spanishName || !plant.scientificName || (wavePlantIds.has(plant.id) && !plant.variety)) throw new Error(`Incomplete identity fields: ${plant.id}`);
  for (const [sectionName, section] of Object.entries(plant.sections || {})) {
    if (!["source_backed", "garden_adaptation", "needs_validation"].includes(section.evidenceType)) throw new Error(`Invalid evidence type at ${plant.id}.${sectionName}`);
    if (wavePlantIds.has(plant.id) && section.evidenceType !== "needs_validation" && (!Array.isArray(section.sourceIds) || section.sourceIds.length === 0)) throw new Error(`Wave 1 sourced section has no source IDs: ${plant.id}.${sectionName}`);
  }
  validateCompatibilityProfile(plant.compatibilityProfile, sourceIds);
  for (const sourceId of collectSourceIds(plant)) if (!sourceIds.has(sourceId)) throw new Error(`Dangling plant source ID ${sourceId} in ${plant.id}`);
}

if (plants.length !== 72 || plantIds.size !== 72) throw new Error(`Expected 72 unique identities, got ${plants.length}/${plantIds.size}`);
if (wavePlants.length !== 29 || Object.keys(waveTranslations).length !== wavePlants.length || Object.keys(waveSeedProfiles.profiles).length !== wavePlants.length) throw new Error("Wave 1 plant, translation, and seed-profile counts do not match");
for (const plant of wavePlants) {
  const translation = waveTranslations[plant.id];
  if (!translation?.summary || !translation.sections) throw new Error(`Incomplete Wave 1 translation: ${plant.id}`);
  for (const sectionName of Object.keys(plant.sections)) if (!translation.sections[sectionName]?.guidance) throw new Error(`Missing Wave 1 section translation: ${plant.id}.${sectionName}`);
}
const allSourceRefs = collectSourceIds(plants);
if ([...allSourceRefs].some((id) => !sourceIds.has(id))) throw new Error("Unresolved source reference in catalog");
const taxonomy = JSON.parse(fs.readFileSync(path.join(root, "labs", "gardenpedia", "taxonomy", "reconciliation-v1.json"), "utf8"));
validateTaxonomyReconciliation(taxonomy, wavePlantIds);
if (new Set(taxonomy.records.map((record) => record.plantIdentityId)).size !== wavePlants.length) throw new Error("Wave 1 taxonomy records do not cover every new identity");
const allSeedProfileFiles = [read("seed-profiles-v0.json"), waveSeedProfiles];
const existingSeedProfileIds = new Set(Object.keys(allSeedProfileFiles[0].profiles || {}));
const waveSeedProfileIds = new Set(Object.keys(waveSeedProfiles.profiles || {}));
const seedProfileOverlap = [...waveSeedProfileIds].filter((id) => existingSeedProfileIds.has(id));
if (seedProfileOverlap.length > 0) throw new Error(`Wave 1 Seed Profile IDs overlap existing profiles: ${seedProfileOverlap.join(", ")}`);
const seedProfileCount = allSeedProfileFiles.reduce((sum, bundle) => sum + Object.keys(bundle.profiles || {}).length, 0);
if (seedProfileCount !== 69) throw new Error(`Expected 69 Seed Profiles after Wave 1, got ${seedProfileCount}`);
const expectedUnprofiledIds = new Set(["italian-oregano", "fragrant-dwarf-dianthus-mix", "monterey-strawberry"]);
const unprofiledPlantIds = [...plantIds].filter((id) => !existingSeedProfileIds.has(id) && !waveSeedProfileIds.has(id));
if (unprofiledPlantIds.length !== expectedUnprofiledIds.size || unprofiledPlantIds.some((id) => !expectedUnprofiledIds.has(id))) {
  throw new Error(`Unexpected Seed Profile exclusions: ${unprofiledPlantIds.join(", ")}`);
}
const publicText = JSON.stringify({ plants: wavePlants, sources: sources.filter((source) => source.id.endsWith("-wave1")), waveTranslations, waveSeedProfiles });
if (/user zero|owner_id|user_id|seed_package_id|system_instance_id/i.test(publicText)) throw new Error("Private data marker detected in Wave 1 public data");
console.log(JSON.stringify({ plants: plants.length, sources: sources.length, wavePlants: wavePlants.length, seedProfiles: seedProfileCount, unresolvedSourceIds: 0, taxonomyRecords: taxonomy.records.length }));
