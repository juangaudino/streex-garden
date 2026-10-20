# Gardenpedia identity reconciliation — 506 source records to 501 canonical identities

## Result

The 506 records loaded by the canonical publisher are unique source-record IDs,
not 506 distinct public plant identities. The existing alias reconciliation
maps five duplicate/common-name/synonym records to five canonical IDs, leaving
501 canonical identities in the generated public manifest:

| Alias record | Canonical public identity | Reconciliation basis |
|---|---|---|
| `parsnip` | `parsnip-pastinaca-sativa` | Same species-level *Pastinaca sativa* crop; the generic “Parsnip type” is not a distinct cultivar. |
| `rutabaga` | `rutabaga-brassica-napus` | Same species-level *Brassica napus* rutabaga crop form; no named selection distinguishes the records. |
| `snapdragon` | `snapdragon-antirrhinum-majus` | Common-name/ID alias for the same non-cultivar *Antirrhinum majus* record. |
| `bachelor-button` | `cornflower-centaurea-cyanus` | Same *Centaurea cyanus* identity; canonical target retains the scientific name to disambiguate the common name. |
| `cuban-oregano-plectranthus-amboinicus` | `cuban-oregano-coleus-amboinicus` | Kew's accepted name *Coleus amboinicus* and synonym *Plectranthus amboinicus*; not true *Origanum* oregano. |

## Verification

- Publisher input: 506 records across the configured plant files; all 506 IDs
  are unique.
- Alias records: 5; each alias and target exists, and all alias source
  references pass the existing Gardenpedia content validator.
- Canonical identities after excluding aliases: 501.
- The publisher's generated manifest reports 501 varieties and retains all
  five alias-to-canonical mappings for resolution; the five aliases are not
  emitted as duplicate canonical profiles.
- This reconciliation reuses the existing alias contract. It adds no plant,
  changes no identity mapping, and does not access or publish private inventory
  data.
