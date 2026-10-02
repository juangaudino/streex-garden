import { describe, expect, it } from "vitest";

import {
  buildDonorPlantDetail,
  canonicalEntries,
  donorPlants,
  donorPlantsById,
  findCanonicalEntry,
  normalizeIndoorLightFilter,
  normalizeOutdoorExposureFilter,
} from "./canonical-adapter";
import { filterDonorPlants } from "./explore";
import { calculateSingleCropDose } from "./hydro-calculator.engine";
import { getPlantRecommendations } from "./plant-advisor.service";

describe("direct Gardenpedia presentation adapter", () => {
  it("adapts the complete active canonical catalog without changing identity ids", () => {
    expect(canonicalEntries).toHaveLength(214);
    expect(new Set(donorPlants.map((plant) => plant.id)).size).toBe(214);
    expect(donorPlants.map((plant) => plant.id)).toContain("genovese-basil");
    expect(donorPlants.map((plant) => plant.id)).toContain("cascading-petunia");
  });

  it("searches canonical English, Spanish, scientific and alias fields", () => {
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "tomillo alemán",
        category: "all",
        outdoorExposure: "all",
        inventory: "all",
      }).map((plant) => plant.id),
    ).toContain("german-thyme");
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "Petunia × atkinsiana",
        category: "all",
        outdoorExposure: "all",
        inventory: "all",
      }).map((plant) => plant.id),
    ).toContain("cascading-petunia");
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "basil",
        category: "herbs",
        outdoorExposure: "all",
        inventory: "all",
      }).every((plant) => plant.category === "herbs"),
    ).toBe(true);
  });

  it("supports category and public inventory boundaries", () => {
    const flowers = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "flowers",
      outdoorExposure: "all",
      inventory: "all",
    });
    expect(flowers.length).toBeGreaterThan(0);
    expect(flowers.every((plant) => plant.category === "flowers")).toBe(true);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "all",
        outdoorExposure: "all",
        inventory: "owned",
      }),
    ).toHaveLength(0);

    const fullSun = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "all",
      outdoorExposure: "full_sun",
      inventory: "all",
    });
    const partialSun = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "all",
      outdoorExposure: "partial_sun",
      inventory: "all",
    });
    const unknownLight = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "all",
      outdoorExposure: "unknown",
      inventory: "all",
    });
    expect(fullSun.length).toBe(198);
    expect(partialSun.length).toBe(5);
    expect(unknownLight.length).toBe(14);
    expect(fullSun.every((plant) => plant.outdoorExposures.includes("full_sun"))).toBe(true);
    expect(partialSun.every((plant) => plant.outdoorExposures.includes("partial_sun"))).toBe(true);
    expect(unknownLight.every((plant) => plant.outdoorExposures.includes("unknown"))).toBe(true);
    expect(donorPlants.every((plant) => plant.indoorLightRequirement === "unknown")).toBe(true);
    expect(normalizeIndoorLightFilter("high light")).toBe("high");
    expect(normalizeIndoorLightFilter("luz media")).toBe("medium");
    expect(normalizeIndoorLightFilter("low light")).toBe("low");
    expect(normalizeIndoorLightFilter("not established")).toBe("unknown");
    expect(normalizeOutdoorExposureFilter("partial shade")).toBe("partial_shade");
    expect(normalizeOutdoorExposureFilter("full sun")).toBe("full_sun");
    expect(normalizeOutdoorExposureFilter("low light")).toBeNull();
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "all",
        outdoorExposure: "partial shade",
        inventory: "all",
      }),
    ).toHaveLength(2);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "all",
        indoorLight: "unknown",
        outdoorExposure: "partial_sun",
        inventory: "all",
      }),
    ).toHaveLength(5);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "herbs",
        indoorLight: "all",
        outdoorExposure: "partial_sun",
        inventory: "all",
      }).length,
    ).toBeGreaterThan(0);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "herbs",
        indoorLight: "low",
        outdoorExposure: "all",
        inventory: "all",
      }),
    ).toHaveLength(0);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "leafy greens",
        indoorLight: "medium",
        outdoorExposure: "all",
        inventory: "all",
      }),
    ).toHaveLength(0);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "all",
        indoorLight: "high",
        outdoorExposure: "full_sun",
        inventory: "all",
      }),
    ).toHaveLength(0);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "all",
        indoorLight: "medium",
        outdoorExposure: "partial_sun",
        inventory: "all",
      }),
    ).toHaveLength(0);
    const partialShade = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "all",
      indoorLight: "all",
      outdoorExposure: "partial_shade",
      inventory: "all",
    });
    expect(partialShade).toHaveLength(2);
    expect(partialShade.map((plant) => plant.id)).toEqual(
      expect.arrayContaining(["delphinium-magic-fountains-dwarf", "zinnia-lilliput-mixed"]),
    );
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "all",
        indoorLight: "all",
        outdoorExposure: "shade",
        inventory: "all",
      }),
    ).toHaveLength(0);
  });

  it("keeps a high-data reference and a lower/uncertain identity generic", () => {
    const basil = buildDonorPlantDetail(findCanonicalEntry("genovese-basil")!, "en");
    const oregano = buildDonorPlantDetail(findCanonicalEntry("italian-oregano")!, "en");
    expect(basil.id).toBe("genovese-basil");
    expect(basil.summary).toContain("productive");
    expect(basil.guides.length).toBeGreaterThanOrEqual(7);
    expect(basil.harvestUse?.options.length).toBeGreaterThan(0);
    expect(basil.seedProfileAvailable).toBe(true);
    expect(basil.evidence.coverage).toMatch(/units/);
    const spanishBasil = buildDonorPlantDetail(findCanonicalEntry("genovese-basil")!, "es");
    expect(spanishBasil.summary).toContain("productiva");
    expect(
      basil.guides.every((guide) => guide.sources.every((source) => source.url.startsWith("http"))),
    ).toBe(true);
    expect(oregano.id).toBe("italian-oregano");
    expect(oregano.summary).not.toContain("Genovese");
    expect(
      oregano.guides.some((guide) => guide.backing === "pending") || oregano.evidence.pending > 0,
    ).toBe(true);
  });

  it("does not expose private inventory or instance fields in public view models", () => {
    for (const plant of donorPlants) expect(plant.inventory).toBe("none");
    const publicModel = JSON.stringify(donorPlants);
    for (const privateMarker of [/URUQ\s+12\s+#1/i, /Garden\s+[12]/i, /nickname/i]) {
      expect(publicModel).not.toMatch(privateMarker);
    }
  });

  it("keeps Advisor local and constrained to canonical identities", async () => {
    const response = await getPlantRecommendations({ query: "hierba fácil para cocina" });
    expect(response.recommendations.length).toBeGreaterThan(0);
    expect(response.recommendations.every((item) => donorPlantsById.has(item.plantId))).toBe(true);
    expect(response.recommendations.every((item) => item.score >= 0 && item.score <= 100)).toBe(
      true,
    );

    const lowLight = await getPlantRecommendations({ query: "poca luz para interior" });
    expect(lowLight.recommendations).toHaveLength(0);
    expect(lowLight.summary).toContain("intensidad de luz interior");
    const lowLightEnglish = await getPlantRecommendations({
      query: "low light indoors",
      language: "en",
    });
    expect(lowLightEnglish.recommendations).toHaveLength(0);
    expect(lowLightEnglish.summary).toContain("indoor light-intensity");

    const herbsEnglish = await getPlantRecommendations({
      query: "herbs for cooking",
      language: "en",
    });
    expect(herbsEnglish.recommendations.length).toBeGreaterThan(0);
    expect(herbsEnglish.summary).toContain("public catalog identities");

    const hydro = await getPlantRecommendations({ query: "hidroponía compacta" });
    expect(
      hydro.recommendations.every((item) => {
        const suitability = donorPlantsById.get(item.plantId)?.hydroponicSuitability;
        return suitability === "compatible" || suitability === "conditional";
      }),
    ).toBe(true);
  });

  it("keeps the donor calculator pure and uses canonical plant ids", () => {
    const result = calculateSingleCropDose({
      plantId: "genovese-basil",
      formulaId: "ab",
      phase: "vegetative",
      liters: 2.5,
    });
    expect(result.crops[0]?.id).toBe("genovese-basil");
    expect(result.parts.every((part) => part.ml >= 0)).toBe(true);
  });
});
