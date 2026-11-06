import { beforeEach, describe, expect, it } from "vitest";

import { gardenLibraryManifest } from "@/generated/garden-library-manifest";
import harvestUse from "../../../../../../labs/gardenpedia/data/harvest-use-v0.1.json";
import harvestUseAdditions from "../../../../../../labs/gardenpedia/data/harvest-use-richness-additions.json";
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

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      for (const source of result.sources) {
        expect(catalogSourceUrls.get(source.id) ?? harvestSourceUrls.get(source.id)).toBe(
          source.url,
        );
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

  it("never attaches private inventory or machine-instance context", () => {
    const serialized = JSON.stringify(retrieveGardenpediaEvidence("basil hydroponics", "en"));

    expect(serialized).not.toMatch(/my seeds|system instance|nickname|URUQ\s*12\s*#/i);
    expect(serialized).not.toContain("inventory");
  });
});
