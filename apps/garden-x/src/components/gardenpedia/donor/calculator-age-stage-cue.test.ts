import { describe, expect, it } from "vitest";
import {
  calculatorAgeStageCueForPlant,
  calculatorSeedTransitionForPlant,
  calculatorStageReferenceForPlant,
  contextFor,
  hasApplicableCropNutrientEvidence,
} from "./calculator-lovable-adapter";
import { calculatePolycultureRange } from "@/lib/garden-nutrient-engine-v1/engine";
import { CROP_EVIDENCE, NUTRIENT_SOURCES } from "@/lib/garden-nutrient-engine-v1/data";

describe("calculator age stage cues", () => {
  it("keeps the nutrient source registry uniquely identified and linkable", () => {
    const sources = Object.values(NUTRIENT_SOURCES);
    const ids = sources.map((source) => source.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const source of sources) {
      expect(source.url, source.id).toMatch(/^https:\/\//);
      expect(() => new URL(source.url)).not.toThrow();
    }
  });

  it("uses USU's celery seed-to-transplant timing only as confirmable nursery context", () => {
    const cue = calculatorAgeStageCueForPlant("chinese-light-green-celery", 90);
    expect(cue?.reference.source.id).toBe("usu-grow-your-own-transplants-celery-timing");
    expect(cue?.ageWindow).toMatchObject({
      minDays: 79,
      maxDays: 105,
      stageSuggestion: "SEEDLING",
    });
    expect(cue?.ageWindow.text.en).toMatch(/outdoor nursery context/);
    expect(cue?.ageWindow.text.en).toMatch(/does not automatically change stage or dose/);
    expect(calculatorAgeStageCueForPlant("chinese-light-green-celery", 78)).toBeUndefined();
    expect(calculatorAgeStageCueForPlant("chinese-light-green-celery", 106)).toBeUndefined();
  });

  it("adds sourced, confirmable seedling timing for the remaining named leafy and onion varieties", () => {
    expect(
      calculatorAgeStageCueForPlant("evergreen-bunching-onion-nabuka", 28)?.reference.source.id,
    ).toBe("umn-extension-scallions-transplanting");
    expect(
      calculatorAgeStageCueForPlant("bunching-onion-allium-fistulosum", 28)?.ageWindow,
    ).toMatchObject({
      minDays: 28,
      maxDays: 28,
      stageSuggestion: "SEEDLING",
    });
    expect(calculatorAgeStageCueForPlant("perpetual-spinach", 28)?.reference.source.id).toBe(
      "nc-state-extension-perpetual-spinach-transplanting",
    );
    expect(calculatorAgeStageCueForPlant("hon-tsai-tai", 10)?.reference.source.id).toBe(
      "seed-collection-hon-tsai-tai-germination",
    );
    expect(calculatorAgeStageCueForPlant("scarlet-red-tatsoi", 10)?.reference.source.id).toBe(
      "hudson-valley-scarlet-red-tatsoi-germination",
    );
    expect(calculatorAgeStageCueForPlant("scarlet-red-tatsoi", 16)).toBeUndefined();
    expect(calculatorAgeStageCueForPlant("purple-kohlrabi", 35)?.ageWindow).toMatchObject({
      minDays: 28,
      maxDays: 42,
      stageSuggestion: "SEEDLING",
    });
    expect(
      calculatorAgeStageCueForPlant("fragrant-dwarf-dianthus-mix", 49)?.reference.source.id,
    ).toBe("usu-extension-miniature-carnation-transplanting");
  });

  it("does not manufacture age-to-stage windows for crops without comparable timing evidence", () => {
    for (const plantId of [
      "monterey-strawberry",
      "papalo-porophyllum-ruderale",
      "peppermint-mentha-piperita",
      "tennessee-coneflower-echinacea-tennesseensis",
      "bulls-blood-beet",
      "chamomile-unspecified",
    ]) {
      expect(calculatorAgeStageCueForPlant(plantId, 30), plantId).toBeUndefined();
    }
  });

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

  it("uses PROSEA fenugreek emergence timing only as a confirmable seedling cue", () => {
    const cue = calculatorAgeStageCueForPlant("common-fenugreek-trigonella-foenum-graecum", 4);

    expect(cue?.reference.source.id).toBe("prosea-fenugreek-germination");
    expect(cue?.ageWindow).toMatchObject({
      minDays: 4,
      maxDays: 5,
      stageSuggestion: "SEEDLING",
    });
    expect(cue?.ageWindow.text.en).toMatch(/first leaf is simple/i);
    expect(cue?.ageWindow.text.en).toMatch(/does not change the dose/i);
    expect(
      CROP_EVIDENCE.some((observation) => observation.source.id === "prosea-fenugreek-germination"),
    ).toBe(false);
    expect(calculatorAgeStageCueForPlant("common-fenugreek-trigonella-foenum-graecum", 3)).toBe(
      undefined,
    );
    expect(calculatorAgeStageCueForPlant("common-fenugreek-trigonella-foenum-graecum", 6)).toBe(
      undefined,
    );
  });

  it("shows sourced marjoram and Papalo emergence windows without turning them into dose rules", () => {
    const marjoram = calculatorAgeStageCueForPlant("marjoram", 17);
    expect(marjoram?.reference.source.id).toBe("prosea-origanum-majorana-seedling-emergence");
    expect(marjoram?.ageWindow).toMatchObject({
      minDays: 14,
      maxDays: 21,
      stageSuggestion: "SEEDLING",
    });
    expect(marjoram?.ageWindow.text.en).toMatch(/change the dose/i);
    expect(calculatorAgeStageCueForPlant("marjoram", 22)).toBeUndefined();

    const papalo = calculatorAgeStageCueForPlant("papalo-porophyllum-ruderale", 18);
    expect(papalo?.reference.source.id).toBe("baumaux-papalo-seed-germination");
    expect(papalo?.ageWindow).toMatchObject({
      minDays: 15,
      maxDays: 20,
      stageSuggestion: "SEEDLING",
    });
    expect(papalo?.ageWindow.text.en).toMatch(/5–10 cm/i);
    expect(papalo?.ageWindow.text.en).toMatch(/does not.*change the dose/i);
    expect(calculatorAgeStageCueForPlant("papalo-porophyllum-ruderale", 21)).toBeUndefined();

    expect(
      CROP_EVIDENCE.some((observation) =>
        ["prosea-origanum-majorana-seedling-emergence", "baumaux-papalo-seed-germination"].includes(
          observation.source.id,
        ),
      ),
    ).toBe(false);
  });

  it("adds conditional, sourced emergence cues for borage, curled chervil, and radish only", () => {
    const borage = calculatorAgeStageCueForPlant("borage-blue", 7);
    expect(borage?.reference.source.id).toBe("yates-borago-officinalis-germination");
    expect(borage?.ageWindow).toMatchObject({
      minDays: 5,
      maxDays: 10,
      stageSuggestion: "SEEDLING",
    });
    expect(borage?.ageWindow.text.en).toMatch(/supplier reference/i);

    const chervil = calculatorAgeStageCueForPlant("curled-chervil", 10);
    expect(chervil?.reference.source.id).toBe("uc-marin-chervil-germination");
    expect(chervil?.ageWindow).toMatchObject({
      minDays: 10,
      maxDays: 10,
      stageSuggestion: "SEEDLING",
    });
    expect(chervil?.ageWindow.text.en).toMatch(/60°F/);

    const radish = calculatorAgeStageCueForPlant("crimson-giant-radish", 5);
    expect(radish?.reference.source.id).toBe("inrae-radish-germination-temperature-table");
    expect(radish?.ageWindow).toMatchObject({
      minDays: 4,
      maxDays: 6,
      stageSuggestion: "SEEDLING",
    });
    expect(radish?.ageWindow.text.en).toMatch(/temperature/i);
    expect(radish?.ageWindow.text.en).toMatch(/does not change EC evidence or dose/i);

    expect(
      CROP_EVIDENCE.some((observation) =>
        [
          "yates-borago-officinalis-germination",
          "uc-marin-chervil-germination",
          "inrae-radish-germination-temperature-table",
        ].includes(observation.source.id),
      ),
    ).toBe(false);
  });

  it("adds conditional age cues for sage, bush nasturtium, and Mexican tarragon", () => {
    const sage = calculatorAgeStageCueForPlant("broadleaf-sage", 14);
    expect(sage?.reference.source.id).toBe("johnnys-common-sage-seed-germination");
    expect(sage?.ageWindow).toMatchObject({
      minDays: 7,
      maxDays: 21,
      stageSuggestion: "SEEDLING",
    });
    expect(sage?.ageWindow.text.en).toMatch(/65–70°F/);

    const nasturtium = calculatorAgeStageCueForPlant("bush-nasturtium-tropaeolum-minus", 8);
    expect(nasturtium?.reference.source.id).toBe("uw-madison-nasturtium-germination");
    expect(nasturtium?.ageWindow).toMatchObject({
      minDays: 7,
      maxDays: 10,
      stageSuggestion: "SEEDLING",
    });
    expect(nasturtium?.ageWindow.text.en).toMatch(/soil temperature/i);

    const mexicanTarragon = calculatorAgeStageCueForPlant("mexican-tarragon", 10);
    expect(mexicanTarragon?.reference.source.id).toBe(
      "la-societe-des-plantes-mexican-tarragon-germination",
    );
    expect(mexicanTarragon?.ageWindow).toMatchObject({
      minDays: 7,
      maxDays: 15,
      stageSuggestion: "SEEDLING",
    });
    expect(mexicanTarragon?.ageWindow.text.en).toMatch(/21°C/);

    const addedSourceIds = [
      "johnnys-common-sage-seed-germination",
      "uw-madison-nasturtium-germination",
      "la-societe-des-plantes-mexican-tarragon-germination",
    ];
    expect(
      CROP_EVIDENCE.some((observation) => addedSourceIds.includes(observation.source.id)),
    ).toBe(false);
  });

  it("adds Bull's Blood emergence timing only as a varietal seedling cue", () => {
    const cue = calculatorAgeStageCueForPlant("bulls-blood-beet", 8);
    expect(cue?.reference.source.id).toBe("rupp-bulls-blood-beet-germination");
    expect(cue?.ageWindow).toMatchObject({
      minDays: 6,
      maxDays: 10,
      stageSuggestion: "SEEDLING",
    });
    expect(cue?.ageWindow.text.en).toMatch(/60–85°F/);
    expect(cue?.ageWindow.text.en).toMatch(/does not define a hydroponic stage/i);
    expect(
      CROP_EVIDENCE.some(
        (observation) => observation.source.id === "rupp-bulls-blood-beet-germination",
      ),
    ).toBe(false);
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

  it("labels the generic WVU marigold transplant window as non-cultivar context", () => {
    const cue = calculatorAgeStageCueForPlant("marigold-jolly-jester", 49);
    expect(cue?.reference.source.id).toBe("wvu-extension-seed-starting-transplant-age");
    expect(cue?.ageWindow).toMatchObject({ minDays: 42, maxDays: 56, stageSuggestion: "SEEDLING" });
    expect(cue?.ageWindow.text.en).toMatch(/without specifying species or cultivar/i);
    expect(cue?.ageWindow.text.en).toMatch(/does not automatically change stage or dose/i);
    expect(calculatorAgeStageCueForPlant("marigold-jolly-jester", 57)).toBeUndefined();
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

  it("pairs cilantro morphology with the study's three-week transplant observation", () => {
    expect(calculatorStageReferenceForPlant("cilantro")?.text.en).toMatch(/broad and flat/i);
    expect(calculatorAgeStageCueForPlant("cilantro", 20)).toBeUndefined();
    const cue = calculatorAgeStageCueForPlant("cilantro", 21);
    expect(cue?.ageWindow).toMatchObject({ minDays: 21, maxDays: 21, stageSuggestion: "SEEDLING" });
    expect(cue?.reference.source.id).toBe("walters-currey-herb-nft-2019");
    expect(cue?.ageWindow.text.en).toMatch(/‘Santo’ cilantro.*three weeks/i);
    expect(cue?.ageWindow.text.en).toMatch(/not a universal transition/i);
  });

  it("keeps related dill and Italian Giant parsley transplant cues cultivar-explicit", () => {
    const dill = calculatorAgeStageCueForPlant("dill-bouquet", 21);
    expect(dill?.ageWindow.stageSuggestion).toBe("SEEDLING");
    expect(dill?.ageWindow.text.en).toMatch(/‘Fernleaf’.*not the tested cultivar/i);
    const parsley = calculatorAgeStageCueForPlant("italian-giant-parsley", 21);
    expect(parsley?.ageWindow.stageSuggestion).toBe("SEEDLING");
    expect(parsley?.ageWindow.text.en).toMatch(/‘Giant of Italy’ parsley/i);
    expect(calculatorAgeStageCueForPlant("flat-leaf-parsley", 21)).toBeUndefined();
  });

  it("surfaces the distinct hydroponic transplant timings for Bouquet dill, Giant of Italy parsley, and watercress", () => {
    const dill = calculatorAgeStageCueForPlant("dill-bouquet", 28);
    expect(dill?.reference.source.id).toBe("walters-lopez-bouquet-dill-deep-flow-2021");
    expect(dill?.ageWindow).toMatchObject({
      minDays: 28,
      maxDays: 28,
      stageSuggestion: "SEEDLING",
    });
    expect(dill?.ageWindow.text.en).toMatch(/Bouquet dill four weeks/i);
    expect(dill?.ageWindow.text.en).toMatch(/another trial.*three-week-old seedlings/i);

    const parsley = calculatorAgeStageCueForPlant("italian-giant-parsley", 35);
    expect(parsley?.reference.source.id).toBe("walters-lopez-bouquet-dill-deep-flow-2021");
    expect(parsley?.ageWindow).toMatchObject({
      minDays: 35,
      maxDays: 35,
      stageSuggestion: "SEEDLING",
    });
    expect(parsley?.ageWindow.text.en).toMatch(/‘Giant of Italy’ parsley five weeks/i);
    expect(parsley?.ageWindow.text.en).toMatch(/another NFT trial.*three-week-old seedlings/i);

    const watercress = calculatorAgeStageCueForPlant("watercress", 21);
    expect(watercress?.reference.source.id).toBe("walters-lopez-bouquet-dill-deep-flow-2021");
    expect(watercress?.ageWindow).toMatchObject({
      minDays: 21,
      maxDays: 21,
      stageSuggestion: "SEEDLING",
    });
    expect(watercress?.ageWindow.text.en).toMatch(/watercress three weeks after sowing/i);
    expect(calculatorAgeStageCueForPlant("watercress", 22)).toBeUndefined();
  });

  it("uses the NFT sunflower transplant cue without claiming cultivar-specific validation", () => {
    for (const plantId of [
      "sunflower-american-giant-hybrid",
      "sunflower-autumn-beauty",
      "sunflower-helianthus-annuus",
    ]) {
      const cue = calculatorAgeStageCueForPlant(plantId, 20);
      expect(cue?.reference.source.id).toBe("antoniacomi-sunflower-nft-transplant-2023");
      expect(cue?.ageWindow).toMatchObject({
        minDays: 20,
        maxDays: 20,
        stageSuggestion: "SEEDLING",
      });
      expect(cue?.ageWindow.text.en).toMatch(/not your cultivars/i);
      expect(cue?.ageWindow.text.es).toMatch(/no tus cultivares/i);
    }
    expect(calculatorAgeStageCueForPlant("sunflower-american-giant-hybrid", 21)).toBeUndefined();
  });

  it("uses the exact hyssop study's four-leaf transplant milestone as a confirmable cue", () => {
    const cue = calculatorAgeStageCueForPlant("hyssop", 28);
    expect(cue?.ageWindow).toMatchObject({ minDays: 28, maxDays: 28, stageSuggestion: "SEEDLING" });
    expect(cue?.reference.source.id).toBe("hyssop-hydroponic-selenium-2022");
    expect(cue?.ageWindow.text.en).toMatch(/‘Lekar’ hyssop.*four true leaves/i);
    expect(cue?.ageWindow.text.en).toMatch(/does not automatically change stage, EC, or dose/i);
    expect(calculatorAgeStageCueForPlant("hyssop", 29)).toBeUndefined();
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

  it("uses the UNAM Epazote transplant observation as confirmable context, never automatic dosing", () => {
    const reference = calculatorStageReferenceForPlant("epazote");
    expect(reference?.source.id).toBe("unam-epazote-hydroponic-2013");
    expect(reference?.text.en).toMatch(/about 30 days.*second pair of leaves/i);
    expect(reference?.text.en).toMatch(/ambiguous/i);
    const cue = calculatorAgeStageCueForPlant("epazote", 30);
    expect(cue?.ageWindow).toMatchObject({ minDays: 30, maxDays: 30, stageSuggestion: "SEEDLING" });
    expect(cue?.ageWindow.text.en).toMatch(/not an automatic transition or dose/i);
    expect(hasApplicableCropNutrientEvidence("epazote", { phenologicalStage: "SEEDLING" })).toBe(
      false,
    );
  });

  it("keeps seasonal sage guidance out of age matching and adds supported cues for chives and culantro", () => {
    const sage = calculatorStageReferenceForPlant("broadleaf-sage");
    expect(sage?.source.id).toBe("uw-madison-common-sage-seed-starting");
    expect(sage?.text.en).toMatch(/6–8 weeks before the average last frost/i);
    expect(calculatorAgeStageCueForPlant("broadleaf-sage", 49)).toBeUndefined();

    const chives = calculatorAgeStageCueForPlant("common-chives", 49);
    expect(chives?.reference.source.id).toBe("usu-extension-chives-transplant-6-8-weeks");
    expect(chives?.ageWindow).toMatchObject({
      minDays: 42,
      maxDays: 56,
      stageSuggestion: "SEEDLING",
    });
    expect(chives?.ageWindow.text.en).toMatch(/not an automatic hydroponic stage/i);

    const garlicChives = calculatorAgeStageCueForPlant("garlic-chives", 60);
    expect(garlicChives?.reference.source.id).toBe("chinese-chive-hydroponic-salinity-2022");
    expect(garlicChives?.ageWindow).toMatchObject({
      minDays: 60,
      maxDays: 60,
      stageSuggestion: "SEEDLING",
    });

    const culantro = calculatorAgeStageCueForPlant("culantro", 60);
    expect(culantro?.reference.source.id).toBe(
      "soto-rodriguez-eryngium-hydroponic-transplant-2020",
    );
    expect(culantro?.ageWindow.text.en).toMatch(/about seven true leaves/i);
    expect(culantro?.ageWindow.text.en).toMatch(/not a universal transition or dose/i);

    expect(hasApplicableCropNutrientEvidence("culantro", { phenologicalStage: "SEEDLING" })).toBe(
      false,
    );
  });

  it("uses USU's Vera lavender seed-to-transplant interval as wide nursery context", () => {
    const cue = calculatorAgeStageCueForPlant("lavender-vera", 150);
    expect(cue?.reference.source.id).toBe("usu-english-lavender-seed-to-transplant-100-200-days");
    expect(cue?.ageWindow).toMatchObject({
      minDays: 100,
      maxDays: 200,
      stageSuggestion: "SEEDLING",
    });
    expect(cue?.ageWindow.text.en).toMatch(/lists Vera among English lavender varieties/);
    expect(cue?.ageWindow.text.en).toMatch(/not a hydroponic stage or dose/);
  });

  it("uses USU leafy-green and brassica transplant ages only as confirmed nursery context", () => {
    const arugula = calculatorAgeStageCueForPlant("astro-arugula", 24);
    expect(arugula?.reference.source.id).toBe("usu-leafy-greens-transplant-3-4-weeks");
    expect(arugula?.ageWindow).toMatchObject({
      minDays: 21,
      maxDays: 28,
      stageSuggestion: "SEEDLING",
    });
    expect(arugula?.ageWindow.text.en).toMatch(/field production/);
    expect(arugula?.ageWindow.text.en).toMatch(/not a confirmed hydroponic stage or dose/);

    const tatsoi = calculatorAgeStageCueForPlant("tatsoi", 49);
    expect(tatsoi?.reference.source.id).toBe("usu-brassica-transplant-6-8-weeks");
    expect(tatsoi?.ageWindow).toMatchObject({
      minDays: 42,
      maxDays: 56,
      stageSuggestion: "SEEDLING",
    });
    expect(tatsoi?.ageWindow.text.en).toMatch(/most Brassica crops/);
    expect(tatsoi?.ageWindow.text.en).toMatch(/not a hydroponic schedule or dose/);
    expect(hasApplicableCropNutrientEvidence("tatsoi", { phenologicalStage: "SEEDLING" })).toBe(
      false,
    );
  });

  it("returns no cue for unmapped plants or invalid ages", () => {
    expect(calculatorAgeStageCueForPlant("unmapped-plant", 30)).toBeUndefined();
    expect(calculatorAgeStageCueForPlant("cherry-tomato", Number.NaN)).toBeUndefined();
    expect(calculatorAgeStageCueForPlant("cherry-tomato", -1)).toBeUndefined();
  });
});
