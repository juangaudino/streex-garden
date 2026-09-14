# Garden Labs — Source Matrix V1

Status: active policy for Grow Guide enrichment and expansion toward ~60 curated plants.

## Core decision
Garden does **not** choose one universal “best source.” It chooses the strongest source **per claim** and preserves provenance when credible sources disagree.

The operating rule is:

> claim first → context second → source class third → reconciliation before promotion.

A high-quality source can be strong for one claim and weak for another. Manufacturer guidance can corroborate a harvest cue while being rejected for taxonomy, hydroponic translation, or a contradictory paragraph.

## Source classes

### Tier A — Extension / university / research / government
Preferred for:
- taxonomy and species-level identity;
- crop biology and lifecycle;
- bolting / flowering behavior;
- diseases and physiological problems;
- established harvest and crop-management practices;
- hydroponic pH / EC / nutrient-system guidance **when the publication is actually hydroponic/CEA-specific**.

Current examples used by Garden Labs:
- Utah State University Extension;
- University of Minnesota Extension;
- University of New Hampshire Extension;
- UF/IFAS Extension;
- Oklahoma State University Extension;
- University of California Agricultural Experiment Station / UC ANR.

Important: a soil-focused Extension page is not automatically authoritative for a countertop hydroponic pod count or hydroponic nutrient target.

### Tier B — Specialist grower references
Preferred for:
- practical sowing/transplant workflows;
- production-oriented spacing/thinning context;
- cultivar/crop handling where Extension is silent;
- pruning / harvest technique from professional production practice;
- hydroponic/container guidance when explicitly crop-specific.

Primary current example: Johnny’s Selected Seeds Grower’s Library.

Garden treats Johnny’s as a strong practical source, but a commercial grower reference still does not override stronger research evidence automatically.

### Tier C — Manufacturer / packet guidance
Preferred for:
- exact commercial variety name printed on the packet;
- packet germination rate, purity, quantity and maturity claims;
- manufacturer-specific germination / harvest cues;
- useful corroboration or additional context.

Current examples:
- Home Grown grow guides;
- Ferry-Morse product/packet guidance.

Rules:
- manufacturer guidance is non-canonical by default;
- never silently overwrites Tier A/B evidence;
- internal inconsistencies remain visible;
- soil/container spacing is never translated directly into hydroponic pod rules.

### Tier D — Retailer / secondary web reference
Use only when stronger sources are unavailable and the claim is low risk, or as a discovery lead that still needs reconciliation.

Do not use Tier D alone for:
- botanical identity when disputed;
- hydroponic pH/EC targets;
- toxicity/safety claims;
- disease diagnosis;
- aggressive pruning/harvest instructions.

## Claim-by-claim source policy

| Claim | Preferred source order | Garden rule |
| --- | --- | --- |
| Exact packet identity | packet evidence → Tier A/B reconciliation | Packet text is a fact about the packet, not automatically the live plant. |
| Species / taxonomy | Tier A research/Extension → Tier B → manufacturer | Conflict = identity hold; no silent correction. |
| Germination time | exact cultivar manufacturer + Tier A/B crop guidance | Keep contextual ranges when methods/temperatures differ. |
| Thinning / plant count | crop habit + system geometry + Tier A/B | Never copy field spacing into a pod count. |
| Pruning | Tier A/B crop-specific | Garden adaptation must be labeled when translating to countertop systems. |
| Harvest cue / method | Tier A/B + exact cultivar manufacturer | User Zero’s real plant condition can delay/modify a generic cue. |
| Flowering / bolting | Tier A/B | Treat as plant stage first, recommendation second. |
| Hydroponic pH / EC | hydroponic/CEA Tier A first; crop-specific Tier B second | No generic “herb range” when crop-specific evidence is missing. |
| Problems / disease | Tier A diagnostic sources | AI should connect symptoms to photos/history, not diagnose from age alone. |
| Actual sowing / germination / harvest event | User Zero canonical history | Real observed event outranks generalized timing tables for that plant. |

## Current source verdict
The existing combination is directionally correct and should be **expanded, not replaced**:

- **USU** remains valuable for garden/crop biology and local Extension guidance.
- **Johnny’s** remains valuable for practical crop handling and some hydro/container production guidance.
- **UF/IFAS + Oklahoma State** strengthen hydroponic-specific coverage.
- **Other university Extensions** are added when they have a stronger crop-specific page than USU.
- **Home Grown** remains a manufacturer layer, useful but explicitly reconciled claim by claim.

There is no reason to force every plant to use the same publisher.

## Promotion states
Every new external claim should resolve to one of:
- `corroborates` — supports current Garden guidance;
- `near_match` — compatible range/context;
- `manufacturer_context` — useful but lower-tier context;
- `context_difference` — both can be true under different conditions;
- `context_conflict` — methods/settings differ materially;
- `material_conflict` — claims materially disagree;
- `manufacturer_only_candidate` — retain but do not promote;
- `needs_validation` — insufficient evidence.

Only reconciled, useful claims are promoted into the primary Grow Guide.

## Nebuka test case
`Evergreen Bunching Nebuka` demonstrates why this matrix exists:
- Home Grown uses `Nabuka` but identifies `Allium fistulosum`;
- User Zero history and independent references use `Nebuka`;
- Johnny’s supports clustered bunching-onion culture;
- Home Grown’s 6–12 inch field spacing is not a pod rule;
- Home Grown’s later “bulb development” wording conflicts with the non-bulbing species identity and is excluded from promoted Garden guidance.

The correct Garden behavior is not to pick a winner silently; it is to preserve provenance and promote only the reconciled claim.

## Expansion rule toward ~60 plants
A plant may enter the curated Garden Labs library when:
1. identity is sufficiently resolved;
2. at least one useful Tier A/B source exists for core crop behavior, or the record is explicitly marked partial;
3. Home Grown/packet evidence is kept as a separate manufacturer layer when available;
4. hydroponic claims remain pending unless supported by an appropriate source;
5. the plant is relevant to User Zero, a realistic near-future crop, or a deliberate reference crop.

The goal is **~60 useful plants**, not 60 filler records.
