# Compact tomato Plant Profile review — 2026-10-17

## Scope and disposition

Reviewed the existing public Plant Profiles for `tiny-tim-tomato`,
`micro-tom-tomato`, `orange-hat-micro-dwarf-tomato`, and the horticultural type
`patio-tomato` before editing. This is established-plant guidance only; no Seed
Profiles were changed. All four remain **partial**: unknown system fit is not
filled by inference, and Tiny Tim / Micro-Tom maturity timing conflicts remain
visible for later resolution.

## Evidence bundle and scope

- RHS, [Tomato 'Tiny Tim'](https://www.rhs.org.uk/plants/293991/solanum-lycopersicum-tiny-tim/details): named-cultivar bush/cherry identity, full sun, moist but well-drained conditions, broad 0.1–0.5 m size range, container context, bush-pruning guidance and listed potential pests/disorders. The RHS range is retained as reported, not converted to a spacing rule.
- Reimer Seeds, [Tiny Tim Tomato](https://www.reimerseeds.com/tiny-tim-tomato-seeds): seller-listed 10–18 inch plant and 45-day headline. The same page's general tomato table gives 60–90 days to harvest without explaining the start point. The maturity estimate is therefore not treated as a reliable schedule; the cultivation page also mixes cultivar-specific and generic tomato instructions.
- National Parks Board Singapore, [Micro-Tom](https://www.nparks.gov.sg/florafaunaweb/flora/8/4/8412): cultivar-specific determinate/bushy habit, 15–20 cm height, fruit description, 4–6 hours direct outdoor sun, container use, soil/root-zone notes, pest observations and edible use. It reports fruiting at 50–60 days from sowing in one field and 90–120 days in another; this conflict remains unresolved.
- University of Florida IFAS, [compact tomatoes grown indoors](https://blogs.ifas.ufl.edu/news/2022/05/26/uf-research-sheds-light-on-which-compact-tomatoes-grow-well-indoors/): Micro-Tom appears in compact-tomato indoor research; this is not a universal hydroponic suitability or device-fit finding.
- Baker Creek, [Orange Hat](https://www.rareseeds.com/tomato-orange-hat): product-level description of the named extra-dwarf determinate bush (6–9 inches), orange fruit, full-sun/container context, watering/feeding, light pruning, staking and indoor pollination suggestions. These are kept at product scope; its sowing and germination instructions were removed from the Plant Profile rather than duplicated from the Seed Profile.
- Iowa State University Extension, [Growing Tomatoes in Containers](https://yardandgarden.extension.iastate.edu/how-to/growing-tomatoes-containers): general container-tomato guidance on drainage, moisture, harvest cues and moisture-related fruit disorders. No Iowa field spacing, container size, or fertilizer dose was assigned to a named micro-dwarf cultivar.
- University of Minnesota Extension, [Growing tomatoes in home gardens](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/growing-tomatoes): crop-level outdoor moisture, bush/vining distinctions, harvest and problem context. Regional schedules and outdoor sunlight are not converted into indoor settings.

## Profile decisions

- **Tiny Tim:** added cultivar identity, growth, cultivation and care; removed seed germination/thinning material from the established-plant profile; distinguished the RHS and Reimer size ranges; harvest timing is explicitly `needs_validation` because the supplier page conflicts internally; corrected problems to cite the RHS list and UMN symptom context. Soil/container care is supported; a specific indoor-light duration remains unknown.
- **Micro-Tom:** added care and a cautious support note. The general bush-tomato support advice is marked as a Garden adaptation, not a cultivar-specific trial. Retained NParks' time discrepancy as `needs_validation`; left hydroponic suitability unknown despite indoor research.
- **Orange Hat:** added growth, care, support and common-problem context, and added a bilingual Harvest Use record. Removed propagation/germination instructions from Plant Profile. Product claims remain supplier-scoped; disease resistance and hydroponic fit remain unclaimed.
- **Patio tomato:** added container-moisture care while retaining this as a type record, not a cultivar. Exact size, support, maturity and system compatibility remain dependent on the selected named variety or unknown.

## Editorial boundary

No Plant Profile schema extension, compatibility rewrite, Seed Profile edit, or
private Garden X data use was required. Iowa State's container source was added
to the source registry; existing sources were reused only within their stated
crop/cultivar scope. No calculator engine mapping or nutrient recommendation
was created.
