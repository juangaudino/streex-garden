import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => JSON.parse(readFileSync(new URL("../data/" + file, import.meta.url), "utf8"));
const batch = read("editorial-scope-batch-100.json");
const plants = [1,2,3].flatMap(n => read("plants-expansion-wave-" + n + ".json"));
const spanish = Object.assign({}, ...[1,2,3].map(n => read("translations-expansion-wave-" + n + "-es.json")));
const ids = Object.keys(batch.profiles);
assert.equal(ids.length,100,"Expected exactly 100 profiles");
let sections=0,actions=0;
for (const id of ids) {
 const plant=plants.find(p=>p.id===id), translation=spanish[id];
 assert.ok(plant && translation,"Missing bilingual profile: "+id);
 for (const [key,scope] of Object.entries(batch.profiles[id].sections)) {
  const en=plant.sections[key],es=translation.sections[key];
  assert.ok(en && es,"Missing section "+id+"/"+key);
  assert.ok(scope.context.en && scope.context.es,"Missing bilingual scope "+id+"/"+key);
  assert.ok(en.evidenceType && en.confidence,"Missing evidence classification "+id+"/"+key);
  if (scope.action) {
   assert.equal(scope.action.en,en.guidance,"Changed English source-derived action "+id+"/"+key);
   assert.equal(scope.action.es,es.guidance,"Changed Spanish source-derived action "+id+"/"+key);
   actions++;
  }
  sections++;
 }
}
const adapter=readFileSync(new URL("../../../apps/garden-x/src/components/gardenpedia/donor/canonical-adapter.ts",import.meta.url),"utf8");
assert.match(adapter,/editorialScopeBatch100/);
assert.match(adapter,/localizedAction/);
assert.match(adapter,/localizedContext/);
console.log("PASS: 100 profiles, "+sections+" bilingual evidence scopes, "+actions+" source-derived guidance actions. Does not certify full plant QA, browser visuals or deployment.");
