// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { calibrationUsage, recordActualDoses } from "./calculator-lovable-adapter";
import {
  CALCULATOR_STORAGE_KEY,
  loadCalibrationObservations,
  mergeCalibrationObservations,
  persistCalibrationObservations,
  QUICK_CALIBRATION_STORAGE_KEY,
  SHARED_CALIBRATION_STORAGE_KEY,
} from "./calculator-calibration-storage";

function observation(timestamp: string) {
  const result = recordActualDoses({
    productId: "gh-flora",
    stageId: "feeding-2",
    liters: 4,
    pods: 6,
    baselineEc: 0.2,
    resultingEc: 1.1,
    actualDoses: { micro: "4", gro: "3", bloom: "2" },
  });
  if (!result.value) throw new Error("Expected a valid calibration fixture");
  return { ...result.value, id: `${result.value.id}-${timestamp}`, timestamp };
}

describe("local calculator calibration registry", () => {
  beforeEach(() => window.localStorage.clear());

  it("merges shared, Quick Mix, and legacy saved-system observations once", () => {
    const quick = observation("2026-11-01T10:00:00.000Z");
    const system = observation("2026-11-02T10:00:00.000Z");
    window.localStorage.setItem(SHARED_CALIBRATION_STORAGE_KEY, JSON.stringify([quick]));
    window.localStorage.setItem(QUICK_CALIBRATION_STORAGE_KEY, JSON.stringify([quick]));
    window.localStorage.setItem(
      CALCULATOR_STORAGE_KEY,
      JSON.stringify([{ id: "tank", name: "Tank", calibrationObservations: [quick, system] }]),
    );

    expect(loadCalibrationObservations()).toEqual([quick, system]);
  });

  it("persists the merged registry without altering legacy storage", () => {
    const quick = observation("2026-11-01T10:00:00.000Z");
    const next = observation("2026-11-02T10:00:00.000Z");
    window.localStorage.setItem(QUICK_CALIBRATION_STORAGE_KEY, JSON.stringify([quick]));

    expect(persistCalibrationObservations(mergeCalibrationObservations([quick], [next]))).toBe(
      true,
    );
    expect(loadCalibrationObservations()).toEqual([quick, next]);
    expect(JSON.parse(window.localStorage.getItem(QUICK_CALIBRATION_STORAGE_KEY) ?? "[]")).toEqual([
      quick,
    ]);
  });

  it("ignores malformed storage and rejects duplicate observation IDs", () => {
    const valid = observation("2026-11-01T10:00:00.000Z");
    window.localStorage.setItem(SHARED_CALIBRATION_STORAGE_KEY, "not-json");
    window.localStorage.setItem(QUICK_CALIBRATION_STORAGE_KEY, JSON.stringify([null, {}, valid]));

    expect(loadCalibrationObservations()).toEqual([valid]);
    expect(mergeCalibrationObservations([valid], [{ ...valid, resultingEc: 8 }])).toEqual([valid]);
  });

  it("keeps the engine's exact recipe-context boundary after merging", () => {
    const reading = observation("2026-11-01T10:00:00.000Z");
    const stored = mergeCalibrationObservations([reading]);
    const matching = calibrationUsage({
      productId: "gh-flora",
      stageId: "feeding-2",
      liters: 4,
      pods: 6,
      calibrationObservations: stored,
    });
    const differentStep = calibrationUsage({
      productId: "gh-flora",
      stageId: "feeding-4",
      liters: 4,
      pods: 6,
      calibrationObservations: stored,
    });

    expect(matching.used).toBe(1);
    expect(differentStep.used).toBe(0);
    expect(differentStep.recorded).toBe(1);
  });
});
