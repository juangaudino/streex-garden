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

  it("adds Texas A&M transplant timing for exact ornamental identities without changing nutrient evidence", () => {
    const cases = [
      ["tiny-tim-sweet-alyssum", 28, 21, 35],
      ["resina-calendula", 52, 49, 56],
      ["rainbow-mix-coleus", 60, 49, 70],
      ["cascading-petunia", 42, 35, 49],
      ["petunia-dwarf-bedding-mixed", 42, 35, 49],
      ["zinnia-lilliput-mixed", 28, 21, 35],
    ] as const;

    for (const [plantId, ageDays, minDays, maxDays] of cases) {
      const cue = calculatorAgeStageCueForPlant(plantId, ageDays);
      expect(cue?.reference.source.id).toBe("texas-am-seedling-transplant-timing");
      expect(cue?.ageWindow).toMatchObject({ minDays, maxDays, stageSuggestion: "SEEDLING" });
      expect(cue?.ageWindow.text.en).toMatch(/nursery context/);
      expect(cue?.ageWindow.text.es).toMatch(/vivero/);
    }
  });

  it("does not apply the Texas A&M timing outside its published transplant window", () => {
    expect(calculatorAgeStageCueForPlant("zinnia-lilliput-mixed", 20)).toBeUndefined();
    expect(calculatorAgeStageCueForPlant("rainbow-mix-coleus", 71)).toBeUndefined();
  });

  it("uses the exact Zinnia study cue at day 15 and retains the separate nursery cue later", () => {
    const hydroponic = calculatorAgeStageCueForPlant("zinnia-lilliput-mixed", 15);
    expect(hydroponic?.reference.source.id).toBe("can-tho-zinnia-hoagland-2022");
    expect(hydroponic?.ageWindow.text.en).toMatch(/two pairs of true leaves/i);
    const nursery = calculatorAgeStageCueForPlant("zinnia-lilliput-mixed", 28);
    expect(nursery?.reference.source.id).toBe("texas-am-seedling-transplant-timing");
  });

  it("uses explicit WVU Extension identity mappings for the user's herb varieties", () => {
    const cases = [
      ["genovese-basil", 42, 42, 42],
      ["thai-basil", 42, 42, 42],
      ["italian-oregano", 63, 56, 70],
      ["rosemary", 77, 70, 84],
      ["italian-giant-parsley", 66, 63, 70],
      ["german-thyme", 63, 56, 70],
      ["dark-green-zucchini", 18, 14, 21],
    ] as const;

    for (const [plantId, ageDays, minDays, maxDays] of cases) {
      const cue = calculatorAgeStageCueForPlant(plantId, ageDays);
      expect(cue?.reference.source.id).toBe("wvu-extension-seed-starting-transplant-age");
      expect(cue?.ageWindow).toMatchObject({ minDays, maxDays, stageSuggestion: "SEEDLING" });
      expect(cue?.ageWindow.text.en).toMatch(/not an automatic hydroponic stage or dose/);
      expect(cue?.ageWindow.text.es).toMatch(/no es una etapa hidropónica automática ni una dosis/);
    }
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
