import { beforeEach, describe, expect, it } from "vitest";

import { gardenLibraryManifest } from "@/generated/garden-library-manifest";
import harvestUse from "../../../../../../labs/gardenpedia/data/harvest-use-v0.1.json";
import harvestUseAdditions from "../../../../../../labs/gardenpedia/data/harvest-use-richness-additions.json";
import { NUTRIENT_SOURCES } from "@/lib/garden-nutrient-engine-v1/data";
import {
  classifyHarvestEvidence,
  clearGardenpediaEvidenceCacheForTests,
  retrieveGardenpediaEvidence,
} from "./plant-advisor.evidence";

describe("Gardenpedia Advisor evidence retrieval", () => {
  beforeEach(() => clearGardenpediaEvidenceCacheForTests());

  it("retrieves bilingual canonical plant knowledge for open questions", () => {
    const english = retrieveGardenpediaEvidence("How should I prune Genovese basil?", "en");
    const spanish = retrieveGardenpediaEvidence("¿Cómo podo la albahaca genovesa?", "es");

    expect(english.length).toBeGreaterThan(0);
    expect(english[0]?.plantName.toLocaleLowerCase()).toContain("basil");
    expect(english.some((item) => /prun/i.test(`${item.section} ${item.text}`))).toBe(true);
    expect(spanish.length).toBeGreaterThan(0);
    expect(spanish[0]?.plantName.toLocaleLowerCase()).toContain("albahaca");
    expect(spanish.some((item) => /pod/i.test(`${item.section} ${item.text}`))).toBe(true);
  });

  it("finds English plant names while answering in Spanish without assigning an ambiguous cultivar", () => {
    for (const [query, plantId] of [
      ["EC garlic chives", "garlic-chives"],
      ["EC Lemon Basil", "basil-lemon"],
      ["EC Hyssop", "hyssop"],
      ["EC Cherry Tomato", "cherry-tomato"],
    ] as const) {
      const records = retrieveGardenpediaEvidence(query, "es", 12);
      expect(
        records.some((record) => record.plantId === plantId),
        query,
      ).toBe(true);
    }
  });

  it("keeps repeated searches stable and separates the English and Spanish indexes", () => {
    const first = retrieveGardenpediaEvidence("Genovese basil germination", "en");
    retrieveGardenpediaEvidence("albahaca genovesa germinación", "es");
    expect(retrieveGardenpediaEvidence("Genovese basil germination", "en")).toEqual(first);
  });

  it("includes seed-profile evidence when a question is about germination", () => {
    const results = retrieveGardenpediaEvidence("basil seed germination", "en");

    expect(results.some((item) => item.id.includes(":seed:"))).toBe(true);
    expect(
      results.every((item) =>
        ["source_backed", "garden_adaptation", "needs_validation"].includes(item.evidenceType),
      ),
    ).toBe(true);
    expect(
      results.every((item) => item.evidenceType !== "source_backed" || item.sources.length > 0),
    ).toBe(true);
  });

  it("keeps source-less harvest guidance in the needs-validation state", () => {
    expect(classifyHarvestEvidence(0)).toBe("needs_validation");
    expect(classifyHarvestEvidence(1)).toBe("source_backed");
  });

  it("uses canonical sources for Harvest Use even when they are attached to that dataset", () => {
    const result = retrieveGardenpediaEvidence("Bibb Lettuce best use fresh", "en").find((item) =>
      item.id.includes(":harvest:"),
    );

    expect(result).toBeDefined();
    expect(result?.evidenceType).toBe("source_backed");
    expect(result?.sources.length).toBeGreaterThan(0);
    const harvestSources = new Map(
      Object.entries({ ...harvestUse.sources, ...harvestUseAdditions.sources }),
    );
    for (const source of result?.sources ?? []) {
      expect(harvestSources.get(source.id)).toEqual(expect.objectContaining({ url: source.url }));
    }
  });

  it("preserves source IDs and URLs from the canonical catalog", () => {
    const results = retrieveGardenpediaEvidence("tomato harvest", "en");
    const catalogSourceUrls = new Map<string, string>();
    for (const entry of gardenLibraryManifest.entries as readonly {
      reference: { sources: readonly { id: string; url: string }[] };
    }[]) {
      for (const source of entry.reference.sources) catalogSourceUrls.set(source.id, source.url);
    }
    const harvestSourceUrls = new Map<string, string>();
    for (const [id, source] of Object.entries({
      ...harvestUse.sources,
      ...harvestUseAdditions.sources,
    })) {
      harvestSourceUrls.set(id, source.url);
    }
    const nutrientSourceUrls = new Map(
      Object.values(NUTRIENT_SOURCES).map((source) => [source.id, source.url]),
    );

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      for (const source of result.sources) {
        expect(
          catalogSourceUrls.get(source.id) ??
            harvestSourceUrls.get(source.id) ??
            nutrientSourceUrls.get(source.id),
        ).toBe(source.url);
      }
    }
  });

  it("returns no unsupported evidence for an unrelated or empty question", () => {
    expect(retrieveGardenpediaEvidence("", "en")).toEqual([]);
    expect(retrieveGardenpediaEvidence("best laptop for video editing", "en")).toEqual([]);
    expect(retrieveGardenpediaEvidence("care", "en")).toEqual([]);
  });

  it("keeps plant-specific care questions anchored to the named identity", () => {
    const results = retrieveGardenpediaEvidence("How do I care for basil?", "en");

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.plantName.toLocaleLowerCase().includes("basil"))).toBe(
      true,
    );
  });

  it.each([
    ["¿Cómo cuido mi lechuga Bibb?", "bibb-lettuce", "es"],
    ["¿Cómo cuido la fresa Monterey?", "monterey-strawberry", "es"],
    ["How do I grow Tiny Tim tomato?", "tiny-tim-tomato", "en"],
  ] as const)("prioritizes the named variety for %s", (question, plantId, lang) => {
    const results = retrieveGardenpediaEvidence(question, lang);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.plantId).toBe(plantId);
    expect(results.every((item) => item.plantId === plantId)).toBe(true);
  });

  it.each([
    ["¿Puedo cultivar lechuga Bibb y tomate Tiny Tim juntos?", "es"],
    ["Can Bibb Lettuce share a system with Tiny Tim Tomato?", "en"],
  ] as const)("balances evidence for both explicitly named crops: %s", (question, lang) => {
    const results = retrieveGardenpediaEvidence(question, lang);
    expect(results.some((item) => item.plantId === "bibb-lettuce")).toBe(true);
    expect(results.some((item) => item.plantId === "tiny-tim-tomato")).toBe(true);
    expect(
      results.every((item) => ["bibb-lettuce", "tiny-tim-tomato"].includes(item.plantId)),
    ).toBe(true);
  });

  it("retrieves sourced EC evidence for both crops without inventing stage or a dose", () => {
    const results = retrieveGardenpediaEvidence(
      "¿Qué EC necesitan la lechuga Bibb y el tomate Tiny Tim?",
      "es",
      12,
    );
    for (const id of ["bibb-lettuce", "tiny-tim-tomato"]) {
      const record = results.find((item) => item.plantId === id && item.id.includes(":nutrient:"));
      expect(record?.evidenceType).toBe("source_backed");
      expect(record?.sources[0]?.id).toBe("okstate-ecph");
      expect(record?.text).toContain("la etapa no están especificadas");
      expect(record?.text).toContain("no una receta, una dosis");
    }
  });

  it("retrieves crop studies as contextual observations, without treating them as universal doses", () => {
    const culantro = retrieveGardenpediaEvidence(
      "¿Qué EC se ha estudiado para culantro?",
      "es",
      12,
    );
    const study = culantro.find((item) => item.id.includes("nutrient-study:nguyen-eryngium"));
    expect(study?.plantId).toBe("culantro");
    expect(study?.text).toContain("no un rango validado ni una dosis automática");
    expect(study?.sources[0]?.url).toMatch(/^https:\/\//);
  });

  it("retrieves the garlic chive and zinnia studies as contextual evidence", () => {
    for (const [query, source] of [
      ["garlic chives hydroponic EC", "chinese-chive-hydroponic-salinity-2022"],
      ["zinnia lilliput hydroponic EC", "can-tho-zinnia-hoagland-2022"],
      ["epazote EC", "unam-epazote-hydroponic-2013"],
      ["blue borage EC", "pisa-borage-leaves-hydroponic-2022"],
      ["dill bouquet EC", "walters-lopez-bouquet-dill-deep-flow-2021"],
    ] as const) {
      const result = retrieveGardenpediaEvidence(query, "en", 20);
      expect(
        result.some((item) => item.sources.some((itemSource) => itemSource.id === source)),
      ).toBe(true);
    }
  });

  it("never attaches private inventory or machine-instance context", () => {
    const serialized = JSON.stringify(retrieveGardenpediaEvidence("basil hydroponics", "en"));

    expect(serialized).not.toMatch(/my seeds|system instance|nickname|URUQ\s*12\s*#/i);
    expect(serialized).not.toContain("inventory");
  });
});
