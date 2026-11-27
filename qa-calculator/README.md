# Calculator V1 verification

> This file preserves historical fixtures and earlier integration reports for
> context. The current production and validation snapshot follows immediately;
> sections titled “Historical” are superseded. For the physical QA procedure,
> see [QA-USUARIO.md](./QA-USUARIO.md). Neither software tests nor a READY
> deployment certify a real nutrient-response calibration or physical iPhone QA.

## Current production snapshot — 2026-11-26

- Baseline `main` before this calculator follow-through:
  `5849129f32dccd47c05257fcadb2be14ec75a460` (`Clarify calculator plant
  stage references`). Vercel confirmed this same commit **READY** on the
  production alias `https://garden.getstreex.com`. This follow-through adds a
  mixed-stage recipe compatibility guard without changing recipe math or
  canonical data.
- The latest production browser smoke selected AeroGarden Recipe, added Bibb
  Lettuce, and confirmed the crop compatibility disclosure showed the
  applicable 1.20–1.80 mS/cm range and sources while the official 8.00 mL dose
  stayed unchanged. Removing the crop cleared that evidence back to
  `INSUFFICIENT` while preserving the 8.00 mL manufacturer dose. This was a
  desktop in-app browser check, not physical iPhone QA.
- Calculator evidence follow-ups were merged through PRs #25, #26 and #27.
  The latest changes preserve explicit crop-stage/system evidence boundaries,
  correct the Jolly Jester species boundary, add sourced transition cues,
  require explicit composition for mixed-age/stage reservoirs, and cache the
  canonical plant-search index so bilingual coverage checks stay within the
  test timeout. Later main commits add an explicitly optional shared-tank
  compromise when crop ranges do not overlap, preserve the strawberry study's
  manual-target semantics, and expose Epazote study choices without turning
  them into automatic crop ranges.
- The catalog adapter exposes 507 identities; 499 are nutrient-calculator
  eligible and 8 carnivorous profiles are intentionally excluded. All 83 of
  User Zero's non-carnivorous varieties are searchable and covered by
  deterministic Recipe, By EC, Correct and Top Up tests.
- At unspecified stage/system, the 83-variety audit classifies 7 as
  `SUPPORTED_DIRECT`, 57 as `SUPPORTED_VIA_DEFENSIBLE_MAPPING`, and 19 as
  `INSUFFICIENT`. Across the tested 6 phenological stages × 8 hydroponic
  systems, 70/83 have an automatic evidence range in at least one context;
  13 remain insufficient in every tested context. Those 13 still support an
  official recipe or an explicit user target with compatible exact-product
  calibration; the UI must not turn manual study observations into automatic
  crop optima.
- All **83/83** varieties also have at least one cited stage-observation or
  cultivation-context reference available to the Calculator. **67/83** have a
  published age window that can be shown as a confirmation cue. For the other
  16—Broadleaf Sage, Common Fenugreek, Common Mint, Mexican Tarragon, Monterey
  Strawberry, Papalo, Marjoram, Borage, Chamomile (species unspecified),
  Peppermint, Crimson Giant Radish, Curled Chervil, Lemon Balm, Tennessee
  Coneflower, Bush Nasturtium and Bull's Blood Beet—the user can still choose
  the observed stage and open the plant's cited context, but the Calculator
  does not invent a day-to-stage window. Age is never an automatic dose input.
- Local verification on the baseline plus this follow-through passed the full
  suite: **1,012/1,012 tests across 126 files**, including **171/171** focused
  Calculator tests. Typecheck, changed-file lint and production build also pass.
  Gardenpedia content validation passed. Content counts:
  512 plant source records, 1,304 sources, 328 Seed Profiles, 464 taxonomy
  records, and 0 unresolved source IDs.
- Latest Calculator interaction suite: **47/47**. The full suite includes the
  83-variety coverage and four-mode fixtures.
- A regression now traverses all 83 owned varieties and requires at least one
  HTTPS-backed age, seed-transition, crop-stage or public profile reference for
  stage context. It deliberately does not require an age window where sources
  do not support one.
- Production browser inspection also verified Calculator loads in Spanish, the
  four modes are present, Quick Mix starts empty, and the default FloraSeries
  Recipe shows FloraMicro, FloraGro, FloraBloom and the manufacturer EC range.
- Physical iPhone QA and a real measured FloraSeries calibration are still
  pending. Simulated software observations validate arithmetic only; they are
  not empirical product-response measurements. Do not mark the Calculator
  empirically validated until User Zero records and reviews a real calibration.

### Mixed-stage recipe boundary regression

The official manufacturer recipe remains executable even if a grower marks a
crop as mixed-stage but declares fewer distinct stages than plants. In that
case, the manufacturer dose is unchanged and Garden withholds crop compatibility
and any common range until the stage composition is complete. A recipe step is
not plant phenology, and this guard does not make it one.

### Additional age-context coverage — 2026-11-26

- Added source-backed nursery or germination context for Nebuka/bunching onion,
  perpetual spinach, Hon Tsai Tai, Scarlet Red Tatsoi, purple kohlrabi and the
  miniature/spray Dianthus mix. Tatsoi also has a separately labeled floating-
  culture trial reference.
- These references do not assign phenological stage or change an EC range or
  dose. The grower must inspect the plant and confirm a suggested stage. Garden
  does not convert an unsupported sowing-day count into a stage.
- The exact cultivar/system boundary is retained in each note: garden and
  nursery timing is not presented as a hydroponic transition, and supplier
  germination windows only indicate emergence context.
- Added a regression assertion that every registered nutrient source ID is
  unique and every source URL is HTTPS. Focused age/stage and Calculator UI tests
  pass **102/102**; the full suite passes **1,023/1,023**. Typecheck, the Garden
  build, content validation and changed-file lint pass. Build regenerated only
  the manifest timestamp; that noise is excluded from the change.
- The detailed per-identity audit for the 83 owned varieties, including the
  default evidence class and stage/system contexts that resolve, is in
  [`coverage-83-varieties.md`](./coverage-83-varieties.md).

## Historical continuation snapshot — superseded

- Isolated worktree: `/private/tmp/garden-calculator-online-review`, branch
  `codex/calculator-online-review-2026-11-26`, base/HEAD snapshot
  `084e330830df34b934672debc1caaaf5fedb3928`. The original checkout and its
  unrelated work remain untouched. The reviewed Calculator delta is limited to
  the files listed in the current change set; generated `.output`, `.wrangler`
  and `public/grow-guide-lab` directories are excluded.
- The objective calculation suite passed **16/16**, producing 2,013
  deterministic calculation cases and 235 numeric comparisons. The full
  repository suite passed **986/986 tests across 126 files** with
  `--maxWorkers=2`. Typecheck, changed-file ESLint, Vite production build,
  Gardenpedia content validation and `git diff --check` passed. Content
  validation reported 512 plants, 1,304 sources, 328 Seed Profiles, 464
  taxonomy records and zero unresolved source IDs.
- The calculator adapter currently exposes **507 identities**, of which 499 are
  non-carnivorous and 8 carnivorous profiles are excluded from nutrient inputs.
  User Zero's 83 non-carnivorous varieties are searchable and exercised through
  Recipe, By EC, Correct and Top Up tests. By EC/Correct/Top Up use simulated
  calibration observations in software tests; those are not real product
  measurements.
- For those 83 varieties at unspecified stage/system, coverage is 7
  `SUPPORTED_DIRECT`, 57 `SUPPORTED_VIA_DEFENSIBLE_MAPPING`, and 19
  `INSUFFICIENT`. Across 6 stages × 8 hydroponic contexts, 70/83 obtain an
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
- Local rendered-browser review was completed on the Calculator page: Recipe
  rendered its three FloraSeries components and manufacturer EC range; By EC
  showed Basil's 1.00–1.60 mS/cm reference and correctly required an applicable
  calibration before producing a dose; Correct and Top Up exposed their
  distinct measured-state inputs. This was a desktop local-browser check, not
  iPhone QA or an empirical nutrient-response test.
- Physical iPhone QA and a real measured FloraSeries calibration are still
  required before calling the EC response empirically validated.
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

## Historical continuation — 2026-11-26 (superseded by production snapshot)

- Worktree: `/private/tmp/garden-calculator-online-review`, branch
  `codex/calculator-online-review-2026-11-26`, based on local
  `origin/main` snapshot `084e330830df34b934672debc1caaaf5fedb3928`.
- Added a bilingual, source-linked Tulsi development cue from a primary DFT
  study: its seedlings were transplanted at 14 days after leaves and roots had
  developed. This is a comparison for the grower to confirm, not an automatic
  phenological transition or EC recommendation. Added the University of
  Arkansas Komatsuna thesis timeline for two true leaves around day 14 and at
  least four by the end of week three; the UI still requires the grower to
  confirm the stage. Neither cue changes EC evidence or dose logic.
- Validation on this worktree: focused stage/storage tests **33/33**; full suite
  **986/986** across 126 files; typecheck, changed-file ESLint,
  `git diff --check`, and Gardenpedia content validation passed. Content
  validation reports 512 plants, 1,304 sources, 328 Seed Profiles, 464 taxonomy
  records, and zero unresolved source IDs. `npx vite build` passed; it retains
  the existing 695.70 kB main-chunk warning and ineffective dynamic-import
  warning for `photo-renditions.ts`.
- This continuation did not change the database, canonical catalog, or Supabase.
  The Calculator changes were published to `main` in commit
  `c80815267ca596561cdafad02128e915bf38f258` and its production deployment is
  READY. Physical iPhone QA and empirical nutrient calibration remain
  outstanding.
- Added a browser-storage resilience regression: the Calculator still renders
  when private browsing blocks `localStorage`; a failed local save leaves the
  system-name form open and reports the failure without interrupting use.
- Local desktop-browser check opened `/gardenpedia/?view=calculator`, verified
  the FloraSeries Recipe result and range, then checked By EC, Correct and Top
  Up input states. By EC showed the Basil evidence range and withheld a dose
  until an applicable calibration existed. This is not mobile/iPhone QA or
  empirical nutrient-response validation.

## Preview platform prerequisite

Vercel rejected the initial Preview because `@tanstack/react-start@1.168.32` is affected by [CVE-2026-102989 / GHSA-qx66-fv34-fjm8](https://github.com/TanStack/router/security/advisories/GHSA-qx66-fv34-fjm8). The corrective branch pins the official patched Start `1.168.60` and its matching Router `1.170.41`. No unsafe deployment bypass is enabled. Production/main are not changed by this branch-only prerequisite.
