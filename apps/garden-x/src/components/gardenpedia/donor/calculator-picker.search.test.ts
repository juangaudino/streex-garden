import { describe, expect, it } from "vitest";
import { gardenCalculatorPlantIndex } from "@/generated/garden-calculator-plant-index";
import {
  CALCULATOR_EXCLUDED_CARNIVOROUS_IDS,
  CALCULATOR_PLANTS,
  searchCalculatorPlants,
} from "./calculator-lovable-adapter";

describe("canonical Calculator plant search", () => {
  it("uses a public identity-only index rather than loading profile or private inventory data", () => {
    expect(gardenCalculatorPlantIndex.length).toBeGreaterThan(500);
    for (const plant of gardenCalculatorPlantIndex) {
      expect(Object.keys(plant).sort()).toEqual([
        "aliases",
        "cultivar",
        "emoji",
        "id",
        "name",
        "scientificName",
      ]);
      expect(Object.keys(plant.name).sort()).toEqual(["en", "es"]);
      expect(JSON.stringify(plant)).not.toMatch(/owner_?id|user_?id|seed_package|system_instance/i);
      expect(
        plant.aliases.every(
          (alias) => !/owned seed|home grown|user zero|uruq|packet|inventory/i.test(alias),
        ),
      ).toBe(true);
    }
  });

  it.each([
    ["Black Seeded Simpson Lettuce", "black-seeded-simpson"],
    ["Evergreen Bunching Onion Nabuka / Nebuka", "evergreen-bunching-onion-nabuka"],
    ["Mini / Lunchbox Sweet Bell Pepper", "mini-lunchbox-sweet-pepper"],
    ["Borage", "borage-blue"],
    ["Common Peppermint", "peppermint-mentha-piperita"],
    ["Fragrant Dwarf Dianthus", "fragrant-dwarf-dianthus-mix"],
    ["Lemon Balm / Melissa officinalis", "lemon-balm"],
    ["Red Mustard", "red-mustard-greens"],
    ["Tropaeolum minus Nasturtium", "bush-nasturtium-tropaeolum-minus"],
  ])("finds the canonical identity for %s", (query, expectedId) => {
    expect(searchCalculatorPlants(query, "en").map((plant) => plant.id)).toContain(expectedId);
  });

  it("ranks exact canonical display names ahead of broader aliases", () => {
    expect(searchCalculatorPlants("Cherry Tomato", "en")[0]?.id).toBe("cherry-tomato");
    expect(searchCalculatorPlants("Butterhead", "en")[0]?.id).toBe(
      "butterhead-lettuce-unspecified",
    );
    expect(searchCalculatorPlants("Basil", "en")[0]?.id).toBe("basil-ocimum-basilicum");
  });

  it("keeps carnivorous profiles out of nutrient selection", () => {
    expect(searchCalculatorPlants("Venus flytrap", "en").map((plant) => plant.id)).toHaveLength(0);
  });

  it("searches Spanish display names and accents", () => {
    expect(searchCalculatorPlants("Lechuga romana roja", "es")[0]?.id).toBe("red-romaine-lettuce");
    expect(searchCalculatorPlants("Menta piperita", "es")[0]?.id).toBe(
      "peppermint-mentha-piperita",
    );
  });

  it("keeps every non-carnivorous canonical identity discoverable by its EN and ES display names", () => {
    const eligiblePlants = CALCULATOR_PLANTS.filter(
      (plant) => !CALCULATOR_EXCLUDED_CARNIVOROUS_IDS.has(plant.id),
    );

    expect(eligiblePlants.length).toBeGreaterThan(400);
    for (const plant of eligiblePlants) {
      expect(searchCalculatorPlants(plant.name.en, "en").map(({ id }) => id)).toContain(plant.id);
      expect(searchCalculatorPlants(plant.name.es, "es").map(({ id }) => id)).toContain(plant.id);
    }
  });
});
