import type { OperatingMode } from "@/lib/garden-nutrient-engine-v1";

export type CalculatorMode = "recipe" | "target" | "correction" | "topup";
export const MODE_TO_ENGINE: Record<CalculatorMode, OperatingMode> = {
  recipe: "FRESH_RECIPE",
  target: "FRESH_TARGET_EC",
  correction: "EC_CORRECTION",
  topup: "TOP_UP_MAINTENANCE",
};

/** Stable signature helper used to identify an actual multi-component mixture. */
export function recipeSignature(componentDoses: Readonly<Record<string, number>>): string {
  return Object.entries(componentDoses)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([component, dose]) => `${component}:${dose}`)
    .join("|");
}
