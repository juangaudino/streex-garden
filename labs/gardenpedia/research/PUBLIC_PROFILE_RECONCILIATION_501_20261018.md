# Public Plant Profile reconciliation — 2026-10-18

The generated public Plant Profile index contains **501 unique IDs**. A
read-only reconciliation of the public profile input files and the generated
index explains the apparent 506-versus-501 discrepancy:

- Public profile arrays contain 492 unique IDs, with no duplicates.
- Five of those IDs are explicitly declared aliases in
  `plant-identity-aliases-v1.json`, not separate published identities:
  `parsnip` → `parsnip-pastinaca-sativa`, `rutabaga` →
  `rutabaga-brassica-napus`, `snapdragon` → `snapdragon-antirrhinum-majus`,
  `bachelor-button` → `cornflower-centaurea-cyanus`, and
  `cuban-oregano-plectranthus-amboinicus` → `cuban-oregano-coleus-amboinicus`.
- `plant-profile-enrichment-v1.json` contains 26 curated public enrichment
  records. Twelve IDs overlap the profile arrays and enrich an existing public
  identity; 14 IDs are additional public identities. The publisher explicitly
  treats these as independently reviewed public enrichments; it does not
  publish the private Garden/seed context records from which candidate notes
  originated.
- The union is **492 + 26 − 12 overlaps = 506 unique input IDs**. Five IDs in
  that union are aliases, not separate public identities, leaving
  **506 − 5 = 501 published identities**. The generated index matches this
  501-ID set.

This is an identity/input reconciliation, not a claim that all 501 fichas have
passed the editorial completeness gate. At the time of this 2026-10-18
reconciliation, the inventory recorded 487 complete, 9 partial, and 5 pending.
The five aliases remain searchable/routable aliases; they must not become
duplicate canonical profiles. The 14 enrichment records are public editorial
data and must remain distinct from private `plants-owned-seeds.json` /
`sources-owned-seeds.json` data.

## Inventory follow-up — 2026-10-19

After subsequent individual reviews and evidence-gated updates, the current
501-row inventory records 494 complete, 4 partial, and 3 pending. The catalog
validator currently reconciles 506 editorial input records to 501 published
varieties, reports 1,252 sources and zero unresolved source references; the
publisher succeeds with 501 varieties. This is an editorial-gate count, not a
visual QA claim or a statement that all optional enrichment layers apply to
every plant. The four partial and three pending dispositions remain explicit
where evidence or represented identity does not support safe closure.

## Verification basis

Read-only comparison of the 67 public `plants*.json` input arrays (excluding
private owned-seed and request files), all 26 records in
`plant-profile-enrichment-v1.json`, `plant-identity-aliases-v1.json`, and the
501-key generated public `garden-plant-profile-index.ts`; publisher inclusion
boundary inspected in `scripts/publish-gardenpedia.mjs`.
