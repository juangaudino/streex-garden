import type { EvidenceObservation, ManufacturerRecipe, SourceRef } from "./types.ts";

export const NUTRIENT_SOURCES: Record<string, SourceRef> = {
  okstateEcPh: {
    id: "okstate-ecph",
    publisher: "Oklahoma State University Extension",
    title: "Electrical Conductivity and pH Guide for Hydroponics",
    url: "https://extension.okstate.edu/fact-sheets/electrical-conductivity-and-ph-guide-for-hydroponics",
    sourceClass: "UNIVERSITY_EXTENSION",
    tier: "A",
    publication: "2017",
    documentCode: "HLA-6722",
    retrievedAt: "2026-10-03",
  },
  generalHydroponicsFlora: {
    id: "general-hydroponics-floraseries-2026-07-07",
    publisher: "General Hydroponics",
    title: "FloraSeries Professional 3-Part Nutrient System",
    url: "https://generalhydroponics.com/pages/flora-series-3-part-feed-program",
    sourceClass: "MANUFACTURER",
    tier: "A",
    publication: "2026",
    revision: "English United States Revised 07/07/2026",
    region: "US",
    retrievedAt: "2026-10-03",
  },
  aerogardenBounty: {
    id: "aerogarden-bounty-liquid-food",
    publisher: "AeroGarden / ScottsMiracle-Gro",
    title: "Bounty Basic product guidance and feeding FAQ",
    url: "https://aerogarden.com/bounty-basic.html",
    sourceClass: "MANUFACTURER",
    tier: "A",
    publication: "2024",
    region: "US",
    retrievedAt: "2026-10-03",
  },
  aerogardenLiquidFood: {
    id: "aerogarden-liquid-plant-food",
    publisher: "AeroGarden / ScottsMiracle-Gro",
    title: "Liquid Plant Food (Nutrients) - 3 oz",
    url: "https://aerogarden.com/subscribe-to-save/100824-0000.html",
    sourceClass: "MANUFACTURER",
    tier: "A",
    publication: "2024",
    region: "US",
    retrievedAt: "2026-10-03",
  },
};

const source = NUTRIENT_SOURCES.okstateEcPh;

function cropObservation(
  id: string,
  cropIdentity: string,
  ec: [number, number],
  ph: [number, number],
  notes: string,
): EvidenceObservation[] {
  return [
    {
      id: `${id}-ec`,
      metric: "EC",
      cropIdentity,
      stageApplicability: "UNSPECIFIED",
      hydroponicSystem: "GENERAL_HYDROPONIC",
      measurementScope: "NUTRIENT_SOLUTION",
      scopeBasis: "STATED",
      source,
      verificationStatus: "VERIFIED",
      evidenceState: "HIGH",
      publication: source.publication,
      observedRange: { min: ec[0], max: ec[1], unit: "mS/cm" },
      notes,
    },
    {
      id: `${id}-ph`,
      metric: "PH",
      cropIdentity,
      stageApplicability: "UNSPECIFIED",
      hydroponicSystem: "GENERAL_HYDROPONIC",
      measurementScope: "NUTRIENT_SOLUTION",
      scopeBasis: "STATED",
      source,
      verificationStatus: "VERIFIED",
      evidenceState: "HIGH",
      publication: source.publication,
      observedRange: { min: ph[0], max: ph[1], unit: "pH" },
      notes,
    },
  ];
}

/**
 * Only ranges explicitly present in the verified OSU crop table are included.
 * Missing crops remain INSUFFICIENT rather than inheriting a category default.
 */
export const CROP_EVIDENCE: EvidenceObservation[] = [
  ...cropObservation(
    "basil-osu",
    "basil",
    [1.0, 1.6],
    [5.5, 6.0],
    "Crop-level reference; not cultivar-specific.",
  ),
  ...cropObservation(
    "lettuce-osu",
    "lettuce",
    [1.2, 1.8],
    [6.0, 7.0],
    "Crop-level reference; not cultivar-specific.",
  ),
  ...cropObservation(
    "tomato-osu",
    "tomato",
    [2.0, 4.0],
    [6.0, 6.5],
    "Crop-level reference; not cultivar-specific.",
  ),
  ...cropObservation(
    "celery-osu",
    "celery",
    [1.8, 2.4],
    [6.5, 6.5],
    "Crop-level reference; not cultivar-specific.",
  ),
  ...cropObservation(
    "pepper-osu",
    "pepper",
    [0.8, 1.8],
    [5.5, 6.0],
    "Crop-level reference; not cultivar-specific.",
  ),
  ...cropObservation(
    "strawberry-osu",
    "strawberry",
    [1.8, 2.2],
    [6.0, 6.0],
    "Crop-level reference; not cultivar-specific.",
  ),
  ...cropObservation(
    "spinach-osu",
    "spinach",
    [1.8, 2.3],
    [6.0, 7.0],
    "Crop-level reference; not cultivar-specific.",
  ),
  ...cropObservation(
    "parsley-osu",
    "parsley",
    [1.8, 2.2],
    [6.0, 6.5],
    "Crop-level reference; not cultivar-specific.",
  ),
  ...cropObservation(
    "sage-osu",
    "sage",
    [1.0, 1.6],
    [5.5, 6.5],
    "Crop-level reference; not cultivar-specific.",
  ),
];

const flora = NUTRIENT_SOURCES.generalHydroponicsFlora;
const gallonToLiter = 1 / 3.785411784;
const floraDose = (mlPerGallon: number) => Number((mlPerGallon * gallonToLiter).toFixed(6));

const floraProduct = {
  manufacturer: "General Hydroponics",
  productFamily: "FloraSeries",
  exactProduct: "FloraSeries 3-Part Nutrient System",
  formulationVersion: "2026-07-07-US-3PART",
  region: "US",
};

export const FLORA_RECIPE: ManufacturerRecipe = {
  id: "general-hydroponics-floraseries-3part-2026-07-07",
  product: floraProduct,
  components: [
    { id: "micro", label: "FloraMicro", role: "base nutrient", npk: "5-0-1" },
    { id: "gro", label: "FloraGro", role: "vegetative growth", npk: "2-1-6" },
    { id: "bloom", label: "FloraBloom", role: "flowering and fruiting", npk: "0-5-4" },
  ],
  steps: [
    {
      stage: "SEEDLING_CLONE",
      feedingIndex: 1,
      label: "Grow week 1 / Seedling-Clone",
      doses: { micro: floraDose(1.8), gro: floraDose(1.8), bloom: floraDose(1.8) },
      doseUnit: "mL/L",
      expectedEc: { min: 0.4, max: 0.5, unit: "mS/cm" },
      source: flora,
      epistemic: "MANUFACTURER_INSTRUCTION",
    },
    {
      stage: "EARLY_GROWTH",
      feedingIndex: 2,
      label: "Grow week 2 / Early Growth",
      doses: { micro: floraDose(3.6), gro: floraDose(3.4), bloom: floraDose(2.6) },
      doseUnit: "mL/L",
      expectedEc: { min: 0.9, max: 1.1, unit: "mS/cm" },
      source: flora,
      epistemic: "MANUFACTURER_INSTRUCTION",
    },
    {
      stage: "LATE_GROWTH",
      feedingIndex: 4,
      label: "Grow week 4 / Late Growth",
      doses: { micro: floraDose(6.0), gro: floraDose(5.6), bloom: floraDose(4.2) },
      doseUnit: "mL/L",
      expectedEc: { min: 1.4, max: 1.7, unit: "mS/cm" },
      source: flora,
      epistemic: "MANUFACTURER_INSTRUCTION",
    },
    {
      stage: "EARLY_BLOOM",
      feedingIndex: 5,
      label: "Bloom week 1 / Early Bloom",
      doses: { micro: floraDose(7.6), gro: floraDose(6.6), bloom: floraDose(8.5) },
      doseUnit: "mL/L",
      expectedEc: { min: 2.0, max: 2.4, unit: "mS/cm" },
      source: flora,
      epistemic: "MANUFACTURER_INSTRUCTION",
    },
    {
      stage: "MID_BLOOM",
      feedingIndex: 7,
      label: "Bloom week 3 / Mid Bloom",
      doses: { micro: floraDose(4.6), gro: floraDose(4.6), bloom: floraDose(6.6) },
      doseUnit: "mL/L",
      expectedEc: { min: 1.4, max: 1.7, unit: "mS/cm" },
      source: flora,
      epistemic: "MANUFACTURER_INSTRUCTION",
    },
    {
      stage: "LATE_BLOOM",
      feedingIndex: 10,
      label: "Bloom week 6 / Late Bloom",
      doses: { micro: floraDose(3.3), gro: floraDose(3.3), bloom: floraDose(4.0) },
      doseUnit: "mL/L",
      expectedEc: { min: 0.9, max: 1.1, unit: "mS/cm" },
      source: flora,
      epistemic: "MANUFACTURER_INSTRUCTION",
    },
    {
      stage: "RIPEN",
      feedingIndex: 12,
      label: "Bloom week 8 / Ripen",
      doses: { micro: floraDose(2.0), gro: floraDose(2.0), bloom: floraDose(3.2) },
      doseUnit: "mL/L",
      expectedEc: { min: 0.6, max: 0.8, unit: "mS/cm" },
      source: flora,
      epistemic: "MANUFACTURER_INSTRUCTION",
    },
  ],
  mixingOrder: ["micro", "gro", "bloom"],
  source: flora,
  executable: true,
  notes: [
    "Check and adjust pH and EC after all nutrients are mixed.",
    "A Hardwater FloraMicro variant was not verified in the checked official program; no alternate recipe is inferred.",
  ],
};

const aero = NUTRIENT_SOURCES.aerogardenBounty;
export const AEROGARDEN_RECIPE: ManufacturerRecipe = {
  id: "aerogarden-liquid-plant-food-4-3-6",
  product: {
    manufacturer: "AeroGarden",
    productFamily: "Liquid Plant Food",
    exactProduct: "AeroGarden Liquid Plant Food 4-3-6",
    formulationVersion: "4-3-6-US",
    region: "US",
  },
  components: [{ id: "single", label: "AeroGarden Liquid Plant Food", npk: "4-3-6" }],
  steps: [
    {
      stage: "POD_GROUP_6_7",
      feedingIndex: 1,
      label: "6-pod Harvest feeding",
      doses: { single: 8 },
      doseUnit: "mL",
      source: NUTRIENT_SOURCES.aerogardenLiquidFood,
      epistemic: "MANUFACTURER_INSTRUCTION",
    },
    {
      stage: "POD_GROUP_9",
      feedingIndex: 1,
      label: "9-pod Bounty first or second feeding",
      doses: { single: 8 },
      doseUnit: "mL",
      source: aero,
      epistemic: "MANUFACTURER_INSTRUCTION",
    },
    {
      stage: "POD_GROUP_9",
      feedingIndex: 3,
      label: "9-pod Bounty later feeding",
      doses: { single: 12 },
      doseUnit: "mL",
      source: aero,
      epistemic: "MANUFACTURER_INSTRUCTION",
    },
  ],
  mixingOrder: ["single"],
  source: aero,
  executable: true,
  podCountGroups: [6, 7, 9],
  notes: [
    "Pod count is a product-model group, not a crop count.",
    "2–3 and 12-pod amount details are not persisted here without a directly verified current manufacturer amount.",
  ],
};

export const MANUFACTURER_RECIPES: ManufacturerRecipe[] = [FLORA_RECIPE, AEROGARDEN_RECIPE];
