import { describe, expect, it } from "vitest";
import {
  calculatorAgeStageCueForPlant,
  calculatorStageReferenceForPlant,
} from "./calculator-lovable-adapter";

describe("calculator age stage cues", () => {
  it("resolves only explicitly mapped public stage references for the plant row", () => {
    expect(calculatorStageReferenceForPlant("genovese-basil")?.cropIdentity).toBe("basil");
    expect(calculatorStageReferenceForPlant("bibb-lettuce")?.cropIdentity).toBe("lettuce");
    expect(calculatorStageReferenceForPlant("unmapped-plant")).toBeUndefined();
  });

  it("offers source-backed tomato plug timing without converting it into a dose", () => {
    expect(calculatorAgeStageCueForPlant("cherry-tomato", 28)?.ageWindow).toMatchObject({
      minDays: 28,
      maxDays: 42,
      stageSuggestion: "SEEDLING",
    });
    expect(calculatorAgeStageCueForPlant("cherry-tomato", 43)).toBeUndefined();
  });

  it("uses the separate pepper plug window and does not guess below it", () => {
    expect(calculatorAgeStageCueForPlant("jalapeno-pepper", 42)?.ageWindow).toMatchObject({
      minDays: 42,
      maxDays: 63,
      stageSuggestion: "SEEDLING",
    });
    expect(calculatorAgeStageCueForPlant("jalapeno-pepper", 41)).toBeUndefined();
  });

  it("uses a shared leafy-crop transplant window for spinach and mustard only", () => {
    expect(calculatorAgeStageCueForPlant("seaside-f1-spinach", 15)?.ageWindow).toMatchObject({
      minDays: 12,
      maxDays: 18,
      stageSuggestion: "SEEDLING",
    });
    expect(calculatorAgeStageCueForPlant("red-mustard-greens", 15)?.ageWindow).toMatchObject({
      minDays: 12,
      maxDays: 18,
      stageSuggestion: "SEEDLING",
    });
    expect(calculatorAgeStageCueForPlant("seaside-f1-spinach", 19)).toBeUndefined();
  });

  it("uses morphology guidance for cilantro without inventing an age window", () => {
    expect(calculatorStageReferenceForPlant("cilantro")?.text.en).toMatch(/broad and flat/i);
    expect(calculatorAgeStageCueForPlant("cilantro", 20)).toBeUndefined();
  });

  it("returns no cue for unmapped plants or invalid ages", () => {
    expect(calculatorAgeStageCueForPlant("unmapped-plant", 30)).toBeUndefined();
    expect(calculatorAgeStageCueForPlant("cherry-tomato", Number.NaN)).toBeUndefined();
    expect(calculatorAgeStageCueForPlant("cherry-tomato", -1)).toBeUndefined();
  });
});
