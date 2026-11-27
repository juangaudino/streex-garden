import {
  buildCalibrationModel,
  calculateEcCorrection,
  calculateFreshTargetEcDose,
  calculateFreshTargetEc,
  calculatePolycultureRange,
  calculateTopUpMaintenance,
  calculateTopUpToCapacity,
  executeFreshRecipe,
  learnFromObservation,
  selectCropRange,
  sameProductIdentity,
} from "@/lib/garden-nutrient-engine-v1/engine";
import {
  CROP_EVIDENCE,
  CROP_STAGE_REFERENCES,
  MANUFACTURER_RECIPES,
  NUTRIENT_SOURCES,
} from "@/lib/garden-nutrient-engine-v1/data";
import {
  buildDonorPlantDetail,
  canonicalEntries,
  donorPlants,
  donorPlantsById,
  type DonorGuideSection,
} from "./canonical-adapter";
import type { DonorPlant } from "./canonical-adapter";
import type {
  CalibrationObservation,
  CalibrationModel,
  Claim,
  CropContext,
  EngineResult,
  EvidenceState,
  HydroponicSystem,
  MeasurementScope,
  UserMeasurement,
} from "@/lib/garden-nutrient-engine-v1/types";
import { gardenSeedTransitionReferences } from "@/generated/garden-seed-transition-index";

export type Lang = "es" | "en";
export type Mode = "recipe" | "target" | "adjust" | "topup";
export type Provenance = "official" | "garden" | "measured" | "user";
export type Evidence = Lowercase<EvidenceState>;
export type EcUnit = "mS" | "uS";
export type CalculatorCropStage =
  "UNSPECIFIED" | "SEEDLING" | "VEGETATIVE" | "MATURE" | "FLOWERING" | "FRUITING" | "MIXED";
export type CalculatorAdditionalStage = Exclude<CalculatorCropStage, "UNSPECIFIED" | "MIXED">;

export function replaceAdditionalCohortStage(
  primaryStage: CalculatorCropStage,
  additionalStages: CalculatorAdditionalStage[],
  cohortStage: CalculatorAdditionalStage,
  suggestedStage: CalculatorAdditionalStage,
):
  { primaryStage: CalculatorCropStage; additionalStages: CalculatorAdditionalStage[] } | undefined {
  if (suggestedStage === cohortStage) return undefined;
  if (primaryStage !== "MIXED" && suggestedStage === primaryStage) return undefined;

  const nextStages = new Set(
    additionalStages.filter((stage) => stage !== cohortStage && stage !== primaryStage),
  );
  nextStages.add(suggestedStage);
  const orderedStages = [...nextStages];

  if (primaryStage !== "MIXED") {
    return { primaryStage, additionalStages: orderedStages };
  }

  if (orderedStages.length > 1) {
    return { primaryStage: "MIXED", additionalStages: orderedStages };
  }

  return { primaryStage: orderedStages[0]!, additionalStages: [] };
}

export type CalculatorPlant = {
  id: string;
  emoji: string;
  name: Record<Lang, string>;
  scientificName: string;
  cultivar: string | null;
  aliases: readonly string[];
};

export type CalculatorProduct = {
  id: string;
  name: string;
  basis: "liters" | "pods";
  parts: { id: string; label: string }[];
  hasRecipeStages?: boolean | undefined;
  recipeId?: string | undefined;
  recipeStages: CalculatorStage[];
  recipeSchedules?: readonly CalculatorRecipeSchedule[] | undefined;
  podGroups?: readonly number[] | undefined;
  available: boolean;
};

export type CalculatorStage = {
  id: string;
  feedingIndex: number | undefined;
  scheduleId?: string | undefined;
  label: Record<Lang, string>;
};

export type CalculatorRecipeSchedule = {
  id: string;
  label: Record<Lang, string>;
  context: Record<Lang, string>;
};

export type CalculatorStageGuidance = Pick<
  DonorGuideSection,
  "id" | "title" | "body" | "backing" | "confidence" | "sources"
> & { scopeNote?: Record<Lang, string> | undefined };

export type CalculatorSeedTransitionReference = {
  short: { en: string; es: string };
  guidance: { en: string; es: string };
  sources: readonly { id: string; title: string; url: string }[];
};

export const CALCULATOR_PLANTS: CalculatorPlant[] = donorPlants.map((plant) => ({
  id: plant.id,
  emoji: plant.emoji,
  name: { es: plant.spanishName, en: plant.name },
  scientificName: plant.scientificName,
  cultivar: plant.variety,
  aliases: plant.tags,
}));

const CALCULATOR_SEARCH_STOP_WORDS = new Set(["common", "mixed", "plant", "type", "variety"]);

function normalizeCalculatorSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/×/g, " x ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

type CalculatorPlantSearchEntry = {
  plant: CalculatorPlant;
  normalizedFields: string[];
  corpus: string;
  displayNames: Record<Lang, string>;
};

let calculatorPlantSearchIndex: CalculatorPlantSearchEntry[] | undefined;

function getCalculatorPlantSearchIndex(): CalculatorPlantSearchEntry[] {
  if (!calculatorPlantSearchIndex) {
    calculatorPlantSearchIndex = CALCULATOR_PLANTS.filter(
      (plant) => !CALCULATOR_EXCLUDED_CARNIVOROUS_IDS.has(plant.id),
    ).map((plant) => {
      const normalizedFields = [
        plant.id,
        plant.name.en,
        plant.name.es,
        plant.scientificName,
        plant.cultivar ?? "",
        ...plant.aliases,
      ]
        .map(normalizeCalculatorSearch)
        .filter(Boolean);
      return {
        plant,
        normalizedFields,
        corpus: normalizedFields.join(" "),
        displayNames: {
          en: normalizeCalculatorSearch(plant.name.en),
          es: normalizeCalculatorSearch(plant.name.es),
        },
      };
    });
  }
  return calculatorPlantSearchIndex;
}

/**
 * Search public canonical identities without resolving a crop by name. Query
 * words may match across display name, scientific name, cultivar and tags;
 * results remain explicit identities for the user to choose.
 */
export function searchCalculatorPlants(query: string, language: Lang): CalculatorPlant[] {
  const normalizedQuery = normalizeCalculatorSearch(query);
  const groups = query
    .split("/")
    .map((group) =>
      normalizeCalculatorSearch(group)
        .split(" ")
        .filter((word) => !CALCULATOR_SEARCH_STOP_WORDS.has(word)),
    )
    .filter((words) => words.length > 0);
  const searchable = getCalculatorPlantSearchIndex();
  if (!normalizedQuery) return searchable.map(({ plant }) => plant);

  const matches = searchable.flatMap((plant) => {
    const { plant: identity, normalizedFields, corpus, displayNames } = plant;
    const normalizedDisplayName = displayNames[language];
    const exactDisplayName = normalizedDisplayName === normalizedQuery;
    const exactField = normalizedFields.includes(normalizedQuery);
    const queryTokens = groups.flat();
    const matchedTokens = queryTokens.filter((word) => corpus.includes(word));
    const matchedRatio = queryTokens.length ? matchedTokens.length / queryTokens.length : 0;
    const matchedGroup = groups.some(
      (words) => words.length >= 2 && words.every((word) => corpus.includes(word)),
    );
    const isSingleTermQuery = groups.length === 1 && groups[0]!.length === 1;
    if (
      !exactField &&
      !matchedGroup &&
      !(isSingleTermQuery && matchedRatio === 1) &&
      matchedRatio < 0.67
    )
      return [];

    const score = exactDisplayName
      ? 0
      : normalizedDisplayName.startsWith(normalizedQuery)
        ? 1
        : exactField
          ? 2
          : matchedRatio === 1
            ? 3
            : 4;
    return [{ plant: identity, score, matchedCount: matchedTokens.length }];
  });

  return matches
    .sort(
      (a, b) =>
        a.score - b.score ||
        b.matchedCount - a.matchedCount ||
        a.plant.name[language].localeCompare(b.plant.name[language]),
    )
    .map(({ plant }) => plant);
}

const STAGE_GUIDE_SECTIONS: Record<CalculatorCropStage, readonly string[]> = {
  UNSPECIFIED: ["growth", "flowering", "harvest", "germination"],
  SEEDLING: ["germination", "growth"],
  VEGETATIVE: ["growth", "hydroponics"],
  MATURE: ["growth", "harvest"],
  FLOWERING: ["flowering", "growth"],
  FRUITING: ["fruiting", "harvest", "growth"],
  MIXED: ["germination", "growth", "flowering", "harvest"],
};

const SAME_SPECIES_STAGE_GUIDANCE: Record<
  string,
  { profileId: string; scopeNote: Record<Lang, string> }
> = {
  "basil-dark-opal": {
    profileId: "genovese-basil",
    scopeNote: {
      es: "Pista general de Ocimum basilicum; no está validada específicamente para el cultivar Dark Opal.",
      en: "General Ocimum basilicum cue; not validated specifically for the Dark Opal cultivar.",
    },
  },
  "basil-spicy-globe": {
    profileId: "genovese-basil",
    scopeNote: {
      es: "Pista general de Ocimum basilicum; no está validada específicamente para Spicy Globe.",
      en: "General Ocimum basilicum cue; not validated specifically for Spicy Globe.",
    },
  },
  "butterhead-lettuce-unspecified": {
    profileId: "bibb-lettuce",
    scopeNote: {
      es: "Pista de Lactuca sativa tipo butterhead; no identifica un cultivar específico.",
      en: "Lactuca sativa butterhead-type cue; no specific cultivar is identified.",
    },
  },
};

function chamomileStageGuidance(
  language: Lang,
  stage: CalculatorCropStage,
): CalculatorStageGuidance[] {
  if (stage === "SEEDLING")
    return [
      {
        id: "germination",
        title: language === "es" ? "Germinación y plántula" : "Germination and seedlings",
        body:
          language === "es"
            ? "La RHS indica que la manzanilla común y la alemana pueden cultivarse desde semilla; sus semillas necesitan luz para germinar. Trasplanta las plántulas cuando sean suficientemente grandes para manipularlas. La ficha de Gardenpedia no identifica cuál de esas especies tienes."
            : "The RHS says both common and German chamomile can be grown from seed and need light to germinate. Transplant seedlings once they are large enough to handle. Gardenpedia has not identified which of those species you have.",
        backing: "source",
        confidence: "media",
        sources: [
          {
            label: `${NUTRIENT_SOURCES.rhsChamomileCultivation.publisher} · ${NUTRIENT_SOURCES.rhsChamomileCultivation.title}`,
            url: NUTRIENT_SOURCES.rhsChamomileCultivation.url,
          },
        ],
        scopeNote: {
          es: "Orientación de cultivo para manzanilla común y alemana; no identifica tu especie ni establece EC hidropónico.",
          en: "Cultivation guidance for common and German chamomile; it does not identify your species or establish hydroponic EC.",
        },
      },
    ];

  if (stage === "FLOWERING" || stage === "FRUITING")
    return [
      {
        id: "flowering",
        title: language === "es" ? "Floración" : "Flowering",
        body:
          language === "es"
            ? "La RHS señala que la manzanilla común y la alemana pueden empezar a florecer en tan solo diez semanas; el momento cambia con las condiciones. Comprueba las flores visibles y no uses esa edad para cambiar la etapa o el EC automáticamente."
            : "The RHS notes that common and German chamomile may begin flowering in as little as ten weeks; timing varies with conditions. Confirm visible flowers and do not use that age to change stage or EC automatically.",
        backing: "source",
        confidence: "media",
        sources: [
          {
            label: `${NUTRIENT_SOURCES.rhsChamomileCultivation.publisher} · ${NUTRIENT_SOURCES.rhsChamomileCultivation.title}`,
            url: NUTRIENT_SOURCES.rhsChamomileCultivation.url,
          },
        ],
        scopeNote: {
          es: "Referencia temporal de manzanilla común y alemana; la especie de tu ficha sigue sin identificar.",
          en: "Timing reference for common and German chamomile; the species in your profile remains unidentified.",
        },
      },
    ];

  return [
    {
      id: "germination",
      title: language === "es" ? "Cultivo desde semilla" : "Growing from seed",
      body:
        language === "es"
          ? "La RHS indica que la manzanilla común y la alemana pueden cultivarse desde semilla; germinan con luz y las plántulas se trasplantan cuando se pueden manipular. También señala que pueden empezar a florecer en tan solo diez semanas, según las condiciones."
          : "The RHS says both common and German chamomile can be grown from seed; they germinate with light and seedlings are transplanted once large enough to handle. They may begin flowering in as little as ten weeks, depending on conditions.",
      backing: "source",
      confidence: "media",
      sources: [
        {
          label: `${NUTRIENT_SOURCES.rhsChamomileCultivation.publisher} · ${NUTRIENT_SOURCES.rhsChamomileCultivation.title}`,
          url: NUTRIENT_SOURCES.rhsChamomileCultivation.url,
        },
      ],
      scopeNote: {
        es: "Orientación general para manzanilla común y alemana; la ficha no resuelve la especie y esto no establece EC hidropónico.",
        en: "General guidance for common and German chamomile; the profile does not resolve the species and this does not establish hydroponic EC.",
      },
    },
  ];
}

/**
 * Returns existing public Plant Profile context to help a grower identify an
 * observed stage. These editorial cues do not infer stage from age or change
 * the Calculator's evidence selection or dose.
 */
export function calculatorStageGuidanceForPlant(
  plantId: string,
  language: Lang,
  stage: CalculatorCropStage,
): CalculatorStageGuidance[] {
  if (plantId === "chamomile-unspecified") return chamomileStageGuidance(language, stage);
  const mapped = SAME_SPECIES_STAGE_GUIDANCE[plantId];
  const entry = canonicalEntries.find(
    (candidate) => candidate.libraryPlantId === (mapped?.profileId ?? plantId),
  );
  if (!entry) return [];
  const guides = buildDonorPlantDetail(entry, language).guides;
  const byId = new Map(guides.map((guide) => [guide.id, guide]));
  return STAGE_GUIDE_SECTIONS[stage]
    .map((id) => byId.get(id))
    .filter((guide): guide is DonorGuideSection => Boolean(guide && (guide.body || guide.subtitle)))
    .slice(0, 2)
    .map(({ id, title, body, backing, confidence, sources }) => ({
      id,
      title,
      body,
      backing,
      confidence,
      sources,
      ...(mapped ? { scopeNote: mapped.scopeNote } : {}),
    }));
}

/** Returns only the reviewed stage reference explicitly mapped to this identity. */
export function calculatorStageReferenceForPlant(plantId: string) {
  const exactReferences = CROP_STAGE_REFERENCES.filter(
    (item) =>
      item.cropIdentity === plantId ||
      ("plantIds" in item && (item.plantIds as readonly string[]).includes(plantId)),
  );
  const cropIdentity = resolveNutrientCropIdentity(plantId);
  const mappedReferences = cropIdentity
    ? CROP_STAGE_REFERENCES.filter((item) => item.cropIdentity === cropIdentity)
    : [];
  const references = [...new Set([...exactReferences, ...mappedReferences])];
  return (
    references.find((item) => !("ageWindows" in item)) ?? exactReferences[0] ?? mappedReferences[0]
  );
}

/**
 * Returns a public, source-backed Seed Profile transition cue for an exact
 * canonical identity. It is observational context only, never an age-to-stage
 * rule or nutrient target.
 */
export function calculatorSeedTransitionForPlant(
  plantId: string,
): CalculatorSeedTransitionReference | undefined {
  return gardenSeedTransitionReferences[plantId as keyof typeof gardenSeedTransitionReferences];
}

/**
 * Returns a source-backed age cue for the selected canonical plant identity.
 * The caller must ask the user to confirm morphology before applying the stage.
 */
export function calculatorAgeStageCueForPlant(plantId: string, ageDays: number) {
  if (!Number.isFinite(ageDays) || ageDays < 0) return undefined;
  const exactAgeReferences = CROP_STAGE_REFERENCES.filter(
    (item) =>
      (item.cropIdentity === plantId ||
        ("plantIds" in item && (item.plantIds as readonly string[]).includes(plantId))) &&
      "ageWindows" in item,
  );
  const resolvedCropIdentity = resolveNutrientCropIdentity(plantId);
  const cropAgeReferences = resolvedCropIdentity
    ? CROP_STAGE_REFERENCES.filter(
        (item) => item.cropIdentity === resolvedCropIdentity && "ageWindows" in item,
      )
    : [];
  const candidates = [...new Set([...exactAgeReferences, ...cropAgeReferences])];
  for (const reference of candidates) {
    if (!("ageWindows" in reference)) continue;
    const ageWindow = reference.ageWindows.find(
      (window) => ageDays >= window.minDays && ageDays <= window.maxDays,
    );
    if (ageWindow) return { reference, ageWindow };
  }
  return undefined;
}

/** Carnivorous plant profiles stay in Gardenpedia, but are not nutrient recipe inputs. */
export const CALCULATOR_EXCLUDED_CARNIVOROUS_IDS = new Set([
  "alice-sundew-drosera-aliciae",
  "cape-sundew-drosera-capensis",
  "nepenthes-x-ventrata",
  "pinguicula-lilac-lollipop",
  "pinguicula-primuliflora",
  "pinguicula-weser",
  "purple-pitcher-plant-sarracenia-purpurea",
  "venus-flytrap-dionaea-muscipula",
]);

function spanishRecipeLabel(label: string): string {
  return label
    .replace("Grow week", "Grow · Semana")
    .replace("Bloom week", "Bloom · Semana")
    .replace(" / ", " · ")
    .replace("Seedling-Clone", "Plántula/Clon")
    .replace("Early Growth", "Crecimiento temprano")
    .replace("Late Growth", "Crecimiento tardío")
    .replace("Early Bloom", "Floración temprana")
    .replace("Mid Bloom", "Floración media")
    .replace("Late Bloom", "Floración tardía")
    .replace("Ripen", "Maduración")
    .replace("Flush (water only)", "Enjuague (solo agua)")
    .replace("6-pod Harvest feeding", "Alimentación Harvest · 6 pods")
    .replace("9-pod Bounty first or second feeding", "Alimentación Bounty 1/2 · 9 pods")
    .replace("9-pod Bounty later feeding", "Alimentación Bounty posterior · 9 pods");
}

const FLORA_RECIPE_ID = "general-hydroponics-floraseries-3part-2026-07-07";
const AEROGARDEN_RECIPE_ID = "aerogarden-liquid-plant-food-4-3-6";

export const FLORA_RECIPE_SCHEDULES: readonly CalculatorRecipeSchedule[] = [
  {
    id: "LIGHT_FEED",
    label: { es: "Light Feed", en: "Light Feed" },
    context: { es: "Riego frecuente · secado rápido", en: "High irrigation · fast dryback" },
  },
  {
    id: "MEDIUM_FEED",
    label: { es: "Medium Feed", en: "Medium Feed" },
    context: { es: "Uso general", en: "General use" },
  },
  {
    id: "AGGRESSIVE_FEED",
    label: { es: "Aggressive Feed", en: "Aggressive Feed" },
    context: { es: "Riego bajo · alimentación intensa", en: "Low irrigation · heavy feeding" },
  },
];

function projectRecipeStages(recipeId: string): CalculatorStage[] {
  const recipe = MANUFACTURER_RECIPES.find((item) => item.id === recipeId);
  const seenFeedingIndexes = new Set<number>();
  return (recipe?.steps ?? [])
    .filter((step) => {
      if (recipeId !== AEROGARDEN_RECIPE_ID || step.feedingIndex === undefined) return true;
      if (seenFeedingIndexes.has(step.feedingIndex)) return false;
      seenFeedingIndexes.add(step.feedingIndex);
      return true;
    })
    .map((step) => ({
      id:
        recipeId === FLORA_RECIPE_ID && step.scheduleId !== "LIGHT_FEED"
          ? `${step.scheduleId?.toLowerCase()}-feeding-${step.feedingIndex ?? step.label}`
          : `feeding-${step.feedingIndex ?? step.label}`,
      feedingIndex: step.feedingIndex,
      scheduleId: step.scheduleId,
      label: {
        es:
          recipeId === AEROGARDEN_RECIPE_ID
            ? step.feedingIndex === 1
              ? "Primera alimentación · Bounty · 9 pods"
              : step.feedingIndex === 2
                ? "Segunda alimentación · Bounty · 9 pods"
                : "Tercera y siguientes · Bounty · 9 pods"
            : spanishRecipeLabel(step.label),
        en:
          recipeId === AEROGARDEN_RECIPE_ID
            ? step.feedingIndex === 1
              ? "First feeding · Bounty · 9 pods"
              : step.feedingIndex === 2
                ? "Second feeding · Bounty · 9 pods"
                : "Third and later feedings · Bounty · 9 pods"
            : step.label,
      },
    }));
}

const FLORA_STAGES = projectRecipeStages(FLORA_RECIPE_ID);
const AEROGARDEN_STAGES = projectRecipeStages(AEROGARDEN_RECIPE_ID);

export function recipeStageLabel(
  stage: CalculatorStage,
  productId: string,
  pods: number,
  lang: Lang,
): string {
  if (productId !== "aerogarden") return stage.label[lang];
  if (stage.feedingIndex === 1 && (pods === 9 || pods === 12)) {
    return lang === "es" ? `Primera alimentación · ${pods} pods` : `First feeding · ${pods} pods`;
  }
  if (stage.feedingIndex === 2) {
    return lang === "es" ? `Segunda alimentación · ${pods} pods` : `Second feeding · ${pods} pods`;
  }
  if (stage.feedingIndex === 3) {
    return lang === "es"
      ? `Tercera y siguientes · ${pods} pods`
      : `Third and later feedings · ${pods} pods`;
  }
  return lang === "es" ? `En cada alimentación · ${pods} pods` : `At each feeding · ${pods} pods`;
}

export function manufacturerDoseDefaults(input: {
  productId: string;
  stageId: string;
  liters: number;
  pods: number;
}): { id: string; label: string; amount: number }[] {
  const recipeId = RECIPE_IDS[input.productId];
  if (!recipeId) return [];
  const stage = stageForId(input.stageId, input.productId);
  const recipe = executeFreshRecipe({
    recipeId,
    ...(input.productId === "aerogarden" ? { podCount: input.pods } : { volumeL: input.liters }),
    ...(stage?.feedingIndex === undefined ? {} : { feedingIndex: stage.feedingIndex }),
    ...(stage?.scheduleId ? { scheduleId: stage.scheduleId } : {}),
  });
  return recipe.ok && recipe.value
    ? recipe.value.parts.map((part) => ({
        id: part.componentId,
        label: part.label,
        amount: part.ml,
      }))
    : [];
}

export const CALCULATOR_PRODUCTS: CalculatorProduct[] = [
  {
    id: "gh-flora",
    name: "GH FloraSeries",
    basis: "liters",
    hasRecipeStages: true,
    recipeId: FLORA_RECIPE_ID,
    recipeStages: FLORA_STAGES,
    recipeSchedules: FLORA_RECIPE_SCHEDULES,
    available: true,
    parts: [
      { id: "micro", label: "FloraMicro" },
      { id: "gro", label: "FloraGro" },
      { id: "bloom", label: "FloraBloom" },
    ],
  },
  {
    id: "aerogarden",
    name: "AeroGarden Liquid Plant Food",
    basis: "pods",
    recipeId: AEROGARDEN_RECIPE_ID,
    hasRecipeStages: true,
    recipeStages: AEROGARDEN_STAGES,
    podGroups:
      MANUFACTURER_RECIPES.find((recipe) => recipe.id === AEROGARDEN_RECIPE_ID)?.podCountGroups ??
      [],
    available: true,
    parts: [{ id: "single", label: "Liquid Plant Food" }],
  },
  {
    id: "ab",
    name: "A + B",
    basis: "liters",
    available: true,
    recipeStages: [],
    parts: [
      { id: "a", label: "Parte A" },
      { id: "b", label: "Parte B" },
    ],
  },
];

export const CALCULATOR_STAGES = FLORA_STAGES;

export function recipeStagesForSchedule(
  productId: string,
  scheduleId?: string | undefined,
): CalculatorStage[] {
  const product = CALCULATOR_PRODUCTS.find((item) => item.id === productId);
  return (product?.recipeStages ?? CALCULATOR_STAGES).filter(
    (stage) => !stage.scheduleId || !scheduleId || stage.scheduleId === scheduleId,
  );
}

const STAGE_ALIASES: Record<string, string> = {
  w1: "feeding-1",
  w3: "feeding-2",
  w6: "feeding-4",
};

function stageForId(stageId: string, productId = "gh-flora") {
  const product = CALCULATOR_PRODUCTS.find((item) => item.id === productId);
  return (product?.recipeStages ?? CALCULATOR_STAGES).find(
    (item) => item.id === (STAGE_ALIASES[stageId] ?? stageId),
  );
}

export type SavedSystem = {
  id: string;
  name: string;
  crops: Record<string, number>;
  cropStages?: Record<string, CalculatorCropStage> | undefined;
  cropAdditionalStages?: Record<string, CalculatorAdditionalStage[]> | undefined;
  cropSowingAgeDays?: Record<string, string> | undefined;
  /** Age observations for distinct stage cohorts of the same crop in a shared reservoir. */
  cropStageSowingAgeDays?:
    Record<string, Partial<Record<CalculatorAdditionalStage, string>>> | undefined;
  hydroponicSystem?: HydroponicSystem | undefined;
  liters: number;
  productId: string;
  customAbManufacturer?: string | undefined;
  customAbName?: string | undefined;
  customAbVersion?: string | undefined;
  water: { label: Record<Lang, string>; ec: number };
  meter: string;
  stageId: string;
  pods: number;
  unit: EcUnit;
  calibrationObservations?: CalibrationObservation[] | undefined;
  calibration?: { learned: number; readings: number } | undefined;
  lastEc?: number | undefined;
  mode?: Mode | undefined;
  userTarget?: (number | null) | undefined;
  currentEc?: (number | null) | undefined;
  currentLiters?: (number | null) | undefined;
  capacityLiters?: number | null | undefined;
  waterAdded?: (number | null) | undefined;
  dosingResolutionMl?: number | undefined;
  meterResolutionMs?: number | undefined;
  correctionFraction?: number | undefined;
  sourceEcKnown?: boolean | undefined;
};

export const CALCULATOR_STORAGE_KEY = "gardenpedia.calculator.systems.v1";

export function loadSavedSystems(): SavedSystem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CALCULATOR_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Partial<SavedSystem> => Boolean(item && typeof item === "object"))
      .filter((item) => typeof item.id === "string" && typeof item.name === "string")
      .map((item) => ({
        id: item.id!,
        name: item.name!,
        crops: item.crops ?? {},
        ...(item.cropStages ? { cropStages: item.cropStages } : {}),
        ...(item.cropAdditionalStages ? { cropAdditionalStages: item.cropAdditionalStages } : {}),
        ...(item.cropSowingAgeDays ? { cropSowingAgeDays: item.cropSowingAgeDays } : {}),
        ...(item.cropStageSowingAgeDays
          ? { cropStageSowingAgeDays: item.cropStageSowingAgeDays }
          : {}),
        ...(item.hydroponicSystem ? { hydroponicSystem: item.hydroponicSystem } : {}),
        ...(item.correctionFraction !== undefined
          ? { correctionFraction: item.correctionFraction }
          : {}),
        liters: item.liters ?? 1,
        productId: item.productId ?? "gh-flora",
        ...(item.customAbManufacturer ? { customAbManufacturer: item.customAbManufacturer } : {}),
        ...(item.customAbName ? { customAbName: item.customAbName } : {}),
        ...(item.customAbVersion ? { customAbVersion: item.customAbVersion } : {}),
        water: item.water ?? { label: { es: "Agua de origen", en: "Source water" }, ec: 0 },
        meter: item.meter ?? "—",
        stageId: item.stageId ?? "feeding-2",
        pods: item.pods ?? 6,
        unit: item.unit === "uS" ? "uS" : "mS",
        calibrationObservations: item.calibrationObservations ?? [],
        calibration: item.calibration,
        lastEc: item.lastEc,
        mode: item.mode ?? "recipe",
        userTarget: item.userTarget ?? null,
        currentEc: item.currentEc ?? null,
        currentLiters: item.currentLiters ?? null,
        capacityLiters: item.capacityLiters ?? null,
        waterAdded: item.waterAdded ?? null,
        dosingResolutionMl: item.dosingResolutionMl,
        meterResolutionMs: item.meterResolutionMs,
        // Older saved systems did not record whether the displayed value was
        // measured; their zero/default cannot be treated as a measurement.
        sourceEcKnown: item.sourceEcKnown === true,
      }));
  } catch {
    return [];
  }
}

export function persistSavedSystems(systems: SavedSystem[]) {
  if (typeof window !== "undefined")
    window.localStorage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify(systems));
}

export type CalcInput = {
  language?: Lang | undefined;
  invalidFields?: string[] | undefined;
  mode: Mode;
  crops: Record<string, number>;
  cropStages?: Record<string, CalculatorCropStage> | undefined;
  cropAdditionalStages?: Record<string, CalculatorAdditionalStage[]> | undefined;
  hydroponicSystem?: HydroponicSystem | undefined;
  liters: number;
  productId: string;
  customAbManufacturer?: string | undefined;
  customAbName?: string | undefined;
  customAbVersion?: string | undefined;
  stageId: string;
  pods: number;
  sourceEc: number;
  sourceEcKnown?: boolean | undefined;
  currentEc: number | null;
  currentLiters: number | null;
  capacityLiters?: number | null | undefined;
  waterAdded: number | null;
  userTarget: number | null;
  round: number;
  calibrationObservations?: CalibrationObservation[] | undefined;
  dosingResolutionMl?: number | undefined;
  meterResolutionMs?: number | undefined;
  correctionFraction?: number | undefined;
  reservoirMixConfirmed?: boolean | undefined;
};

export type CalcResult =
  | {
      kind: "needs";
      missing: string[];
      message?: string | undefined;
      calibrationRequired?: boolean | undefined;
      mixtureConfirmationRequired?: boolean | undefined;
      target?: { value: number; provenance: Provenance } | undefined;
      range?:
        { min: number; max: number; common: boolean; limiting?: string | undefined } | undefined;
      evidence?: Evidence | undefined;
      evidenceNote?: Record<Lang, string> | undefined;
      outsideEvidence?: boolean | undefined;
      sources?: string[] | undefined;
      compatibility?: ReturnType<typeof calculatePolycultureRange> | undefined;
    }
  | {
      kind: "ok";
      provenance: Provenance;
      action: "add" | "dilute" | "hold";
      instruction?: string | undefined;
      doses: { label: string; amount: number; unit: "mL" | "L" }[];
      target?: { value: number; provenance: Provenance } | undefined;
      range?:
        { min: number; max: number; common: boolean; limiting?: string | undefined } | undefined;
      evidence: Evidence;
      evidenceNote: Record<Lang, string>;
      outsideEvidence?: boolean | undefined;
      sources: string[];
      compatibility?: ReturnType<typeof calculatePolycultureRange> | undefined;
      warnings?: string[] | undefined;
      expectedEc?:
        | { kind: "manufacturer"; min: number; max: number }
        | { kind: "calculated"; min: number; max: number }
        | undefined;
    };

const RECIPE_IDS = Object.fromEntries(
  CALCULATOR_PRODUCTS.filter((product) => product.recipeId).map((product) => [
    product.id,
    product.recipeId,
  ]),
) as Record<string, string | undefined>;

const NUTRIENT_IDENTITY_MAP: Record<string, string> = {
  // Bouquet is a cultivar of Anethum graveolens; the grower's guidance is
  // for dill generally, not a cultivar-specific measurement.
  "dill-bouquet": "dill",
  "curled-chervil": "chervil",
  "astro-arugula": "arugula",
  "garlic-chives": "garlic-chives",
  "sunflower-helianthus-annuus": "sunflower",
  "sunflower-american-giant-hybrid": "sunflower",
  "sunflower-autumn-beauty": "sunflower",
  "purple-kohlrabi": "kohlrabi",
  "bunching-onion-allium-fistulosum": "bunching-onion",
  "evergreen-bunching-onion-nabuka": "bunching-onion",
  "basil-lemon": "lemon-basil",
  "basil-lime": "lemon-basil",
  "tulsi-holy-basil-ocimum-tenuiflorum": "holy-basil",
  "cascading-petunia": "petunia",
  "petunia-dwarf-bedding-mixed": "petunia",
  // Exact Magic Fountains identity has stage timing context, but no applicable
  // reservoir EC evidence. This mapping must not imply nutrient support.
  "delphinium-magic-fountains-dwarf": "delphinium",
  "lavender-vera": "english-lavender",
  "resina-calendula": "calendula",
  "common-fenugreek-trigonella-foenum-graecum": "fenugreek",
  "borage-blue": "borage",
  // Bull's Blood is a beetroot cultivar; the supplier's EC guidance is
  // crop-level, not a cultivar-specific trial or a seedling recommendation.
  "bulls-blood-beet": "beetroot",
  "basil-dark-opal": "basil",
  "basil-spicy-globe": "basil",
  "butterhead-lettuce-unspecified": "lettuce",
  "scarlet-red-tatsoi": "tatsoi",
  // This catalog entry identifies miniature/spray D. caryophyllus, not a
  // confirmed cultivar or the identity of any particular purchased seed lot.
  "fragrant-dwarf-dianthus-mix": "carnation",
  "hon-tsai-tai": "flowering-choy-sum",
  // Perpetual Spinach is leaf beet / chard, not Spinacia oleracea.
  "perpetual-spinach": "chard",
  "common-mint": "mint",
  "cherry-belle-radish": "radish",
  "crimson-giant-radish": "radish",
  "french-breakfast-radish": "radish",
  "english-thyme": "thyme",
  "german-thyme": "thyme",
  "swiss-chard-rainbow": "chard",
  "kale-dwarf-blue-curled": "kale",
  "lacinato-kale": "kale",
  "redbor-kale": "kale",
  mizuna: "mizuna",
  "mizuna-red-streaks": "mizuna",
  "mustard-greens": "mustard-greens",
  "red-mustard-greens": "mustard-greens",
  "wasabina-mustard-greens": "mustard-greens",
  "greek-oregano": "oregano",
  "italian-oregano": "oregano",
  "common-chives": "chives",
  "peppermint-mentha-piperita": "mint",
  spearmint: "mint",
  "african-violet-streptocarpus-ionanthus": "african-violet",
  "golden-acre-cabbage": "cabbage",
  "red-acre-cabbage": "cabbage",
  "red-cabbage": "cabbage",
  "savoy-cabbage": "cabbage",
  "giant-musselburgh-leek": "leek",
  "king-richard-leek": "leek",
  "leek-american-flag": "leek",
  asparagus: "asparagus",
  "bok-choy": "pak-choi",
  "broccoli-calabrese": "broccoli",
  "purple-sprouting-broccoli": "broccoli",
  "waltham-29-broccoli": "broccoli",
  "bush-cucumber": "cucumber",
  "cucumber-marketmore": "cucumber",
  "gherkin-cucumber": "cucumber",
  "pickling-cucumber": "cucumber",
  "straight-eight-cucumber": "cucumber",
  "black-beauty-eggplant": "eggplant",
  "fairy-tale-f1-eggplant": "eggplant",
  "hansel-f1-eggplant": "eggplant",
  "patio-baby-f1-eggplant": "eggplant",
  "okra-abelmoschus-esculentus": "okra",
  rhubarb: "rhubarb",
  "dark-green-zucchini": "zucchini",
  "eight-ball-zucchini": "zucchini",
  "cinnamon-basil": "basil",
  "basil-ocimum-basilicum": "basil",
  "genovese-basil": "basil",
  "italian-large-leaf-basil": "basil",
  "purple-basil": "basil",
  "sweet-basil": "basil",
  "thai-basil": "basil",
  "bibb-lettuce": "lettuce",
  "breen-romaine-lettuce": "lettuce",
  "bronze-arrow-lettuce": "lettuce",
  "black-seeded-simpson": "lettuce",
  "buttercrunch-lettuce": "lettuce",
  "iceberg-lettuce": "lettuce",
  "green-salanova-lettuce": "lettuce",
  "little-gem-lettuce": "lettuce",
  "muir-lettuce": "lettuce",
  "oakleaf-lettuce": "lettuce",
  "pandero-romaine-lettuce": "lettuce",
  "parris-island-romaine": "lettuce",
  "red-romaine-lettuce": "lettuce",
  "red-sail-lettuce": "lettuce",
  "romaine-lettuce": "lettuce",
  "beefsteak-tomato": "tomato",
  "black-cherry-tomato": "tomato",
  "black-krim-tomato": "tomato",
  "celebrity-tomato": "tomato",
  "cherry-bomb-tomato": "tomato",
  "cherry-tomato": "tomato",
  "grape-tomato": "tomato",
  "large-red-cherry-tomato": "tomato",
  "patio-tomato": "tomato",
  "roma-tomato": "tomato",
  "san-marzano-tomato": "tomato",
  "sun-gold-tomato": "tomato",
  "sunrise-sauce-tomato": "tomato",
  "supersweet-100-tomato": "tomato",
  "tiny-tim-tomato": "tomato",
  "yellow-brandywine-tomato": "tomato",
  "yellow-pear-tomato": "tomato",
  "chinese-light-green-celery": "celery",
  "anaheim-pepper": "pepper",
  "ancho-pepper": "pepper",
  "banana-pepper": "pepper",
  "cayenne-pepper": "pepper",
  "cubanelle-pepper": "pepper",
  "habanero-pepper": "pepper",
  "jalapeno-pepper": "pepper",
  "mini-bell-pepper": "pepper",
  "mini-lunchbox-sweet-pepper": "pepper",
  "poblano-pepper": "pepper",
  "serrano-pepper": "pepper",
  "shishito-pepper": "pepper",
  "sweet-chocolate-pepper": "pepper",
  "monterey-strawberry": "strawberry",
  "baby-spinach": "spinach",
  "seaside-f1-spinach": "spinach",
  "flat-leaf-parsley": "parsley",
  "italian-giant-parsley": "parsley",
  "broadleaf-sage": "sage",
};

export type CropEvidenceCoverageClass =
  "SUPPORTED_DIRECT" | "SUPPORTED_VIA_DEFENSIBLE_MAPPING" | "INSUFFICIENT" | "NOT_APPLICABLE";

export type CropEvidenceCoverageRow = {
  plantId: string;
  classification: CropEvidenceCoverageClass;
  evidenceIdentity?: string | undefined;
};

export type CropEvidenceCoverageContext = {
  phenologicalStage?: CalculatorCropStage | undefined;
  hydroponicSystem?: HydroponicSystem | undefined;
};

export type CropEvidenceCoverageReport = {
  context: {
    phenologicalStage: CalculatorCropStage;
    hydroponicSystem: HydroponicSystem;
  };
  totals: Record<CropEvidenceCoverageClass, number>;
  rows: CropEvidenceCoverageRow[];
};

export function resolveNutrientCropIdentity(plantId: string): string | undefined {
  return NUTRIENT_IDENTITY_MAP[plantId];
}

/**
 * Whether this published identity has applicable crop-level EC evidence for
 * the embedded Plant Detail calculator. Unknown identities must not inherit
 * the legacy calculator's broad category defaults.
 */
export function hasApplicableCropNutrientEvidence(
  plantId: string,
  context: CropEvidenceCoverageContext = {},
): boolean {
  const result = calculatePolycultureRange(
    contextFor(
      { [plantId]: 1 },
      "gh-flora",
      context.phenologicalStage ? { [plantId]: context.phenologicalStage } : {},
      {},
      context.hydroponicSystem ?? "UNKNOWN",
    ),
    CROP_EVIDENCE,
  );
  return result.status !== "INSUFFICIENT";
}

/** General context only; never feeds the selected-stage target or dosing engine. */
export function generalCropReferenceForStage(
  plantId: string,
  stage: CalculatorCropStage,
  hydroponicSystem: HydroponicSystem,
) {
  if (stage === "UNSPECIFIED") return undefined;
  const context: CropContext = {
    cropIdentity: resolveNutrientCropIdentity(plantId) ?? plantId,
    phenologicalStage: "UNSPECIFIED",
    hydroponicSystem,
    measurementScope: "NUTRIENT_SOLUTION",
  };
  // A mixed cohort has no single phenological stage. Do not use Seedling as a
  // proxy: that can hide or mislabel a general reference for groups that do not
  // contain seedlings. General references remain contextual, never automatic.
  if (stage !== "MIXED" && selectCropRange({ ...context, phenologicalStage: stage }).ec.ec)
    return undefined;
  const reference = selectCropRange(context).ec;
  if (!reference.ec) return undefined;
  return { range: reference.ec, sources: reference.observations.map((item) => item.source) };
}

/**
 * Audits every published Gardenpedia identity against the explicit nutrient
 * evidence boundary. Unknown identities stay insufficient; no name matching
 * or category guessing is used here.
 */
export function buildCropEvidenceCoverage(
  context: CropEvidenceCoverageContext = {},
): CropEvidenceCoverageReport {
  const resolvedContext = {
    phenologicalStage: context.phenologicalStage ?? "UNSPECIFIED",
    hydroponicSystem: context.hydroponicSystem ?? "UNKNOWN",
  } satisfies CropEvidenceCoverageReport["context"];
  const rows = CALCULATOR_PLANTS.map(({ id }) => {
    const evidenceIdentity = resolveNutrientCropIdentity(id);
    const hasDirectEvidence = CROP_EVIDENCE.some((item) => item.cropIdentity === id);
    const hasApplicableEvidence = hasApplicableCropNutrientEvidence(id, resolvedContext);
    if (hasDirectEvidence && hasApplicableEvidence) {
      return { plantId: id, classification: "SUPPORTED_DIRECT" as const, evidenceIdentity: id };
    }
    if (!evidenceIdentity) return { plantId: id, classification: "INSUFFICIENT" as const };

    return !hasApplicableEvidence
      ? { plantId: id, classification: "INSUFFICIENT" as const, evidenceIdentity }
      : {
          plantId: id,
          classification: "SUPPORTED_VIA_DEFENSIBLE_MAPPING" as const,
          evidenceIdentity,
        };
  });
  const totals: Record<CropEvidenceCoverageClass, number> = {
    SUPPORTED_DIRECT: 0,
    SUPPORTED_VIA_DEFENSIBLE_MAPPING: 0,
    INSUFFICIENT: 0,
    NOT_APPLICABLE: 0,
  };
  for (const row of rows) totals[row.classification] += 1;
  return { context: resolvedContext, totals, rows };
}

export function calculatorPlantById(id: string): DonorPlant | undefined {
  return donorPlantsById.get(id);
}

export function calculatorSourceUrl(title: string): string | undefined {
  return Object.values(NUTRIENT_SOURCES).find((source) => source.title === title)?.url;
}

function evidenceLabel(state: EvidenceState): Evidence {
  return state.toLowerCase() as Evidence;
}

export function contextFor(
  crops: Record<string, number>,
  _productId: string,
  cropStages: Record<string, CalculatorCropStage> = {},
  cropAdditionalStages: Record<string, CalculatorAdditionalStage[]> = {},
  hydroponicSystem: HydroponicSystem = "UNKNOWN",
): CropContext[] {
  return Object.keys(crops).flatMap((id): CropContext[] =>
    [
      ...new Set([
        ...(cropStages[id] === "MIXED"
          ? (cropAdditionalStages[id] ?? [])
          : ([cropStages[id] ?? "UNSPECIFIED"] as const)),
        ...(cropStages[id] !== "MIXED" && crops[id]! > 1 ? (cropAdditionalStages[id] ?? []) : []),
      ]),
    ].map((stage) => ({
      cropIdentity: resolveNutrientCropIdentity(id) ?? id,
      // A manufacturer feeding step is not evidence of plant phenology.
      phenologicalStage: stage,
      hydroponicSystem,
      measurementScope: "NUTRIENT_SOLUTION",
    })),
  );
}

function noteFor(state: EvidenceState): Record<Lang, string> {
  const notes: Record<EvidenceState, Record<Lang, string>> = {
    HIGH: {
      es: "La evidencia aplicable es consistente y está respaldada por fuentes verificadas.",
      en: "Applicable evidence is consistent and backed by verified sources.",
    },
    MODERATE: {
      es: "La fuente ofrece una referencia general: la variedad, el producto y las condiciones pueden cambiar la respuesta. Observa tus plantas y vuelve a medir.",
      en: "The source provides general guidance: cultivar, product and conditions can change the response. Observe your plants and remeasure.",
    },
    LOW: {
      es: "La evidencia aplicable es limitada. Garden conserva la incertidumbre.",
      en: "Applicable evidence is limited. Garden preserves that uncertainty.",
    },
    CONFLICTING: {
      es: "Las observaciones comparables presentan conflicto material.",
      en: "Comparable observations contain a material conflict.",
    },
    INSUFFICIENT: {
      es: "No hay evidencia aplicable suficiente para afirmar un rango automático.",
      en: "There is not enough applicable evidence for an automatic range.",
    },
  };
  return notes[state];
}

function sourceTitles(claims: Claim[]): string[] {
  const ids = new Set(claims.flatMap((claim) => claim.sourceIds ?? []));
  return CROP_EVIDENCE.filter((item) => ids.has(item.source.id)).map((item) => item.source.title);
}

function rangeFor(contexts: CropContext[]) {
  const result = calculatePolycultureRange(contexts, CROP_EVIDENCE);
  if (result.status === "INSUFFICIENT") return undefined;
  if (result.status === "COMMON_OPTIMUM_RANGE" && result.range) {
    return { min: result.range.min, max: result.range.max, common: true };
  }
  // Never present one crop's range as the whole reservoir's range when
  // the selected crops have no common optimum.
  return undefined;
}

function engineNeeds(
  message: string,
  details: Partial<Extract<CalcResult, { kind: "needs" }>> = {},
): CalcResult {
  return { kind: "needs", missing: [], message, ...details };
}

function makeMeasurement(value: number): UserMeasurement {
  return {
    value,
    unit: "mS/cm",
    context: {
      scope: "NUTRIENT_SOLUTION" as MeasurementScope,
      scopeBasis: "STATED",
    },
  };
}

function makeSourceWaterMeasurement(value: number): UserMeasurement {
  return {
    value,
    unit: "mS/cm",
    context: {
      scope: "SOURCE_WATER",
      scopeBasis: "STATED",
    },
  };
}

function combineEvidence(states: EvidenceState[]): EvidenceState {
  if (states.includes("CONFLICTING")) return "CONFLICTING";
  if (states.includes("INSUFFICIENT")) return "INSUFFICIENT";
  if (states.includes("LOW")) return "LOW";
  if (states.includes("MODERATE")) return "MODERATE";
  return "HIGH";
}

function productIdentity(
  productId: string,
  customAbName?: string,
  customAbVersion?: string,
  customAbManufacturer?: string,
) {
  if (productId === "ab") {
    const manufacturer = customAbManufacturer?.trim();
    const name = customAbName?.trim();
    const version = customAbVersion?.trim();
    if (!manufacturer || !name || !version) return undefined;
    return {
      manufacturer,
      productFamily: "A+B",
      exactProduct: name,
      formulationVersion: version,
    };
  }
  return MANUFACTURER_RECIPES.find((recipe) => RECIPE_IDS[productId] === recipe.id)?.product;
}

function recipeSignatureFor(
  productId: string,
  stageId: string,
  liters: number,
  pods: number,
  customAbName?: string,
  customAbVersion?: string,
  customAbManufacturer?: string,
) {
  if (productId === "ab") {
    const identity = productIdentity(
      productId,
      customAbName,
      customAbVersion,
      customAbManufacturer,
    );
    return identity
      ? JSON.stringify([
          "user-ab",
          identity.manufacturer,
          identity.exactProduct,
          identity.formulationVersion,
        ])
      : undefined;
  }
  const recipeId = RECIPE_IDS[productId];
  if (!recipeId) return undefined;
  const stage = stageForId(stageId, productId);
  const recipe = executeFreshRecipe({
    recipeId,
    feedingIndex: stage?.feedingIndex,
    ...(stage?.scheduleId ? { scheduleId: stage.scheduleId } : {}),
    podCount: productId === "aerogarden" ? pods : undefined,
    // GH signatures describe the recipe ratio, not a particular reservoir
    // size. Volume is supplied separately to the calibration calculation.
    volumeL: productId === "aerogarden" ? undefined : 1,
  });
  if (!recipe.ok || !recipe.value || recipe.value.action === "WATER_ONLY_FLUSH") return undefined;
  if (productId === "aerogarden") return "single:1";
  return recipe.value.parts
    .map((part) => `${part.componentId}:${part.ml}`)
    .sort()
    .join("|");
}

function dosePartsForTotal(
  productId: string,
  stageId: string,
  pods: number,
  totalMl: number,
  calibration?: CalibrationModel,
) {
  const measuredParts = calibration?.observations[0]?.componentDosesMl;
  if (measuredParts) {
    const product = CALCULATOR_PRODUCTS.find((item) => item.id === productId);
    const sum = Object.values(measuredParts).reduce((total, value) => total + value, 0);
    if (!product || sum <= 0) return undefined;
    return product.parts.map((part) => ({
      label: part.label,
      amount: (totalMl * measuredParts[part.id]!) / sum,
      unit: "mL" as const,
    }));
  }
  const recipeId = RECIPE_IDS[productId];
  if (!recipeId || totalMl <= 0) return undefined;
  const stage = stageForId(stageId, productId);
  const recipe = executeFreshRecipe({
    recipeId,
    feedingIndex: stage?.feedingIndex,
    ...(stage?.scheduleId ? { scheduleId: stage.scheduleId } : {}),
    podCount: productId === "aerogarden" ? pods : undefined,
    volumeL: productId === "aerogarden" ? undefined : 1,
  });
  if (!recipe.ok || !recipe.value) return undefined;
  const base = recipe.value.parts.reduce((sum, part) => sum + part.ml, 0);
  if (base <= 0) return undefined;
  return recipe.value.parts.map((part) => ({
    label: part.label,
    amount: (totalMl * part.ml) / base,
    unit: "mL" as const,
  }));
}

function actualDoseTotal(doses: Record<string, string>): number | undefined {
  if (Object.values(doses).some((value) => value.trim() === "")) return undefined;
  const values = Object.values(doses).map((value) => Number(value.replace(",", ".")));
  if (!values.length || values.some((value) => !Number.isFinite(value) || value < 0))
    return undefined;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total > 0 ? total : undefined;
}

/** Never prefill a positive actual dose as zero when two-decimal display rounds it away. */
export function formatActualDosePrefill(amount: number | undefined): string {
  if (amount === undefined || !Number.isFinite(amount) || amount < 0) return "";
  if (amount > 0 && amount < 0.005) return "";
  return amount.toFixed(2);
}

export function calculateGardenResult(input: CalcInput): CalcResult {
  const calculated = calculateResult(input);
  if (calculated.kind === "ok" && input.productId === "ab")
    calculated.warnings = [
      ...(calculated.warnings ?? []),
      "User-identified formulation and measured ratio; no manufacturer recipe is implied. Follow the manufacturer's mixing instructions.",
    ];
  if (
    calculated.kind === "ok" &&
    input.productId === "gh-flora" &&
    input.mode !== "recipe" &&
    calculated.doses.some((dose) => dose.unit === "mL" && dose.amount > 0)
  )
    calculated.warnings = [
      ...(calculated.warnings ?? []),
      "Component proportions follow your actual calibration mixture and may differ from the manufacturer's recipe for this stage.",
    ];
  if (
    calculated.kind === "ok" &&
    calculated.doses.some((dose) => !Number.isFinite(dose.amount) || dose.amount < 0)
  )
    return engineNeeds(
      "These values exceed numeric calculation limits. Check the measurements and volumes.",
    );
  if (calculated.kind === "ok" && input.dosingResolutionMl !== undefined) {
    const unmeasurable = calculated.doses.filter(
      (dose) => dose.unit === "mL" && dose.amount > 0 && dose.amount < input.dosingResolutionMl!,
    );
    if (unmeasurable.length)
      calculated.warnings = [
        ...(calculated.warnings ?? []),
        `Below your dosing resolution (${input.dosingResolutionMl} mL): ${unmeasurable.map((dose) => dose.label).join(", ")}. Use suitable equipment; do not round a required dose to zero.`,
      ];
  }
  if (
    calculated.kind === "ok" &&
    input.dosingResolutionMl === undefined &&
    calculated.doses.some((dose) => dose.unit === "mL" && dose.amount > 0)
  )
    calculated.warnings = [
      ...(calculated.warnings ?? []),
      "Dosing equipment resolution is unknown; check that you can measure each amount accurately.",
    ];
  const lang = input.language ?? "es";
  if (calculated.kind === "needs" && calculated.message)
    calculated.message = presentationMessage(calculated.message, lang);
  if (calculated.kind === "ok")
    calculated.warnings = calculated.warnings?.map((message) => presentationMessage(message, lang));
  return calculated;
}

function presentationMessage(message: string, lang: Lang): string {
  const pairs: [string, string][] = [
    [
      "Mide el EC del agua de origen antes de preparar la solución.",
      "Measure the source-water EC before preparing the solution.",
    ],
    [
      "Mide el EC del agua de reposición antes de calcular el relleno.",
      "Measure the source-water EC before calculating the top-up.",
    ],
    [
      "Las proporciones de los componentes siguen la mezcla que mediste en tu calibración y pueden diferir de la receta del fabricante para esta etapa.",
      "Component proportions follow your actual calibration mixture and may differ from the manufacturer's recipe for this stage.",
    ],
    [
      "Confirma que la mezcla real de este tanque coincide con la proporción de componentes usada en la calibración seleccionada.",
      "Confirm that this tank's actual mixture matches the component ratio used in the selected calibration.",
    ],
    [
      "No se conoce la resolución de tu equipo; comprueba que puedes medir cada cantidad con precisión.",
      "Dosing equipment resolution is unknown; check that you can measure each amount accurately.",
    ],
    [
      "Añade al menos una planta para aplicar evidencia EC.",
      "Add at least one plant to apply crop EC evidence.",
    ],
    [
      "Esta calculadora de nutrientes no incluye plantas carnívoras. Retíralas de la mezcla para continuar.",
      "This nutrient calculator does not include carnivorous plants. Remove them from the mixture to continue.",
    ],
    [
      "Hay más etapas distintas que plantas de una variedad. Ajusta la cantidad de plantas o las etapas seleccionadas.",
      "There are more distinct stages than plants of a variety. Adjust the plant count or selected stages.",
    ],
    [
      "Registra una medición real en este producto y receta para calcular una dosis por EC.",
      "Record a real measurement of this product and mixture to calculate EC-based doses.",
    ],
    [
      "Registra una medición real para calibrar este producto y receta exactos.",
      "Record a real measurement to calibrate this exact product and mixture.",
    ],
    ["Selecciona un objetivo EC para continuar.", "Select an EC target to continue."],
    [
      "Esta es una política provisional de punto de partida de Garden, no un objetivo científico.",
      "This is a provisional Garden starting policy, not a scientific target.",
    ],
    [
      "Formulación identificada por ti y proporción medida; no es una receta del fabricante. Sigue sus instrucciones de mezcla.",
      "User-identified formulation and measured ratio; no manufacturer recipe is implied. Follow the manufacturer's mixing instructions.",
    ],
    [
      "No existe una receta oficial para esta formulación exacta.",
      "No official recipe is available for this exact formulation.",
    ],
    ["el EC que mediste", "the EC you measured"],
    ["cuántos litros quedan", "the actual liters remaining"],
    ["cuánta agua añadiste", "the replacement water amount"],
    ["cuánta agua planeas añadir", "how much water you plan to add"],
    [
      "Registra una calibración específica de este producto para calcular la dosis de nutrientes.",
      "A product-specific calibration is required to calculate nutrient addition.",
    ],
    [
      "Se requiere una calibración específica del producto para calcular el aporte de nutrientes después del relleno.",
      "A product-specific calibration is required to calculate nutrient addition after top-up.",
    ],
    [
      "Se requiere conocer la capacidad del tanque antes de añadir agua.",
      "Reservoir capacity is required before adding water.",
    ],
    [
      "La primera dosis parcial es una estrategia experimental; mezcla, espera una lectura estable y vuelve a medir antes de continuar.",
      "A partial first dose is an experimental operating policy; mix, stabilize and remeasure before continuing.",
    ],
    [
      "La mezcla lineal de EC es una aproximación; vuelve a medir después de mezclar.",
      "This linear EC mixing model is an approximation; remeasure after mixing.",
    ],
    [
      "No hay evidencia EC aplicable y comparable para todos los cultivos. Elige un objetivo explícito solo si puedes justificarlo.",
      "No applicable comparable crop EC evidence is available.",
    ],
    [
      "La receta del fabricante se puede aplicar, pero no hay evidencia suficiente para evaluar con confianza la compatibilidad del cultivo.",
      "The manufacturer recipe is executable, but crop compatibility cannot be evaluated with high confidence.",
    ],
    [
      "La receta del fabricante se puede aplicar, pero la evidencia comparable de los cultivos presenta un conflicto relevante.",
      "The manufacturer recipe is executable, but comparable crop evidence contains a material conflict.",
    ],
    [
      "El rango de EC esperado por el fabricante no se solapa con la evidencia aplicable del cultivo; Garden no considera que uno invalide al otro.",
      "The manufacturer expected EC and applicable crop evidence do not overlap; neither is silently ranked as the truth.",
    ],
    ["Los rangos reportados de EC no se solapan.", "The reported EC ranges do not overlap."],
    [
      "Los rangos publicados no se solapan. Define un objetivo explícito o separa los cultivos.",
      "The reported EC ranges do not overlap.",
    ],
    [
      "El objetivo elegido está fuera del rango de evidencia aplicable; se conserva sin modificar.",
      "The user-selected target is outside the applicable evidence range; it is preserved and not silently replaced.",
    ],
    [
      "La evidencia se reduce a un solo valor o el rango no supera la resolución indicada para tu medidor. Elige un objetivo explícito.",
      "The evidence is a single value or its range is no wider than your meter resolution. Choose an explicit target.",
    ],
    [
      "Se conserva el objetivo elegido, pero Garden no pudo establecer un rango de evidencia común aplicable a los cultivos.",
      "The user-selected target is preserved, but Garden could not establish a common applicable crop evidence range.",
    ],
    [
      "El agua de origen ya supera el objetivo; añadir nutrientes no puede reducir su EC.",
      "Source-water EC is already above the selected fresh-solution target; nutrient dosing cannot lower it.",
    ],
    [
      "El EC del agua de origen ya coincide con el objetivo. La conductividad no identifica los nutrientes presentes: no consideres esa agua una solución nutritiva completa.",
      "Source-water EC already equals the selected target. Conductivity does not establish nutrient composition; do not treat this water as a complete nutrient solution.",
    ],
    [
      "El relleno superaría la capacidad del tanque.",
      "The top-up would exceed known reservoir capacity.",
    ],
    [
      "La siguiente dosis de nutrientes superaría la capacidad del tanque. Deja espacio suficiente y recalcula con el volumen restante medido.",
      "The next nutrient dose would exceed reservoir capacity. Leave enough room and recalculate with the measured remaining volume.",
    ],
    [
      "No se puede alcanzar el objetivo dentro de la capacidad disponible con este relleno. Revisa las mediciones o cambia el plan del depósito.",
      "The target cannot be reached within the available capacity by this top-up. Recheck the measurements or change the reservoir plan.",
    ],
    [
      "Deja espacio para el concentrado además del agua de reposición; las cantidades calculadas superan la capacidad conocida.",
      "Leave room for the nutrient stock as well as replacement water; the calculated additions exceed known capacity.",
    ],
    [
      "La dilución adicional superaría la capacidad. Retira o sustituye solución y recalcula con el volumen restante real.",
      "Further dilution would exceed capacity. Remove or replace solution before recalculating with the actual remaining volume.",
    ],
    [
      "Este agua no puede diluir la solución hasta el objetivo seleccionado.",
      "The selected source water EC is at or above the target and cannot dilute the solution to that target.",
    ],
    [
      "La mezcla lineal de EC es aproximada. Recuperar el EC no demuestra recuperar el equilibrio de nutrientes.",
      "This linear EC model is an approximation; restored EC does not prove restored nutrient balance.",
    ],
    [
      "El cambio de EC es menor que la resolución indicada para tu medidor; confirma con una medición más precisa antes de ajustar.",
      "The EC change is smaller than your meter's stated resolution; confirm with a more precise measurement before adjusting.",
    ],
    [
      "El cambio de EC de una calibración es menor que la resolución registrada del medidor; repite la medición con un cambio que puedas medir o un medidor más preciso.",
      "A calibration EC change is smaller than the meter resolution recorded with it; repeat the measurement with a measurable change or a more precise meter.",
    ],
    [
      "La dosis está fuera del rango de volumen/dosis observado en tu calibración. Añade con cuidado y vuelve a medir.",
      "The fresh target dose is outside the validated calibration volume or dose range.",
    ],
    [
      "La corrección está fuera del rango observado en tu calibración. Vuelve a medir después de añadir.",
      "The correction dose is outside the validated calibration range.",
    ],
    [
      "El relleno está fuera del rango observado en tu calibración. Vuelve a medir después de añadir.",
      "The top-up dose is outside the validated calibration range.",
    ],
    [
      "Usa mediciones EC finitas no negativas, y un volumen y objetivo positivos.",
      "Use finite non-negative EC measurements and positive volume/target values.",
    ],
    [
      "Mide el EC del agua de reposición antes de calcular la dilución.",
      "Measure the dilution water EC before calculating dilution.",
    ],
    [
      "La dosis necesaria es positiva, pero está por debajo de la resolución configurada para tu equipo.",
      "The required dose is positive but below the configured dosing resolution.",
    ],
  ];
  const pair = pairs.find((item) => item.includes(message));
  if (pair) return pair[lang === "es" ? 0 : 1];
  if (lang === "es" && message.startsWith("Below your dosing resolution"))
    return message
      .replace("Below your dosing resolution", "Por debajo de tu resolución de dosificación")
      .replace(
        "Use suitable equipment; do not round a required dose to zero.",
        "Usa equipo adecuado; no redondees una dosis necesaria a cero.",
      );
  return message;
}

function calculateResult(input: CalcInput): CalcResult {
  if (Object.keys(input.crops).some((id) => CALCULATOR_EXCLUDED_CARNIVOROUS_IDS.has(id))) {
    return engineNeeds(
      "Esta calculadora de nutrientes no incluye plantas carnívoras. Retíralas de la mezcla para continuar.",
    );
  }
  const invalidStageComposition = Object.entries(input.crops).some(([id, count]) => {
    const primary = input.cropStages?.[id] ?? "UNSPECIFIED";
    const stages = new Set([
      ...(primary === "MIXED" ? [] : [primary]),
      ...(input.cropAdditionalStages?.[id] ?? []),
    ]);
    return primary === "MIXED" ? stages.size < 2 || stages.size > count : stages.size > count;
  });
  if (input.mode !== "recipe" && invalidStageComposition)
    return engineNeeds("MIXED_STAGE_COMPOSITION_REQUIRED");
  if (
    ![
      input.liters,
      input.sourceEc,
      input.userTarget ?? 1,
      input.currentEc ?? 0,
      input.currentLiters ?? 1,
      input.waterAdded ?? 0,
    ].every(Number.isFinite) ||
    input.liters <= 0 ||
    (input.meterResolutionMs !== undefined &&
      (!Number.isFinite(input.meterResolutionMs) || input.meterResolutionMs <= 0)) ||
    input.sourceEc < 0 ||
    (input.userTarget !== null && input.userTarget <= 0) ||
    (input.currentEc !== null && input.currentEc < 0)
  )
    return engineNeeds(
      "Use finite non-negative EC measurements and positive volume/target values.",
    );
  const selectedContexts = contextFor(
    input.crops,
    input.productId,
    input.cropStages,
    input.cropAdditionalStages,
    input.hydroponicSystem,
  );
  // Crop compatibility is a separate result from manufacturer recipe dosing.
  // An incomplete "mixed stages" declaration must not imply evidence for only
  // the one stage entered, but it must never block the official recipe itself.
  const contexts = input.mode === "recipe" && invalidStageComposition ? [] : selectedContexts;
  const compatibility = calculatePolycultureRange(contexts, CROP_EVIDENCE);
  const range = rangeFor(contexts);
  if (input.mode !== "recipe" && contexts.length === 0 && input.userTarget === null) {
    return engineNeeds("Añade al menos una planta para aplicar evidencia EC.");
  }
  const targetEngine = calculateFreshTargetEc({
    contexts,
    userSelectedTarget: input.userTarget ?? undefined,
    meterResolution: input.meterResolutionMs,
  });
  const targetValue = input.userTarget ?? targetEngine.value?.suggestedStartingPoint;
  const evidenceState = targetEngine.value?.evidenceState ?? compatibility.evidenceState;
  const evidenceNote = noteFor(evidenceState);
  const sources = [
    ...new Set([
      ...sourceTitles(targetEngine.value?.claims ?? []),
      ...compatibility.cropRanges.flatMap((crop) =>
        crop.observations.map((observation) => observation.source.title),
      ),
    ]),
  ];
  const outsideEvidence = Boolean(
    input.userTarget !== null &&
    range &&
    (input.userTarget < range.min || input.userTarget > range.max),
  );
  const targetPresentation = {
    ...(targetValue === undefined
      ? {}
      : {
          target: {
            value: targetValue,
            provenance: input.userTarget !== null ? ("user" as const) : ("garden" as const),
          },
        }),
    ...(range ? { range } : {}),
    evidence: evidenceLabel(evidenceState),
    evidenceNote,
    outsideEvidence,
    sources,
    compatibility,
  };

  // Keep the crop-evidence result visible while the user fills required mode
  // inputs (for example source-water EC). The validation state should not hide
  // a shared-tank conflict or an experimental compromise from the user.
  if (input.invalidFields?.length) {
    return { kind: "needs", missing: input.invalidFields, ...targetPresentation };
  }

  if (input.mode === "recipe") {
    const recipeId = RECIPE_IDS[input.productId];
    if (!recipeId) return engineNeeds("No existe una receta oficial para esta formulación exacta.");
    const stage = stageForId(input.stageId, input.productId);
    const recipe = executeFreshRecipe({
      recipeId,
      volumeL: input.productId === "aerogarden" ? undefined : input.liters,
      podCount: input.productId === "aerogarden" ? input.pods : undefined,
      feedingIndex: stage?.feedingIndex,
      ...(stage?.scheduleId ? { scheduleId: stage.scheduleId } : {}),
      contexts,
      dosingEquipmentResolutionMl: input.dosingResolutionMl,
    });
    if (!recipe.ok || !recipe.value) {
      return engineNeeds(
        recipe.errors[0]?.message ?? "La receta oficial necesita más información.",
      );
    }
    return {
      kind: "ok",
      provenance: "official",
      action: recipe.value.action === "WATER_ONLY_FLUSH" ? "hold" : "add",
      instruction:
        recipe.value.action === "WATER_ONLY_FLUSH"
          ? input.language === "en"
            ? "Flush with water only. Do not add FloraSeries nutrients."
            : "Enjuaga solo con agua. No añadas nutrientes FloraSeries."
          : undefined,
      doses: recipe.value.parts.map((part) => ({
        label: part.label,
        amount: part.ml,
        unit: "mL" as const,
      })),
      range,
      evidence: evidenceLabel(recipe.value.evidenceState),
      evidenceNote: noteFor(recipe.value.evidenceState),
      sources: [...new Set([recipe.value.recipe.source.title, ...sources])],
      compatibility,
      warnings: recipe.warnings.map((item) =>
        presentationMessage(item.message, input.language ?? "es"),
      ),
      expectedEc: recipe.value.manufacturerRecipeExpectation
        ? {
            kind: "manufacturer",
            min: recipe.value.manufacturerRecipeExpectation.min,
            max: recipe.value.manufacturerRecipeExpectation.max,
          }
        : undefined,
    };
  }

  if (input.mode === "target") {
    if (input.sourceEcKnown === false)
      return engineNeeds(
        "Mide el EC del agua de origen antes de preparar la solución.",
        targetPresentation,
      );
    if (!targetEngine.ok || !targetEngine.value || targetValue === undefined) {
      return engineNeeds(
        targetEngine.errors[0]?.message ??
          (targetEngine.warnings.some((item) => item.code === "STARTING_POINT_SUPPRESSED")
            ? "La evidencia se reduce a un solo valor o el rango no supera la resolución indicada para tu medidor. Elige un objetivo explícito."
            : "Elige un objetivo o aporta evidencia aplicable."),
        targetPresentation,
      );
    }
    const identity = productIdentity(
      input.productId,
      input.customAbName,
      input.customAbVersion,
      input.customAbManufacturer,
    );
    const signature = recipeSignatureFor(
      input.productId,
      input.stageId,
      input.liters,
      input.pods,
      input.customAbName,
      input.customAbVersion,
      input.customAbManufacturer,
    );
    const calibration =
      identity && signature ? applicableCalibration(input, identity, signature) : undefined;
    const dose = calculateFreshTargetEcDose({
      sourceWaterEc: makeSourceWaterMeasurement(input.sourceEc),
      targetEc: targetValue,
      reservoirVolumeL: input.liters,
      calibration: calibration?.value,
      policy: {
        dosingEquipmentResolutionMl: input.dosingResolutionMl,
        meterResolution: input.meterResolutionMs,
      },
    });
    if (!dose.ok || !dose.value) {
      return {
        kind: "needs",
        missing: [],
        message:
          dose.errors[0]?.code === "CALIBRATION_REQUIRED"
            ? identity && signature
              ? "Registra una medición real en este producto y receta para calcular una dosis por EC."
              : "Esta formulación exacta todavía no tiene una calibración compatible."
            : (dose.errors[0]?.message ?? "No se pudo calcular una dosis por EC."),
        calibrationRequired:
          dose.errors[0]?.code === "CALIBRATION_REQUIRED" && Boolean(identity && signature),
        ...targetPresentation,
      };
    }
    if (!calibration?.value)
      return engineNeeds("No se encontró una calibración aplicable.", targetPresentation);
    const doseValue = dose.value;
    const doses =
      doseValue.doseMl !== undefined
        ? (dosePartsForTotal(
            input.productId,
            input.stageId,
            input.pods,
            doseValue.doseMl,
            calibration.value,
          ) ?? [{ label: "Mezcla nutritiva", amount: doseValue.doseMl, unit: "mL" as const }])
        : [];
    return {
      kind: "ok",
      provenance: input.userTarget !== null ? "user" : "garden",
      action: doseValue.direction === "NO_CHANGE" ? "hold" : "add",
      doses,
      ...targetPresentation,
      evidence: evidenceLabel(
        combineEvidence([targetEngine.value.evidenceState, doseValue.evidenceState]),
      ),
      evidenceNote: noteFor(
        combineEvidence([targetEngine.value.evidenceState, doseValue.evidenceState]),
      ),
      sources: [...new Set([...sources, ...calibration.value.claims.map((claim) => claim.label)])],
      expectedEc: { kind: "calculated", min: targetValue, max: targetValue },
      warnings: [...targetEngine.warnings, ...calibration.warnings, ...dose.warnings].map(
        (item) => item.message,
      ),
    };
  }

  if (targetValue === undefined)
    return engineNeeds("Selecciona un objetivo EC para continuar.", targetPresentation);
  const identity = productIdentity(
    input.productId,
    input.customAbName,
    input.customAbVersion,
    input.customAbManufacturer,
  );
  const signature = recipeSignatureFor(
    input.productId,
    input.stageId,
    input.liters,
    input.pods,
    input.customAbName,
    input.customAbVersion,
    input.customAbManufacturer,
  );
  if (!identity || !signature)
    return engineNeeds(
      "Este producto necesita una calibración exacta antes de corregir o rellenar.",
      targetPresentation,
    );
  const calibration = applicableCalibration(input, identity, signature);
  const calibrationModel = calibration.ok ? calibration.value : undefined;

  if (input.mode === "adjust") {
    if (input.currentEc === null) return engineNeeds("el EC que mediste", targetPresentation);
    if (input.currentLiters === null)
      return engineNeeds("cuántos litros quedan", targetPresentation);
    const correction = calculateEcCorrection({
      currentEc: makeMeasurement(input.currentEc),
      dilutionWaterEc:
        input.sourceEcKnown === false ? undefined : makeSourceWaterMeasurement(input.sourceEc),
      targetEc: targetValue,
      reservoirVolumeL: input.currentLiters,
      reservoirCapacityL: input.capacityLiters ?? undefined,
      calibration: calibrationModel,
      policy: {
        dosingEquipmentResolutionMl: input.dosingResolutionMl,
        meterResolution: input.meterResolutionMs,
        firstStepFraction: input.correctionFraction,
      },
    });
    if (!correction.ok || !correction.value)
      return engineNeeds(correction.errors[0]?.message ?? "No se pudo calcular la corrección.", {
        ...targetPresentation,
        calibrationRequired: correction.errors.some((item) => item.code === "CALIBRATION_REQUIRED"),
      });
    const value = correction.value;
    if (value.direction === "ADD_NUTRIENT" && calibrationModel && !input.reservoirMixConfirmed)
      return engineNeeds(
        "Confirma que la mezcla real de este tanque coincide con la proporción de componentes usada en la calibración seleccionada.",
        { ...targetPresentation, mixtureConfirmationRequired: true },
      );
    const doses =
      value.direction === "ADD_WATER" && value.waterMl !== undefined
        ? [{ label: "Agua", amount: value.waterMl / 1000, unit: "L" as const }]
        : value.doseMl !== undefined
          ? (dosePartsForTotal(
              input.productId,
              input.stageId,
              input.pods,
              value.firstStepDoseMl ?? value.doseMl,
              calibrationModel,
            ) ?? [
              {
                label: "Mezcla nutritiva",
                amount: value.firstStepDoseMl ?? value.doseMl,
                unit: "mL" as const,
              },
            ])
          : [];
    return {
      kind: "ok",
      provenance: "measured",
      action:
        value.direction === "ADD_WATER"
          ? "dilute"
          : value.direction === "NO_CHANGE"
            ? "hold"
            : "add",
      doses,
      target: { value: targetValue, provenance: input.userTarget !== null ? "user" : "garden" },
      range,
      evidence: evidenceLabel(combineEvidence([evidenceState, value.evidenceState])),
      evidenceNote: noteFor(combineEvidence([evidenceState, value.evidenceState])),
      outsideEvidence,
      sources: [
        ...new Set([...sources, ...(calibrationModel?.claims.map((claim) => claim.label) ?? [])]),
      ],
      compatibility,
      warnings: [
        ...targetEngine.warnings,
        ...(value.direction === "ADD_NUTRIENT" ? calibration.warnings : []),
        ...correction.warnings,
      ].map((item) => item.message),
      expectedEc:
        value.firstStepDoseMl === undefined
          ? {
              kind: "calculated",
              min: targetValue,
              max: targetValue,
            }
          : undefined,
    };
  }

  if (input.currentEc === null) return engineNeeds("el EC que mediste", targetPresentation);
  if (input.currentLiters === null) return engineNeeds("cuántos litros quedan", targetPresentation);
  if (input.waterAdded === null)
    return engineNeeds("cuánta agua planeas añadir", targetPresentation);
  if (input.waterAdded > 0 && input.sourceEcKnown === false)
    return engineNeeds(
      "Mide el EC del agua de reposición antes de calcular el relleno.",
      targetPresentation,
    );
  if (input.capacityLiters == null)
    return engineNeeds(
      presentationMessage(
        "Se requiere conocer la capacidad del tanque antes de añadir agua.",
        input.language ?? "es",
      ),
      targetPresentation,
    );
  const topup = calculateTopUpMaintenance({
    currentVolumeL: input.currentLiters,
    nominalVolumeL: input.capacityLiters,
    replacementWaterL: input.waterAdded,
    currentEc: makeMeasurement(input.currentEc),
    replacementWaterEc: makeSourceWaterMeasurement(input.sourceEc),
    targetEc: targetValue,
    calibration: calibrationModel,
    policy: {
      dosingEquipmentResolutionMl: input.dosingResolutionMl,
      meterResolution: input.meterResolutionMs,
    },
  });
  if (!topup.ok || !topup.value)
    return engineNeeds(topup.errors[0]?.message ?? "No se pudo calcular el relleno.", {
      ...targetPresentation,
      calibrationRequired: topup.errors.some((item) => item.code === "CALIBRATION_REQUIRED"),
    });
  const value = topup.value;
  if (value.nutrientDoseMl && calibrationModel && !input.reservoirMixConfirmed)
    return engineNeeds(
      "Confirma que la mezcla real de este tanque coincide con la proporción de componentes usada en la calibración seleccionada.",
      { ...targetPresentation, mixtureConfirmationRequired: true },
    );
  return {
    kind: "ok",
    provenance: "measured",
    action:
      value.nutrientDoseMl || input.waterAdded > 0
        ? "add"
        : value.dilutionWaterMl
          ? "dilute"
          : "hold",
    doses: [
      ...(input.waterAdded > 0
        ? [{ label: "Replacement water", amount: input.waterAdded, unit: "L" as const }]
        : []),
      ...(value.nutrientDoseMl
        ? (dosePartsForTotal(
            input.productId,
            input.stageId,
            input.pods,
            value.nutrientDoseMl,
            calibrationModel,
          ) ?? [{ label: "Mezcla nutritiva", amount: value.nutrientDoseMl, unit: "mL" as const }])
        : value.dilutionWaterMl
          ? [{ label: "Water", amount: value.dilutionWaterMl / 1000, unit: "L" as const }]
          : []),
    ],
    target: { value: targetValue, provenance: input.userTarget !== null ? "user" : "garden" },
    range,
    evidence: evidenceLabel(combineEvidence([evidenceState, value.evidenceState])),
    evidenceNote: noteFor(combineEvidence([evidenceState, value.evidenceState])),
    outsideEvidence,
    sources: [
      ...new Set([...sources, ...(calibrationModel?.claims.map((claim) => claim.label) ?? [])]),
    ],
    compatibility,
    warnings: [
      ...targetEngine.warnings,
      ...(value.nutrientDoseMl ? calibration.warnings : []),
      ...topup.warnings,
    ].map((item) => item.message),
    expectedEc: { kind: "calculated", min: targetValue, max: targetValue },
  };
}

export function planTopUpToCapacity(
  input: CalcInput,
  targetEc: number,
): { ok: true; waterToAddL: number } | { ok: false; code: string; message: string } {
  if (input.sourceEcKnown === false)
    return {
      ok: false,
      code: "SOURCE_WATER_EC_REQUIRED",
      message: presentationMessage(
        "Measure the source-water EC before calculating the top-up.",
        input.language ?? "es",
      ),
    };
  const identity = productIdentity(
    input.productId,
    input.customAbName,
    input.customAbVersion,
    input.customAbManufacturer,
  );
  const signature = recipeSignatureFor(
    input.productId,
    input.stageId,
    input.liters,
    input.pods,
    input.customAbName,
    input.customAbVersion,
    input.customAbManufacturer,
  );
  const calibration =
    identity && signature ? applicableCalibration(input, identity, signature).value : undefined;
  if (input.currentLiters === null || input.capacityLiters == null || input.currentEc === null)
    return {
      ok: false,
      code: "MEASUREMENT_REQUIRED",
      message: "Current volume, capacity and EC are required.",
    };
  const plan = calculateTopUpToCapacity({
    currentVolumeL: input.currentLiters,
    capacityL: input.capacityLiters,
    currentEc: makeMeasurement(input.currentEc),
    replacementWaterEc: makeSourceWaterMeasurement(input.sourceEc),
    targetEc,
    calibration,
  });
  if (!plan.ok || !plan.value) {
    const error = plan.errors[0];
    return {
      ok: false,
      code: error?.code ?? "PLAN_UNAVAILABLE",
      message: presentationMessage(
        error?.message ?? "The top-up plan is unavailable.",
        input.language ?? "es",
      ),
    };
  }
  return { ok: true, waterToAddL: plan.value.waterToAddL };
}

function applicableCalibration(
  input: CalcInput,
  identity: CalibrationObservation["productIdentity"],
  context: string,
) {
  const matching = matchingCalibrationObservations(input, identity, context);
  const latest = matching.at(-1);
  return buildCalibrationModel({
    productIdentity: identity,
    formulationVersion: identity.formulationVersion,
    recipeSignature: latest?.componentRatioOrRecipeSignature ?? context,
    // Old observations without actual per-component amounts cannot prove a mixture.
    observations: matching,
  });
}

function matchingCalibrationObservations(
  input: Pick<CalcInput, "productId" | "calibrationObservations">,
  identity: CalibrationObservation["productIdentity"],
  context: string,
): CalibrationObservation[] {
  return (input.calibrationObservations ?? []).flatMap((item) => {
    if (
      !sameProductIdentity(identity, item.productIdentity) ||
      item.formulationVersion !== identity.formulationVersion ||
      !item.componentDosesMl
    )
      return [];
    const previousContext = item.recipeContextSignature;
    if (previousContext === context) return [item];
    // Earlier AeroGarden records encoded the official dose rather than its
    // single-component ratio. Normalize matching records in memory only.
    if (
      input.productId !== "aerogarden" ||
      context !== "single:1" ||
      !previousContext ||
      !/^single:(?:4|8|12|16|24)$/.test(previousContext) ||
      Object.keys(item.componentDosesMl).length !== 1 ||
      !((item.componentDosesMl["single"] ?? 0) > 0) ||
      !item.componentRatioOrRecipeSignature.startsWith(`${previousContext};observed=`)
    )
      return [];
    return [
      {
        ...item,
        recipeContextSignature: context,
        componentRatioOrRecipeSignature:
          context + item.componentRatioOrRecipeSignature.slice(previousContext.length),
      },
    ];
  });
}

export function calibrationUsage(
  input: Pick<
    CalcInput,
    | "productId"
    | "stageId"
    | "liters"
    | "pods"
    | "calibrationObservations"
    | "customAbName"
    | "customAbVersion"
    | "customAbManufacturer"
  >,
): { used: number; recorded: number } {
  const identity = productIdentity(
    input.productId,
    input.customAbName,
    input.customAbVersion,
    input.customAbManufacturer,
  );
  const signature = recipeSignatureFor(
    input.productId,
    input.stageId,
    input.liters,
    input.pods,
    input.customAbName,
    input.customAbVersion,
    input.customAbManufacturer,
  );
  const recorded = input.calibrationObservations?.length ?? 0;
  if (!identity || !signature) return { used: 0, recorded };
  const matching = matchingCalibrationObservations(input, identity, signature);
  const latest = matching.at(-1);
  const model = buildCalibrationModel({
    productIdentity: identity,
    formulationVersion: identity.formulationVersion,
    recipeSignature: latest?.componentRatioOrRecipeSignature ?? signature,
    observations: matching,
  });
  return { used: model.value?.observations.length ?? 0, recorded };
}

export function recordActualDoses(input: {
  productId: string;
  customAbManufacturer?: string | undefined;
  customAbName?: string | undefined;
  customAbVersion?: string | undefined;
  stageId: string;
  liters: number;
  pods: number;
  baselineEc: number;
  resultingEc: number;
  actualDoses: Record<string, string>;
  meterResolutionMs?: number | undefined;
}): EngineResult<CalibrationObservation> {
  const identity = productIdentity(
    input.productId,
    input.customAbName,
    input.customAbVersion,
    input.customAbManufacturer,
  );
  const signature = recipeSignatureFor(
    input.productId,
    input.stageId,
    input.liters,
    input.pods,
    input.customAbName,
    input.customAbVersion,
    input.customAbManufacturer,
  );
  const doseAppliedMl = actualDoseTotal(input.actualDoses);
  const components = CALCULATOR_PRODUCTS.find((item) => item.id === input.productId)?.parts ?? [];
  if (
    !identity ||
    !signature ||
    doseAppliedMl === undefined ||
    Object.keys(input.actualDoses).length !== components.length ||
    components.some((part) => !(part.id in input.actualDoses))
  ) {
    return {
      ok: false,
      warnings: [],
      errors: [
        { code: "ACTUAL_DOSE_REQUIRED", message: "Actual positive component doses are required." },
      ],
      claims: [],
    };
  }
  const componentDosesMl = Object.fromEntries(
    components.map((part) => [part.id, Number(input.actualDoses[part.id]!.replace(",", "."))]),
  );
  if (input.productId === "ab" && Object.values(componentDosesMl).some((amount) => amount <= 0))
    return {
      ok: false,
      warnings: [],
      errors: [
        {
          code: "BOTH_COMPONENTS_REQUIRED",
          message: "The actual positive amounts of both A and B are required.",
        },
      ],
      claims: [],
    };
  const measuredSignature = components
    .map((part) => `${part.id}:${(componentDosesMl[part.id]! / doseAppliedMl).toPrecision(12)}`)
    .sort()
    .join("|");
  const observation = learnFromObservation({
    productIdentity: identity,
    formulationVersion: identity.formulationVersion,
    recipeSignature: `${signature};observed=${measuredSignature}`,
    baselineEc: input.baselineEc,
    resultingEc: input.resultingEc,
    doseAppliedMl,
    reservoirVolumeL: input.liters,
    timestamp: new Date().toISOString(),
  });
  if (observation.value) {
    observation.value.recipeContextSignature = signature;
    observation.value.componentDosesMl = componentDosesMl;
    if (
      input.meterResolutionMs !== undefined &&
      Number.isFinite(input.meterResolutionMs) &&
      input.meterResolutionMs > 0
    )
      observation.value.meterResolution = input.meterResolutionMs;
  }
  return observation;
}
