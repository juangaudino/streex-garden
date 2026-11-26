# Calculator V1 verification

> Historical integration report: the baseline, catalog counts, product support,
> test totals and deployment status below describe an earlier review and are not
> the current production status. In particular, AeroGarden EC modes can use a
> compatible user calibration. For the current physical QA procedure, see
> [QA-USUARIO.md](./QA-USUARIO.md). This file preserves the original fixtures
> and historical evidence; it does not certify a later release.

## Current continuation snapshot — 2026-11-25

- Worktree branch: `codex/calculator-finalization-20261125`, based on
  `32e289d631d49786881c2d93aca31f4110d9924f` (`origin/main`). Calculator source,
  engine evidence and tests have uncommitted changes in that isolated worktree;
  nothing from this continuation has been committed or deployed.
- The objective calculation suite was rerun: **16/16 tests passed**, producing
  2,013 deterministic calculation cases and 235 numeric comparisons. The
  7-file Calculator/engine regression set passed **248/248 tests**.
- The complete repository suite passed **974/974 tests across 126 files** with
  `--maxWorkers=2` (now configured in GitHub Actions to reduce contention around
  Add Plant's timed interaction tests);
  root typecheck, changed-file ESLint, Vite production build, Gardenpedia content
  validation and whitespace checks passed. Content validation reported 512
  plants, 1,304 sources, 328 Seed Profiles, 464 taxonomy records and zero
  unresolved source IDs.
- The calculator adapter currently exposes **507 identities**, of which 499 are
  non-carnivorous and 8 carnivorous profiles are excluded from nutrient inputs.
  User Zero's 83 non-carnivorous varieties are searchable and exercised through
  Recipe, By EC, Correct and Top Up tests. By EC/Correct/Top Up use simulated
  calibration observations in software tests; those are not real product
  measurements.
- For those 83 varieties at unspecified stage/system, coverage is 7
  `SUPPORTED_DIRECT`, 57 `SUPPORTED_VIA_DEFENSIBLE_MAPPING`, and 19
  `INSUFFICIENT`. Across 6 stages × 7 hydroponic contexts, 70/83 obtain an
  automatic evidence range somewhere; 13 do not. All 83 can still run with an
  explicit user target and compatible measured calibration. The 13 must remain
  visibly `INSUFFICIENT`; no automatic crop EC range is claimed for them.
- The current official manufacturer page documents AeroGarden feeding amounts
  for groups 2/3, 6/7, 9 and 12. These are separate feeding events; unsupported
  intermediate pod counts must not be interpolated. See the updated physical QA
  steps below.
- A peer-reviewed *Tropaeolum majus* cutting-rooting experiment is available as
  a manual-only 1.00 mS/cm contextual choice for the user's *T. minus* Bush
  Nasturtium. It is a different species and propagation outcome, so the value is
  not crop evidence, an optimum, or an automatic target; the identity remains
  `INSUFFICIENT` for automatic EC dosing.
- Physical iPhone QA and a real measured FloraSeries calibration are still
  required before calling the EC response empirically validated. The Mac browser
  is locked and local loopback access is denied in this environment, so no new
  rendered-browser or physical-device QA is claimed.
- Build passed with the app's general bundle warnings: a 695.69 kB minified
  main JavaScript chunk and `photo-renditions.ts` remaining in the static graph
  despite a dynamic import. This pass did not change those modules.

Base under User Zero review: `3654c876e8669fa7aa3e6632372b226630da437c`.
All storage changes are local Calculator settings. No Supabase or canonical Garden writes.

## Functional contract inspected

| Mode    | Inputs that change dose                                                                                      | Inputs that do not change manufacturer dose    | Operation / evidence boundary                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Recipe  | exact product, official feeding step/group, prepared liters for GH                                           | crops, quantities, crop-derived EC target      | Verified manufacturer recipe. Crop compatibility is evaluated separately.                                      |
| By EC   | measured source EC, actual preparation volume, chosen target, exact observed mixture response                | crop counts                                    | Crop range / explicit user target, then volume-normalized user calibration. No fixture response in production. |
| Correct | measured current EC, actual remaining liters, target, applicable mixture calibration; source EC for dilution | nominal capacity as a proxy for current volume | Add measured components or calculate dilution, mix, stabilize, remeasure, recalculate.                         |
| Top Up  | actual remaining liters, water to add, both measured ECs, target, applicable mixture calibration             | universal refill percentages                   | Approximate EC balance at resulting volume; capacity checked. Restored EC is not restored composition.         |

The original Claude HTML and JSON were also inspected in Downloads. They contain estimated AeroGarden/A+B response coefficients, not empirical user calibration. Those estimates are not imported as measured response. V1 manufacturer data is checked against current official sources independently of that prototype.

## Corrections

- Correct and Top Up now normalize the measured response to the actual solution volume.
- Correct explicitly collects remaining volume; it cannot substitute the preparation/capacity field.
- Calibration records actual amounts of all components. The observed ratio has its own signature, separate from the manufacturer recipe context. Subsequent doses preserve that observed mixture rather than assuming the official ratio was actually added.
- The calibration step is directly visible when needed. Its sample volume can differ from the working reservoir volume. EC before and after must be measured; manufacturer expected EC is not a measured calibration.
- Saved Systems preserve mode, explicit target, source EC and whether it was measured, units, product/program, plants/counts, current volume/EC, water addition, equipment resolution and calibration observations.
- Top Up states water addition before nutrient doses and handles above-target dilution/capacity limits explicitly.
- Numeric overflow and invalid inputs cannot produce Infinity/NaN dosing results.
- The source-water input starts unknown, not an invented tap-water EC.
- An actual post-water EC measurement is required before learning from a Top Up. The modeled mixed EC is never saved as a measurement.
- Manufacturer expected EC remains a range, and multi-crop non-overlap never displays one crop's range as a common range.

## Reproducible QA examples

The calibration below is a **simulated software QA observation**, never a production default and never asserted to be a physical measurement:

GH standard formulation, Light Feed / Grow week 2; actual sample **4 L**;
EC before **0.20**, after **1.10 mS/cm**;
actual **FloraMicro 4 / FloraGro 3 / FloraBloom 2 mL**.

An actual user must substitute their own measured before/after EC and actual applied quantities. This test observation demonstrates arithmetic and the complete workflow; it does not empirically validate a product response.

| Fixture | Mode / configuration                                                                                | Independently expected result                                                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A       | Bibb Lettuce, GH, Recipe, Grow week 2, 4 L                                                          | Micro 3.804077554 / Gro 3.592739912 / Bloom 2.747389345 mL (manufacturer chart / exact US gallon conversion); UI 3.80 / 3.59 / 2.75. Manufacturer EC 0.90–1.10; lettuce evidence 1.20–1.80 stays separate.  |
| B       | Genovese Basil, GH, By EC, preparation 4 L, source 0.20, explicit target 1.20, QA observation above | Total 10 mL; components 4.444444 / 3.333333 / 2.222222 mL. This is observed-mixture arithmetic, not a GH feedchart recipe.                                                                                  |
| C       | Same crop/product/target/calibration, Correct, actual remaining 4 L, current EC 0.80                | Total 4 mL; components 1.777778 / 1.333333 / 0.888889. At current 1.10 total is 1 mL; at 1.80 dilution is 2.40 L using source 0.20.                                                                         |
| D       | Same target/calibration, Top Up, capacity 4.1 L, current 3 L at 0.80, add 1 L at 0.20               | Approximate mixed EC 0.65. Total nutrients 5.5 mL: 2.444444 / 1.833333 / 1.222222. Capacity includes headroom for stock; exact capacity 4 L blocks these additions. No claim of restored ionic composition. |
| E       | AeroGarden manufacturer Recipe, 9-pod model, third/later feeding                                    | 12 mL. First and second are 8 mL; 6/7-pod models are 8 mL at each feeding. Reservoir liters are not requested for this recipe.                                                                              |

## External reference checks

- [GH official feed program](https://generalhydroponics.com/pages/flora-series-3-part-feed-program), US revision 07/07/2026: Light Feed, Medium Feed (General Use), and Aggressive Feed (Low Irrigation/Heavy Feeding) are separate manufacturer schedules. Published weeks, all three component amounts, EC ranges, and water-only flush are represented without filling schedule gaps.
- [AeroGarden manufacturer instructions](https://scottsmiraclegro.com/en-us/brands/aerogarden/products/accessories/VB999965.html): supported 6/7/9-pod groups and first/second/later events. The previous product URLs redirect and no longer expose all feeding instructions; source pointers were repaired.
- [OSU HLA-6722](https://extension.okstate.edu/fact-sheets/electrical-conductivity-and-ph-guide-for-hydroponics): every stored EC/pH range, including basil, lettuce, tomato, strawberry and pepper. Stage is unspecified; these are crop-level observations, not cultivar-specific or seedling prescriptions.

`external-validation.md` contains every numerical comparison with source, source value, Garden value, difference, tolerance and status.
`numerical-validation.json` also includes the complete 214-identity evidence coverage report.
`scenarios.json` records each software calculation's inputs and domain result.

Generate the reports with:

```sh
npx vitest run apps/garden-x/src/components/gardenpedia/donor/calculator-objective.test.ts
```

There is no empirical GH EC-to-dose calibration in the inspected repository/prototype. EC math checks use explicitly simulated observations. This must not be described as manufacturer validation of EC dosing.

## Historical scope and known limits

- The following coverage counts are from an older review snapshot, not the
  current 83-variety audit: 49 published identities had explicit defensible
  crop-family evidence mappings and 165 were insufficient. No substring mapping
  or fabricated ranges.
- A+B remains unavailable without an exact product/formulation.
- AeroGarden V1 exposes verified Recipe support for 6/7/9-pod models. Its EC modes are explicitly unavailable in this interface. Other groups are not interpolated.
- One observation provides a local response estimate with LOW evidence and extrapolation warnings. Remeasurement remains necessary.
- Shared type-only fixes and duplicate object-key cleanup preserve effective runtime copy. The Calculator typecheck uses the existing strict compiler settings.
- The broad suite has one pre-existing Compare failure, reproduced independently on the reviewed base. Calculator/Gardenpedia relevant tests must pass; that unrelated failure is reported, not hidden or edited away.
- Chromium/browser rendering does not establish physical iPhone or empirical nutrient-response validation.

## Historical automated check snapshot

- Relevant Gardenpedia/Calculator/engine suite: 14 files, 98 tests passed.
- Numerical matrix: 2,013 executed calculations; 235 numeric comparisons passed, including 232 comparisons tied to cited references and 3 independently recomputed simulated-calibration cases. The simulated cases verify arithmetic only, not empirical nutrient response.
- Full repository suite with four workers: 634 passed, 1 failed. The same Compare Timeline-query assertion fails on the unchanged reviewed baseline; no Compare code was changed. An unbounded-worker run additionally timed out in AddPlant; isolated and four-worker runs pass that file.
- Root typecheck and the strict Calculator dependency-graph typecheck passed. This does not assert that unrelated app-wide pre-existing TypeScript errors were repaired.
- Changed-file lint, production build, content validation and diff whitespace checks passed.
- Canonical counts unchanged: 214 identities, 211 Seed Profiles, 144 sources, 171 taxonomy records; zero unresolved source IDs.
- Browser workflow details and measured widths are in `browser-validation.md`.

The requested empirical-calibration gate is **not proven** by these checks. An actual measured exact-product observation is needed for that gate. The software accepts, saves and consumes such observations; simulated QA entries must never be relabeled as physical evidence.

## Preview platform prerequisite

Vercel rejected the initial Preview because `@tanstack/react-start@1.168.32` is affected by [CVE-2026-102989 / GHSA-qx66-fv34-fjm8](https://github.com/TanStack/router/security/advisories/GHSA-qx66-fv34-fjm8). The corrective branch pins the official patched Start `1.168.60` and its matching Router `1.170.41`. No unsafe deployment bypass is enabled. Production/main are not changed by this branch-only prerequisite.
