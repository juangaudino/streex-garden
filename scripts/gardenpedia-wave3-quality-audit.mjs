import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataDir = path.join(root, "labs", "gardenpedia", "data");
const plants = JSON.parse(fs.readFileSync(path.join(dataDir, "plants-expansion-wave-3.json"), "utf8"));
const seedProfiles = JSON.parse(fs.readFileSync(path.join(dataDir, "seed-profiles-expansion-wave-3.json"), "utf8")).profiles;
const sources = JSON.parse(fs.readFileSync(path.join(dataDir, "sources-expansion-wave-3.json"), "utf8"));

function duplicateCount(records) {
  const signatures = new Map();
  for (const record of records) {
    const signature = JSON.stringify(record);
    signatures.set(signature, (signatures.get(signature) || 0) + 1);
  }
  return [...signatures.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
}

const plantText = JSON.stringify(plants);
const seedText = JSON.stringify(seedProfiles);
const hydroClaims = plants.filter((plant) => plant.compatibilityProfile?.hydroponicSuitability?.status === "known" || plant.compatibilityProfile?.hydroponicSuitability?.status === "compatible").map((plant) => plant.id);
const soilSpacingInHydro = plants.filter((plant) => ["known", "compatible"].includes(plant.compatibilityProfile?.hydroponicSuitability?.status) && /spacing|soil|field|outdoor/i.test(JSON.stringify(plant.compatibilityProfile?.hydroponicSuitability))).map((plant) => plant.id);
const unsupportedResistance = [...plantText.matchAll(/disease resistance|resistant to|resistance codes/gi)].map((match) => match[0]);
const exactPlantDuplicates = duplicateCount(plants);
const exactSeedDuplicates = duplicateCount(Object.values(seedProfiles));
const needsValidationFields = [...plants.flatMap((plant) => Object.values(plant.sections || {})), ...Object.values(seedProfiles).flatMap((profile) => [...(profile.quickFacts || []), ...(profile.sections || [])])].filter((value) => value.evidenceType === "needs_validation").length;
const categoryCounts = plants.reduce((result, plant) => { result[plant.category] = (result[plant.category] || 0) + 1; return result; }, {});
const sourceTypeCounts = sources.reduce((result, source) => { result[source.type] = (result[source.type] || 0) + 1; return result; }, {});
const identityOnlySources = new Set(["johnnys-black-cherry-wave3", "johnnys-sunrise-sauce-wave3", "ferry-sunflower-autumn-beauty", "ferry-sunflower-american-giant"]);
const productGeneralization = plants.flatMap((plant) => {
  const nonIdentityEvidence = { ...Object.fromEntries(Object.entries(plant.sections || {}).filter(([key]) => key !== "identity")), compatibilityProfile: plant.compatibilityProfile };
  return [...identityOnlySources].filter((sourceId) => JSON.stringify(nonIdentityEvidence).includes(sourceId)).map((sourceId) => `${plant.id}:${sourceId}`);
});
const seedProductGeneralization = Object.values(seedProfiles).flatMap((profile) => [...identityOnlySources].filter((sourceId) => JSON.stringify(profile).includes(sourceId)).map((sourceId) => `${profile.plantIdentityId}:${sourceId}`));

if (exactPlantDuplicates || exactSeedDuplicates || hydroClaims.length || soilSpacingInHydro.length || unsupportedResistance.length || productGeneralization.length || seedProductGeneralization.length) {
  throw new Error(JSON.stringify({ exactPlantDuplicates, exactSeedDuplicates, hydroClaims, soilSpacingInHydro, unsupportedResistance, productGeneralization, seedProductGeneralization }));
}

console.log(JSON.stringify({ identities: plants.length, seedProfiles: Object.keys(seedProfiles).length, categoryCounts, sourceTypeCounts, exactPlantDuplicates, exactSeedDuplicates, hydroClaims: [], soilSpacingInHydro: [], unsupportedResistance: [], productGeneralization: [], seedProductGeneralization: [], needsValidationFields, editorialScaffold: "shared structure is intentional; identity names, taxonomy, sources and scope remain per-record" }));
