import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const harvest = read("../data/harvest-use-richness-additions.json");
const visuals = read("../data/visuals.json");
const profiles = read("../data/plants-expansion-wave-29.json");
const spanish = read("../data/translations-expansion-wave-29-es.json");
const rhubarb = profiles.find((p) => p.id === "rhubarb");
assert.ok(rhubarb, "Rhubarb profile missing");
assert.ok(spanish.rhubarb, "Rhubarb Spanish translation missing");
for (const section of ["identity", "cultivation", "growth", "maintenance", "harvest", "problems", "uses"]) {
  assert.ok(rhubarb.sections?.[section], `Rhubarb section missing: ${section}`);
  assert.ok(spanish.rhubarb.sections?.[section], `Rhubarb Spanish section missing: ${section}`);
}
const use = harvest.plants.rhubarb;
assert.ok(use?.edibleParts?.en && use.edibleParts.es);
assert.ok(use?.bestUse?.en && use.bestUse.es);
assert.ok(use?.quickUses?.en?.length && use.quickUses.es.length);
for (const method of use.methods ?? []) {
  assert.ok(method.title.en && method.title.es && method.steps.en.length && method.steps.es.length);
  for (const source of method.sourceIds) assert.ok(harvest.sources[source], `Unknown Harvest Use source: ${source}`);
}
assert.ok(visuals.rhubarb?.length, "Rhubarb guide missing");
for (const guide of visuals.rhubarb) {
  assert.ok(guide.sourceUrl?.startsWith("https://") && guide.title.en && guide.title.es && guide.description.en && guide.description.es);
}
const neighbors = read("../data/neighbor-profiles.json");
const verifiedPairs = neighbors.meta.researchPairs.filter((pair) => pair.a === "rhubarb" || pair.b === "rhubarb");
assert.ok(verifiedPairs.length, "Rhubarb has no verified companion-planting pairs; profile is NOT complete");
for (const pair of verifiedPairs) assert.ok(pair.sourceId && pair.label, "Companion pair must have source and explanation");
console.log("Rhubarb editorial data checks passed; browser and production QA still required.");
