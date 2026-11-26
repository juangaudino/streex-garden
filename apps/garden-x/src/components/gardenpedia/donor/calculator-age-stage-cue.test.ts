import { describe, expect, it } from "vitest";
import {
  calculatorAgeStageCueForPlant,
  calculatorSeedTransitionForPlant,
  calculatorStageReferenceForPlant,
  contextFor,
} from "./calculator-lovable-adapter";
import { calculatePolycultureRange } from "@/lib/garden-nutrient-engine-v1/engine";
import { CROP_EVIDENCE } from "@/lib/garden-nutrient-engine-v1/data";

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

  it("uses the controlled holy-basil DFT transplant observation as a day-14 cue only", () => {
    const cue = calculatorAgeStageCueForPlant("tulsi-holy-basil-ocimum-tenuiflorum", 14);
    expect(cue?.reference.source.id).toBe("holy-basil-controlled-dft-study-2022");
    expect(cue?.ageWindow).toMatchObject({
      minDays: 14,
      maxDays: 14,
      stageSuggestion: "SEEDLING",
    });
    expect(cue?.ageWindow.text.en).toMatch(/developed leaves and roots/i);
    expect(cue?.ageWindow.text.en).toMatch(/does not automatically change its stage or dose/i);
  });

  it("maps Tulsi growth and maturity day windows to confirmable stages backed by the same source", () => {
    const growth = calculatorAgeStageCueForPlant("tulsi-holy-basil-ocimum-tenuiflorum", 50);
    expect(growth?.reference.source.id).toBe("letpot-hydroponic-holy-basil-guide");
    expect(growth?.ageWindow).toMatchObject({
      minDays: 42,
      maxDays: 56,
      stageSuggestion: "VEGETATIVE",
    });
    expect(growth?.ageWindow.text.en).toMatch(/not a universal or automatic transition/i);

    const maturity = calculatorAgeStageCueForPlant("tulsi-holy-basil-ocimum-tenuiflorum", 75);
    expect(maturity?.reference.source.id).toBe("letpot-hydroponic-holy-basil-guide");
    expect(maturity?.ageWindow).toMatchObject({
      minDays: 60,
      maxDays: 90,
      stageSuggestion: "MATURE",
    });
    expect(maturity?.ageWindow.text.en).toMatch(/does not guarantee maturity/i);

    const plantId = "tulsi-holy-basil-ocimum-tenuiflorum";
    const growthRange = calculatePolycultureRange(
      contextFor({ [plantId]: 1 }, "gh-flora", { [plantId]: "VEGETATIVE" }),
      CROP_EVIDENCE,
    );
    expect(growthRange.status).toBe("COMMON_OPTIMUM_RANGE");
    expect(growthRange.range).toMatchObject({ min: 0.9, max: 1.2 });

    const maturityRange = calculatePolycultureRange(
      contextFor({ [plantId]: 1 }, "gh-flora", { [plantId]: "MATURE" }),
      CROP_EVIDENCE,
    );
    expect(maturityRange.status).toBe("COMMON_OPTIMUM_RANGE");
    expect(maturityRange.range).toMatchObject({ min: 1.6, max: 2.1 });
  });

  it("uses the exact Komatsuna study timeline as seedling confirmation context", () => {
    const twoLeafCue = calculatorAgeStageCueForPlant("lady-murasaki-komatsuna", 14);
    expect(twoLeafCue?.reference.source.id).toBe("arkansas-komatsuna-nft-2014");
    expect(twoLeafCue?.ageWindow).toMatchObject({
      minDays: 14,
      maxDays: 14,
      stageSuggestion: "SEEDLING",
    });
    expect(twoLeafCue?.ageWindow.text.en).toMatch(/two true leaves/i);

    const transplantCue = calculatorAgeStageCueForPlant("lady-murasaki-komatsuna", 21);
    expect(transplantCue?.reference.source.id).toBe("arkansas-komatsuna-nft-2014");
    expect(transplantCue?.ageWindow.text.en).toMatch(/four true leaves/i);
    expect(transplantCue?.ageWindow.text.en).toMatch(/not an automatic stage or EC target/i);
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

  it("applies reviewed basil and lettuce age cues to explicitly mapped cultivars", () => {
    for (const plantId of ["basil-dark-opal", "basil-lemon", "basil-lime", "basil-spicy-globe"]) {
      const cue = calculatorAgeStageCueForPlant(plantId, 42);
      expect(cue?.reference.source.id).toBe("wvu-extension-seed-starting-transplant-age");
      expect(cue?.ageWindow).toMatchObject({
        minDays: 42,
        maxDays: 42,
        stageSuggestion: "SEEDLING",
      });
    }

    const butterheadAt15Days = calculatorAgeStageCueForPlant("butterhead-lettuce-unspecified", 15);
    const butterheadAt19Days = calculatorAgeStageCueForPlant("butterhead-lettuce-unspecified", 19);
    expect(butterheadAt15Days?.reference.source.id).toBe(
      "university-kentucky-hydroponic-lettuce-ccd-cp-63",
    );
    expect(butterheadAt15Days?.ageWindow).toMatchObject({
      minDays: 14,
      maxDays: 21,
      stageSuggestion: "SEEDLING",
    });
    expect(butterheadAt19Days?.ageWindow).toEqual(butterheadAt15Days?.ageWindow);
    expect(calculatorAgeStageCueForPlant("butterhead-lettuce-unspecified", 22)).toBeUndefined();
  });

  it("uses morphology guidance for cilantro without inventing an age window", () => {
    expect(calculatorStageReferenceForPlant("cilantro")?.text.en).toMatch(/broad and flat/i);
    expect(calculatorAgeStageCueForPlant("cilantro", 20)).toBeUndefined();
  });

  it("exposes a bilingual, publicly sourced Seed Profile transition cue for exact identities", () => {
    const cue = calculatorSeedTransitionForPlant("genovese-basil");
    expect(cue?.short.en).toMatch(/leaf stage/i);
    expect(cue?.short.es).toMatch(/hojas/i);
    expect(cue?.guidance.en).toMatch(/3–4 sets of leaves/i);
    expect(cue?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "johnnys-genovese-basil-seed",
          url: expect.stringMatching(/^https:\/\//),
        }),
      ]),
    );
    expect(calculatorSeedTransitionForPlant("unmapped-test-identity")).toBeUndefined();
  });

  it("uses the UNAM Epazote transplant observation as context, never an automatic age window", () => {
    const reference = calculatorStageReferenceForPlant("epazote");
    expect(reference?.source.id).toBe("unam-epazote-hydroponic-2013");
    expect(reference?.text.en).toMatch(/about 30 days.*second pair of leaves/i);
    expect(reference?.text.en).toMatch(/ambiguous/i);
    expect(calculatorAgeStageCueForPlant("epazote", 30)).toBeUndefined();
  });

  it("returns no cue for unmapped plants or invalid ages", () => {
    expect(calculatorAgeStageCueForPlant("unmapped-plant", 30)).toBeUndefined();
    expect(calculatorAgeStageCueForPlant("cherry-tomato", Number.NaN)).toBeUndefined();
    expect(calculatorAgeStageCueForPlant("cherry-tomato", -1)).toBeUndefined();
  });
});
