# Harvest Use V0.2 — Catalog Expansion

## Status

Harvest Use V0.2 expands the approved V0.1 pattern to the complete current Gardenpedia Library catalog: **41 / 41 plant identities**.

## Product rule

Harvest Use remains a compact post-harvest decision layer, not a recipe collection.

- Show only methods that are useful and supported for that crop.
- Do not fill Fresh / Store / Freeze / Dry for symmetry.
- Do not infer shelf life.
- Keep food-safety guidance separate from quality guidance.
- Prefer institutional preservation sources: USDA / FDA / NCHFP / University Extension and equivalents.
- Preserve identity uncertainty instead of silently mapping a cultivar/species.
- Ornamental or identity-sensitive plants may intentionally have **no preservation method cards**.
- A technically possible method is not automatically a recommended method.

## Coverage

V0.2 covers all 41 current Library records loaded from:

- `data/plants.json`
- `data/plants-current-gardens.json`
- `data/plants-owned-seeds.json`
- `data/plants-expansion-batch-a1.json`
- `data/plants-expansion-batch-b1.json`

The canonical Harvest Use dataset remains `data/harvest-use-v0.1.json` for this iteration to avoid introducing a second asset path during the Vercel hardening cycle. Its internal version is now `0.2`.

## Evidence additions

V0.2 adds or reuses institutional evidence from:

- National Center for Home Food Preservation
- Utah State University Extension
- Penn State Extension
- University of Illinois Extension
- Colorado State University Extension
- existing University of Minnesota / Oregon State sources from V0.1

## Special handling

- Lettuce: fresh + refrigeration prioritized; freezing explicitly not recommended for fresh texture.
- Spinach: freezing shown only with blanching.
- Zucchini, sweet pepper, celery, strawberries: tested preservation methods only.
- Florence fennel: bulb use/storage is kept separate from drying foliage/seed.
- Herbs: drying/freezing only where the institutional source supports the herb or method.
- Delphinium: explicit toxic / do-not-eat state.
- Petunia, ornamental sunflowers, Jolly Jester marigold and sweet alyssum: no culinary method invented.
- Dianthus and zinnia: culinary flower guidance is identity- and pesticide-history-sensitive.

## QA gate

Before calling V0.2 fully validated in runtime:

1. Confirm every one of the 41 Library cards opens without a Harvest Use rendering error.
2. Confirm all 41 identities have a Harvest Use record.
3. Confirm every rendered method source ID resolves to a visible source.
4. Spot-check ES/EN on at least one herb, lettuce, fruiting crop, root crop and ornamental.
5. Confirm ornamental records with no useful preservation method do not render an empty method grid.
6. Confirm Delphinium displays the food-safety warning.
7. Confirm no new shelf-life number was introduced without a source.
8. Confirm Vercel bundles the existing Harvest Use JSON/JS/CSS assets after deploy.

## Commits

- Catalog expansion: `5dc64576501c98a8b03e19a5f3a12036fa40f3c3`
- Source hardening: `763f422c93231280bc23682fe487a9acd84af6e6`
- Renderer polish: `794b54cd3c9f9de8236723be0be806bc65bfe8bd`
