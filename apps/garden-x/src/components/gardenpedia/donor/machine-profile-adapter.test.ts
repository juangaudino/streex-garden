import { describe, expect, it } from "vitest";

import {
  canonicalMachineModel,
  canonicalMachineModels,
  publicMachineViewModel,
} from "./machine-profile-adapter";

describe("Gardenpedia public machine adapter", () => {
  it("publishes only source-backed model facts", () => {
    const models = canonicalMachineModels();

    expect(models.map((model) => model.id)).toEqual(["uruq-hp-gc001", "uruq-hp-gc202"]);
    expect(models.every((model) => model.source.url.startsWith("https://"))).toBe(true);
    expect(JSON.stringify(models)).not.toMatch(/URUQ 12 #1|Garden 2|podMap|activeDays|waterLevel/i);
  });

  it("keeps model identity separate from instance and layout data", () => {
    const model = canonicalMachineModel("uruq-hp-gc202");

    expect(model?.modelNumber).toBe("HP-GC202");
    expect(model).not.toHaveProperty("instance");
    expect(model).not.toHaveProperty("layout");
    expect(publicMachineViewModel(model!)).toMatchObject({ id: "uruq-hp-gc202" });
  });

  it("supports an evidence-poor model without inventing specs", () => {
    const model = canonicalMachineModel("uruq-hp-gc001");

    expect(model?.maxGrowHeightCm).toBe(40);
    expect(model).not.toHaveProperty("tankLiters");
    expect(model).not.toHaveProperty("pump");
  });
});
