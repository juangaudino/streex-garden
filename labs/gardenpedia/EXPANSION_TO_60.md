# Garden Labs — Expansion toward ~60 curated plants

Status: staged expansion plan. This is **not** a bulk-import instruction.

## Current principle
The target is approximately 60 useful, evidence-aware plant records. Garden should grow the library in coherent batches instead of ingesting every manufacturer entry blindly.

## Batch A — Home Grown 30 Herb Guide candidates
These varieties are present in `30 Herb Grow Guide 2.pdf` and are candidates for new Garden Labs records after Source Matrix V1 reconciliation:

1. Angelica
2. Anise
3. Arugula — Roquette
4. Basil — Italian Large Leaf ✅ Batch A1
5. Basil — Thai ✅ Batch A1
6. Caraway
7. Cumin
8. Fennel — Florence ✅ Batch A1
9. Lemon Grass ✅ Batch A1
10. Marjoram — Sweet
11. Mint — Mountain
12. Parsley — Triple Curled
13. Peppermint
14. Sorrel — Large Leaf
15. Spearmint ✅ Batch A1

The unchecked entries remain **candidate additions**, not yet promoted Grow Guide records.

## Batch A1 — implemented in GitHub
First five curated additions are now wired into the Lab branch:
- Thai Basil
- Italian Large Leaf Basil
- Florence Fennel
- Lemongrass
- Spearmint

Implementation includes:
- structured EN guide records;
- complete ES translations;
- Tier A/B source registry;
- Home Grown claim-level reconciliation;
- Source Comparison using the already approved `Coincide / Complementa / Difiere` pattern;
- explicit identity hold for Lemongrass at `Cymbopogon spp.` rather than silently choosing `C. citratus` or `C. flexuosus`;
- crop-specific hydro values only where evidence supports them (basil); otherwise hydro remains pending;
- no changes to Seed Inventory because a guide existing is not evidence that User Zero owns that seed.

The Library count becomes **34 guides** after deployment. This batch is still on GitHub and must be deployed through the existing Garden Labs Site workflow before User Zero runtime QA.

## Already represented from the Home Grown guide
The Lab already has records for the other relevant Home Grown guide entries, including Genovese Basil, Sweet Basil, Curled Chervil, Chives, Cilantro, Dill Bouquet, Garlic Chives, Lavender Vera, Common Mint, Evergreen Bunching onion/scallion, Italian Oregano, Italian Giant Parsley, Rosemary, Broadleaf Sage and Thyme-family guidance.

Important identity holds remain in place where the live plant and manufacturer guide do not match exactly — especially German Thyme vs Home Grown’s English Thyme treatment.

## Batch B — User Zero near-future crops
After Batch A source reconciliation, prioritize plants that are realistically likely to enter the actual gardens. Current known candidates include:
- strawberry cultivars suitable for the new fruit/flower system;
- mini sweet pepper;
- dwarf chili pepper;
- additional compact tomato candidate(s) only if physically suitable;
- specialized lettuces selected for flavor/texture and repeat harvest.

Exact cultivars should be chosen before building cultivar-specific records.

## Batch C — coverage / reference crops
Use remaining slots to fill meaningful gaps in:
- compact hydroponic vegetables;
- culinary herbs;
- tea/aromatic herbs;
- compact fruiting plants;
- edible flowers / pollinator reference crops where Garden may need comparison logic.

No filler entries solely to hit the number 60.

## Acceptance checklist for every new plant
- [x] Identity / cultivar resolved enough for display, or an explicit identity hold is shown.
- [x] Tier A/B source found for core biology or record explicitly marked partial.
- [x] Manufacturer/packet source kept separate if available.
- [x] Germination context reconciled.
- [x] Thinning/pod logic does not copy field spacing blindly.
- [x] Harvest/pruning guidance has an explicit evidence class.
- [x] Hydro pH/EC remains pending unless crop-appropriate evidence exists.
- [x] ES/EN naming and aliases added.
- [x] Neighbor/visual layers added only when useful — Batch A1 intentionally does not invent them.
- [x] No canonical Garden X data changed automatically.

## Next gate
1. Deploy the batched Garden Labs update once through Work/Sites.
2. Runtime QA on iPhone for the five new records + Nebuka discoverability.
3. Confirm source-comparison cards remain useful on the new conflict cases, especially Florence Fennel and Lemongrass.
4. Only after that QA, select and build the next five. Do not continue mechanically through the remaining Home Grown list.
