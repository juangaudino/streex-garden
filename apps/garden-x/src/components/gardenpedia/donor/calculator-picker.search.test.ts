import { describe, expect, it } from "vitest";
import { searchCalculatorPlants } from "./calculator-lovable-adapter";

describe("canonical Calculator plant search", () => {
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
});
