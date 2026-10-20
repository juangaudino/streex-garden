# Aromatic culinary herbs — Plant Profile review cohort

Date: 2026-10-17
Scope: five existing Plant identities only; no Seed Profile, compatibility, taxonomy, or private-user records were rewritten.

## Editorial decisions

| Identity | Review outcome | Evidence and useful content | Deliberately unresolved |
|---|---|---|---|
| `cilantro` | Partial | Rechecked the established-plant guidance against Utah State University Extension: cool-season growth, established watering, crop-specific leaf harvest, flowering/seed transition, root-disturbance caution, leafhopper/aster-yellows signs, and existing bilingual Harvest Use. The profile's unknown hydroponic targets remain explicit. | No crop-specific hydroponic nutrient target was added; generic herb values were not borrowed. |
| `lemongrass-homegrown` | Pending | Added Wisconsin Extension's genus-scoped clump dimensions, warm/moist outdoor cultivation context, frost risk, outer-stalk harvest cue, and culinary method. Existing Seed Profile remains the seed-stage protocol. | Home Grown identifies only `Cymbopogon spp.`. Wisconsin distinguishes `C. flexuosus` and `C. citratus`; neither is silently selected. Indoor/hydroponic fit remains unknown. |
| `cuban-oregano-coleus-amboinicus` | Complete | Kew's accepted `Coleus amboinicus` identity reconciled with the `Plectranthus amboinicus` name used by NC State and UF/IFAS. Added UF/IFAS partial-shade, drainage, regional watering, frost sensitivity, culinary intensity, and a bilingual Harvest Use method. | NC State's 1–3 ft garden dimensions and UF/IFAS's ~19 in Florida height are retained as source-contextual observations, not collapsed into one guaranteed mature size. Hydroponics remains unknown, not asserted. |
| `hoja-santa-piper-auritum` | Complete | Preserved Kew/RHS species identity and RHS garden-context cultivation; added RHS problem-context limits and SARE's as-needed leaf harvest evidence. Added bilingual Harvest Use and capability-aware problem content. | No fixed first-harvest age, leaf-removal percentage, recipe, medicinal claim, or hydroponic suitability is inferred. |
| `mexican-oregano-lippia-origanoides` | Partial | Reconciled Kew-accepted `Lippia origanoides` with `Lippia graveolens` as synonym. Illinois Extension's specific Mexican-oregano culinary statement now supports use; a peer-reviewed Yucatán study is explicitly limited to local wild/managed harvest context. Added bilingual Harvest Use. | The Yucatán harvest season/practices are not generalized to containers or other regions. The selected evidence still does not establish a dependable home-growing or propagation protocol. |

## Source-scope decisions

- Wisconsin Extension covers *Cymbopogon* at genus level and explicitly distinguishes two culinary species; it does not resolve the represented Home Grown packet.
- UF/IFAS and NC State both cover Cuban oregano under the older name `Plectranthus amboinicus`; Kew is the taxonomy authority for the accepted `Coleus amboinicus` identity. Their dimensions remain separately attributed to their regional contexts.
- The RHS `Piper auritum` profile is UK horticultural guidance. Partial shade is not converted to an indoor light tier, nor soil/container advice to hydroponics.
- Illinois Extension's generic oregano growing/harvesting instructions are not treated as Mexican-oregano cultivation evidence. Only its explicit Mexican type identity/use statement is used. The SciELO study is regional evidence, not a home-garden protocol.

## Boundary and validation notes

### Lemongrass Plant/Seed boundary follow-up — 2026-10-19

Removed the Plant Profile's `germination` and seedling `thinning` sections and
the germination metric. Those instructions remain in the existing Seed Profile
V0, which owns seed-to-establishment guidance. The Plant Profile retains adult
clump growth, outdoor cultivation, frost/care, harvest/use, flowering, problems
and the explicit unknown compact-system fit. Status remains pending because the
Home Grown packet does not identify the exact *Cymbopogon* species and available
evidence does not validate small-system suitability.

- Plant Profiles remain distinct from Seed Profiles and private seed inventory.
- No nutrient-engine mapping, indoor-light equivalence, pod spacing, hydroponic compatibility, or private context was created.
- All added content has EN/ES counterparts; the edited data files parse as JSON, the cohort's own source references resolve against the loaded registry, and `git diff --check` passes. The full content validator currently stops on an unrelated existing dangling reference, `ncsu-colocasia-esculenta-wave62`, in the Colocasia compatibility profile; publisher validation is therefore not yet confirmed.
- The two `complete` outcomes are specific to the Plant Profile rubric; unresolved suitability is represented as unknown and is not a claim of system compatibility.
