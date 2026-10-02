import { describe, expect, it } from "vitest";

import {
  buildDonorPlantDetail,
  canonicalEntries,
  donorPlants,
  donorPlantsById,
  findCanonicalEntry,
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
        light: "all",
        inventory: "all",
      }).map((plant) => plant.id),
    ).toContain("german-thyme");
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "Petunia × atkinsiana",
        category: "all",
        light: "all",
        inventory: "all",
      }).map((plant) => plant.id),
    ).toContain("cascading-petunia");
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "basil",
        category: "herbs",
        light: "all",
        inventory: "all",
      }).every((plant) => plant.category === "herbs"),
    ).toBe(true);
  });

  it("supports category and public inventory boundaries", () => {
    const flowers = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "flowers",
      light: "all",
      inventory: "all",
    });
    expect(flowers.length).toBeGreaterThan(0);
    expect(flowers.every((plant) => plant.category === "flowers")).toBe(true);
    expect(
      filterDonorPlants({
        plants: donorPlants,
        query: "",
        category: "all",
        light: "all",
        inventory: "owned",
      }),
    ).toHaveLength(0);

    const fullSun = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "all",
      light: "full_sun",
      inventory: "all",
    });
    const partialSun = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "all",
      light: "partial_sun",
      inventory: "all",
    });
    const unknownLight = filterDonorPlants({
      plants: donorPlants,
      query: "",
      category: "all",
      light: "unknown",
      inventory: "all",
    });
    expect(fullSun.length).toBeGreaterThan(0);
    expect(partialSun.length).toBeGreaterThan(0);
    expect(unknownLight.length).toBeGreaterThan(0);
    expect(fullSun.every((plant) => plant.light === "full_sun")).toBe(true);
    expect(partialSun.every((plant) => plant.light === "partial_sun")).toBe(true);
    expect(unknownLight.every((plant) => plant.light === "unknown")).toBe(true);
    expect(donorPlants.some((plant) => plant.light === ("baja" as never))).toBe(false);
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
    expect(
      lowLight.recommendations.every(
        (item) => donorPlantsById.get(item.plantId)?.light === "partial_sun",
      ),
    ).toBe(true);

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
