import type { CalibrationObservation } from "@/lib/garden-nutrient-engine-v1/types";

export const CALCULATOR_STORAGE_KEY = "gardenpedia.calculator.systems.v1";
export const QUICK_CALIBRATION_STORAGE_KEY = "gardenpedia.calculator.quick-calibration.v1";
export const SHARED_CALIBRATION_STORAGE_KEY = "gardenpedia.calculator.calibrations.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function isCalibrationObservation(value: unknown): value is CalibrationObservation {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CalibrationObservation>;
  return (
    typeof item.id === "string" &&
    typeof item.timestamp === "string" &&
    typeof item.componentRatioOrRecipeSignature === "string" &&
    typeof item.productIdentity === "object" &&
    item.productIdentity !== null &&
    typeof item.doseAppliedMl === "number" &&
    typeof item.reservoirVolumeL === "number"
  );
}

function readObservations(storage: StorageLike, key: string): CalibrationObservation[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isCalibrationObservation) : [];
  } catch {
    return [];
  }
}

export function mergeCalibrationObservations(
  ...groups: readonly (readonly CalibrationObservation[] | null | undefined)[]
): CalibrationObservation[] {
  const byId = new Map<string, CalibrationObservation>();
  for (const group of groups) {
    for (const observation of group ?? []) {
      if (isCalibrationObservation(observation) && !byId.has(observation.id)) {
        byId.set(observation.id, observation);
      }
    }
  }
  return [...byId.values()].sort((a, b) => {
    const aTime = Date.parse(a.timestamp);
    const bTime = Date.parse(b.timestamp);
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Reads the shared local registry and the two V1 storage locations. The engine
 * still decides applicability by exact product, formulation and recipe signature.
 */
export function loadCalibrationObservations(
  storage: StorageLike | undefined = browserStorage(),
): CalibrationObservation[] {
  if (!storage) return [];
  const systemObservations: CalibrationObservation[][] = [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(CALCULATOR_STORAGE_KEY) ?? "[]");
    if (Array.isArray(parsed)) {
      for (const system of parsed) {
        if (system && typeof system === "object" && "calibrationObservations" in system) {
          const observations = (system as { calibrationObservations?: unknown })
            .calibrationObservations;
          if (Array.isArray(observations)) {
            systemObservations.push(observations.filter(isCalibrationObservation));
          }
        }
      }
    }
  } catch {
    // Preserve usable calibrations from the other local keys if system storage is malformed.
  }
  return mergeCalibrationObservations(
    readObservations(storage, SHARED_CALIBRATION_STORAGE_KEY),
    readObservations(storage, QUICK_CALIBRATION_STORAGE_KEY),
    ...systemObservations,
  );
}

export function persistCalibrationObservations(
  observations: readonly CalibrationObservation[],
  storage: StorageLike | undefined = browserStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      SHARED_CALIBRATION_STORAGE_KEY,
      JSON.stringify(mergeCalibrationObservations(observations)),
    );
    return true;
  } catch {
    return false;
  }
}
