# Source-record to public-identity reconciliation — 2026-10-17

## Verified counts

- Editorial Plant source records loaded by `gardenpedia-content-validation.mjs`: **506**.
- Unique source IDs: **506**; duplicate IDs across the loaded source files: **0**.
- Public Plant Profile index: **501** identities.
- Public IDs absent from the source set: **0**.
- Source IDs absent from the public profile index: **5**. All five are recorded in `plant-identity-aliases-v1.json` as aliases of an existing published identity; they are not additional public plants.

## Alias reconciliation

| Non-published source ID | Published canonical ID | Basis in alias registry |
| --- | --- | --- |
| `parsnip` | `parsnip-pastinaca-sativa` | Same species-level parsnip crop identity; “Parsnip type” is not a distinct cultivar. |
| `rutabaga` | `rutabaga-brassica-napus` | Same species-level rutabaga crop form; no distinct named cultivar or infraspecific identity. |
| `snapdragon` | `snapdragon-antirrhinum-majus` | Same non-cultivar species record; tall and dwarf cultivars remain unassigned. |
| `bachelor-button` | `cornflower-centaurea-cyanus` | Common-name alias for *Centaurea cyanus* in these records; canonical identity retains scientific name because the common name can be ambiguous. |
| `cuban-oregano-plectranthus-amboinicus` | `cuban-oregano-coleus-amboinicus` | Kew-accepted *Coleus amboinicus* with *Plectranthus amboinicus* as a synonym; not a true *Origanum* oregano. |

Each alias entry carries source IDs supporting the mapping. This reconciliation
does not merge public records at render time and does not authorize copying
profile content across identities without checking claim scope. The 501-row
inventory therefore tracks published canonical IDs only.

## Reproduction

Counts were derived by reading the exact plant-file list in
`scripts/gardenpedia-content-validation.mjs`, comparing its unique `id` values
with the generated `garden-plant-profile-index.ts`, then checking the five
source-only IDs against `plant-identity-aliases-v1.json`.
