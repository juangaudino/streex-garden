import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const read = (file) => JSON.parse(readFileSync(new URL("../data/" + file, import.meta.url), "utf8"));
const waves = [27,28,29];
const plants = waves.flatMap(n => read(`plants-expansion-wave-${n}.json`));
const es = Object.assign({}, ...waves.map(n => read(`translations-expansion-wave-${n}-es.json`)));
const sourceFiles = readdirSync(new URL("../data/", import.meta.url)).filter(
  file => file.startsWith("sources") && file.endsWith(".json"),
);
const sources = new Set(sourceFiles.flatMap(file => read(file)).map(source => source.id));
const visuals = {...read("visuals.json"), ...read("visual-guides-batch-10.json")};
const ids = ["asparagus","rhubarb","escarole","blush-hibiscus","pink-petunia","black-viola","northern-highbush-blueberry","red-raspberry","common-fig","table-grape-vine"];
for (const id of ids) {
 const p = plants.find(x => x.id === id), t = es[id];
 assert.ok(p && t && p.summary && t.summary, id + " bilingual profile");
 assert.ok(Object.keys(p.sections).length >= 4, id + " sections");
 for (const [k,s] of Object.entries(p.sections)) {
  const x = t.sections?.[k];
  assert.ok(s.short && s.guidance && x?.short && x?.guidance, id + "/" + k);
  assert.equal(s.items?.length || 0, x.items?.length || 0, id + "/" + k + " steps");
  for (const source of s.sourceIds || []) assert.ok(sources.has(source), id + "/" + k + ": " + source);
 }
 const v = visuals[id]?.[0];
 assert.ok(v?.sourceUrl?.startsWith("https://") && v.title?.en && v.title?.es, id + " guide");
 assert.equal(v.rightsStatus, "source_link_only", id + " media rights");
}
console.log("Ten profiles passed editorial checks; browser QA is separate.");
