# HydroGardenAdvisor: benchmark notes for Garden Calculator

**Purpose:** reference the product's useful workflow ideas without copying its
interface, assumptions, or nutrient recommendations. This is a product audit,
not agronomic evidence for Garden's crop ranges.

## Verified public facts

- The official [App Store listing](https://apps.apple.com/nz/app/hydrogardenadvisor/id6807613285)
  describes HydroGardenAdvisor as an iPhone growing coach for lettuce, leafy
  greens, herbs, and fruiting crops. It says plans use crop and system context,
  reservoir size, nutrient mix, cultivar selection, and week-by-week expectations.
- The listing describes a separate photo-check flow, harvest logging, and
  carry-forward of lessons into a later grow. It also advertises a dedicated
  EC Adjust calculator that considers reservoir size and returns concentrate
  or dilution quantities.
- Its visible setup screen (Juan's screenshots) asks for system type, crop,
  optional cultivar preference, reservoir size, nutrient system, daily light
  hours, and optional experience level. Crop selection opens a small category
  picker before showing individual crops.
- The listing's version notes describe recent nutrient-mix and EC-adjust
  refinements, including measured source-water EC for dilution. These are
  vendor-published feature claims; this audit does not independently validate
  the app's calculations.

## What this suggests for Garden

1. Keep the current Calculator focused on the task the user opened: prepare a
   fresh recipe, dose toward an explicit EC, correct a measured reservoir, or
   top it up. Garden already has these four distinct modes and a more explicit
   source/evidence/calibration model.
2. A setup context can be useful when it changes a real calculation. In V1,
   volume, source-water EC, exact product/formulation, measured reservoir
   state, user target, calibration, selected crops, and confirmed crop stage
   already have defined roles. Do not add light-hours or experience controls
   to nutrient math unless a verified rule actually uses them.
3. Treat plant planning, light schedules, photo diagnosis, and harvest
   learning as adjacent Garden features. They should not be used to disguise
   missing calibration or crop evidence in the nutrient calculator.
4. Preserve the useful picker pattern as a future interaction reference:
   choose a crop category, then a crop, then an optional cultivar. Garden's
   existing canonical searchable picker remains the source of plant identities.
5. Any future per-grow plan should retain the distinction among a measured
   fact, a manufacturer instruction, a user choice, an engine calculation,
   and an uncertain inference. An app-store claim that a plan is “exact” is
   not evidence for a Garden EC target.

## Explicit non-conclusions

- The app listing and screenshots do not establish the correctness or
  provenance of its nutrient schedules, stage rules, light-hour advice, or
  photo diagnoses.
- The screenshots are not a reason to reproduce the visual design.
- No HydroGardenAdvisor values were copied into Garden's canonical crop
  evidence or nutrient-engine data.

