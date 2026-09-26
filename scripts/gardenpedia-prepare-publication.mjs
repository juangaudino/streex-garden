import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCompatibilityProfile } from "./gardenpedia-compatibility-profile.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.GARDENPEDIA_DATA_DIR
  ? path.resolve(process.env.GARDENPEDIA_DATA_DIR)
  : path.join(root, "labs", "gardenpedia", "data");
const plantFiles = ["plants.json", "plants-current-gardens.json", "plants-owned-seeds.json", "plants-expansion-batch-a1.json", "plants-expansion-batch-b1.json", "plants-requests.json"];
const sourceFiles = ["sources.json", "sources-current-gardens.json", "sources-owned-seeds.json", "sources-expansion-batch-a1.json", "sources-expansion-batch-b1.json", "sources-requests.json"];
const categories = new Set(["herbs", "leafy greens", "fruiting", "flowers", "alliums", "root vegetables", "vegetables", "fruits"]);
const publicPlantFields = new Set(["id", "name", "spanishName", "scientificName", "variety", "category", "emoji", "guideCompletion", "tags", "summary", "metrics", "sections", "compatibilityProfile"]);
const sectionNames = new Set(["identity", "germination", "thinning", "pruning", "harvest", "flowering", "hydroponics", "problems"]);
const sourceTypes = new Set(["botanical_taxonomy", "grower_reference", "horticulture_reference", "product_reference", "purchase_listing", "specialist_grower", "university_extension", "university_research"]);
const approvedDomains = ["cornell.edu", "highmowingseeds.com", "fedcoseeds.com", "usda.gov", "powo.science.kew.org", "kew.org", "johnnyseeds.com", "extension.usu.edu", "extension.okstate.edu", "ask.ifas.ufl.edu", "extension.umn.edu", "extension.illinois.edu", "extension.colostate.edu", "extension.wisc.edu", "extension.unh.edu", "extension.ncsu.edu", "extension.psu.edu", "extension.missouri.edu"];

const read = (file) => {
  const target = path.join(source, file);
  return fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, "utf8")) : [];
};
const write = (file, value) => fs.writeFileSync(path.join(source, file), `${JSON.stringify(value, null, 2)}\n`);
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function rejectPrivateMetadata(value, trail = "bundle") {
  if (Array.isArray(value)) return value.forEach((item, index) => rejectPrivateMetadata(item, `${trail}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (/^(owner_?id|user_?id|approved_?by|created_?by|seed_?package_?id|system_?instance_?id|garden_?id|request_?id|proposal_?id|private_.*)$/i.test(key)) {
      throw new Error(`Private metadata is forbidden in catalog fields: ${trail}.${key}`);
    }
    rejectPrivateMetadata(child, `${trail}.${key}`);
  }
}

function remapSourceIds(value, mapping) {
  if (Array.isArray(value)) return value.map((item) => remapSourceIds(item, mapping));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    key === "sourceIds" && Array.isArray(child) ? child.map((id) => mapping.get(id) || id) : remapSourceIds(child, mapping),
  ]));
}

function validateGrowGuide(plant, sourceIds) {
  const unsupported = Object.keys(plant).find((key) => !publicPlantFields.has(key));
  if (unsupported) throw new Error(`Unsupported public plant field: ${unsupported}`);
  const required = ["name", "scientificName", "variety", "summary"];
  for (const key of required) if (typeof plant[key] !== "string" || !plant[key].trim()) throw new Error(`Plant is missing ${key}`);
  if (typeof plant.spanishName !== "string" || typeof plant.emoji !== "string" || !plant.emoji.trim()) throw new Error("Plant identity fields are invalid");
  if (!Number.isInteger(plant.guideCompletion) || plant.guideCompletion < 0 || plant.guideCompletion > 100) throw new Error("guideCompletion must be a derived whole percentage from 0 to 100");
  if (!categories.has(plant.category)) throw new Error(`Unsupported category: ${plant.category}`);
  if (!Array.isArray(plant.tags) || plant.tags.some((tag) => typeof tag !== "string") || !Array.isArray(plant.metrics) || plant.metrics.length !== 0 || !plant.sections || typeof plant.sections !== "object") throw new Error("Grow Guide record shape is invalid; unsupported free-standing metrics are rejected");
  for (const [sectionName, section] of Object.entries(plant.sections)) {
    if (!sectionNames.has(sectionName) || !section || typeof section !== "object") throw new Error(`Unsupported Grow Guide section: ${sectionName}`);
    const unsupportedSectionField = Object.keys(section).find((key) => !["short", "guidance", "items", "context", "evidenceType", "confidence", "sourceIds"].includes(key));
    if (unsupportedSectionField) throw new Error(`Unsupported Grow Guide field ${sectionName}.${unsupportedSectionField}`);
    if (!(typeof section.short === "string" && section.short.trim()) && !(typeof section.guidance === "string" && section.guidance.trim())) throw new Error(`Section ${sectionName} needs a sourced description`);
    if (section.guidance !== undefined && typeof section.guidance !== "string") throw new Error(`Section ${sectionName} guidance must be text`);
    if (section.items !== undefined && (!Array.isArray(section.items) || section.items.some((item) => typeof item !== "string"))) throw new Error(`Section ${sectionName} items must be text`);
    if (section.context !== undefined && typeof section.context !== "string") throw new Error(`Section ${sectionName} context must be text`);
    if (!Array.isArray(section.sourceIds) || section.sourceIds.length === 0) throw new Error(`Section ${sectionName} must cite a source`);
    if (!new Set(["source_backed", "garden_adaptation"]).has(section.evidenceType)) throw new Error(`Section ${sectionName} has an invalid evidence type`);
    if (!new Set(["high", "medium", "low"]).has(section.confidence)) throw new Error(`Section ${sectionName} has invalid confidence`);
    if (section.sourceIds.some((id) => !sourceIds.has(id))) throw new Error(`Section ${sectionName} has a dangling source ID`);
  }
}

function validateIdentityEvidence(items, sourceIds) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Identity evidence is required");
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Identity evidence ${index} is invalid`);
    const unsupported = Object.keys(item).find((key) => !["claim", "taxonomicScope", "confidence", "evidenceType", "sourceIds", "note"].includes(key));
    if (unsupported) throw new Error(`Unsupported identity evidence field: ${unsupported}`);
    if (typeof item.claim !== "string" || !item.claim.trim() || !["high", "medium", "low"].includes(item.confidence) || !["source_backed", "garden_adaptation"].includes(item.evidenceType)) throw new Error(`Identity evidence ${index} is incomplete`);
    const scope = item.taxonomicScope;
    if (!scope || typeof scope !== "object" || Array.isArray(scope)) throw new Error(`Identity evidence ${index} has no taxonomic scope`);
    if (scope.level === "identity") {
      if (Object.keys(scope).some((key) => key !== "level")) throw new Error(`Identity evidence ${index} has invalid identity scope`);
    } else if (["species", "genus", "family"].includes(scope.level)) {
      if (Object.keys(scope).some((key) => !["level", "taxon"].includes(key)) || typeof scope.taxon !== "string" || !scope.taxon.trim()) throw new Error(`Identity evidence ${index} has invalid taxonomic scope`);
    } else throw new Error(`Identity evidence ${index} has unsupported taxonomic scope`);
    if (!Array.isArray(item.sourceIds) || item.sourceIds.length === 0 || item.sourceIds.some((id) => !sourceIds.has(id))) throw new Error(`Identity evidence ${index} has a dangling source ID`);
  }
}

function checkDuplicateIdentity(plant, existingPlants) {
  const requestedId = normalize(plant.id);
  const proposedName = normalize(plant.name);
  const proposedScientific = normalize(plant.scientificName);
  const proposedCultivar = normalize(plant.variety);
  const duplicate = existingPlants.find((existing) => {
    if (normalize(existing.id) === requestedId) return true;
    const names = [existing.name, existing.spanishName, existing.scientificName, existing.variety, ...(existing.aliases || []), ...(existing.tags || [])].map(normalize);
    if (names.includes(proposedName)) return true;
    return proposedScientific && proposedCultivar && normalize(existing.scientificName) === proposedScientific && normalize(existing.variety) === proposedCultivar;
  });
  if (duplicate) throw new Error(`Duplicate catalog identity: ${duplicate.id}`);
}

function main() {
  const bundlePath = process.argv[2];
  if (!bundlePath) throw new Error("Usage: node scripts/gardenpedia-prepare-publication.mjs <approved-proposal.json>");
  const bundle = JSON.parse(fs.readFileSync(path.resolve(bundlePath), "utf8"));
  if (bundle.schemaVersion !== "gardenpedia_publication_bundle_v1") throw new Error("Unsupported publication bundle version");
  if (!bundle.proposalId || !bundle.requestId || !bundle.approvedAt || !bundle.approvedBy) throw new Error("Bundle is not traceable to an approved request and curator");
  const proposedData = bundle.proposedData;
  if (!proposedData || typeof proposedData !== "object" || !proposedData.plant || !Array.isArray(proposedData.sources)) throw new Error("Proposal payload is incomplete");
  rejectPrivateMetadata(proposedData);
  if (Object.keys(proposedData).some((key) => !["plant", "identityEvidence", "unknowns", "sources"].includes(key))) throw new Error("Proposal contains unsupported public or private fields");
  if (!Array.isArray(proposedData.unknowns) || proposedData.unknowns.some((value) => typeof value !== "string")) throw new Error("Proposal unknowns must be text");

  const existingPlants = plantFiles.flatMap(read);
  const existingSources = sourceFiles.flatMap(read);
  const knownSourceById = new Map(existingSources.map((record) => [record.id, record]));
  const knownSourceByUrl = new Map(existingSources.map((record) => [record.url, record]));
  const proposedSourceIds = new Map();
  const appendedSources = [];

  for (const record of proposedData.sources) {
    if (!record || typeof record.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id) || typeof record.url !== "string" || !record.title?.trim?.() || !record.publisher?.trim?.()) throw new Error("Source record is incomplete");
    const url = new URL(record.url).href;
    const hostname = new URL(url).hostname.toLowerCase();
    if (new URL(url).protocol !== "https:" || !approvedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) throw new Error("Source is outside the approved institutional and primary source list");
    if (!sourceTypes.has(record.type) || typeof record.scope !== "string" || !record.scope.trim() || typeof record.accessed !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(record.accessed) || Number.isNaN(Date.parse(`${record.accessed}T00:00:00Z`))) throw new Error("Source record has unsupported provenance metadata");
    const canonical = knownSourceByUrl.get(url);
    if (canonical) {
      proposedSourceIds.set(record.id, canonical.id);
      continue;
    }
    const conflictingId = knownSourceById.get(record.id);
    if (conflictingId && conflictingId.url !== url) throw new Error(`Source ID collision: ${record.id}`);
    if (!conflictingId) {
      appendedSources.push({ ...record, url });
      knownSourceById.set(record.id, record);
      knownSourceByUrl.set(url, record);
    }
    proposedSourceIds.set(record.id, record.id);
  }

  const plant = remapSourceIds(proposedData.plant, proposedSourceIds);
  if (typeof plant.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(plant.id)) throw new Error("Proposed identity ID must be a stable lowercase Gardenpedia slug");
  checkDuplicateIdentity(plant, existingPlants);
  const sourceIds = new Set(knownSourceById.keys());
  validateGrowGuide(plant, sourceIds);
  validateCompatibilityProfile(plant.compatibilityProfile, sourceIds);
  validateIdentityEvidence(proposedData.identityEvidence, sourceIds);
  const referencedSources = new Set();
  const collectSourceIds = (value) => {
    if (Array.isArray(value)) value.forEach(collectSourceIds);
    else if (value && typeof value === "object") {
      if (Array.isArray(value.sourceIds)) value.sourceIds.forEach((id) => referencedSources.add(id));
      Object.values(value).forEach(collectSourceIds);
    }
  };
  collectSourceIds(proposedData);
  if ([...referencedSources].some((id) => !sourceIds.has(id))) throw new Error("Proposal contains an orphan source reference");
  const serialized = JSON.stringify(plant);
  if (serialized.includes("sourceUrls")) throw new Error("Unresolved source URL references remain in catalog data");

  const allSourceIds = [...existingSources, ...appendedSources].map((record) => record.id);
  if (new Set(allSourceIds).size !== allSourceIds.length) throw new Error("Duplicate source IDs in final catalog sources");
  const profileSources = new Set();
  for (const evidence of Object.values(plant.compatibilityProfile)) {
    const visit = (value) => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") {
        if (Array.isArray(value.sourceIds)) value.sourceIds.forEach((id) => profileSources.add(id));
        Object.values(value).forEach(visit);
      }
    };
    visit(evidence);
  }
  if ([...profileSources].some((id) => !sourceIds.has(id))) throw new Error("Compatibility profile contains an orphan source reference");

  const plantPath = path.join(source, "plants-requests.json");
  const sourcePath = path.join(source, "sources-requests.json");
  const currentPlants = fs.existsSync(plantPath) ? read("plants-requests.json") : [];
  const currentSources = fs.existsSync(sourcePath) ? read("sources-requests.json") : [];
  if (currentPlants.some((entry) => entry.id === plant.id)) throw new Error(`Identity already exists in request catalog: ${plant.id}`);
  write("plants-requests.json", [...currentPlants, plant]);
  write("sources-requests.json", [...currentSources, ...appendedSources]);
  console.log(JSON.stringify({ prepared: plant.id, requestId: bundle.requestId, proposalId: bundle.proposalId, addedSources: appendedSources.length, profileVersion: plant.compatibilityProfile.profileVersion }));
}

main();
