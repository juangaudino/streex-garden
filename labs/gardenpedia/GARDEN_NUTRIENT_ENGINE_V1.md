# Garden Nutrient Engine V1

The canonical engine lives in `apps/garden-x/src/lib/garden-nutrient-engine-v1`.
It is framework-independent and does not persist state or mutate Garden records.

## Operating modes

- `FRESH_RECIPE` executes a verified manufacturer recipe for an exact product and
  formulation. It never falls back to a calibrated EC preparation.
- `FRESH_TARGET_EC` selects comparable crop evidence and may calculate a bounded
  starting policy. It requires applicable evidence unless the user explicitly
  selects a target.
- `EC_CORRECTION` implements measure → calculate → partial dose → stabilize →
  remeasure. Partial-dose fractions are policy, not agronomic truth.
- `TOP_UP_MAINTENANCE` requires actual current volume and labels linear EC mixing
  as an approximation. It never claims that restored EC restores nutrient balance.

## Provenance policy

Every derived claim carries `derivedFrom`. Source observations, manufacturer
instructions, user calibration, deterministic calculations, inferences and user
selections remain separate. Evidence state is controlled (`HIGH`, `MODERATE`,
`LOW`, `CONFLICTING`, `INSUFFICIENT`) and is not a synonym for epistemic origin.

The seven epistemic classes are deliberately finite:

- `SOURCE_BACKED_FACT`: a verified source reports the observation; it is not a
  claim that the observation is universally true.
- `MANUFACTURER_INSTRUCTION`: an exact product/formulation instruction.
- `USER_CALIBRATION`: an observed response for an exact product/recipe context.
- `DETERMINISTIC_CALCULATION`: arithmetic derived from recorded inputs.
- `ENGINE_INFERENCE`: a bounded Garden policy or interpretation, marked with
  `experimentalPolicy` when it is experimental.
- `UNVALIDATED_ASSUMPTION`: an explicit unresolved assumption, never hidden as
  a fact.
- `USER_SELECTED`: an explicit human choice preserved even when it differs from
  applicable evidence.

The propagation order is `CONFLICTING` → `INSUFFICIENT` → `LOW` → `MODERATE`
→ `HIGH`. Derived results cannot report a stronger evidence state than their
  selected dependencies. Every derived claim carries the dependency IDs.

`UNSPECIFIED` stage evidence is not automatically valid for `SEEDLING`. Unknown
measurement scope is not silently converted to nutrient-solution scope. Tier E/F
evidence can be reported but cannot create an automatic EC target or dose.

## Verified product data

The FloraSeries recipe is based on the official General Hydroponics page carrying
the US revision label `07/07/2026`. The current data records the published light
feed schedule values and mixing order as manufacturer instructions.

AeroGarden data is intentionally narrower: the verified 6/7-pod and 9-pod
instructions are executable; unsupported pod counts are rejected instead of
interpolated. A later evidence pass can add 2/3 and 12-pod amounts when a current
manufacturer amount is directly verified.

The crop ranges included in V1 are the explicit OSU crop-level table observations;
they are not cultivar-specific prescriptions and are not copied to crops absent
from that table.

The three manufacturer source references used by this package are intentionally
kept in `src/lib/garden-nutrient-engine-v1/data.ts` as nutrient-engine
provenance. The Gardenpedia editorial source registry remains unchanged at its
canonical 144 records; these recipe references are not plant-catalog enrichment.

The checked official materials did not verify a separate Hardwater FloraMicro
program. V1 therefore preserves that product-identity gap and does not infer an
alternate recipe.

## UI boundary

`ui-contract.json` is the machine-readable contract for the parallel Calculator
UX work. The existing donor Calculator remains a compatibility surface in this
pass; no visual redesign or persistence integration is performed here.
