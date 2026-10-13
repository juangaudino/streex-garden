import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  calculateGardenResult,
  buildCropEvidenceCoverage,
  contextFor,
  recordActualDoses,
  type CalcInput,
  type CalcResult,
} from "./calculator-lovable-adapter";
import { CROP_EVIDENCE, AEROGARDEN_RECIPE } from "@/lib/garden-nutrient-engine-v1/data";
import {
  calculatePolycultureRange,
  executeFreshRecipe,
} from "@/lib/garden-nutrient-engine-v1/engine";

// Independent transcription of the official online Light Feed weekly table.
// Original units are mL/US gallon, not Garden's copied per-liter constants.
const gh = [
  [1, 1.8, 1.8, 1.8, 0.4, 0.5],
  [2, 3.6, 3.4, 2.6, 0.9, 1.1],
  [4, 6, 5.6, 4.2, 1.4, 1.7],
  [5, 7.6, 6.6, 8.5, 2, 2.4],
  [7, 4.6, 4.6, 6.6, 1.4, 1.7],
  [10, 3.3, 3.3, 4, 0.9, 1.1],
  [12, 2, 2, 3.2, 0.6, 0.8],
];
const ghUrl = "https://generalhydroponics.com/pages/flora-series-3-part-feed-program";
const aeroUrl =
  "https://scottsmiraclegro.com/en-us/brands/aerogarden/products/accessories/VB999965.html";
const osuUrl =
  "https://extension.okstate.edu/fact-sheets/electrical-conductivity-and-ph-guide-for-hydroponics";
const rows: {
  test: string;
  source: string;
  sourceValue: number;
  gardenValue: number;
  difference: number;
  tolerance: number;
  pass: boolean;
}[] = [];
let calculations = 0;
const scenarios: {
  input: Omit<CalcInput, "calibrationObservations">;
  hasCalibration: boolean;
  output: Record<string, unknown>;
}[] = [];
const base: CalcInput = {
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
};
// Simulated QA user observation, NOT empirical calibration. Never imported
// by production: 4L, actual Micro/Gro/Bloom 4/3/2mL, measured .20 -> 1.10.
const observation = recordActualDoses({
  ...base,
  baselineEc: 0.2,
  resultingEc: 1.1,
  actualDoses: { micro: "4", gro: "3", bloom: "2" },
}).value!;
const calibrated = { ...base, calibrationObservations: [observation] };
function run(input: CalcInput) {
  calculations++;
  const output = calculateGardenResult(input);
  const { calibrationObservations, ...parameters } = input;
  scenarios.push({
    input: parameters,
    hasCalibration: Boolean(calibrationObservations?.length),
    output: {
      kind: output.kind,
      target: output.target,
      range: output.range,
      evidence: output.evidence,
      compatibility: output.compatibility?.status,
      ...(output.kind === "ok"
        ? { action: output.action, doses: output.doses }
        : { message: output.message }),
    },
  });
  return output;
}
function amount(value: CalcResult) {
  expect(value.kind).toBe("ok");
  if (value.kind !== "ok") throw Error(value.message);
  for (const dose of value.doses) {
    expect(Number.isFinite(dose.amount)).toBe(true);
    expect(dose.amount).toBeGreaterThanOrEqual(0);
  }
  return value.doses
    .filter((dose) => dose.unit === "mL")
    .reduce((sum, dose) => sum + dose.amount, 0);
}
function compare(test: string, source: string, expected: number, actual: number, tolerance = 1e-9) {
  const difference = Math.abs(expected - actual);
  rows.push({
    test,
    source,
    sourceValue: expected,
    gardenValue: actual,
    difference,
    tolerance,
    pass: difference <= tolerance,
  });
  expect(difference, test).toBeLessThanOrEqual(tolerance);
}
describe("Calculator objective independent validation", () => {
  it("compares GH manufacturer doses at all seven implemented steps and four volumes", () => {
    for (const [index, micro, gro, bloom, min, max] of gh)
      for (const liters of [2, 4, 6.5, 10]) {
        const value = run({ ...base, mode: "recipe", stageId: `feeding-${index}`, liters });
        expect(value.kind).toBe("ok");
        if (value.kind !== "ok") throw Error(value.message);
        [micro!, gro!, bloom!].forEach((ml, i) =>
          compare(
            `GH Light W${index} ${liters}L ${["Micro", "Gro", "Bloom"][i]}`,
            ghUrl,
            (ml * liters) / 3.785411784,
            value.doses[i]!.amount,
            0.000006,
          ),
        );
        expect(value.expectedEc).toEqual({ kind: "manufacturer", min, max });
      }
  });
  it("compares AeroGarden with current official group and feeding instructions", () => {
    for (const pods of [6, 7, 9])
      for (const event of [1, 2, 3, 8]) {
        calculations++;
        const value = executeFreshRecipe({
          recipeId: AEROGARDEN_RECIPE.id,
          podCount: pods,
          feedingIndex: pods === 9 ? event : 1,
        });
        compare(
          `Aero ${pods} pods feeding ${event}`,
          aeroUrl,
          pods === 9 && event >= 3 ? 12 : 8,
          value.value!.parts[0]!.ml,
          0,
        );
      }
    for (const pods of [2, 3, 5, 8, 12]) {
      calculations++;
      expect(
        executeFreshRecipe({ recipeId: AEROGARDEN_RECIPE.id, podCount: pods, feedingIndex: 1 }).ok,
      ).toBe(false);
    }
  });
  it("checks every stored EC and pH range against the OSU table", () => {
    const table: Record<string, [number, number, number, number]> = {
      basil: [1, 1.6, 5.5, 6],
      lettuce: [1.2, 1.8, 6, 7],
      tomato: [2, 4, 6, 6.5],
      pepper: [0.8, 1.8, 5.5, 6],
      strawberry: [1.8, 2.2, 6, 6],
      celery: [1.8, 2.4, 6.5, 6.5],
      spinach: [1.8, 2.3, 6, 7],
      parsley: [1.8, 2.2, 6, 6.5],
      sage: [1, 1.6, 5.5, 6.5],
    };
    for (const [crop, [emin, emax, pmin, pmax]] of Object.entries(table))
      for (const [metric, min, max] of [
        ["EC", emin, emax],
        ["PH", pmin, pmax],
      ] as const) {
        const value = CROP_EVIDENCE.find(
          (item) => item.cropIdentity === crop && item.metric === metric,
        )!;
        compare(`OSU ${crop} ${metric} min`, osuUrl, min, value.observedRange!.min, 0);
        compare(`OSU ${crop} ${metric} max`, osuUrl, max, value.observedRange!.max, 0);
        expect(value.measurementScope).toBe("NUTRIENT_SOLUTION");
        expect(value.stageApplicability).toBe("UNSPECIFIED");
      }
  });
  it("independently recomputes fresh dosing across nine families, six waters, eight targets and four volumes", () => {
    for (const id of [
      "genovese-basil",
      "bibb-lettuce",
      "cherry-tomato",
      "jalapeno-pepper",
      "monterey-strawberry",
      "baby-spinach",
      "flat-leaf-parsley",
      "broadleaf-sage",
      "chinese-light-green-celery",
    ])
      for (const liters of [2, 4, 6.5, 10])
        for (const sourceEc of [0, 0.1, 0.2, 0.35, 0.5, 0.8])
          for (const userTarget of [0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2]) {
            const value = run({ ...calibrated, crops: { [id]: 1 }, liters, sourceEc, userTarget });
            const expected = ((userTarget - sourceEc) * liters * 9) / (0.9 * 4);
            expect(amount(value)).toBeCloseTo(expected, 10);
            if (value.kind === "ok" && expected > 0)
              [4, 3, 2].forEach((part, i) =>
                expect(value.doses[i]!.amount / expected).toBeCloseTo(part / 9, 10),
              );
          }
  });
  it("independently recomputes corrections across actual volumes and measured EC", () => {
    for (const liters of [2, 4, 6.5, 10])
      for (const currentEc of [0.2, 0.8, 1.1, 1.2, 1.8]) {
        const value = run({
          ...calibrated,
          mode: "adjust",
          liters,
          currentLiters: liters,
          currentEc,
        });
        if (currentEc <= 1.2)
          expect(amount(value)).toBeCloseTo(((1.2 - currentEc) * liters * 9) / (0.9 * 4), 10);
        else {
          expect(value.kind).toBe("ok");
          if (value.kind === "ok") {
            expect(value.action).toBe("dilute");
            expect(value.doses[0]!.amount).toBeCloseTo(
              (liters * (currentEc - 1.2)) / (1.2 - 0.2),
              10,
            );
          }
        }
      }
  });
  it("changes automatic crop targets and actionable doses for independently verified crop ranges", () => {
    for (const [id, target] of [
      ["genovese-basil", 1.15],
      ["bibb-lettuce", 1.35],
      ["cherry-tomato", 2.5],
      ["monterey-strawberry", 1.9],
      ["jalapeno-pepper", 1.05],
    ] as const) {
      const value = run({ ...calibrated, crops: { [id]: 1 }, userTarget: null });
      expect(value.target?.value).toBeCloseTo(target, 10);
      expect(amount(value)).toBeCloseTo(((target - 0.2) * 4 * 9) / (0.9 * 4), 10);
    }
  });
  it("independently recomputes top-up using final volume, never nominal capacity", () => {
    for (const currentLiters of [1, 2, 3, 5])
      for (const waterAdded of [0, 0.5, 1, 2])
        for (const currentEc of [0.4, 0.8, 1.1])
          for (const sourceEc of [0, 0.2, 0.5]) {
            const volume = currentLiters + waterAdded;
            const after = (currentEc * currentLiters + sourceEc * waterAdded) / volume;
            expect(
              amount(
                run({
                  ...calibrated,
                  mode: "topup",
                  liters: 10,
                  currentLiters,
                  waterAdded,
                  currentEc,
                  sourceEc,
                }),
              ),
            ).toBeCloseTo(((1.2 - after) * volume * 9) / (0.9 * 4), 10);
          }
  });
  it("checks 2/3/5 crop intersections, zero-width overlap, non-overlap, duplicates and insufficient evidence", () => {
    const cases: [Record<string, number>, string][] = [
      [{ "genovese-basil": 1, "broadleaf-sage": 1 }, "COMMON_OPTIMUM_RANGE"],
      [{ "genovese-basil": 1, "bibb-lettuce": 1, "jalapeno-pepper": 1 }, "COMMON_OPTIMUM_RANGE"],
      [{ "bibb-lettuce": 1, "cherry-tomato": 1 }, "NO_COMMON_OPTIMUM_RANGE"],
      [
        {
          "genovese-basil": 1,
          "sweet-basil": 2,
          "broadleaf-sage": 1,
          "bibb-lettuce": 1,
          "jalapeno-pepper": 3,
        },
        "COMMON_OPTIMUM_RANGE",
      ],
      [{ "bibb-lettuce": 1, "monterey-strawberry": 1 }, "COMMON_OPTIMUM_RANGE"],
      [{ "genovese-basil": 1, petunia: 1 }, "INSUFFICIENT"],
    ];
    for (const [crops, status] of cases) {
      const a = calculatePolycultureRange(contextFor(crops, "gh-flora")),
        b = calculatePolycultureRange(
          contextFor(Object.fromEntries(Object.entries(crops).reverse()), "gh-flora"),
        );
      expect(a.status).toBe(status);
      expect(a.range).toEqual(b.range);
      const recipe = run({ ...calibrated, crops, mode: "recipe" });
      if (recipe.kind !== "ok") throw Error(recipe.message);
      expect(recipe.compatibility?.status).toBe(status);
      const target = run({ ...calibrated, crops, userTarget: null });
      expect(target.kind).toBe(
        status === "COMMON_OPTIMUM_RANGE" && a.range!.min !== a.range!.max ? "ok" : "needs",
      );
    }
    expect(run({ ...calibrated, crops: { "genovese-basil": 1 } }).range).toEqual(
      run({ ...calibrated, crops: { "genovese-basil": 20, "sweet-basil": 5 } }).range,
    );
  });
  it("rejects missing calibration, formulation/stage mismatch, invalid numbers and capacity overflow", () => {
    expect(run(base).kind).toBe("needs");
    expect(run({ ...calibrated, stageId: "feeding-7" }).kind).toBe("needs");
    expect(
      run({
        ...calibrated,
        calibrationObservations: [{ ...observation, formulationVersion: "wrong" }],
      }).kind,
    ).toBe("needs");
    for (const liters of [0, -1, NaN, Infinity])
      expect(run({ ...calibrated, liters }).kind).toBe("needs");
    for (const userTarget of [-1, 0, NaN, Infinity])
      expect(run({ ...calibrated, userTarget }).kind).toBe("needs");
    expect(run({ ...calibrated, liters: 1e308, userTarget: 1e308 }).kind).toBe("needs");
    expect(run({ ...calibrated, mode: "recipe", stageId: "feeding-5", liters: 1e308 }).kind).toBe(
      "needs",
    );
    expect(run({ ...calibrated, mode: "adjust", currentLiters: null, currentEc: 0.8 }).kind).toBe(
      "needs",
    );
    expect(
      run({ ...calibrated, mode: "adjust", currentLiters: 4, capacityLiters: 4, currentEc: 1.8 })
        .kind,
    ).toBe("needs");
    for (const currentLiters of [null, 4])
      expect(
        run({ ...calibrated, mode: "topup", currentLiters, currentEc: 0.8, waterAdded: 1 }).kind,
      ).toBe("needs");
    expect(
      run({ ...calibrated, mode: "topup", currentLiters: 3, currentEc: 2.8, waterAdded: 1 }).kind,
    ).toBe("needs");
    expect(
      run({
        ...calibrated,
        mode: "topup",
        capacityLiters: 4,
        currentLiters: 3,
        currentEc: 0.8,
        waterAdded: 1,
      }).kind,
    ).toBe("needs");
    expect(
      recordActualDoses({
        ...base,
        baselineEc: 0.2,
        resultingEc: 1,
        actualDoses: { micro: "4", gro: "", bloom: "2" },
      }).ok,
    ).toBe(false);
    expect(
      recordActualDoses({
        ...base,
        baselineEc: 1,
        resultingEc: 0.2,
        actualDoses: { micro: "4", gro: "3", bloom: "2" },
      }).ok,
    ).toBe(false);
  });
  it("preserves explicit targets and compares arithmetic without calling it GH calibration", () => {
    const value = run({ ...calibrated, userTarget: 2.2 });
    expect(value.target?.value).toBe(2.2);
    expect(value.outsideEvidence).toBe(true);
    compare(
      "Fresh 4L .20→1.20",
      "SIMULATED CALIBRATION + INDEPENDENT MATHEMATICS",
      10,
      amount(run(calibrated)),
    );
    compare(
      "Correct 4L .80→1.20",
      "SIMULATED CALIBRATION + INDEPENDENT MATHEMATICS",
      4,
      amount(run({ ...calibrated, mode: "adjust", currentLiters: 4, currentEc: 0.8 })),
    );
    compare(
      "Top up 3L@.80 + 1L@.20 →1.20",
      "SIMULATED CALIBRATION + INDEPENDENT MATHEMATICS",
      5.5,
      amount(
        run({
          ...calibrated,
          mode: "topup",
          capacityLiters: 4.1,
          currentLiters: 3,
          waterAdded: 1,
          currentEc: 0.8,
        }),
      ),
    );
  });
});
afterAll(() => {
  expect(calculations).toBeGreaterThanOrEqual(100);
  mkdirSync("qa-calculator", { recursive: true });
  writeFileSync(
    "qa-calculator/numerical-validation.json",
    JSON.stringify(
      {
        calibrationEvidence:
          "SIMULATED QA observation. No empirical product-response validation claimed.",
        calculations,
        externalComparisons: rows.length,
        coverage: buildCropEvidenceCoverage(),
        rows,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    "qa-calculator/scenarios.json",
    JSON.stringify(
      scenarios,
      (_key, value) =>
        typeof value === "number" && !Number.isFinite(value) ? String(value) : value,
      2,
    ),
  );
  writeFileSync(
    "qa-calculator/external-validation.md",
    "# Calculator V1 numerical validation\n\nManufacturer doses are compared with independently transcribed official values checked 2026-10-12. GH uses the published Light Feed program, US revision 07/07/2026. Dose tolerance reflects Garden's existing six-decimal per-liter transcription, not equipment accuracy.\n\nEC dosing checks use a SIMULATED QA observation (4 L; EC 0.20 → 1.10; actual Micro/Gro/Bloom 4/3/2 mL). This is arithmetic validation, NOT empirical calibration and NOT GH validation of an EC-to-dose response. Production contains no fixture response coefficient.\n\n| Test | Source | Source / independent value | Garden value | Difference | Tolerance | Result |\n|---|---|---:|---:|---:|---:|---|\n" +
      rows
        .map(
          (row) =>
            `| ${row.test} | ${row.source.startsWith("https") ? `[Reference](${row.source})` : row.source} | ${row.sourceValue} | ${row.gardenValue} | ${row.difference} | ${row.tolerance} | ${row.pass ? "PASS" : "FAIL"} |`,
        )
        .join("\n") +
      "\n",
  );
});
