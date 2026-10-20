# Harvest Use V0.2 — Catalog Expansion

## Status

Harvest Use V0.2 began with a 41-identity Library snapshot. The public catalog has since grown to 501 Plant identities; the merged runtime layer currently has records for **373 / 501** identities. This is a record-coverage count, not a completion score: some plants are ornamental, unsafe, or otherwise inapplicable to culinary use, and may correctly have no method card. The layer remains in progress.

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

The original 41-record snapshot was loaded from:

- `data/plants.json`
- `data/plants-current-gardens.json`
- `data/plants-owned-seeds.json`
- `data/plants-expansion-batch-a1.json`
- `data/plants-expansion-batch-b1.json`

The base Harvest Use dataset remains `data/harvest-use-v0.1.json` for this iteration. Its internal version is `0.2`; the file contains 67 plant records. The Gardenpedia adapter also merges `data/harvest-use-richness-additions.json` (324 identities, with 18 overlaps), so **373 unique public Plant identities currently have a Harvest Use record in the app**. The 501-row Plant Profile inventory marks the same 373 identities as covered; a direct ID-set comparison found no unmatched Harvest Use records or inventory flags. This is record coverage, not a claim that all remaining identities need food-use methods: ornamental, toxic, or otherwise inapplicable records may correctly have no method card.

## Evidence additions

V0.2 adds or reuses institutional evidence from:

- National Center for Home Food Preservation
- Utah State University Extension
- Penn State Extension
- University of Illinois Extension
- Colorado State University Extension
- existing University of Minnesota / Oregon State sources from V0.1
- Iowa State Extension crop/type guidance for Capsicum harvest, culinary use and handling
- Iowa State Horticulture Research Station Shishito description
- Utah State University Extension garlic and shallot harvest/use references
- UMN Extension and Oregon State crop-level guidance for bunching onions

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

1. Confirm representative Library cards across the full catalog open without a Harvest Use rendering error.
2. Continue adding identity-appropriate records until all 501 identities have a reviewed record, including explicit non-edible/not-applicable dispositions where evidence supports them.
3. Confirm every rendered method source ID resolves to a visible source.
4. Spot-check ES/EN across herbs, leafy crops, fruiting crops, roots and ornamentals in each review batch.
5. Confirm ornamental records with no useful preservation method do not render an empty method grid.
6. Confirm Delphinium displays the food-safety warning.
7. Confirm no new shelf-life number was introduced without a source.
8. Confirm Vercel bundles the existing Harvest Use JSON/JS/CSS assets after deploy.

## Commits

- Catalog expansion: `5dc64576501c98a8b03e19a5f3a12036fa40f3c3`
- Source hardening: `763f422c93231280bc23682fe487a9acd84af6e6`
- Renderer polish: `794b54cd3c9f9de8236723be0be806bc65bfe8bd`
