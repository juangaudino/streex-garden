import { describe, expect, it, vi } from "vitest";

import {
  AEROGARDEN_RECIPE,
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
} from "@/lib/garden-nutrient-engine-v1/engine";
import { donorPlants } from "./canonical-adapter";
import { MODE_TO_ENGINE, recipeSignature } from "./calculator-v1-adapter";
import {
  CALCULATOR_PLANTS,
  CALCULATOR_EXCLUDED_CARNIVOROUS_IDS,
  CALCULATOR_PRODUCTS,
  CALCULATOR_STAGES,
  buildCropEvidenceCoverage,
  calculateGardenResult,
  calibrationUsage,
  contextFor,
  generalCropReferenceForStage,
  hasApplicableCropNutrientEvidence,
  loadSavedSystems,
  persistSavedSystems,
  recipeStageLabel,
  recordActualDoses,
  resolveNutrientCropIdentity,
} from "./calculator-lovable-adapter";

describe("Gardenpedia Calculator V1 integration", () => {
  it("links every crop study to a selectable public identity", () => {
    const ids = new Set(CALCULATOR_PLANTS.map((plant) => plant.id));
    for (const reference of CROP_STUDY_REFERENCES)
      for (const id of reference.plantIds)
        expect(ids.has(id), `${reference.source.id}: ${id}`).toBe(true);
  });
  it("shows tower-specific guidance without applying it as a general crop target", () => {
    for (const id of ["dill-bouquet", "astro-arugula", "purple-kohlrabi"]) {
      expect(CROP_STUDY_REFERENCES.some((study) =>
        study.source.id === "idroponica-facile-home-tower-guide" &&
        study.plantIds.some((plantId: string) => plantId === id),
      )).toBe(true);
      expect(hasApplicableCropNutrientEvidence(id)).toBe(false);
    }
  });
  it("does not reuse common chive evidence for the distinct garlic chive species", () => {
    expect(resolveNutrientCropIdentity("garlic-chives")).toBeUndefined();
    expect(hasApplicableCropNutrientEvidence("garlic-chives")).toBe(false);
    expect(
      CROP_STUDY_REFERENCES.some(
        (study) =>
          study.plantIds.some((id: string) => id === "garlic-chives") &&
          study.source.id === "chinese-chive-hydroponic-salinity-2022",
      ),
    ).toBe(true);
  });
  it("keeps identity sources from becoming nutrient targets for unidentified or distinct crops", () => {
    for (const id of ["chamomile-unspecified", "mexican-tarragon"]) {
      expect(hasApplicableCropNutrientEvidence(id)).toBe(false);
      expect(
        CROP_STUDY_REFERENCES.some((study) =>
          study.plantIds.some((plantId: string) => plantId === id),
        ),
      ).toBe(true);
    }
  });
  it("makes named basil, butterhead, and species-unspecified chamomile identities selectable without inventing crop evidence", () => {
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
    for (const id of ["basil-lemon", "basil-lime", "chamomile-unspecified"]) {
      expect(resolveNutrientCropIdentity(id)).toBeUndefined();
      expect(hasApplicableCropNutrientEvidence(id)).toBe(false);
    }
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
    expect(generalCropReferenceForStage("cascading-petunia", "SEEDLING", "DWC")).toBeUndefined();
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
    expect(invalid.kind).toBe("needs");
    if (invalid.kind === "needs")
      expect(invalid.message).toContain("more distinct stages than plants");
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
      crops: { "cascading-petunia": 1 },
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
    const fenugreekHasNutrientEvidence = hasApplicableCropNutrientEvidence(
      "common-fenugreek-trigonella-foenum-graecum",
    );
    expect(fenugreekHasNutrientEvidence).toBe(false);
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
    expect(report.rows).toHaveLength(donorPlants.length);
    expect(report.totals).toEqual({
      SUPPORTED_DIRECT: 8,
      SUPPORTED_VIA_DEFENSIBLE_MAPPING: 106,
      INSUFFICIENT: 393,
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
      "common-fenugreek-trigonella-foenum-graecum",
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
    expect(CALCULATOR_STAGES.map((stage) => stage.feedingIndex)).toEqual([1, 2, 4, 5, 7, 10, 12]);
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
  });

  it("keeps an unmapped published identity insufficient instead of guessing a crop", () => {
    const result = calculateGardenResult({
      mode: "recipe",
      crops: { "cascading-petunia": 1 },
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
    expect(seedlings.compatibility?.status).toBe("INSUFFICIENT");
    expect(seedlings.range).toBeUndefined();
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
      productId: "aerogarden", stageId: "feeding-1", liters: 4, pods: 9,
      baselineEc: 0.2, resultingEc: 1, actualDoses: { single: "4" },
    }).value!;
    const legacy = {
      ...observation,
      recipeContextSignature: "single:8",
      componentRatioOrRecipeSignature: observation.componentRatioOrRecipeSignature.replace("single:1;", "single:8;"),
    };
    const originalSignature = legacy.componentRatioOrRecipeSignature;
    const input = {
      crops: { "genovese-basil": 1 }, liters: 4, productId: "aerogarden",
      stageId: "feeding-3", pods: 12, sourceEc: 0.2, currentEc: 0.8,
      currentLiters: 3, capacityLiters: 5, waterAdded: 0.5, userTarget: 1.2,
      round: 1, calibrationObservations: [legacy],
    };
    expect(calibrationUsage(input)).toEqual({ used: 1, recorded: 1 });
    for (const mode of ["target", "adjust", "topup"] as const) {
      const result = calculateGardenResult({ ...input, mode });
      expect(result.kind).toBe("ok");
      if (result.kind === "ok") expect(result.doses.some((dose) => dose.amount > 0 && dose.unit === "mL")).toBe(true);
    }
    expect(legacy.componentRatioOrRecipeSignature).toBe(originalSignature);
    const otherProduct = { ...legacy, productIdentity: { ...legacy.productIdentity, formulationVersion: "other" }, formulationVersion: "other" };
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
      crops: { "cascading-petunia": 1 },
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
      capacityLiters: 8,
      sourceEcKnown: true,
    };
    persistSavedSystems([saved]);
    expect(loadSavedSystems()).toEqual([saved]);
    vi.unstubAllGlobals();
  });
});
