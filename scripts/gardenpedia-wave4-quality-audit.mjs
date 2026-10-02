import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSourceRegistry } from "./gardenpedia-source-registry.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataDir = path.join(root, "labs", "gardenpedia", "data");
const read = (file) => JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
const plants = [1, 2, 3, 4].flatMap((wave) => read(`plants-expansion-wave-${wave}.json`));
const seedProfiles = [1, 2, 3, 4].flatMap((wave) => Object.values(read(`seed-profiles-expansion-wave-${wave}.json`).profiles));
const sourceFiles = ["sources.json", "sources-current-gardens.json", "sources-owned-seeds.json", "sources-expansion-batch-a1.json", "sources-expansion-batch-b1.json", "sources-expansion-wave-1.json", "sources-expansion-wave-2.json", "sources-expansion-wave-3.json", "sources-expansion-wave-4.json", "sources-requests.json"];
const sources = loadSourceRegistry(dataDir, sourceFiles);

function collectSourceIds(value, result = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => collectSourceIds(item, result));
  else if (value && typeof value === "object") {
    if (Array.isArray(value.sourceIds)) value.sourceIds.forEach((id) => result.add(id));
    Object.values(value).forEach((item) => collectSourceIds(item, result));
  }
  return result;
}

const sourceIdSet = new Set(sources.map((source) => source.id));
const plantIdSet = new Set(plants.map((plant) => plant.id));
const sourceIds = new Set([...plants, ...seedProfiles].flatMap((record) => [...collectSourceIds(record)]));
const danglingSourceIds = [...sourceIds].filter((id) => !sourceIdSet.has(id));
const identityOnlySources = new Set(["johnnys-black-cherry-wave3", "johnnys-sunrise-sauce-wave3", "ferry-sunflower-autumn-beauty", "ferry-sunflower-american-giant"]);
const productGeneralization = plants.flatMap((plant) => {
  const nonIdentityEvidence = { ...Object.fromEntries(Object.entries(plant.sections || {}).filter(([key]) => key !== "identity")), compatibilityProfile: plant.compatibilityProfile };
  return [...identityOnlySources].filter((sourceId) => JSON.stringify(nonIdentityEvidence).includes(sourceId)).map((sourceId) => `${plant.id}:${sourceId}`);
});
const hydroClaims = plants.filter((plant) => ["known", "compatible"].includes(plant.compatibilityProfile?.hydroponicSuitability?.status)).map((plant) => plant.id);
const soilSpacingInHydro = plants.filter((plant) => ["known", "compatible"].includes(plant.compatibilityProfile?.hydroponicSuitability?.status) && /spacing|soil|field|outdoor/i.test(JSON.stringify(plant.compatibilityProfile?.hydroponicSuitability))).map((plant) => plant.id);
const unsupportedResistance = [...JSON.stringify(plants).matchAll(/disease resistance|resistant to|resistance codes/gi)].map((match) => match[0]);
const taxonomy = JSON.parse(fs.readFileSync(path.join(root, "labs", "gardenpedia", "taxonomy", "reconciliation-v1.json"), "utf8"));
const taxonomyConflicts = taxonomy.records.filter((record) => Array.isArray(record.conflicts) && record.conflicts.length).map((record) => record.plantIdentityId);
const privateMarkers = [...JSON.stringify({ plants, seedProfiles }).matchAll(/user zero|owner_id|user_id|seed_package_id|system_instance_id/gi)].map((match) => match[0]);
const needsValidation = [...plants.flatMap((plant) => Object.values(plant.sections || {})), ...seedProfiles.flatMap((profile) => [...(profile.quickFacts || []), ...(profile.sections || [])])].filter((value) => value.evidenceType === "needs_validation").length;
const templatePlantSignatures = new Set(plants.map((plant) => JSON.stringify(plant).replaceAll(plant.id, "<id>").replaceAll(plant.name, "<name>").replaceAll(plant.spanishName, "<es>").replaceAll(plant.scientificName, "<scientific>").replaceAll(plant.variety, "<type>"))).size;
const templateSeedSignatures = new Set(seedProfiles.map((profile) => JSON.stringify(profile).replaceAll(profile.plantIdentityId, "<id>").replaceAll(profile.summary.en, "<summary>").replaceAll(profile.summary.es, "<summary>"))).size;
const inappropriateProfiles = ["italian-oregano", "fragrant-dwarf-dianthus-mix", "monterey-strawberry"].filter((id) => seedProfiles.some((profile) => profile.plantIdentityId === id));

if (plantIdSet.size !== plants.length || new Set(seedProfiles.map((profile) => profile.plantIdentityId)).size !== seedProfiles.length || sourceIdSet.size !== sources.length || danglingSourceIds.length || productGeneralization.length || hydroClaims.length || soilSpacingInHydro.length || unsupportedResistance.length || taxonomyConflicts.length || privateMarkers.length || inappropriateProfiles.length) {
  throw new Error(JSON.stringify({ duplicatePlantIds: plants.length - plantIdSet.size, duplicateSeedProfileIds: seedProfiles.length - new Set(seedProfiles.map((profile) => profile.plantIdentityId)).size, duplicateSourceIds: sources.length - sourceIdSet.size, danglingSourceIds, productGeneralization, hydroClaims, soilSpacingInHydro, unsupportedResistance, taxonomyConflicts, privateMarkers, inappropriateProfiles }));
}

const categoryCounts = plants.reduce((result, plant) => { result[plant.category] = (result[plant.category] || 0) + 1; return result; }, {});
const sourceTypeCounts = sources.reduce((result, source) => { result[source.type] = (result[source.type] || 0) + 1; return result; }, {});
console.log(JSON.stringify({ plants: plants.length, seedProfiles: seedProfiles.length, sources: sources.length, taxonomyRecords: taxonomy.records.length, categoryCounts, sourceTypeCounts, duplicatePlantIds: 0, duplicateSeedProfileIds: 0, duplicateSourceIds: 0, danglingSourceIds: [], productGeneralization: [], hydroClaims: [], soilSpacingInHydro: [], unsupportedResistance: [], taxonomyConflicts: [], privateMarkers: [], inappropriateProfiles: [], needsValidation, templatePlantSignatures, templateSeedSignatures, editorialScaffold: "shared structure is intentional; identity, taxonomy, source scope and uncertainty remain per-record" }));
