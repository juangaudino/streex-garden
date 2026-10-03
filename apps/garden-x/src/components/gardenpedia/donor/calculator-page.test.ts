import { describe, expect, it } from "vitest";

import { donorPlants } from "./canonical-adapter";
import {
  FORMULAS,
  calculatePolycultureCompromise,
  calculateSingleCropDose,
} from "./hydro-calculator.engine";

describe("Gardenpedia provisional calculator transplant", () => {
  it("uses the canonical plant catalog rather than the donor's small demo catalog", () => {
    expect(donorPlants).toHaveLength(214);
    expect(donorPlants.map((plant) => plant.id)).toContain("genovese-basil");
    expect(donorPlants.map((plant) => plant.id)).toContain("cascading-petunia");
  });

  it("keeps the donor's formula, stage, dose and measurement result flow isolated", () => {
    expect(FORMULAS.map((formula) => formula.id)).toEqual(["aerogarden", "ab", "flora"]);
    const result = calculateSingleCropDose({
      plantId: "genovese-basil",
      formulaId: "ab",
      phase: "vegetative",
      liters: 2,
    });

    expect(result.parts).toHaveLength(2);
    expect(result.estimatedEc).toBeGreaterThan(0);
    expect(result.targetEc.min).toBeLessThanOrEqual(result.targetEc.max);
  });

  it("surfaces a limiting crop for a shared tank without changing canonical profiles", () => {
    const result = calculatePolycultureCompromise({
      plantIds: ["genovese-basil", "cherry-tomato"],
      formulaId: "flora",
      phase: "flowering",
      liters: 6.5,
    });

    expect(result.limitingCrop).toBeDefined();
    expect(result.crops.map((crop) => crop.id)).toEqual(["genovese-basil", "cherry-tomato"]);
    expect(JSON.stringify(result)).not.toMatch(/User Zero|Garden 2|podMap|packetName/i);
  });
});
