import { describe, expect, it, vi } from "vitest";

import {
  AEROGARDEN_RECIPE,
  CROP_EVIDENCE,
  CROP_STUDY_REFERENCES,
  FLORA_RECIPE,
} from "@/lib/garden-nutrient-engine-v1/data";
import {
  buildCalibrationModel,
  calculateEcCorrection,
  calculateFreshTargetEc,
  calculateTopUpMaintenance,
  executeFreshRecipe,
  learnFromObservation,
  selectCropRange,
} from "@/lib/garden-nutrient-engine-v1/engine";
import { donorPlants } from "./canonical-adapter";
import { MODE_TO_ENGINE, recipeSignature } from "./calculator-v1-adapter";
import {
  CALCULATOR_PLANTS,
  CALCULATOR_EXCLUDED_CARNIVOROUS_IDS,
  CALCULATOR_PRODUCTS,
  buildCropEvidenceCoverage,
  calculateGardenResult,
  calibrationUsage,
  contextFor,
  calculatorStageGuidanceForPlant,
  generalCropReferenceForStage,
  hasApplicableCropNutrientEvidence,
  loadSavedSystems,
  planTopUpToCapacity,
  persistSavedSystems,
  recipeStageLabel,
  recipeStagesForSchedule,
  recordActualDoses,
  resolveNutrientCropIdentity,
  searchCalculatorPlants,
} from "./calculator-lovable-adapter";

// Transcribed from the user's 2026-11-07 inventory, deduplicated by variety;
// the three separately listed carnivorous plants are intentionally excluded.
const USER_ZERO_83_VARIETY_IDS = [
  "basil-ocimum-basilicum",
  "bibb-lettuce",
  "black-seeded-simpson",
  "blush-hibiscus",
  "breen-romaine-lettuce",
  "broadleaf-sage",
  "bronze-arrow-lettuce",
  "buttercrunch-lettuce",
  "butterhead-lettuce-unspecified",
  "cascading-petunia",
  "cherry-tomato",
  "chinese-light-green-celery",
  "common-chives",
  "cilantro",
  "cinnamon-basil",
  "common-fenugreek-trigonella-foenum-graecum",
  "common-mint",
  "culantro",
  "basil-dark-opal",
  "dill-bouquet",
  "petunia-dwarf-bedding-mixed",
  "epazote",
  "evergreen-bunching-onion-nabuka",
  "garlic-chives",
  "genovese-basil",
  "german-thyme",
  "green-salanova-lettuce",
  "hon-tsai-tai",
  "iceberg-lettuce",
  "italian-giant-parsley",
  "italian-large-leaf-basil",
  "italian-oregano",
  "marigold-jolly-jester",
  "lavender-vera",
  "basil-lemon",
  "zinnia-lilliput-mixed",
  "basil-lime",
  "mexican-tarragon",
  "mini-lunchbox-sweet-pepper",
  "monterey-strawberry",
  "papalo-porophyllum-ruderale",
  "perpetual-spinach",
  "rainbow-mix-coleus",
  "red-romaine-lettuce",
  "resina-calendula",
  "rosemary",
  "seaside-f1-spinach",
  "basil-spicy-globe",
  "sweet-basil",
  "marjoram",
  "thai-basil",
  "tiny-tim-sweet-alyssum",
  "tiny-tim-tomato",
  "tulsi-holy-basil-ocimum-tenuiflorum",
  "watercress",
  "sunflower-american-giant-hybrid",
  "astro-arugula",
  "sunflower-autumn-beauty",
  "borage-blue",
  "chamomile-unspecified",
  "peppermint-mentha-piperita",
  "crimson-giant-radish",
  "curled-chervil",
  "dark-green-zucchini",
  "fragrant-dwarf-dianthus-mix",
  "hyssop",
  "lady-murasaki-komatsuna",
  "large-red-cherry-tomato",
  "lemon-balm",
  "delphinium-magic-fountains-dwarf",
  "muir-lettuce",
  "pandero-romaine-lettuce",
  "purple-kohlrabi",
  "red-mustard-greens",
  "scarlet-red-tatsoi",
  "tennessee-coneflower-echinacea-tennesseensis",
  "bush-nasturtium-tropaeolum-minus",
  "wasabina-mustard-greens",
  "bulls-blood-beet",
  "bunching-onion-allium-fistulosum",
  "tatsoi",
  "romaine-lettuce",
  "sunflower-helianthus-annuus",
] as const;

describe("Gardenpedia Calculator V1 integration", () => {
  it("uses bilingual public profile guidance to help identify observed plant stages", () => {
    const english = calculatorStageGuidanceForPlant("genovese-basil", "en", "FLOWERING");
    const spanish = calculatorStageGuidanceForPlant("genovese-basil", "es", "FLOWERING");

    expect(english.map((guide) => guide.title)).toEqual(["Flowering", "Growth"]);
    expect(english[0]?.backing).toBe("source");
    expect(english[0]?.sources.length).toBeGreaterThan(0);
    expect(spanish[0]?.title).toBe("Floración");
    expect(spanish[0]?.body).toContain("floración");
    expect(spanish[0]?.sources[0]?.url).toMatch(/^https:\/\//);
  });

  it("returns no stage guidance for an unknown identity without inventing content", () => {
    expect(calculatorStageGuidanceForPlant("unmapped-test-identity", "en", "MATURE")).toEqual([]);
  });

  it("reuses stage cues only across explicitly mapped same-species profiles and labels their scope", () => {
    expect(CALCULATOR_PLANTS.find((plant) => plant.id === "basil-dark-opal")?.scientificName).toBe(
      "Ocimum basilicum",
    );
    expect(
      CALCULATOR_PLANTS.find((plant) => plant.id === "basil-spicy-globe")?.scientificName,
    ).toBe("Ocimum basilicum");
    expect(CALCULATOR_PLANTS.find((plant) => plant.id === "basil-lemon")?.scientificName).toBe(
      "Ocimum × africanum",
    );
    expect(CALCULATOR_PLANTS.find((plant) => plant.id === "basil-lime")?.scientificName).toBe(
      "Ocimum × africanum",
    );

    for (const plantId of ["basil-dark-opal", "basil-spicy-globe"]) {
      const guidance = calculatorStageGuidanceForPlant(plantId, "en", "VEGETATIVE");
      expect(guidance.length, plantId).toBeGreaterThan(0);
      expect(guidance.every((item) => item.scopeNote?.en.includes("Ocimum basilicum"))).toBe(true);
      expect(
        guidance.every((item) => item.sources.some((source) => source.url.startsWith("https://"))),
      ).toBe(true);
    }

    for (const plantId of ["basil-lemon", "basil-lime"]) {
      const guidance = calculatorStageGuidanceForPlant(plantId, "en", "VEGETATIVE");
      expect(
        guidance.every((item) => !item.scopeNote?.en.includes("Ocimum basilicum")),
        plantId,
      ).toBe(true);
    }

    const butterhead = calculatorStageGuidanceForPlant(
      "butterhead-lettuce-unspecified",
      "es",
      "SEEDLING",
    );
    expect(butterhead.length).toBeGreaterThan(0);
    expect(butterhead[0]?.scopeNote).toMatchObject({
      es: expect.stringContaining("Lactuca sativa"),
    });
  });

  it("provides only scoped RHS stage cues for unresolved chamomile without EC claims", () => {
    const seedling = calculatorStageGuidanceForPlant("chamomile-unspecified", "en", "SEEDLING");
    expect(seedling).toHaveLength(1);
    expect(seedling[0]?.scopeNote?.en).toMatch(/does not identify your species/i);
    expect(seedling[0]?.body).toMatch(/need light to germinate/i);
    expect(seedling[0]?.sources[0]?.url).toBe(
      "https://www.rhs.org.uk/advice/grow-your-own/herbs/chamomile",
    );
    expect(seedling[0]?.body).not.toMatch(/mS\/cm|EC target|nutrient dose/i);
  });

  it("makes the hyssop study condition selectable without presenting it as a validated crop range", () => {
    expect(hasApplicableCropNutrientEvidence("hyssop")).toBe(false);
    const hyssopStudy = CROP_STUDY_REFERENCES.find(
      (reference) => reference.source.id === "hyssop-hydroponic-selenium-2022",
    );
    expect(hyssopStudy?.source.url).toBe("https://doi.org/10.3390/horticulturae8111037");
    expect(hyssopStudy?.source.title).toMatch(/Phenolic Compounds.*Selenium Concentration/i);
    expect(hyssopStudy?.selectableEcMs).toBe(2.2);
    expect(
      CROP_EVIDENCE.some((observation) => observation.source.id === hyssopStudy?.source.id),
    ).toBe(false);
    const reading = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4", gro: "3", bloom: "2" },
    });
    expect(reading.ok).toBe(true);
    const result = calculateGardenResult({
      mode: "target",
      crops: { hyssop: 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      sourceEcKnown: true,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: 2.2,
      round: 1,
      calibrationObservations: [reading.value!],
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.target).toEqual({ value: 2.2, provenance: "user" });
      expect(result.evidence).toBe("insufficient");
      expect(result.doses).toHaveLength(3);
    }
  });
  it("keeps Tennessee coneflower's soil fertilization warning distinct from hydroponic EC guidance", () => {
    const id = "tennessee-coneflower-echinacea-tennesseensis";
    expect(hasApplicableCropNutrientEvidence(id)).toBe(false);
    const reference = CROP_STUDY_REFERENCES.find(
      (item) =>
        item.plantIds.includes(id) &&
        item.source.id === "tennessee-extension-coneflower-fertilization",
    );
    expect(reference?.text.en).toMatch(/soil-gardening/);
    expect(reference?.selectableEcMs).toBeUndefined();
  });
  it("offers the same-species Hibiscus fertigation EC only as an explicit manual reference", () => {
    const id = "blush-hibiscus";
    const reference = CROP_STUDY_REFERENCES.find(
      (item) =>
        item.plantIds.includes(id) && item.source.id === "hardy-hibiscus-cultivar-fertigation-2016",
    );

    expect(reference?.text.en).toMatch(/weekly 14-3-23 fertilizer.*EC 1\.3 mS\/cm/i);
    expect(reference?.text.en).toMatch(
      /only as a manual fertigation reference.*not an optimum, range or automatic recommendation/i,
    );
    expect(reference?.selectableEcMs).toBe(1.3);
    expect(hasApplicableCropNutrientEvidence(id)).toBe(false);
  });
  it("warns when a calculated EC adjustment is smaller than the user's meter resolution", () => {
    const reading = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4", gro: "3", bloom: "2" },
    });
    expect(reading.ok).toBe(true);
    const input = {
      language: "es" as const,
      crops: { "bibb-lettuce": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 1,
      sourceEcKnown: true,
      currentEc: 1,
      currentLiters: 4,
      capacityLiters: 5,
      waterAdded: 0,
      userTarget: 1.04,
      round: 1,
      calibrationObservations: [reading.value!],
      meterResolutionMs: 0.1,
      reservoirMixConfirmed: true,
    };
    for (const mode of ["target", "adjust", "topup"] as const) {
      const lowResolution = calculateGardenResult({ ...input, mode });
      expect(lowResolution.kind).toBe("ok");
      if (lowResolution.kind === "ok")
        expect(lowResolution.warnings?.join(" ")).toMatch(/menor que la resolución indicada/);
      const fineResolution = calculateGardenResult({ ...input, mode, meterResolutionMs: 0.01 });
      expect(fineResolution.kind).toBe("ok");
      if (fineResolution.kind === "ok")
        expect(fineResolution.warnings?.join(" ")).not.toMatch(/menor que la resolución indicada/);
    }
  });
  it("preserves a low-resolution calibration and warns when using it", () => {
    const reading = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 0.24,
      actualDoses: { micro: "4", gro: "3", bloom: "2" },
      meterResolutionMs: 0.1,
    });
    expect(reading.ok).toBe(true);
    const result = calculateGardenResult({
      language: "es",
      mode: "target",
      crops: { "bibb-lettuce": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: 1.2,
      round: 1,
      calibrationObservations: [reading.value!],
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok")
      expect(result.warnings?.join(" ")).toMatch(/calibración es menor que la resolución/);
  });
  it("uses the actual EC meter resolution instead of assuming a universal one", () => {
    const input = {
      language: "en" as const,
      mode: "target" as const,
      crops: { "bibb-lettuce": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      sourceEcKnown: true,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    };
    const unknown = calculateGardenResult(input);
    const fine = calculateGardenResult({ ...input, meterResolutionMs: 0.01 });
    const coarse = calculateGardenResult({ ...input, meterResolutionMs: 1 });
    expect(unknown.target?.provenance).toBe("garden");
    expect(fine.target?.provenance).toBe("garden");
    expect(coarse.target).toBeUndefined();
    expect(coarse.kind).toBe("needs");
    if (coarse.kind === "needs") expect(coarse.message).toMatch(/meter resolution/i);
    const explicit = calculateGardenResult({ ...input, meterResolutionMs: 1, userTarget: 1.3 });
    expect(explicit.target).toEqual({ value: 1.3, provenance: "user" });
  });
  it("offers study treatment values only as explicit, source-linked choices", () => {
    const choices = CROP_STUDY_REFERENCES.filter(
      (reference) =>
        reference.selectableEcValuesMs?.length || reference.selectableEcMs !== undefined,
    );
    expect(
      choices.map((reference) => [
        reference.source.id,
        reference.selectableEcValuesMs ?? [reference.selectableEcMs],
      ]),
    ).toEqual([
      ["walters-lopez-bouquet-dill-deep-flow-2021", [1.56]],
      ["nsw-asian-vegetables-nft-2011", [1.5, 2.5]],
      ["nasturtium-majus-cutting-rooting-ec-2021", [1]],
      ["uga-bedding-plant-subirrigation-study", [2]],
      ["uga-bedding-plant-subirrigation-study", [2]],
      ["plant-garden-coleus-hydroponic-guide", [1]],
      ["hardy-hibiscus-cultivar-fertigation-2016", [1.3]],
      ["wur-delphinium-greenhouse-nutrient-solution-ec-2006", [1.4]],
      ["aguilar-carpio-epazote-steiner-2021", [1, 1.5, 2]],
      ["kazakidou-burrage-marigold-nft-1994", [1.5, 3]],
      ["tagetes-patula-dwc-cultivars-2026", [1.8, 2.0]],
      ["lanitex-hydroponic-marigold-guide-2026", [1.0, 1.5, 1.8, 2.0]],
      ["barc-fertilizer-recommendation-guide-2024-hydroponics", [1.5]],
      ["yunindanova-choysum-floating-ec-2020", [1.0, 2.0]],
      ["barc-fertilizer-recommendation-guide-2024-hydroponics", [1.5]],
      ["barc-fertilizer-recommendation-guide-2024-hydroponics", [2.3, 2.5]],
      ["barc-fertilizer-recommendation-guide-2024-hydroponics", [2.0]],
      ["barc-fertilizer-recommendation-guide-2024-hydroponics", [1.5]],
      ["barc-fertilizer-recommendation-guide-2024-hydroponics", [2.0]],
      ["barc-fertilizer-recommendation-guide-2024-hydroponics", [1.5]],
      ["barc-fertilizer-recommendation-guide-2024-hydroponics", [1.5, 2.0]],
      ["barc-fertilizer-recommendation-guide-2024-hydroponics", [1.0, 1.2]],
      ["illinois-extension-monterey-hydroponic-strawberry-2023", [1.8]],
      ["arkansas-komatsuna-nft-2014", [1, 1.2, 1.4, 1.6, 1.8]],
      ["hyssop-hydroponic-selenium-2022", [2.2]],
      ["uga-bedding-plant-subirrigation-study", [1.1]],
      ["can-tho-zinnia-hoagland-2022", [1.4, 2.8]],
      ["nguyen-eryngium-foetidum-hydroponics-2018", [1, 1.5, 2]],
      ["chinese-chive-hydroponic-salinity-2022", [1.4]],
      ["asianjab-chinese-chives-aeroponics-ec-2026", [1.2, 1.6]],
      ["juarez-porophyllum-nutrient-poster", [1, 1.5, 2, 2.5]],
      ["nsw-asian-vegetables-nft-2011", [1.5, 2.5]],
      ["cyprus-lavender-potassium-hydroponic-2017", [2.1]],
      ["walters-currey-basil-species-nft-2018", [0.5, 1, 2, 3, 4]],
      ["walters-currey-basil-species-nft-2018", [0.5, 1, 2, 3, 4]],
      ["holy-basil-controlled-dft-study-2022", [1.4, 2.2]],
    ]);
    const culantro = CROP_STUDY_REFERENCES.find(
      (reference) => reference.source.id === "nguyen-eryngium-foetidum-hydroponics-2018",
    );
    expect(culantro?.plantIds).toEqual(["culantro"]);
    expect(culantro?.source.region).toBe("Vietnam");
    expect(culantro?.text.en).toContain("after 28 days");
    expect(hasApplicableCropNutrientEvidence("culantro")).toBe(true);
    for (const reference of choices) {
      expect(reference.source.url).toMatch(/^https:\/\//);
      if (reference.selectionKind === "GUIDE_LOWER_BOUND") expect(reference.source.tier).toBe("E");
      else expect(["A", "B", "C"]).toContain(reference.source.tier);
    }
  });
  it("keeps UGA ornamental treatment results manual and out of automatic crop evidence", () => {
    const references = CROP_STUDY_REFERENCES.filter(
      (reference) => reference.source.id === "uga-bedding-plant-subirrigation-study",
    );
    expect(references.map((reference) => [reference.plantIds, reference.selectableEcMs])).toEqual([
      [["fragrant-dwarf-dianthus-mix"], 2.0],
      [["tiny-tim-sweet-alyssum"], 2.0],
      [["zinnia-lilliput-mixed"], 1.1],
    ]);
    expect(references.map((reference) => reference.text.en).join(" ")).toMatch(/not.*automatic/i);
    expect(
      CROP_EVIDENCE.filter(
        (observation) => observation.source.id === "uga-bedding-plant-subirrigation-study",
      ),
    ).toHaveLength(0);
  });
  it("keeps all Komatsuna NFT treatments as manual references, never as an inferred optimum", () => {
    const reference = CROP_STUDY_REFERENCES.find(
      (item) => item.source.id === "arkansas-komatsuna-nft-2014",
    );
    expect(reference?.plantIds).toEqual(["lady-murasaki-komatsuna"]);
    expect(reference?.selectableEcValuesMs).toEqual([1.0, 1.2, 1.4, 1.6, 1.8]);
    expect(reference?.text.en).toMatch(/not.*optimum range.*manual choices/i);
    expect(
      CROP_EVIDENCE.filter((item) => item.source.id === "arkansas-komatsuna-nft-2014"),
    ).toHaveLength(0);
  });
  it("keeps NSW Asian-vegetable EC evidence NFT-specific and offers only explicit manual values", () => {
    const study = CROP_STUDY_REFERENCES.find(
      (reference) =>
        reference.source.id === "nsw-asian-vegetables-nft-2011" &&
        reference.plantIds.includes("scarlet-red-tatsoi"),
    );
    expect(study?.plantIds).toEqual(["tatsoi", "scarlet-red-tatsoi", "cilantro", "hon-tsai-tai"]);
    expect(study?.selectableEcValuesMs).toEqual([1.5, 2.5]);

    for (const cropIdentity of ["tatsoi", "cilantro", "flowering-choy-sum"]) {
      const evidence = CROP_EVIDENCE.find(
        (item) => item.cropIdentity === cropIdentity && item.source.id === study?.source.id,
      );
      expect(evidence?.hydroponicSystem).toBe("NFT");
      expect(evidence?.observedRange).toEqual({ min: 1.5, max: 2.5, unit: "mS/cm" });
    }
  });
  it("exposes 2026 aeroponic Chinese-chive treatments only as manual choices", () => {
    const study = CROP_STUDY_REFERENCES.find(
      (reference) => reference.source.id === "asianjab-chinese-chives-aeroponics-ec-2026",
    );
    expect(study?.plantIds).toEqual(["garlic-chives"]);
    expect(study?.source.publication).toBe("2026(4), article 129");
    expect(study?.source.url).toBe("https://doi.org/10.35495/ajab.2026.129");
    expect(study?.selectableEcValuesMs).toEqual([1.2, 1.6]);
    expect(study?.text.en).toContain("not a universal optimum");
    expect(hasApplicableCropNutrientEvidence("garlic-chives")).toBe(false);
    const evidence = CROP_EVIDENCE.find(
      (observation) => observation.source.id === study?.source.id,
    );
    expect(evidence).toMatchObject({
      cropIdentity: "garlic-chives",
      stageApplicability: "VEGETATIVE",
      hydroponicSystem: "AEROPONIC",
      measurementScope: "NUTRIENT_SOLUTION",
      observedRange: { min: 1.2, max: 1.6, unit: "mS/cm" },
      evidenceState: "MODERATE",
    });

    const aeroponicVegetative = contextFor(
      { "garlic-chives": 1 },
      "gh-flora",
      { "garlic-chives": "VEGETATIVE" },
      {},
      "AEROPONIC",
    )[0]!;
    // The engine intersects this study with compatible general hydroponic
    // guidance for garlic chives (1.2–1.5 mS/cm).
    expect(selectCropRange(aeroponicVegetative).ec.ec).toEqual({
      min: 1.2,
      max: 1.5,
      unit: "mS/cm",
    });

    const unknownSystem = contextFor({ "garlic-chives": 1 }, "gh-flora", {
      "garlic-chives": "VEGETATIVE",
    })[0]!;
    const unspecifiedStage = contextFor(
      { "garlic-chives": 1 },
      "gh-flora",
      {},
      {},
      "AEROPONIC",
    )[0]!;
    expect(
      selectCropRange(unknownSystem).ec.observations.some(
        (observation) => observation.id === "garlic-chives-yaseen-aeroponic-vegetative-ec-2026",
      ),
    ).toBe(false);
    expect(
      selectCropRange(unspecifiedStage).ec.observations.some(
        (observation) => observation.id === "garlic-chives-yaseen-aeroponic-vegetative-ec-2026",
      ),
    ).toBe(false);
  });
  it("exposes Choy Sum trial concentrations as manual context for Hon Tsai Tai only", () => {
    const study = CROP_STUDY_REFERENCES.find(
      (reference) => reference.source.id === "yunindanova-choysum-floating-ec-2020",
    );
    expect(study?.plantIds).toEqual(["hon-tsai-tai"]);
    expect(study?.source.url).toBe("https://doi.org/10.32663/ba.v1i2.1810");
    expect(study?.selectableEcValuesMs).toEqual([1.0, 2.0]);
    expect(study?.text.en).toContain("Tosakan");
    expect(study?.text.en).toContain("not an optimum range");
    expect(hasApplicableCropNutrientEvidence("hon-tsai-tai")).toBe(false);
    expect(CROP_EVIDENCE.some((observation) => observation.source.id === study?.source.id)).toBe(
      false,
    );
  });
  it("uses the reported culantro best treatment as a single evidence point without false precision", () => {
    const context = contextFor({ culantro: 1 }, "gh-flora")[0]!;
    const range = selectCropRange(context).ec;
    expect(range.ec).toEqual({ min: 1.5, max: 1.5, unit: "mS/cm" });
    expect(range.evidenceState).toBe("MODERATE");
    expect(range.observations.map((observation) => observation.source.id)).toContain(
      "nguyen-eryngium-foetidum-hydroponics-2018",
    );
    expect(
      calculateFreshTargetEc({ contexts: [context] }).value?.suggestedStartingPoint,
    ).toBeUndefined();
    expect(buildCropEvidenceCoverage().rows.find((row) => row.plantId === "culantro")).toEqual({
      plantId: "culantro",
      classification: "SUPPORTED_DIRECT",
      evidenceIdentity: "culantro",
    });
  });
  it("offers holy basil NFT trial values only as manual targets, not an automatic optimum", () => {
    const reference = CROP_STUDY_REFERENCES.find(
      (study) =>
        study.source.id === "walters-currey-basil-species-nft-2018" &&
        study.plantIds.includes("tulsi-holy-basil-ocimum-tenuiflorum"),
    );
    expect(reference?.plantIds).toContain("tulsi-holy-basil-ocimum-tenuiflorum");
    expect(reference?.selectableEcValuesMs).toEqual([0.5, 1, 2, 3, 4]);
    expect(reference?.text.en).toContain("not an optimum");
    expect(hasApplicableCropNutrientEvidence("tulsi-holy-basil-ocimum-tenuiflorum")).toBe(false);
  });
  it("limits the lemon-basil NFT treatment choices to the matching Lime cultivar", () => {
    const limeStudy = CROP_STUDY_REFERENCES.find(
      (study) =>
        study.source.id === "walters-currey-basil-species-nft-2018" &&
        study.plantIds.includes("basil-lime"),
    );
    const lemonStudy = CROP_STUDY_REFERENCES.find(
      (study) =>
        study.source.id === "walters-currey-basil-species-nft-2018" &&
        study.plantIds.includes("basil-lemon"),
    );
    expect(limeStudy?.selectableEcValuesMs).toEqual([0.5, 1, 2, 3, 4]);
    expect(limeStudy?.text.en).toContain("not an optimum range");
    expect(lemonStudy?.selectableEcValuesMs).toBeUndefined();
    expect(lemonStudy?.text.en).toContain("not direct evidence for this variety");
    expect(resolveNutrientCropIdentity("basil-lime")).toBe("lemon-basil");
    expect(resolveNutrientCropIdentity("basil-lemon")).toBe("lemon-basil");
    expect(resolveNutrientCropIdentity("unmapped-basil-cultivar")).toBeUndefined();
    expect(hasApplicableCropNutrientEvidence("basil-lime")).toBe(true);
    expect(hasApplicableCropNutrientEvidence("basil-lemon")).toBe(true);
  });
  it("keeps BARC marigold EC as a cultivar- and solution-qualified manual choice", () => {
    const reference = CROP_STUDY_REFERENCES.find(
      (study) =>
        study.source.id === "barc-fertilizer-recommendation-guide-2024-hydroponics" &&
        study.plantIds.includes("marigold-jolly-jester"),
    );
    expect(reference?.plantIds).toEqual(["marigold-jolly-jester"]);
    expect(reference?.selectableEcMs).toBe(1.5);
    expect(reference?.source.region).toBe("Bangladesh");
    expect(reference?.text.en).toContain("BARI Gada-1");
    expect(reference?.text.en).toContain("manual target");
    expect(reference?.text.en).toContain("not validation of Jolly Jester or automatic evidence");
  });
  it("offers BARC crop- and stage-qualified readings only as manual choices", () => {
    const references = CROP_STUDY_REFERENCES.filter(
      (study) => study.source.id === "barc-fertilizer-recommendation-guide-2024-hydroponics",
    );
    expect(references).toHaveLength(9);
    for (const plantId of ["tiny-tim-tomato", "large-red-cherry-tomato", "cherry-tomato"]) {
      const tomatoRefs = references.filter((study) => study.plantIds.includes(plantId));
      expect(
        tomatoRefs.map((study) => study.selectableEcValuesMs ?? [study.selectableEcMs]),
      ).toEqual([[1.5], [2.3, 2.5], [2.0]]);
      expect(
        tomatoRefs.every((study) =>
          /manual|not a universal optimum|does not validate|not automatic/i.test(study.text.en),
        ),
      ).toBe(true);
    }
    expect(
      references.find(
        (study) =>
          study.plantIds.includes("mini-lunchbox-sweet-pepper") && study.selectableEcMs === 2.0,
      )?.text.en,
    ).toContain("not an automatic recommendation");
    expect(
      references.find(
        (study) => study.plantIds.includes("bibb-lettuce") && study.selectableEcValuesMs,
      )?.selectableEcValuesMs,
    ).toEqual([1.5, 2.0]);
    expect(
      references.find((study) => study.plantIds.includes("monterey-strawberry"))
        ?.selectableEcValuesMs,
    ).toEqual([1.0, 1.2]);
    const stageStudy = CROP_STUDY_REFERENCES.find(
      (study) => study.source.id === "strawberry-hydroponic-ec-by-growth-stage-2021",
    );
    expect(stageStudy?.plantIds).toContain("monterey-strawberry");
    expect(stageStudy?.stageSpecificEcChoices).toEqual([
      { stage: "VEGETATIVE", value: 0.9 },
      { stage: "FRUITING", value: 1.3 },
      { stage: "FRUITING", value: 1.7 },
    ]);
    expect(stageStudy?.text.en).toMatch(/manual choice/);
    expect(
      CROP_EVIDENCE.some((observation) => observation.source.id === stageStudy?.source.id),
    ).toBe(false);
    const exactCultivarContext = CROP_STUDY_REFERENCES.find(
      (study) => study.source.id === "illinois-extension-monterey-hydroponic-strawberry-2023",
    );
    expect(exactCultivarContext?.plantIds).toEqual(["monterey-strawberry"]);
    expect(exactCultivarContext?.selectableEcMs).toBe(1.8);
    expect(exactCultivarContext?.text.en).toMatch(/operational observation.*includes Monterey/i);
    expect(exactCultivarContext?.text.en).toMatch(
      /not a target-comparison trial or a validated optimum/i,
    );
    expect(
      CROP_EVIDENCE.some(
        (observation) => observation.source.id === exactCultivarContext?.source.id,
      ),
    ).toBe(false);
  });
  it("keeps the Mexican tarragon hydroponic guide contextual without inventing an EC target", () => {
    const source = CROP_STUDY_REFERENCES.find(
      (item) => item.source.id === "zipgrow-mexican-tarragon-hydroponic-tower",
    );
    expect(source?.plantIds).toContain("mexican-tarragon");
    expect(source?.selectableEcMs).toBeUndefined();
    expect(source?.text.en).toMatch(/does not publish an EC/);
    expect(hasApplicableCropNutrientEvidence("mexican-tarragon")).toBe(false);
  });
  it("never plans a capacity refill using an explicitly unknown source-water EC", () => {
    const plan = planTopUpToCapacity(
      {
        language: "es",
        mode: "topup",
        crops: { "bibb-lettuce": 1 },
        liters: 4,
        productId: "gh-flora",
        stageId: "feeding-2",
        pods: 6,
        sourceEc: 0,
        sourceEcKnown: false,
        currentEc: 1.2,
        currentLiters: 2,
        capacityLiters: 4,
        waterAdded: null,
        userTarget: 1.2,
        round: 1,
      },
      1.2,
    );
    expect(plan).toEqual({
      ok: false,
      code: "SOURCE_WATER_EC_REQUIRED",
      message: "Mide el EC del agua de reposición antes de calcular el relleno.",
    });
  });
  it("resolves fenugreek and blue borage using their own crop types", () => {
    for (const [id, identity] of [
      ["common-fenugreek-trigonella-foenum-graecum", "fenugreek"],
      ["borage-blue", "borage"],
    ] as const) {
      expect(resolveNutrientCropIdentity(id)).toBe(identity);
      expect(hasApplicableCropNutrientEvidence(id)).toBe(true);
    }
  });
  it("maps Resina calendula to species guidance without mapping Tagetes marigold", () => {
    expect(resolveNutrientCropIdentity("resina-calendula")).toBe("calendula");
    expect(hasApplicableCropNutrientEvidence("resina-calendula")).toBe(true);
    expect(resolveNutrientCropIdentity("marigold-jolly-jester")).toBeUndefined();
  });
  it("keeps the related-species nasturtium rooting study manual-only", () => {
    const reference = CROP_STUDY_REFERENCES.find(
      (study) => study.source.id === "nasturtium-majus-cutting-rooting-ec-2021",
    );
    expect(reference?.plantIds).toEqual(["bush-nasturtium-tropaeolum-minus"]);
    expect(reference?.selectableEcMs).toBe(1.0);
    expect(reference?.text.en).toMatch(/T\. minus, a different species/i);
    expect(reference?.text.en).toMatch(/not statistically significant/i);
    expect(reference?.text.en).toMatch(/not automatic evidence/i);
    expect(
      CROP_EVIDENCE.some(
        (observation) => observation.source.id === "nasturtium-majus-cutting-rooting-ec-2021",
      ),
    ).toBe(false);
    expect(hasApplicableCropNutrientEvidence("bush-nasturtium-tropaeolum-minus")).toBe(false);
  });
  it("uses petunia crop guidance and lavender's explicitly selected stage", () => {
    for (const id of ["cascading-petunia", "petunia-dwarf-bedding-mixed"]) {
      expect(resolveNutrientCropIdentity(id)).toBe("petunia");
      expect(hasApplicableCropNutrientEvidence(id)).toBe(true);
    }
    expect(resolveNutrientCropIdentity("lavender-vera")).toBe("english-lavender");
    const mature = contextFor({ "lavender-vera": 1 }, "gh-flora", {
      "lavender-vera": "MATURE",
    })[0]!;
    expect(selectCropRange(mature).ec.ec).toEqual({ min: 1.2, max: 1.5, unit: "mS/cm" });
    expect(hasApplicableCropNutrientEvidence("lavender-vera")).toBe(false);
  });
  it("links every crop study to a selectable public identity", () => {
    const ids = new Set(CALCULATOR_PLANTS.map((plant) => plant.id));
    for (const reference of CROP_STUDY_REFERENCES)
      for (const id of reference.plantIds)
        expect(ids.has(id), `${reference.source.id}: ${id}`).toBe(true);
  });
  it("shows tower-specific guidance without applying it as a general crop target", () => {
    for (const id of ["dill-bouquet", "astro-arugula", "purple-kohlrabi"]) {
      expect(
        CROP_STUDY_REFERENCES.some(
          (study) =>
            study.source.id === "idroponica-facile-home-tower-guide" &&
            study.plantIds.some((plantId: string) => plantId === id),
        ),
      ).toBe(true);
      expect(hasApplicableCropNutrientEvidence(id)).toBe(true);
    }
  });
  it("shows African marigold trial context without fabricating an automatic range", () => {
    const reference = CROP_STUDY_REFERENCES.find(
      (study) =>
        study.source.id === "kazakidou-burrage-marigold-nft-1994" &&
        study.plantIds.some((id: string) => id === "marigold-jolly-jester"),
    );
    expect(reference?.text.en).toContain("1.5, 3.0 and 6.0");
    expect(reference?.text.en).toContain("not an automatic range");
    expect(hasApplicableCropNutrientEvidence("marigold-jolly-jester")).toBe(false);
  });
  it("shows the Tagetes patula DWC condition as context only, never as an EC target", () => {
    const reference = CROP_STUDY_REFERENCES.find(
      (study) =>
        study.source.id === "tagetes-patula-dwc-cultivars-2026" &&
        study.plantIds.includes("french-marigold"),
    );
    expect(reference?.plantIds).toEqual(["french-marigold"]);
    expect(reference?.selectableEcMs).toBeUndefined();
    expect(reference?.selectableEcValuesMs).toEqual([1.8, 2.0]);
    expect(reference?.text.en).toContain("not the Jolly Jester commercial identity");
    expect(reference?.text.en).toContain("not an optimum range");
    expect(reference?.plantIds).not.toContain("marigold-jolly-jester");
    expect(
      CROP_EVIDENCE.some((observation) => observation.source.id === reference?.source.id),
    ).toBe(false);
    expect(hasApplicableCropNutrientEvidence("marigold-jolly-jester")).toBe(false);
    expect(hasApplicableCropNutrientEvidence("french-marigold")).toBe(false);
  });
  it("exposes the LaNiTex Tagetes patula report as manual stage-context choices only", () => {
    const reference = CROP_STUDY_REFERENCES.find(
      (study) => study.source.id === "lanitex-hydroponic-marigold-guide-2026",
    );
    expect(reference?.plantIds).toEqual(["french-marigold"]);
    expect(reference?.plantIds).not.toContain("marigold-jolly-jester");
    expect(reference?.selectableEcValuesMs).toEqual([1.0, 1.5, 1.8, 2.0]);
    expect(reference?.source).toMatchObject({
      sourceClass: "SPECIALIST_GROWER",
      tier: "C",
      region: "Australia",
    });
    expect(reference?.text.en).toMatch(/does not identify the Jolly Jester commercial identity/i);
    expect(reference?.text.en).toMatch(/not automatic evidence/i);
    expect(
      CROP_EVIDENCE.some(
        (observation) => observation.source.id === "lanitex-hydroponic-marigold-guide-2026",
      ),
    ).toBe(false);
    expect(hasApplicableCropNutrientEvidence("marigold-jolly-jester")).toBe(false);
    expect(hasApplicableCropNutrientEvidence("french-marigold")).toBe(false);
  });
  it("shows the epazote substrate trial without treating it as a reservoir range", () => {
    const reference = CROP_STUDY_REFERENCES.find(
      (study) =>
        study.source.id === "aguilar-carpio-epazote-steiner-2021" &&
        study.plantIds.some((id: string) => id === "epazote"),
    );
    expect(reference?.text.en).toContain("1.0, 1.5 and 2.0");
    expect(reference?.text.en).toContain("does not validate a dose or range");
    expect(hasApplicableCropNutrientEvidence("epazote")).toBe(false);
  });
  it("keeps the coleus grower-page claim visible but out of automatic targets", () => {
    const reference = CROP_STUDY_REFERENCES.find(
      (study) =>
        study.source.id === "plant-garden-coleus-hydroponic-guide" &&
        study.plantIds.some((id: string) => id === "rainbow-mix-coleus"),
    );
    expect(reference?.source.tier).toBe("E");
    expect(reference?.text.en).toContain("1.0–1.6");
    expect(reference?.text.en).toContain("not a validated automatic target");
    expect(hasApplicableCropNutrientEvidence("rainbow-mix-coleus")).toBe(false);
  });
  it("shows inconsistent hyssop guide values as reported context only", () => {
    const reference = CROP_STUDY_REFERENCES.find(
      (study) =>
        study.source.id === "scale-stem-hyssop-hydroponic-guide" &&
        study.plantIds.some((id: string) => id === "hyssop"),
    );
    expect(reference?.source.tier).toBe("E");
    expect(reference?.text.en).toContain("1.0–1.6");
    expect(reference?.text.en).toContain("1.0–1.8");
    expect(hasApplicableCropNutrientEvidence("hyssop")).toBe(false);
  });
  it("keeps exact-cultivar substrate EC evidence out of reservoir targets", () => {
    const delphinium = CROP_STUDY_REFERENCES.find(
      (reference) => reference.source.id === "benary-delphinium-magic-fountains-grower",
    );
    const hibiscus = CROP_STUDY_REFERENCES.find(
      (reference) => reference.source.id === "uky-luna-blush-substrate-ec",
    );
    expect(delphinium?.text.en).toMatch(/substrate measurements.*not nutrient-solution EC/i);
    expect(delphinium?.selectableEcValuesMs).toBeUndefined();
    expect(delphinium?.selectableEcMs).toBeUndefined();
    expect(hibiscus?.text.en).toMatch(/substrate EC.*not reservoir EC/i);
    expect(hibiscus?.selectableEcValuesMs).toBeUndefined();
    expect(hibiscus?.selectableEcMs).toBeUndefined();
    expect(resolveNutrientCropIdentity("delphinium-magic-fountains-dwarf")).toBe("delphinium");
    expect(hasApplicableCropNutrientEvidence("delphinium-magic-fountains-dwarf")).toBe(false);
    expect(hasApplicableCropNutrientEvidence("blush-hibiscus")).toBe(false);
  });
  it("resolves sunflower cultivars and purple kohlrabi to identified crop-level guidance", () => {
    for (const id of [
      "sunflower-helianthus-annuus",
      "sunflower-american-giant-hybrid",
      "sunflower-autumn-beauty",
    ]) {
      expect(resolveNutrientCropIdentity(id)).toBe("sunflower");
      expect(hasApplicableCropNutrientEvidence(id)).toBe(true);
    }
    expect(resolveNutrientCropIdentity("purple-kohlrabi")).toBe("kohlrabi");
    expect(hasApplicableCropNutrientEvidence("purple-kohlrabi")).toBe(true);
  });
  it("maps the user's bunching onion type to non-bulbing crop guidance", () => {
    for (const id of ["bunching-onion-allium-fistulosum", "evergreen-bunching-onion-nabuka"]) {
      expect(resolveNutrientCropIdentity(id)).toBe("bunching-onion");
      expect(hasApplicableCropNutrientEvidence(id)).toBe(true);
    }
  });
  it("maps Bouquet dill to general grower guidance while retaining seasonal context", () => {
    expect(resolveNutrientCropIdentity("dill-bouquet")).toBe("dill");
    expect(hasApplicableCropNutrientEvidence("dill-bouquet")).toBe(true);
    expect(
      CROP_STUDY_REFERENCES.some(
        (study) =>
          study.source.id === "pure-hydroponics-crop-conductivity-2015" &&
          study.plantIds.some((id: string) => id === "dill-bouquet"),
      ),
    ).toBe(true);
  });
  it("maps curled chervil to species-level grower guidance", () => {
    expect(resolveNutrientCropIdentity("curled-chervil")).toBe("chervil");
    expect(hasApplicableCropNutrientEvidence("curled-chervil")).toBe(true);
  });
  it("uses the selected garlic chive stage in an actionable calibrated preparation", () => {
    const observation = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4", gro: "3", bloom: "2" },
      meterResolutionMs: 0.01,
    });
    expect(observation.ok).toBe(true);
    expect(observation.value?.meterResolution).toBe(0.01);
    const result = calculateGardenResult({
      language: "en",
      mode: "target",
      crops: { "garlic-chives": 1 },
      cropStages: { "garlic-chives": "SEEDLING" },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
      calibrationObservations: [observation.value!],
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.target?.value).toBeGreaterThan(1);
      expect(result.doses.length).toBeGreaterThan(0);
    }
  });
  it("does not reuse common chive evidence for the distinct garlic chive species", () => {
    expect(resolveNutrientCropIdentity("garlic-chives")).toBe("garlic-chives");
    expect(hasApplicableCropNutrientEvidence("garlic-chives")).toBe(false);
    const seedling = contextFor({ "garlic-chives": 1 }, "gh-flora", {
      "garlic-chives": "SEEDLING",
    })[0]!;
    expect(selectCropRange(seedling).ec.ec).toEqual({ min: 1, max: 1.3, unit: "mS/cm" });
    expect(
      CROP_STUDY_REFERENCES.some(
        (study) =>
          study.plantIds.some((id: string) => id === "garlic-chives") &&
          study.source.id === "chinese-chive-hydroponic-salinity-2022",
      ),
    ).toBe(true);
  });
  it("keeps identity sources from becoming nutrient targets for distinct crops", () => {
    for (const id of ["mexican-tarragon"]) {
      expect(hasApplicableCropNutrientEvidence(id)).toBe(false);
      expect(
        CROP_STUDY_REFERENCES.some((study) =>
          study.plantIds.some((plantId: string) => plantId === id),
        ),
      ).toBe(true);
    }
  });
  it("makes named basil, butterhead, and species-unspecified chamomile identities selectable", () => {
    for (const id of [
      "basil-dark-opal",
      "basil-spicy-globe",
      "basil-lemon",
      "basil-lime",
      "butterhead-lettuce-unspecified",
      "chamomile-unspecified",
    ]) {
      expect(
        CALCULATOR_PLANTS.some((plant) => plant.id === id),
        id,
      ).toBe(true);
    }
    expect(resolveNutrientCropIdentity("basil-dark-opal")).toBe("basil");
    expect(resolveNutrientCropIdentity("butterhead-lettuce-unspecified")).toBe("lettuce");
    for (const id of ["basil-lemon", "basil-lime"]) {
      expect(resolveNutrientCropIdentity(id)).toBe("lemon-basil");
      expect(hasApplicableCropNutrientEvidence(id)).toBe(true);
    }
    expect(resolveNutrientCropIdentity("chamomile-unspecified")).toBeUndefined();
    expect(hasApplicableCropNutrientEvidence("chamomile-unspecified")).toBe(true);
    const general = contextFor({ "chamomile-unspecified": 1 }, "gh-flora")[0]!;
    const selected = selectCropRange(general).ec;
    expect(selected.ec).toEqual({ min: 1, max: 1.6, unit: "mS/cm" });
    expect(selected.observations[0]?.source.id).toBe("letpot-hydroponic-chamomile-guide");
    const seedling = contextFor({ "chamomile-unspecified": 1 }, "gh-flora", {
      "chamomile-unspecified": "SEEDLING",
    })[0]!;
    expect(selectCropRange(seedling).ec.ec).toBeUndefined();
    const reading = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4", gro: "3", bloom: "2" },
    });
    expect(reading.ok).toBe(true);
    const inputs = {
      crops: { "chamomile-unspecified": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      sourceEcKnown: true,
      currentEc: 0.8,
      currentLiters: 3,
      capacityLiters: 5,
      waterAdded: 0.5,
      userTarget: null,
      round: 1,
      calibrationObservations: [reading.value!],
      reservoirMixConfirmed: true,
    };
    for (const mode of ["recipe", "target", "adjust", "topup"] as const) {
      const result = calculateGardenResult({ ...inputs, mode });
      expect(result.kind).toBe("ok");
      if (result.kind === "ok") expect(result.doses.length).toBeGreaterThan(0);
    }
  });
  it("applies holy basil evidence only when the user selects a matching stage", () => {
    const id = "tulsi-holy-basil-ocimum-tenuiflorum";
    expect(resolveNutrientCropIdentity(id)).toBe("holy-basil");
    expect(hasApplicableCropNutrientEvidence(id)).toBe(false);
    const seedling = contextFor({ [id]: 1 }, "gh-flora", { [id]: "SEEDLING" })[0]!;
    expect(selectCropRange(seedling).ec.ec).toEqual({ min: 0.7, max: 0.9, unit: "mS/cm" });
    const mature = contextFor({ [id]: 1 }, "gh-flora", { [id]: "MATURE" })[0]!;
    expect(selectCropRange(mature).ec.ec).toEqual({ min: 1.6, max: 2.1, unit: "mS/cm" });
  });
  it("keeps all non-carnivorous catalog identities operable with a user-selected target and matching calibration", () => {
    const observation = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4", gro: "3", bloom: "2" },
    });
    expect(observation.ok).toBe(true);
    const plants = CALCULATOR_PLANTS.filter(
      (plant) => !CALCULATOR_EXCLUDED_CARNIVOROUS_IDS.has(plant.id),
    );
    for (const plant of plants) {
      for (const mode of ["recipe", "target", "adjust", "topup"] as const) {
        const result = calculateGardenResult({
          language: "en",
          mode,
          crops: { [plant.id]: 1 },
          liters: 4,
          productId: "gh-flora",
          stageId: "feeding-2",
          pods: 6,
          sourceEc: 0.2,
          currentEc: 0.7,
          currentLiters: 2,
          capacityLiters: 4,
          waterAdded: 1,
          userTarget: 1.2,
          round: 1,
          calibrationObservations: [observation.value!],
          reservoirMixConfirmed: true,
        });
        expect(result.kind, `${plant.id}: ${mode}`).toBe("ok");
        if (mode !== "recipe" && result.kind === "ok") {
          expect(result.target?.value).toBe(1.2);
          if (!hasApplicableCropNutrientEvidence(plant.id)) {
            expect(result.evidence, `${plant.id}: ${mode}`).toBe("insufficient");
            expect(
              result.warnings?.some((warning) =>
                /could not establish a common applicable crop evidence range/i.test(warning),
              ),
              `${plant.id}: ${mode}`,
            ).toBe(true);
          }
        }
      }
    }
  });
  it.each(["alice-sundew-drosera-aliciae", "pinguicula-lilac-lollipop", "pinguicula-weser"])(
    "does not treat %s as zero-EC or produce nutrient doses for a saved carnivorous plant",
    (plantId) => {
      expect(CALCULATOR_EXCLUDED_CARNIVOROUS_IDS.has(plantId)).toBe(true);
      const result = calculateGardenResult({
        language: "es",
        mode: "recipe",
        crops: { [plantId]: 1 },
        liters: 4,
        productId: "gh-flora",
        stageId: "feeding-2",
        pods: 6,
        sourceEc: 0.2,
        currentEc: null,
        currentLiters: null,
        waterAdded: null,
        userTarget: null,
        round: 1,
      });
      expect(result.kind).toBe("needs");
      if (result.kind === "needs") expect(result.message).toContain("carnívoras");
    },
  );
  it("shows general crop context without promoting it to seedling evidence", () => {
    expect(generalCropReferenceForStage("bibb-lettuce", "SEEDLING", "DWC")?.range).toMatchObject({
      min: 1.2,
      max: 1.8,
    });
    expect(generalCropReferenceForStage("bibb-lettuce", "UNSPECIFIED", "DWC")).toBeUndefined();
    expect(generalCropReferenceForStage("epazote", "SEEDLING", "DWC")).toBeUndefined();
    const context = contextFor(
      { "bibb-lettuce": 1 },
      "gh-flora",
      { "bibb-lettuce": "SEEDLING" },
      {},
      "DWC",
    );
    expect(calculateFreshTargetEc({ contexts: context }).ok).toBe(false);
  });
  it("keeps different observed stages of the same crop as separate evidence contexts", () => {
    const contexts = contextFor(
      { "bibb-lettuce": 2 },
      "gh-flora",
      { "bibb-lettuce": "VEGETATIVE" },
      { "bibb-lettuce": ["SEEDLING"] },
    );
    expect(contexts.map((item) => item.phenologicalStage)).toEqual(["VEGETATIVE", "SEEDLING"]);
    expect(contexts.every((item) => item.cropIdentity === "lettuce")).toBe(true);
    expect(
      contextFor(
        { "bibb-lettuce": 1 },
        "gh-flora",
        { "bibb-lettuce": "VEGETATIVE" },
        { "bibb-lettuce": ["SEEDLING"] },
      ),
    ).toHaveLength(1);
    const invalid = calculateGardenResult({
      language: "en",
      mode: "recipe",
      crops: { "bibb-lettuce": 2 },
      cropStages: { "bibb-lettuce": "VEGETATIVE" },
      cropAdditionalStages: { "bibb-lettuce": ["SEEDLING", "FLOWERING"] },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    // Manufacturer recipe math is independent of crop stage composition.
    expect(invalid.kind).toBe("ok");
    if (invalid.kind === "ok") expect(invalid.compatibility?.status).toBe("INSUFFICIENT");
  });

  it("uses the selected growing system instead of inferring it from the nutrient product", () => {
    expect(contextFor({ "bibb-lettuce": 1 }, "aerogarden")[0]?.hydroponicSystem).toBe("UNKNOWN");
    expect(
      contextFor({ "bibb-lettuce": 1 }, "aerogarden", {}, {}, "KRATKY")[0]?.hydroponicSystem,
    ).toBe("KRATKY");
    expect(contextFor({ "bibb-lettuce": 1 }, "gh-flora", {}, {}, "NFT")[0]?.hydroponicSystem).toBe(
      "NFT",
    );
  });
  it("preserves the warning when a user chooses a target with no supported crop range", () => {
    const observation = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4", gro: "3", bloom: "2" },
    });
    const result = calculateGardenResult({
      language: "en",
      mode: "target",
      crops: { epazote: 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: 1.2,
      round: 1,
      calibrationObservations: [observation.value!],
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.target?.value).toBe(1.2);
      expect(
        result.warnings?.some((message) =>
          /could not establish a common applicable crop evidence range/i.test(message),
        ),
      ).toBe(true);
    }
  });
  it("explains source water at or above target before asking for calibration", () => {
    const base = {
      mode: "target" as const,
      crops: { "genovese-basil": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      currentEc: 0.8,
      currentLiters: 3,
      capacityLiters: 5,
      waterAdded: 0.5,
      userTarget: 1.2,
      round: 1,
      language: "es" as const,
    };
    const equal = calculateGardenResult({ ...base, sourceEc: 1.2 });
    expect(equal.kind).toBe("needs");
    if (equal.kind === "needs") {
      expect(equal.message).toContain("coincide con el objetivo");
      expect(equal.calibrationRequired).not.toBe(true);
    }
    const higher = calculateGardenResult({ ...base, sourceEc: 1.3 });
    expect(higher.kind).toBe("needs");
    if (higher.kind === "needs") expect(higher.message).toContain("supera el objetivo");
    const lower = calculateGardenResult({ ...base, sourceEc: 0.2 });
    expect(lower.kind === "needs" && lower.calibrationRequired).toBe(true);
  });

  it("requires an identified A+B formulation and actual measurements, never an invented recipe", () => {
    const base = {
      crops: { "genovese-basil": 1 },
      liters: 4,
      productId: "ab",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: 0.8,
      currentLiters: 3,
      capacityLiters: 5,
      waterAdded: 0.5,
      userTarget: 1.2,
      round: 1,
    };
    const named = {
      ...base,
      customAbManufacturer: "Test manufacturer",
      customAbName: "Test nutrient A+B",
      customAbVersion: "Label v1",
      reservoirMixConfirmed: true,
    };
    expect(calculateGardenResult({ ...named, mode: "recipe" }).kind).toBe("needs");
    expect(calculateGardenResult({ ...base, mode: "target" }).kind).toBe("needs");
    const observation = recordActualDoses({
      ...named,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { a: "4", b: "2" },
    });
    expect(observation.ok).toBe(true);
    expect(
      recordActualDoses({
        ...named,
        baselineEc: 0.2,
        resultingEc: 1,
        actualDoses: { a: "4", b: "0" },
      }).ok,
    ).toBe(false);
    const uncalibrated = calculateGardenResult({ ...named, mode: "target" });
    expect(uncalibrated.kind === "needs" && uncalibrated.calibrationRequired).toBe(true);
    const result = calculateGardenResult({
      ...named,
      mode: "target",
      calibrationObservations: [observation.value!],
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.doses.map((dose) => dose.label)).toEqual(["Parte A", "Parte B"]);
      expect(result.doses[0]!.amount / result.doses[1]!.amount).toBeCloseTo(2);
    }
    for (const mode of ["adjust", "topup"] as const) {
      const calculated = calculateGardenResult({
        ...named,
        mode,
        calibrationObservations: [observation.value!],
      });
      expect(calculated.kind).toBe("ok");
      if (calculated.kind === "ok")
        expect(calculated.doses.filter((dose) => dose.unit === "mL")).toHaveLength(2);
    }
    const moreVolume = calculateGardenResult({
      ...named,
      liters: 8,
      mode: "target",
      calibrationObservations: [observation.value!],
    });
    if (result.kind === "ok" && moreVolume.kind === "ok")
      expect(moreVolume.doses[0]!.amount).toBeCloseTo(result.doses[0]!.amount * 2);
    else throw new Error("Expected calibrated A+B targets");
    const changedVersion = calculateGardenResult({
      ...named,
      customAbVersion: "Label v2",
      mode: "target",
      calibrationObservations: [observation.value!],
    });
    expect(changedVersion.kind === "needs" && changedVersion.calibrationRequired).toBe(true);
    const changedManufacturer = calculateGardenResult({
      ...named,
      customAbManufacturer: "Other manufacturer",
      mode: "target",
      calibrationObservations: [observation.value!],
    });
    expect(changedManufacturer.kind === "needs" && changedManufacturer.calibrationRequired).toBe(
      true,
    );
  });
  it("reports which observations actually apply to the latest measured component ratio", () => {
    const base = {
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1.0,
    };
    const first = recordActualDoses({ ...base, actualDoses: { micro: "4", gro: "3", bloom: "2" } });
    const second = recordActualDoses({
      ...base,
      actualDoses: { micro: "8", gro: "6", bloom: "4" },
    });
    const different = recordActualDoses({
      ...base,
      actualDoses: { micro: "5", gro: "3", bloom: "2" },
    });
    const sameUsage = calibrationUsage({
      ...base,
      calibrationObservations: [first.value!, second.value!],
    });
    const mixedUsage = calibrationUsage({
      ...base,
      calibrationObservations: [first.value!, second.value!, different.value!],
    });
    expect(sameUsage).toEqual({ used: 2, recorded: 2 });
    expect(mixedUsage).toEqual({ used: 1, recorded: 3 });
  });
  it("uses the complete canonical identity catalog", () => {
    expect(donorPlants.length).toBeGreaterThanOrEqual(500);
    expect(CALCULATOR_PLANTS).toHaveLength(donorPlants.length);
    expect(donorPlants.map((plant) => plant.id)).toContain("genovese-basil");
  });

  it("resolves only explicitly verified Gardenpedia identity mappings", () => {
    expect(resolveNutrientCropIdentity("genovese-basil")).toBe("basil");
    expect(resolveNutrientCropIdentity("common-mint")).toBe("mint");
    expect(resolveNutrientCropIdentity("hoja-santa-piper-auritum")).toBeUndefined();
  });

  it("keeps embedded nutrient guidance insufficient when there is no applicable crop evidence", () => {
    expect(hasApplicableCropNutrientEvidence("epazote")).toBe(false);
    expect(hasApplicableCropNutrientEvidence("genovese-basil")).toBe(true);
  });

  it("resolves Genovese Basil through applicable EC evidence before calibration", () => {
    const result = calculateGardenResult({
      mode: "target",
      crops: { "genovese-basil": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(result.kind).toBe("needs");
    if (result.kind === "needs") {
      expect(result.range).toEqual({ min: 1, max: 1.6, common: true });
      expect(result.evidence).toBe("high");
      expect(result.message).toContain("medición real");
      expect(result.message).not.toContain("No applicable comparable crop EC evidence");
    }
  });

  it("distinguishes an empty Quick Mix from a crop with insufficient evidence", () => {
    const result = calculateGardenResult({
      mode: "target",
      crops: {},
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(result.kind).toBe("needs");
    if (result.kind === "needs") {
      expect(result.message).toContain("planta");
      expect(result.message).not.toContain("No applicable comparable crop EC evidence");
    }
  });

  it("reports complete canonical crop-evidence coverage without guessing", () => {
    const report = buildCropEvidenceCoverage();
    expect(report.context).toEqual({
      phenologicalStage: "UNSPECIFIED",
      hydroponicSystem: "UNKNOWN",
    });
    expect(report.rows).toHaveLength(donorPlants.length);
    expect(report.totals).toEqual({
      SUPPORTED_DIRECT: 13,
      SUPPORTED_VIA_DEFENSIBLE_MAPPING: 123,
      INSUFFICIENT: 371,
      NOT_APPLICABLE: 0,
    });
    for (const plantId of [
      "goeppertia-orbifolia",
      "croton-codiaeum-variegatum",
      "florist-kalanchoe-kalanchoe-blossfeldiana",
      "dwarf-umbrella-tree-heptapleurum-arboricola",
      "weeping-fig-ficus-benjamina",
    ]) {
      expect(report.rows.find((row) => row.plantId === plantId)?.classification).toBe(
        "INSUFFICIENT",
      );
    }
    expect(report.rows.find((row) => row.plantId === "genovese-basil")).toEqual({
      plantId: "genovese-basil",
      classification: "SUPPORTED_VIA_DEFENSIBLE_MAPPING",
      evidenceIdentity: "basil",
    });
    expect(report.rows.find((row) => row.plantId === "bibb-lettuce")?.classification).toBe(
      "SUPPORTED_VIA_DEFENSIBLE_MAPPING",
    );
    expect(report.rows.find((row) => row.plantId === "cherry-tomato")?.classification).toBe(
      "SUPPORTED_VIA_DEFENSIBLE_MAPPING",
    );
    expect(report.rows.find((row) => row.plantId === "monterey-strawberry")?.classification).toBe(
      "SUPPORTED_VIA_DEFENSIBLE_MAPPING",
    );
    expect(report.rows.find((row) => row.plantId === "anaheim-pepper")?.classification).toBe(
      "SUPPORTED_VIA_DEFENSIBLE_MAPPING",
    );
    expect(report.rows.find((row) => row.plantId === "hoja-santa-piper-auritum")).toMatchObject({
      plantId: "hoja-santa-piper-auritum",
      classification: "INSUFFICIENT",
    });
    expect(report.rows.find((row) => row.plantId === "common-mint")?.classification).toBe(
      "SUPPORTED_VIA_DEFENSIBLE_MAPPING",
    );
    for (const plantId of [
      "venus-flytrap-dionaea-muscipula",
      "cape-sundew-drosera-capensis",
      "pinguicula-primuliflora",
      "nepenthes-x-ventrata",
      "tulsi-holy-basil-ocimum-tenuiflorum",
      "wishbone-flower-torenia-fournieri",
      "alice-sundew-drosera-aliciae",
      "tennessee-coneflower-echinacea-tennesseensis",
      "micro-tom-tomato",
      "orange-hat-micro-dwarf-tomato",
      "black-pearl-ornamental-pepper",
      "white-carolina-pineberry",
    ]) {
      expect(report.rows.find((row) => row.plantId === plantId)?.classification).toBe(
        "INSUFFICIENT",
      );
    }
  });

  it("distinguishes default-insufficient crops from evidence available only in a stated stage or system", () => {
    const defaultCoverage = buildCropEvidenceCoverage();
    const aeroponicVegetative = buildCropEvidenceCoverage({
      phenologicalStage: "VEGETATIVE",
      hydroponicSystem: "AEROPONIC",
    });
    const nft = buildCropEvidenceCoverage({
      phenologicalStage: "UNSPECIFIED",
      hydroponicSystem: "NFT",
    });
    const dwc = buildCropEvidenceCoverage({
      phenologicalStage: "UNSPECIFIED",
      hydroponicSystem: "DWC",
    });
    const stageSpecific = buildCropEvidenceCoverage({
      phenologicalStage: "SEEDLING",
      hydroponicSystem: "UNKNOWN",
    });

    expect(
      defaultCoverage.rows.find((row) => row.plantId === "garlic-chives")?.classification,
    ).toBe("INSUFFICIENT");
    expect(aeroponicVegetative.rows.find((row) => row.plantId === "garlic-chives")).toMatchObject({
      classification: "SUPPORTED_DIRECT",
      evidenceIdentity: "garlic-chives",
    });
    expect(nft.rows.find((row) => row.plantId === "scarlet-red-tatsoi")).toMatchObject({
      classification: "SUPPORTED_VIA_DEFENSIBLE_MAPPING",
      evidenceIdentity: "tatsoi",
    });
    expect(nft.rows.find((row) => row.plantId === "tatsoi")).toMatchObject({
      classification: "SUPPORTED_DIRECT",
      evidenceIdentity: "tatsoi",
    });
    expect(nft.rows.find((row) => row.plantId === "hon-tsai-tai")).toMatchObject({
      classification: "SUPPORTED_VIA_DEFENSIBLE_MAPPING",
      evidenceIdentity: "flowering-choy-sum",
    });
    expect(dwc.rows.find((row) => row.plantId === "scarlet-red-tatsoi")?.classification).toBe(
      "INSUFFICIENT",
    );
    expect(stageSpecific.rows.find((row) => row.plantId === "lavender-vera")).toMatchObject({
      classification: "SUPPORTED_VIA_DEFENSIBLE_MAPPING",
      evidenceIdentity: "english-lavender",
    });
    expect(
      stageSpecific.rows.find((row) => row.plantId === "tulsi-holy-basil-ocimum-tenuiflorum"),
    ).toMatchObject({
      classification: "SUPPORTED_VIA_DEFENSIBLE_MAPPING",
      evidenceIdentity: "holy-basil",
    });
    expect(stageSpecific.rows.find((row) => row.plantId === "garlic-chives")).toMatchObject({
      classification: "SUPPORTED_DIRECT",
      evidenceIdentity: "garlic-chives",
    });
    expect(
      stageSpecific.rows.find((row) => row.plantId === "delphinium-magic-fountains-dwarf")
        ?.classification,
    ).toBe("INSUFFICIENT");
  });

  it("audits all 83 varieties across declared stage and hydroponic contexts", () => {
    const stages = [
      "UNSPECIFIED",
      "SEEDLING",
      "VEGETATIVE",
      "MATURE",
      "FLOWERING",
      "FRUITING",
    ] as const;
    const hydroponicSystems = [
      "UNKNOWN",
      "DWC",
      "NFT",
      "KRATKY",
      "DRIP",
      "AEROPONIC",
      "GENERAL_HYDROPONIC",
    ] as const;
    const contexts = stages.flatMap((phenologicalStage) =>
      hydroponicSystems.map((hydroponicSystem) => ({ phenologicalStage, hydroponicSystem })),
    );
    const supported = new Set<string>();
    const userVarietyIds = new Set<string>(USER_ZERO_83_VARIETY_IDS);
    const defaultCoverage = buildCropEvidenceCoverage();

    for (const context of contexts) {
      for (const row of buildCropEvidenceCoverage(context).rows) {
        if (userVarietyIds.has(row.plantId) && row.classification !== "INSUFFICIENT") {
          supported.add(row.plantId);
        }
      }
    }

    expect(supported.size).toBe(70);
    const defaultUnsupported = USER_ZERO_83_VARIETY_IDS.filter(
      (plantId) =>
        defaultCoverage.rows.find((row) => row.plantId === plantId)?.classification ===
        "INSUFFICIENT",
    );
    expect(defaultUnsupported.filter((plantId) => supported.has(plantId)).sort()).toEqual([
      "garlic-chives",
      "hon-tsai-tai",
      "lavender-vera",
      "scarlet-red-tatsoi",
      "tatsoi",
      "tulsi-holy-basil-ocimum-tenuiflorum",
    ]);
    expect(defaultUnsupported.filter((plantId) => !supported.has(plantId)).sort()).toEqual([
      "blush-hibiscus",
      "bush-nasturtium-tropaeolum-minus",
      "delphinium-magic-fountains-dwarf",
      "epazote",
      "hyssop",
      "lady-murasaki-komatsuna",
      "marigold-jolly-jester",
      "mexican-tarragon",
      "papalo-porophyllum-ruderale",
      "rainbow-mix-coleus",
      "tennessee-coneflower-echinacea-tennesseensis",
      "tiny-tim-sweet-alyssum",
      "zinnia-lilliput-mixed",
    ]);
  });

  it("can calculate a manual, calibrated By EC dose for each of the user's 83 non-carnivorous varieties", () => {
    expect(USER_ZERO_83_VARIETY_IDS).toHaveLength(83);
    expect(new Set(USER_ZERO_83_VARIETY_IDS).size).toBe(83);
    const coverage = buildCropEvidenceCoverage();
    const coverageRows = USER_ZERO_83_VARIETY_IDS.map((plantId) =>
      coverage.rows.find((row) => row.plantId === plantId),
    );
    expect(coverageRows.every(Boolean)).toBe(true);
    expect({
      SUPPORTED_DIRECT: coverageRows.filter((row) => row?.classification === "SUPPORTED_DIRECT")
        .length,
      SUPPORTED_VIA_DEFENSIBLE_MAPPING: coverageRows.filter(
        (row) => row?.classification === "SUPPORTED_VIA_DEFENSIBLE_MAPPING",
      ).length,
      INSUFFICIENT: coverageRows.filter((row) => row?.classification === "INSUFFICIENT").length,
      NOT_APPLICABLE: coverageRows.filter((row) => row?.classification === "NOT_APPLICABLE").length,
    }).toEqual({
      SUPPORTED_DIRECT: 7,
      SUPPORTED_VIA_DEFENSIBLE_MAPPING: 57,
      INSUFFICIENT: 19,
      NOT_APPLICABLE: 0,
    });
    for (const plantId of USER_ZERO_83_VARIETY_IDS) {
      const evidenceIdentity = resolveNutrientCropIdentity(plantId) ?? plantId;
      const evidenceSources = CROP_EVIDENCE.filter(
        (observation) => observation.cropIdentity === evidenceIdentity,
      ).map((observation) => observation.source);
      const contextualSources = CROP_STUDY_REFERENCES.filter((reference) =>
        reference.plantIds.includes(plantId),
      ).map((reference) => reference.source);
      const sources = [...evidenceSources, ...contextualSources];
      expect(sources.length, `${plantId}: source traceability`).toBeGreaterThan(0);
      expect(
        sources.every((source) => /^https:\/\//.test(source.url)),
        `${plantId}: source URL must be HTTPS`,
      ).toBe(true);
    }
    const calibration = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1.0,
      actualDoses: { micro: "4", gro: "3", bloom: "2" },
    });
    expect(calibration.ok).toBe(true);
    if (!calibration.value) throw new Error("Expected a valid GH calibration fixture");

    const officialRecipe = calculateGardenResult({
      mode: "recipe",
      crops: { "bibb-lettuce": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(officialRecipe.kind).toBe("ok");
    if (officialRecipe.kind !== "ok") throw new Error(officialRecipe.message);

    for (const plantId of USER_ZERO_83_VARIETY_IDS) {
      const coverageRow = coverageRows.find((row) => row?.plantId === plantId);
      expect(
        CALCULATOR_PLANTS.some((plant) => plant.id === plantId),
        plantId,
      ).toBe(true);
      const shared = {
        crops: { [plantId]: 1 },
        liters: 4,
        productId: "gh-flora",
        stageId: "feeding-2",
        pods: 6,
        sourceEc: 0.2,
        sourceEcKnown: true,
        userTarget: 1.2,
        round: 1,
        calibrationObservations: [calibration.value],
        reservoirMixConfirmed: true,
      };
      const byEc = calculateGardenResult({
        ...shared,
        mode: "target",
        currentEc: null,
        currentLiters: null,
        waterAdded: null,
      });
      const correction = calculateGardenResult({
        ...shared,
        mode: "adjust",
        currentEc: 0.8,
        currentLiters: 4,
        waterAdded: null,
      });
      const topUp = calculateGardenResult({
        ...shared,
        mode: "topup",
        currentEc: 0.8,
        currentLiters: 3,
        capacityLiters: 4.1,
        waterAdded: 1,
      });
      const recipe = calculateGardenResult({
        mode: "recipe",
        crops: { [plantId]: 1 },
        liters: 4,
        productId: "gh-flora",
        stageId: "feeding-2",
        pods: 6,
        sourceEc: 0.2,
        currentEc: null,
        currentLiters: null,
        waterAdded: null,
        userTarget: null,
        round: 1,
      });

      for (const result of [byEc, correction, topUp, recipe]) {
        expect(
          result.kind,
          `${plantId}: ${result.kind === "needs" ? result.message : result.kind}`,
        ).toBe("ok");
        if (result.kind === "ok") {
          expect(result.doses.length).toBeGreaterThanOrEqual(3);
          expect(
            result.doses.every((dose) => dose.amount > 0),
            plantId,
          ).toBe(true);
        }
      }
      if (byEc.kind === "ok") expect(byEc.target).toEqual({ value: 1.2, provenance: "user" });
      if (recipe.kind === "ok") {
        expect(recipe.doses).toHaveLength(3);
        expect(recipe.doses.map((dose) => dose.amount)).toEqual(
          officialRecipe.doses.map((dose) => dose.amount),
        );
      }
      if (coverageRow?.classification === "INSUFFICIENT") {
        expect(byEc.kind === "ok" && byEc.evidence).toBe("insufficient");
        expect(byEc.kind === "ok" && byEc.range).toBeUndefined();
        expect(recipe.kind === "ok" && recipe.range).toBeUndefined();
      }
    }
  });

  it("finds every one of the user's 83 varieties through canonical plant search", () => {
    for (const plantId of USER_ZERO_83_VARIETY_IDS) {
      const plant = CALCULATOR_PLANTS.find((candidate) => candidate.id === plantId);
      expect(plant, plantId).toBeTruthy();
      if (!plant) continue;

      expect(
        searchCalculatorPlants(plant.name.en, "en").map(({ id }) => id),
        plantId,
      ).toContain(plantId);
      if (plant.name.es) {
        expect(
          searchCalculatorPlants(plant.name.es, "es").map(({ id }) => id),
          plantId,
        ).toContain(plantId);
      }
      if (plant.scientificName) {
        expect(
          searchCalculatorPlants(plant.scientificName, "en").map(({ id }) => id),
          plantId,
        ).toContain(plantId);
      }
    }
  });

  it("supports the user's 83 varieties with a named, calibrated A+B product but no invented recipe", () => {
    const namedProduct = {
      productId: "ab",
      customAbManufacturer: "QA manufacturer",
      customAbName: "QA nutrient A+B",
      customAbVersion: "Label/formula 1",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
    };
    const calibration = recordActualDoses({
      ...namedProduct,
      baselineEc: 0.2,
      resultingEc: 1.0,
      actualDoses: { a: "4", b: "2" },
    });
    expect(calibration.ok).toBe(true);
    if (!calibration.value) throw new Error("Expected an exact-product A+B calibration fixture");

    for (const plantId of USER_ZERO_83_VARIETY_IDS) {
      const shared = {
        ...namedProduct,
        crops: { [plantId]: 1 },
        sourceEc: 0.2,
        sourceEcKnown: true,
        userTarget: 1.2,
        round: 1,
        calibrationObservations: [calibration.value],
        reservoirMixConfirmed: true,
      };
      const target = calculateGardenResult({
        ...shared,
        mode: "target",
        currentEc: null,
        currentLiters: null,
        waterAdded: null,
      });
      const correction = calculateGardenResult({
        ...shared,
        mode: "adjust",
        currentEc: 0.8,
        currentLiters: 4,
        waterAdded: null,
      });
      const topUp = calculateGardenResult({
        ...shared,
        mode: "topup",
        currentEc: 0.8,
        currentLiters: 3,
        capacityLiters: 4.1,
        waterAdded: 1,
      });

      for (const result of [target, correction, topUp]) {
        expect(
          result.kind,
          `${plantId}: ${result.kind === "needs" ? result.message : result.kind}`,
        ).toBe("ok");
        if (result.kind === "ok") {
          const componentDoses = result.doses.filter((dose) =>
            ["Parte A", "Parte B"].includes(dose.label),
          );
          expect(componentDoses.map((dose) => dose.label)).toEqual(["Parte A", "Parte B"]);
          expect(componentDoses.every((dose) => dose.amount > 0)).toBe(true);
        }
      }

      const recipe = calculateGardenResult({
        ...shared,
        mode: "recipe",
        currentEc: null,
        currentLiters: null,
        waterAdded: null,
      });
      expect(recipe.kind, plantId).toBe("needs");
    }
  });

  it("maps CAFRE crop-level observations only to explicitly supported identities", () => {
    for (const [id, crop] of [
      ["swiss-chard-rainbow", "chard"],
      ["perpetual-spinach", "chard"],
      ["lacinato-kale", "kale"],
      ["mizuna-red-streaks", "mizuna"],
      ["red-mustard-greens", "mustard-greens"],
      ["wasabina-mustard-greens", "mustard-greens"],
      ["greek-oregano", "oregano"],
      ["common-chives", "chives"],
      ["peppermint-mentha-piperita", "mint"],
      ["spearmint", "mint"],
    ] as const) {
      expect(resolveNutrientCropIdentity(id)).toBe(crop);
      expect(hasApplicableCropNutrientEvidence(id)).toBe(true);
    }
    expect(resolveNutrientCropIdentity("seaside-f1-spinach")).toBe("spinach");
    for (const id of [
      "cuban-oregano-coleus-amboinicus",
      "mexican-oregano-lippia-origanoides",
      "red-russian-kale",
    ]) {
      expect(hasApplicableCropNutrientEvidence(id)).toBe(false);
    }
  });

  it("uses published crop evidence for cucumber without treating Armenian melon as cucumber", () => {
    expect(resolveNutrientCropIdentity("cucumber-marketmore")).toBe("cucumber");
    expect(hasApplicableCropNutrientEvidence("cucumber-marketmore")).toBe(true);
    expect(resolveNutrientCropIdentity("armenian-cucumber")).toBeUndefined();
    expect(hasApplicableCropNutrientEvidence("armenian-cucumber")).toBe(false);
  });

  it("connects reviewed common lettuce, basil, tomato and pepper identities without mapping unrelated crops", () => {
    for (const [id, crop] of [
      ["breen-romaine-lettuce", "lettuce"],
      ["bronze-arrow-lettuce", "lettuce"],
      ["green-salanova-lettuce", "lettuce"],
      ["muir-lettuce", "lettuce"],
      ["pandero-romaine-lettuce", "lettuce"],
      ["parris-island-romaine", "lettuce"],
      ["romaine-lettuce", "lettuce"],
      ["large-red-cherry-tomato", "tomato"],
      ["basil-ocimum-basilicum", "basil"],
      ["mini-lunchbox-sweet-pepper", "pepper"],
    ] as const) {
      expect(resolveNutrientCropIdentity(id)).toBe(crop);
      expect(hasApplicableCropNutrientEvidence(id)).toBe(true);
    }
    expect(resolveNutrientCropIdentity("celtuce-lactuca-sativa-augustana")).toBeUndefined();
    expect(hasApplicableCropNutrientEvidence("celtuce-lactuca-sativa-augustana")).toBe(false);
  });

  it("maps sourced African violet, head cabbage and leek without guessing lookalikes or stages", () => {
    for (const [id, minimum, maximum] of [
      ["african-violet-streptocarpus-ionanthus", 1.2, 1.5],
      ["golden-acre-cabbage", 2.5, 3],
      ["king-richard-leek", 1.4, 1.8],
    ] as const) {
      const automatic = calculateFreshTargetEc({ contexts: contextFor({ [id]: 1 }, "gh-flora") });
      expect(automatic.value?.target).toMatchObject({ min: minimum, max: maximum });
      const seedling = calculateFreshTargetEc({
        contexts: contextFor({ [id]: 1 }, "gh-flora", { [id]: "SEEDLING" }),
      });
      expect(seedling.ok).toBe(false);
    }
    for (const id of [
      "false-african-violet-streptocarpus-saxorum",
      "napa-cabbage",
      "common-houseleek-sempervivum-tectorum",
    ]) {
      expect(resolveNutrientCropIdentity(id)).toBeUndefined();
      expect(hasApplicableCropNutrientEvidence(id)).toBe(false);
    }
  });

  it("keeps AeroGarden UI projections aligned with verified groups and feeding events", () => {
    const aero = CALCULATOR_PRODUCTS.find((product) => product.id === "aerogarden");
    expect(aero?.podGroups).toEqual([2, 3, 6, 7, 9, 12]);
    expect(aero?.recipeStages.map((stage) => stage.feedingIndex)).toEqual([1, 2, 3]);
    expect(recipeStageLabel(aero!.recipeStages[0]!, "aerogarden", 2, "en")).toMatch(
      /each feeding/i,
    );
    expect(recipeStageLabel(aero!.recipeStages[0]!, "aerogarden", 6, "en")).toMatch(
      /each feeding/i,
    );
    expect(recipeStageLabel(aero!.recipeStages[0]!, "aerogarden", 9, "en")).toMatch(
      /first feeding/i,
    );
    expect(recipeStageLabel(aero!.recipeStages[1]!, "aerogarden", 9, "en")).toMatch(
      /second feeding/i,
    );
    expect(recipeStageLabel(aero!.recipeStages[2]!, "aerogarden", 9, "en")).toMatch(
      /third and later/i,
    );
    expect(recipeStageLabel(aero!.recipeStages[0]!, "aerogarden", 12, "en")).toMatch(
      /first feeding/i,
    );
    expect(recipeStageLabel(aero!.recipeStages[2]!, "aerogarden", 12, "en")).toMatch(
      /third and later/i,
    );
  });

  it("maps each UX mode to exactly one V1 operating mode", () => {
    expect(MODE_TO_ENGINE).toEqual({
      recipe: "FRESH_RECIPE",
      target: "FRESH_TARGET_EC",
      correction: "EC_CORRECTION",
      topup: "TOP_UP_MAINTENANCE",
    });
  });

  it("renders the official Flora recipe as three real components", () => {
    const result = executeFreshRecipe({ recipeId: FLORA_RECIPE.id, volumeL: 2, feedingIndex: 2 });
    expect(result.ok).toBe(true);
    expect(result.value?.parts.map((part) => part.label)).toEqual([
      "FloraMicro",
      "FloraGro",
      "FloraBloom",
    ]);
    expect(result.value?.recipe.mixingOrder).toEqual(["micro", "gro", "bloom"]);
  });

  it("projects every verified FloraSeries feeding step without inventing plant phenology", () => {
    expect(
      recipeStagesForSchedule("gh-flora", "LIGHT_FEED").map((stage) => stage.feedingIndex),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    const result = calculateGardenResult({
      mode: "recipe",
      crops: { "genovese-basil": 1 },
      liters: 2,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.expectedEc).toEqual({ kind: "manufacturer", min: 0.9, max: 1.1 });
      expect(result.evidence).toBe("high");
    }

    const medium = calculateGardenResult({
      mode: "recipe",
      crops: { "genovese-basil": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "medium_feed-feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(medium.kind).toBe("ok");
    if (medium.kind === "ok") {
      expect(medium.doses[0]?.amount).toBeCloseTo(4.44, 2);
      expect(medium.expectedEc).toEqual({ kind: "manufacturer", min: 1.0, max: 1.2 });
    }
  });

  it("exposes only the published weeks for each official FloraSeries schedule", () => {
    expect(
      recipeStagesForSchedule("gh-flora", "LIGHT_FEED").map((stage) => stage.feedingIndex),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(
      recipeStagesForSchedule("gh-flora", "MEDIUM_FEED").map((stage) => stage.feedingIndex),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13]);
    expect(
      recipeStagesForSchedule("gh-flora", "AGGRESSIVE_FEED").map((stage) => stage.feedingIndex),
    ).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);

    // Same feeding index is a different manufacturer recipe between programs.
    const light = calculateGardenResult({
      mode: "recipe",
      crops: { "genovese-basil": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    const medium = calculateGardenResult({
      mode: "recipe",
      crops: { "genovese-basil": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "medium_feed-feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(light.kind).toBe("ok");
    expect(medium.kind).toBe("ok");
    if (light.kind === "ok" && medium.kind === "ok") {
      expect(light.doses).not.toEqual(medium.doses);
      expect(light.expectedEc).not.toEqual(medium.expectedEc);
    }
  });

  it("keeps an unmapped published identity insufficient instead of guessing a crop", () => {
    const result = calculateGardenResult({
      mode: "recipe",
      crops: { epazote: 1 },
      liters: 2,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.evidence).toBe("insufficient");
  });

  it("uses supported AeroGarden pod/feed semantics without volume or interpolation", () => {
    const supported = executeFreshRecipe({
      recipeId: AEROGARDEN_RECIPE.id,
      podCount: 9,
      feedingIndex: 1,
    });
    expect(supported.ok).toBe(true);
    expect(supported.value?.parts[0]?.ml).toBe(8);
    const second = executeFreshRecipe({
      recipeId: AEROGARDEN_RECIPE.id,
      podCount: 9,
      feedingIndex: 2,
    });
    expect(second.ok).toBe(true);
    expect(second.value?.parts[0]?.ml).toBe(8);
    const third = executeFreshRecipe({
      recipeId: AEROGARDEN_RECIPE.id,
      podCount: 9,
      feedingIndex: 3,
    });
    expect(third.ok).toBe(true);
    expect(third.value?.parts[0]?.ml).toBe(12);
    const unsupported = executeFreshRecipe({
      recipeId: AEROGARDEN_RECIPE.id,
      podCount: 10,
      feedingIndex: 1,
    });
    expect(unsupported.ok).toBe(false);
    expect(unsupported.errors[0]?.code).toBe("UNSUPPORTED_POD_COUNT");
  });

  it("preserves an edited EC target and warns instead of replacing it", () => {
    const result = calculateFreshTargetEc({
      contexts: [
        {
          cropIdentity: "basil",
          phenologicalStage: "UNSPECIFIED",
          measurementScope: "NUTRIENT_SOLUTION",
        },
      ],
      userSelectedTarget: 2.1,
    });
    expect(result.ok).toBe(true);
    expect(result.value?.target).toEqual({ min: 2.1, max: 2.1, unit: "mS/cm" });
    expect(result.warnings.some((warning) => warning.code === "USER_TARGET_OUTSIDE_EVIDENCE")).toBe(
      true,
    );
  });

  it("records actual multi-component applied doses rather than assuming the recommendation", () => {
    const signature = recipeSignature({ micro: 1.8, gro: 1.8, bloom: 1.8 });
    const observation = learnFromObservation({
      productIdentity: FLORA_RECIPE.product,
      formulationVersion: FLORA_RECIPE.product.formulationVersion,
      recipeSignature: signature,
      baselineEc: 0.4,
      resultingEc: 0.8,
      doseAppliedMl: 7.1,
      reservoirVolumeL: 2,
      timestamp: "2026-10-03T00:00:00.000Z",
    });
    expect(observation.ok).toBe(true);
    expect(observation.value?.doseAppliedMl).toBe(7.1);
    expect(observation.errors).toHaveLength(0);
  });

  it("keeps correction iterative and requires a matching calibration", () => {
    const signature = recipeSignature({ micro: 1.8, gro: 1.8, bloom: 1.8 });
    const observations = [1, 2, 3].map((n) => ({
      id: `cal-${n}`,
      productIdentity: FLORA_RECIPE.product,
      formulationVersion: FLORA_RECIPE.product.formulationVersion,
      componentRatioOrRecipeSignature: signature,
      baselineEc: 0.4,
      deltaEc: n * 0.1,
      resultingEc: 0.4 + n * 0.1,
      doseAppliedMl: n,
      reservoirVolumeL: 2,
      timestamp: `2026-10-0${n}`,
    }));
    const calibration = buildCalibrationModel({
      productIdentity: FLORA_RECIPE.product,
      formulationVersion: FLORA_RECIPE.product.formulationVersion,
      recipeSignature: signature,
      observations,
    });
    expect(calibration.value).toBeDefined();
    const correction = calculateEcCorrection({
      currentEc: {
        value: 0.5,
        unit: "mS/cm",
        context: { scope: "NUTRIENT_SOLUTION", scopeBasis: "STATED" },
      },
      targetEc: 0.8,
      reservoirVolumeL: 2,
      calibration: calibration.value!,
      policy: { firstStepFraction: 0.5, dosingEquipmentResolutionMl: 0.5 },
    });
    expect(correction.value?.requiresRemeasurement).toBe(true);
    expect(correction.value?.firstStepDoseMl).toBeDefined();
  });

  it("blocks top-up without current volume and enforces reservoir capacity", () => {
    const base = {
      nominalVolumeL: 4,
      replacementWaterL: 1,
      currentEc: {
        value: 1,
        unit: "mS/cm" as const,
        context: { scope: "NUTRIENT_SOLUTION" as const, scopeBasis: "STATED" as const },
      },
      targetEc: 1.2,
    };
    expect(calculateTopUpMaintenance(base).errors[0]?.code).toBe("CURRENT_VOLUME_REQUIRED");
    expect(calculateTopUpMaintenance({ ...base, currentVolumeL: 4 }).errors[0]?.code).toBe(
      "RESERVOIR_CAPACITY_EXCEEDED",
    );
  });

  it("connects the transplanted Lovable recipe surface to real Flora components", () => {
    const result = calculateGardenResult({
      mode: "recipe",
      crops: { "genovese-basil": 2 },
      liters: 2,
      productId: "gh-flora",
      stageId: "w3",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.provenance).toBe("official");
      expect(result.doses.map((dose) => dose.label)).toEqual([
        "FloraMicro",
        "FloraGro",
        "FloraBloom",
      ]);
    }
  });

  it("changes official recipe doses with volume and manufacturer step, not crop identity", () => {
    const input = {
      mode: "recipe" as const,
      crops: { "bibb-lettuce": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    };
    const fourLiters = calculateGardenResult(input);
    const tenLiters = calculateGardenResult({ ...input, liters: 10 });
    const laterStage = calculateGardenResult({ ...input, stageId: "feeding-7" });
    const strawberry = calculateGardenResult({
      ...input,
      crops: { "monterey-strawberry": 1 },
    });
    expect(fourLiters.kind).toBe("ok");
    expect(tenLiters.kind).toBe("ok");
    expect(laterStage.kind).toBe("ok");
    expect(strawberry.kind).toBe("ok");
    if (
      fourLiters.kind === "ok" &&
      tenLiters.kind === "ok" &&
      laterStage.kind === "ok" &&
      strawberry.kind === "ok"
    ) {
      expect(tenLiters.doses[0]!.amount / fourLiters.doses[0]!.amount).toBeCloseTo(2.5);
      expect(laterStage.doses.map((dose) => dose.amount)).not.toEqual(
        fourLiters.doses.map((dose) => dose.amount),
      );
      expect(strawberry.range).not.toEqual(fourLiters.range);
    }
  });

  it("allows water-only correction and top-up without pretending nutrient calibration is needed", () => {
    const base = {
      crops: { "bibb-lettuce": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentLiters: 3,
      capacityLiters: 5,
      waterAdded: 0.5,
      userTarget: 1.2,
      round: 1,
    };
    const dilute = calculateGardenResult({ ...base, mode: "adjust", currentEc: 1.4 });
    expect(dilute.kind).toBe("ok");
    if (dilute.kind === "ok") expect(dilute.action).toBe("dilute");
    const topup = calculateGardenResult({ ...base, mode: "topup", currentEc: 1.4 });
    expect(topup.kind).toBe("ok");
    const nutrient = calculateGardenResult({ ...base, mode: "adjust", currentEc: 0.8 });
    expect(nutrient.kind).toBe("needs");
    if (nutrient.kind === "needs") expect(nutrient.calibrationRequired).toBe(true);
  });

  it("uses crop evidence for mixed systems and refuses to infer a seedling range", () => {
    const base = {
      mode: "target" as const,
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    };
    const shared = calculateGardenResult({
      ...base,
      crops: { "bibb-lettuce": 1, "genovese-basil": 1 },
    });
    expect(shared.compatibility?.status).toBe("COMMON_OPTIMUM_RANGE");
    expect(shared.range).toMatchObject({ min: 1.2, max: 1.6 });
    const cucumberAndLettuce = calculateGardenResult({
      ...base,
      crops: { "cucumber-marketmore": 1, "bibb-lettuce": 3 },
    });
    expect(cucumberAndLettuce.compatibility?.status).toBe("COMMON_OPTIMUM_RANGE");
    expect(cucumberAndLettuce.range).toMatchObject({ min: 1.7, max: 1.8 });
    const conflict = calculateGardenResult({
      ...base,
      crops: { "bibb-lettuce": 1, "cherry-tomato": 1 },
    });
    expect(conflict.compatibility?.status).toBe("NO_COMMON_OPTIMUM_RANGE");
    const seedlings = calculateGardenResult({
      ...base,
      crops: { "bibb-lettuce": 2 },
      cropStages: { "bibb-lettuce": "MIXED" },
    });
    expect(seedlings.kind).toBe("needs");
    if (seedlings.kind === "needs")
      expect(seedlings.message).toBe("MIXED_STAGE_COMPOSITION_REQUIRED");
    expect(
      contextFor(
        { "bibb-lettuce": 2 },
        "gh-flora",
        { "bibb-lettuce": "MIXED" },
        { "bibb-lettuce": ["SEEDLING", "VEGETATIVE"] },
      ).map((context) => context.phenologicalStage),
    ).toEqual(["SEEDLING", "VEGETATIVE"]);
    const declaredMixedStages = calculateGardenResult({
      ...base,
      crops: { "bibb-lettuce": 2 },
      cropStages: { "bibb-lettuce": "MIXED" },
      cropAdditionalStages: { "bibb-lettuce": ["SEEDLING", "VEGETATIVE"] },
    });
    expect(declaredMixedStages.kind).toBe("needs");
    if (declaredMixedStages.kind === "needs") expect(declaredMixedStages.range).toBeUndefined();

    const mixedStageCalibration = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4.8", gro: "4.0", bloom: "3.2" },
    });
    const explicitMixedStageTarget = calculateGardenResult({
      ...base,
      mode: "target",
      crops: { "bibb-lettuce": 2 },
      cropStages: { "bibb-lettuce": "MIXED" },
      cropAdditionalStages: { "bibb-lettuce": ["SEEDLING", "VEGETATIVE"] },
      sourceEc: 0.2,
      sourceEcKnown: true,
      userTarget: 1.2,
      calibrationObservations: [mixedStageCalibration.value!],
    });
    expect(explicitMixedStageTarget.kind).toBe("ok");
    if (explicitMixedStageTarget.kind === "ok") {
      expect(explicitMixedStageTarget.target).toEqual({ value: 1.2, provenance: "user" });
      expect(explicitMixedStageTarget.evidence).toBe("insufficient");
      expect(explicitMixedStageTarget.doses.map((dose) => dose.label)).toEqual([
        "FloraMicro",
        "FloraGro",
        "FloraBloom",
      ]);
    }

    const recipeDoesNotDependOnMixedPhenology = calculateGardenResult({
      ...base,
      mode: "recipe",
      crops: { "bibb-lettuce": 2 },
      cropStages: { "bibb-lettuce": "MIXED" },
    });
    expect(recipeDoesNotDependOnMixedPhenology.kind).toBe("ok");
    expect(recipeDoesNotDependOnMixedPhenology.compatibility?.status).toBe("INSUFFICIENT");
  });

  it("changes correction and top-up outputs when measured reservoir state changes", () => {
    const observation = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 2,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4.8", gro: "4.0", bloom: "3.2" },
    });
    const base = {
      crops: { "bibb-lettuce": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentLiters: 3,
      capacityLiters: 4,
      waterAdded: 0.5,
      userTarget: 1.2,
      round: 1,
      calibrationObservations: [observation.value!],
      reservoirMixConfirmed: true,
    };
    const correctionLow = calculateGardenResult({
      ...base,
      mode: "adjust",
      currentEc: 0.8,
    });
    const correctionHigh = calculateGardenResult({
      ...base,
      mode: "adjust",
      currentEc: 1.0,
    });
    const partial = calculateGardenResult({
      ...base,
      mode: "adjust",
      currentEc: 0.8,
      correctionFraction: 0.5,
    });
    const topupSmall = calculateGardenResult({
      ...base,
      mode: "topup",
      currentEc: 0.8,
      waterAdded: 0.25,
    });
    const withoutCapacity = calculateGardenResult({
      ...base,
      mode: "topup",
      currentEc: 0.8,
      capacityLiters: undefined,
    });
    expect(withoutCapacity.kind).toBe("needs");
    const topupLarge = calculateGardenResult({
      ...base,
      mode: "topup",
      currentEc: 0.8,
      waterAdded: 0.75,
    });
    expect(correctionLow.kind).toBe("ok");
    expect(correctionHigh.kind).toBe("ok");
    expect(partial.kind).toBe("ok");
    if (partial.kind === "ok" && correctionLow.kind === "ok") {
      expect(partial.doses[0]!.amount).toBeCloseTo(correctionLow.doses[0]!.amount / 2);
      expect(partial.expectedEc).toBeUndefined();
      expect(partial.warnings?.some((warning) => warning.includes("parcial"))).toBe(true);
    }
    expect(topupSmall.kind).toBe("ok");
    expect(topupLarge.kind).toBe("ok");
    if (
      correctionLow.kind === "ok" &&
      correctionHigh.kind === "ok" &&
      topupSmall.kind === "ok" &&
      topupLarge.kind === "ok"
    ) {
      expect(correctionLow.doses[0]?.amount).not.toBe(correctionHigh.doses[0]?.amount);
      expect(topupSmall.doses[0]?.amount).not.toBe(topupLarge.doses[0]?.amount);
    }
  });

  it("keeps a user EC target in the Lovable presentation model", () => {
    const result = calculateGardenResult({
      mode: "target",
      crops: { "genovese-basil": 2 },
      liters: 2,
      productId: "gh-flora",
      stageId: "w3",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: 2.1,
      round: 1,
    });
    expect(result.kind).toBe("needs");
    if (result.kind === "needs") {
      expect(result.target?.value).toBe(2.1);
      expect(result.message).toContain("medición real");
    }
  });

  it("produces an actionable By EC dose only after exact product calibration", () => {
    const observation = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 2,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4.8", gro: "4.0", bloom: "3.2" },
    });
    expect(observation.ok).toBe(true);
    const calibratedInput = {
      mode: "target" as const,
      crops: { "bibb-lettuce": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: 1.2,
      round: 1,
      calibrationObservations: [observation.value!],
    };
    const result = calculateGardenResult(calibratedInput);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.doses.length).toBeGreaterThan(0);
      expect(result.doses.map((dose) => dose.label)).toEqual([
        "FloraMicro",
        "FloraGro",
        "FloraBloom",
      ]);
    }
  });

  it("translates the experimental suggested-starting-point warning in Spanish", () => {
    const observation = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4.8", gro: "4.0", bloom: "3.2" },
    });
    expect(observation.ok).toBe(true);
    const result = calculateGardenResult({
      mode: "target",
      crops: { "bibb-lettuce": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      sourceEcKnown: true,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
      language: "es",
      calibrationObservations: [observation.value!],
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.warnings).toContain(
        "Esta es una política provisional de punto de partida de Garden, no un objetivo científico.",
      );
      expect(result.warnings?.some((warning) => warning.includes("provisional Garden"))).toBe(
        false,
      );
    }
  });

  it("differentiates By EC by crop, target, and volume", () => {
    const observation = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 2,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4.8", gro: "4.0", bloom: "3.2" },
    });
    const base = {
      mode: "target" as const,
      crops: { "bibb-lettuce": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: 1.2,
      round: 1,
      calibrationObservations: [observation.value!],
    };
    const lettuce = calculateGardenResult({ ...base, crops: { "bibb-lettuce": 1 } });
    const tomato = calculateGardenResult({ ...base, crops: { "cherry-tomato": 1 } });
    const higherTarget = calculateGardenResult({ ...base, userTarget: 1.5 });
    const largerVolume = calculateGardenResult({ ...base, liters: 10 });
    expect(lettuce.kind).toBe("ok");
    expect(tomato.kind).toBe("ok");
    expect(higherTarget.kind).toBe("ok");
    expect(largerVolume.kind).toBe("ok");
    if (
      lettuce.kind === "ok" &&
      tomato.kind === "ok" &&
      higherTarget.kind === "ok" &&
      largerVolume.kind === "ok"
    ) {
      expect(lettuce.range).not.toEqual(tomato.range);
      expect(higherTarget.doses[0]?.amount).not.toBe(lettuce.doses[0]?.amount);
      expect(largerVolume.doses[0]?.amount).not.toBe(lettuce.doses[0]?.amount);
    }
  });

  it("explains when a correction dose would overflow the actual reservoir", () => {
    const observation = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4", gro: "3", bloom: "2" },
    });
    expect(observation.ok).toBe(true);
    const result = calculateGardenResult({
      language: "es",
      mode: "adjust",
      crops: { "bibb-lettuce": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: 0.8,
      currentLiters: 4,
      capacityLiters: 4,
      waterAdded: null,
      userTarget: 1.2,
      round: 1,
      correctionFraction: 0.5,
      calibrationObservations: [observation.value!],
      reservoirMixConfirmed: true,
    });
    expect(result.kind).toBe("needs");
    if (result.kind === "needs") expect(result.message).toContain("superaría la capacidad");
  });

  it("keeps unsupported AeroGarden states explicit instead of interpolating", () => {
    const result = calculateGardenResult({
      mode: "recipe",
      crops: { "genovese-basil": 1 },
      liters: 2,
      productId: "aerogarden",
      stageId: "w1",
      pods: 10,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(result.kind).toBe("needs");
    if (result.kind === "needs") expect(result.message).toContain("will not interpolate");
  });

  it("explains that GH EC dosing uses the measured mixture, not necessarily the official ratio", () => {
    const observation = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4", gro: "3", bloom: "2" },
    });
    expect(observation.ok).toBe(true);
    const input = {
      language: "en" as const,
      crops: { "bibb-lettuce": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: 0.7,
      currentLiters: 2,
      capacityLiters: 4,
      waterAdded: 1,
      userTarget: 1.2,
      round: 1,
      calibrationObservations: [observation.value!],
      reservoirMixConfirmed: true,
    };
    for (const mode of ["target", "adjust", "topup"] as const) {
      const result = calculateGardenResult({ ...input, mode });
      expect(result.kind).toBe("ok");
      if (result.kind === "ok") {
        expect(result.warnings?.join(" ")).toContain(
          "Component proportions follow your actual calibration mixture",
        );
        expect(
          result.doses.find((part) => part.label === "FloraMicro")!.amount /
            result.doses.find((part) => part.label === "FloraBloom")!.amount,
        ).toBeCloseTo(2);
      }
    }
    const official = calculateGardenResult({ ...input, mode: "recipe" });
    if (official.kind === "ok")
      expect(official.warnings?.join(" ")).not.toContain("Component proportions follow");
  });

  it("requires measured AeroGarden calibration and uses it for EC-based workflows", () => {
    const base = {
      crops: { "genovese-basil": 1 },
      liters: 4,
      productId: "aerogarden",
      stageId: "feeding-1",
      pods: 6,
      sourceEc: 0.2,
      currentEc: 0.8,
      currentLiters: 3,
      capacityLiters: 5,
      waterAdded: 0.5,
      userTarget: 1.2,
      round: 1,
      reservoirMixConfirmed: true,
    };
    const uncalibrated = calculateGardenResult({ ...base, mode: "target" });
    expect(uncalibrated.kind).toBe("needs");
    if (uncalibrated.kind === "needs") expect(uncalibrated.calibrationRequired).toBe(true);
    const observation = recordActualDoses({
      productId: "aerogarden",
      stageId: "feeding-1",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { single: "4" },
    });
    expect(observation.ok).toBe(true);
    for (const mode of ["target", "adjust", "topup"] as const) {
      const result = calculateGardenResult({
        ...base,
        mode,
        calibrationObservations: [observation.value!],
      });
      expect(result.kind).toBe("ok");
      if (result.kind === "ok")
        expect(
          result.doses.some((dose) => dose.label === "Liquid Plant Food" && dose.amount > 0),
        ).toBe(true);
    }
  });

  it("reuses a single-component AeroGarden calibration across verified feedings while preserving old records", () => {
    const observation = recordActualDoses({
      productId: "aerogarden",
      stageId: "feeding-1",
      liters: 4,
      pods: 9,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { single: "4" },
    }).value!;
    const legacy = {
      ...observation,
      recipeContextSignature: "single:8",
      componentRatioOrRecipeSignature: observation.componentRatioOrRecipeSignature.replace(
        "single:1;",
        "single:8;",
      ),
    };
    const originalSignature = legacy.componentRatioOrRecipeSignature;
    const input = {
      crops: { "genovese-basil": 1 },
      liters: 4,
      productId: "aerogarden",
      stageId: "feeding-3",
      pods: 12,
      sourceEc: 0.2,
      currentEc: 0.8,
      currentLiters: 3,
      capacityLiters: 5,
      waterAdded: 0.5,
      userTarget: 1.2,
      round: 1,
      calibrationObservations: [legacy],
      reservoirMixConfirmed: true,
    };
    expect(calibrationUsage(input)).toEqual({ used: 1, recorded: 1 });
    for (const mode of ["target", "adjust", "topup"] as const) {
      const result = calculateGardenResult({ ...input, mode });
      expect(result.kind).toBe("ok");
      if (result.kind === "ok")
        expect(result.doses.some((dose) => dose.amount > 0 && dose.unit === "mL")).toBe(true);
    }
    expect(legacy.componentRatioOrRecipeSignature).toBe(originalSignature);
    const otherProduct = {
      ...legacy,
      productIdentity: { ...legacy.productIdentity, formulationVersion: "other" },
      formulationVersion: "other",
    };
    expect(calibrationUsage({ ...input, calibrationObservations: [otherProduct] }).used).toBe(0);
  });

  it("differentiates supported AeroGarden feeding events without asking for volume", () => {
    const run = (stageId: string) =>
      calculateGardenResult({
        mode: "recipe",
        crops: { "genovese-basil": 1 },
        liters: 2,
        productId: "aerogarden",
        stageId,
        pods: 9,
        sourceEc: 0.2,
        currentEc: null,
        currentLiters: null,
        waterAdded: null,
        userTarget: null,
        round: 1,
      });
    const first = run("feeding-1");
    const second = run("feeding-2");
    const later = run("feeding-3");
    expect(first.kind).toBe("ok");
    expect(second.kind).toBe("ok");
    expect(later.kind).toBe("ok");
    if (first.kind === "ok" && second.kind === "ok" && later.kind === "ok") {
      expect(first.doses[0]?.amount).toBe(8);
      expect(second.doses[0]?.amount).toBe(8);
      expect(later.doses[0]?.amount).toBe(12);
    }
  });

  it("keeps unsupported canonical crops insufficient for crop-derived By EC", () => {
    const result = calculateGardenResult({
      mode: "target",
      crops: { epazote: 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    });
    expect(result.kind).toBe("needs");
    if (result.kind === "needs") expect(result.evidence).toBe("insufficient");
  });

  it("captures actual component doses through the engine calibration contract", () => {
    const result = recordActualDoses({
      productId: "gh-flora",
      stageId: "w3",
      liters: 2,
      pods: 6,
      baselineEc: 0.4,
      resultingEc: 0.8,
      actualDoses: { micro: "4.8", gro: "4.0", bloom: "3.2" },
    });
    expect(result.ok).toBe(true);
    expect(result.value?.doseAppliedMl).toBe(12);
  });

  it("does not invent canonical saved systems for the transplanted dock", () => {
    expect(loadSavedSystems()).toEqual([]);
  });

  it("resolves Bull's Blood through explicitly identified beetroot guidance", () => {
    expect(resolveNutrientCropIdentity("bulls-blood-beet")).toBe("beetroot");
    expect(hasApplicableCropNutrientEvidence("bulls-blood-beet")).toBe(true);
    const context = contextFor({ "bulls-blood-beet": 1 }, "gh-flora")[0]!;
    const result = selectCropRange(context).ec;
    expect(result.ec).toEqual({ min: 1.4, max: 2.4, unit: "mS/cm" });
    expect(result.observations[0]?.source.id).toBe("hydrocrop-hydrosol-crop-ec-guide");
    const observation = recordActualDoses({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      baselineEc: 0.2,
      resultingEc: 1,
      actualDoses: { micro: "4", gro: "3", bloom: "2" },
    });
    expect(observation.ok).toBe(true);
    const calculated = calculateGardenResult({
      language: "en",
      mode: "target",
      crops: { "bulls-blood-beet": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
      calibrationObservations: [observation.value!],
    });
    expect(calculated.kind).toBe("ok");
    if (calculated.kind === "ok") {
      expect(calculated.doses.length).toBe(3);
      expect(calculated.target?.value).toBeGreaterThan(1.4);
    }
  });

  it("warns when dosing equipment precision is unknown rather than assuming a resolution", () => {
    const input = {
      mode: "recipe" as const,
      crops: { "bibb-lettuce": 1 },
      liters: 4,
      productId: "gh-flora",
      stageId: "feeding-2",
      pods: 6,
      sourceEc: 0.2,
      currentEc: null,
      currentLiters: null,
      waterAdded: null,
      userTarget: null,
      round: 1,
    };
    const unknown = calculateGardenResult({ ...input, language: "en" });
    const known = calculateGardenResult({ ...input, language: "en", dosingResolutionMl: 0.1 });
    expect(unknown.kind).toBe("ok");
    expect(known.kind).toBe("ok");
    if (unknown.kind === "ok" && known.kind === "ok") {
      expect(unknown.warnings?.join(" ")).toContain("Dosing equipment resolution is unknown");
      expect(known.warnings?.join(" ")).not.toContain("Dosing equipment resolution is unknown");
    }
  });

  it("persists and restores local saved-system configuration without a canonical write", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    const saved = {
      id: "local-test-system",
      name: "Test system",
      crops: { "genovese-basil": 2 },
      liters: 4,
      productId: "gh-flora",
      water: { label: { es: "Grifo", en: "Tap" }, ec: 0.2 },
      meter: "Pocket meter",
      stageId: "feeding-2",
      pods: 6,
      unit: "mS" as const,
      calibrationObservations: [],
      mode: "target" as const,
      userTarget: 1,
      currentEc: 0.8,
      currentLiters: 3,
      waterAdded: 1,
      dosingResolutionMl: 0.1,
      meterResolutionMs: 0.01,
      capacityLiters: 8,
      sourceEcKnown: true,
    };
    persistSavedSystems([saved]);
    expect(loadSavedSystems()).toEqual([saved]);
    const { dosingResolutionMl: _resolution, ...withoutResolution } = saved;
    persistSavedSystems([withoutResolution]);
    expect(loadSavedSystems()[0]?.dosingResolutionMl).toBeUndefined();
    const { sourceEcKnown: _known, ...legacySystem } = withoutResolution;
    persistSavedSystems([legacySystem]);
    expect(loadSavedSystems()[0]?.sourceEcKnown).toBe(false);
    vi.unstubAllGlobals();
  });
});
