import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCompatibilityProfile } from "./gardenpedia-compatibility-profile.mjs";
import { loadSourceRegistry } from "./gardenpedia-source-registry.mjs";
import { validateTaxonomyReconciliation } from "./gardenpedia-taxonomy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "labs", "gardenpedia", "data");
const plantFiles = ["plants.json", "plants-current-gardens.json", "plants-owned-seeds.json", "plants-expansion-batch-a1.json", "plants-expansion-batch-b1.json", "plants-expansion-wave-1.json", "plants-expansion-wave-2.json", "plants-requests.json"];
const sourceFiles = ["sources.json", "sources-current-gardens.json", "sources-owned-seeds.json", "sources-expansion-batch-a1.json", "sources-expansion-batch-b1.json", "sources-expansion-wave-1.json", "sources-expansion-wave-2.json", "sources-requests.json"];
const read = (file) => JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
const plants = plantFiles.flatMap(read);
const sources = loadSourceRegistry(dataDir, sourceFiles);
const sourceIds = new Set(sources.map((source) => source.id));
const plantIds = new Set();
const wave1Plants = read("plants-expansion-wave-1.json");
const wave2Plants = read("plants-expansion-wave-2.json");
const wave1Translations = read("translations-expansion-wave-1-es.json");
const wave2Translations = read("translations-expansion-wave-2-es.json");
const wave1SeedProfiles = read("seed-profiles-expansion-wave-1.json");
const wave2SeedProfiles = read("seed-profiles-expansion-wave-2.json");
const wave1PlantIds = new Set(wave1Plants.map((plant) => plant.id));
const wave2PlantIds = new Set(wave2Plants.map((plant) => plant.id));
const wavePlantIds = new Set([...wave1PlantIds, ...wave2PlantIds]);

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
    if (wavePlantIds.has(plant.id) && section.evidenceType !== "needs_validation" && (!Array.isArray(section.sourceIds) || section.sourceIds.length === 0)) throw new Error(`Expansion sourced section has no source IDs: ${plant.id}.${sectionName}`);
  }
  validateCompatibilityProfile(plant.compatibilityProfile, sourceIds);
  for (const sourceId of collectSourceIds(plant)) if (!sourceIds.has(sourceId)) throw new Error(`Dangling plant source ID ${sourceId} in ${plant.id}`);
}

if (plants.length !== 108 || plantIds.size !== 108) throw new Error(`Expected 108 unique identities, got ${plants.length}/${plantIds.size}`);
if (wave1Plants.length !== 29 || Object.keys(wave1Translations).length !== wave1Plants.length || Object.keys(wave1SeedProfiles.profiles).length !== wave1Plants.length) throw new Error("Wave 1 plant, translation, and seed-profile counts do not match");
if (wave2Plants.length !== 36 || Object.keys(wave2Translations).length !== wave2Plants.length || Object.keys(wave2SeedProfiles.profiles).length !== wave2Plants.length) throw new Error("Wave 2 plant, translation, and seed-profile counts do not match");
if ([...wave1PlantIds].some((id) => wave2PlantIds.has(id))) throw new Error("Wave 1 and Wave 2 plant IDs overlap");
for (const [waveName, waveData, translations] of [["Wave 1", wave1Plants, wave1Translations], ["Wave 2", wave2Plants, wave2Translations]]) for (const plant of waveData) {
  const translation = translations[plant.id];
  if (!translation?.summary || !translation.sections) throw new Error(`Incomplete ${waveName} translation: ${plant.id}`);
  for (const sectionName of Object.keys(plant.sections)) if (!translation.sections[sectionName]?.guidance) throw new Error(`Missing Wave 1 section translation: ${plant.id}.${sectionName}`);
}
const allSourceRefs = collectSourceIds(plants);
if ([...allSourceRefs].some((id) => !sourceIds.has(id))) throw new Error("Unresolved source reference in catalog");
const taxonomy = JSON.parse(fs.readFileSync(path.join(root, "labs", "gardenpedia", "taxonomy", "reconciliation-v1.json"), "utf8"));
validateTaxonomyReconciliation(taxonomy, wavePlantIds);
if (new Set(taxonomy.records.map((record) => record.plantIdentityId)).size !== wavePlantIds.size) throw new Error("Expansion taxonomy records do not cover every new identity");
const allSeedProfileFiles = [read("seed-profiles-v0.json"), wave1SeedProfiles, wave2SeedProfiles];
const seedProfileCount = allSeedProfileFiles.reduce((sum, bundle) => sum + Object.keys(bundle.profiles || {}).length, 0);
if (seedProfileCount !== 105) throw new Error(`Expected 105 Seed Profiles after Wave 2, got ${seedProfileCount}`);
for (const id of ["italian-oregano", "fragrant-dwarf-dianthus-mix", "monterey-strawberry"]) if (wave2SeedProfiles.profiles?.[id]) throw new Error(`Wave 2 must not create a Seed Profile for ${id}`);
const publicText = JSON.stringify({ plants: [...wave1Plants, ...wave2Plants], sources: sources.filter((source) => source.id.endsWith("-wave1") || source.id.endsWith("-wave2")), wave1Translations, wave2Translations, wave1SeedProfiles, wave2SeedProfiles });
if (/user zero|owner_id|user_id|seed_package_id|system_instance_id/i.test(publicText)) throw new Error("Private data marker detected in expansion public data");
console.log(JSON.stringify({ plants: plants.length, sources: sources.length, wave1Plants: wave1Plants.length, wave2Plants: wave2Plants.length, seedProfiles: seedProfileCount, unresolvedSourceIds: 0, taxonomyRecords: taxonomy.records.length }));
