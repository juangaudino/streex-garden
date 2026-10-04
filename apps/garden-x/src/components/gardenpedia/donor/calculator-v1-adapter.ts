import type {
  CropContext,
  HydroponicSystem,
  OperatingMode,
  StageApplicability,
} from "@/lib/garden-nutrient-engine-v1";

import type { DonorPlant } from "./canonical-adapter";

export type CalculatorMode = "recipe" | "target" | "correction" | "topup";
export type CalculatorProduct = "flora" | "aerogarden" | "ab";
export type CalculatorPhase = "seedling" | "vegetative" | "flowering";

export const MODE_TO_ENGINE: Record<CalculatorMode, OperatingMode> = {
  recipe: "FRESH_RECIPE",
  target: "FRESH_TARGET_EC",
  correction: "EC_CORRECTION",
  topup: "TOP_UP_MAINTENANCE",
};

export const RECIPE_IDS = {
  flora: "general-hydroponics-floraseries-3part-2026-07-07",
  aerogarden: "aerogarden-liquid-plant-food-4-3-6",
} as const;

export function cropIdentityForPlant(plant: Pick<DonorPlant, "id" | "scientificName">): string {
  const id = plant.id.toLocaleLowerCase("en-US");
  const scientific = plant.scientificName.toLocaleLowerCase("en-US");
  if (id.includes("basil") || scientific.includes("ocimum")) return "basil";
  if (id.includes("tomato") || scientific.includes("solanum lycopersicum")) return "tomato";
  if (id.includes("lettuce") || scientific.includes("lactuca sativa")) return "lettuce";
  if (id.includes("celery") || scientific.includes("apium graveolens")) return "celery";
  if (id.includes("pepper") || scientific.includes("capsicum")) return "pepper";
  if (id.includes("strawberry") || scientific.includes("fragaria")) return "strawberry";
  if (id.includes("spinach") || scientific.includes("spinacia oleracea")) return "spinach";
  if (id.includes("parsley") || scientific.includes("petroselinum")) return "parsley";
  if (id.includes("sage") || scientific.includes("salvia officinalis")) return "sage";
  return plant.id;
}

export function stageForPhase(phase: CalculatorPhase): StageApplicability {
  if (phase === "seedling") return "SEEDLING";
  if (phase === "flowering") return "FLOWERING";
  return "VEGETATIVE";
}

export function systemForProduct(product: CalculatorProduct): HydroponicSystem {
  return product === "aerogarden" ? "COUNTERTOP_POD" : "GENERAL_HYDROPONIC";
}

export function buildCropContexts(
  crops: Record<string, number>,
  plantsById: ReadonlyMap<string, DonorPlant>,
  phase: CalculatorPhase,
  product: CalculatorProduct,
): CropContext[] {
  return Object.keys(crops).map((plantId) => {
    const plant = plantsById.get(plantId);
    return {
      cropIdentity: cropIdentityForPlant(plant ?? { id: plantId, scientificName: "" }),
      phenologicalStage: stageForPhase(phase),
      hydroponicSystem: systemForProduct(product),
      measurementScope: "NUTRIENT_SOLUTION",
    };
  });
}

export function recipeIdForProduct(product: CalculatorProduct): string | undefined {
  return RECIPE_IDS[product as keyof typeof RECIPE_IDS];
}

export function recipeSignature(componentDoses: Readonly<Record<string, number>>): string {
  return Object.entries(componentDoses)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([component, dose]) => `${component}:${dose}`)
    .join("|");
}

export function sumComponentDoses(componentDoses: Readonly<Record<string, number>>): number {
  return Object.values(componentDoses).reduce((total, dose) => total + dose, 0);
}
