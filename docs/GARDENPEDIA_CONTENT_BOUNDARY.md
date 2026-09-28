# Gardenpedia content boundary

Gardenpedia remains in the canonical `juangaudino/streex-garden` repository, but its editorial content has an explicit ownership boundary from Garden X product code.

## Canonical locations

- Public plant, seed, and machine knowledge: `labs/gardenpedia/data/`
- Gardenpedia editorial/runtime helpers: `labs/gardenpedia/`
- Source/evidence records: `labs/gardenpedia/data/sources*.json`
- Published Garden X catalog manifest: generated `apps/garden-x/src/generated/garden-library-manifest.ts`
- Gardenpedia publication validation: `scripts/gardenpedia-prepare-publication.mjs` and `scripts/publish-gardenpedia.mjs`
- Private inventory and live Garden data: Garden X Production Supabase, never editorial JSON

## Editorial Codex may modify

- `labs/gardenpedia/data/plants*.json`
- `labs/gardenpedia/data/sources*.json`
- `labs/gardenpedia/data/translations*.json`
- `labs/gardenpedia/data/visuals.json`
- `labs/gardenpedia/data/machine-inventory-v1.json`
- `labs/gardenpedia/data/harvest-use-v0.1.json`
- Editorial documentation under `labs/gardenpedia/*.md`

Editorial work must preserve published IDs, use the existing evidence/source fields, keep ES/EN behavior, and avoid unsupported claims. Reference imagery must retain source and rights status.

## Editorial Codex must not modify

- `apps/garden-x/src/` product surfaces or shared Garden X behavior
- `supabase/` migrations, RPCs, RLS, policies, grants, or private data
- `apps/garden-x/public/gardenpedia/` generated artifacts
- Garden X events, plants, cycles, photos, seed packages, or system instances
- R2, Supabase Storage, Auth, Vercel, or OLD project configuration

Schema or authorization changes require explicit approval outside an editorial content task.

## Validation and publishing

1. Run focused Gardenpedia tests: `npx vitest run apps/garden-x/src/lib/gardenpedia-vertical.test.ts apps/garden-x/src/lib/gardenpedia-account.test.ts`.
2. Run the repository typecheck/build checks relevant to the change.
3. For an approved proposal, use the versioned publication workflow; do not edit the generated manifest by hand.
4. Review the diff for stable IDs, evidence/source links, ES/EN coverage, and absence of private metadata before merge.

Editorial requests are requests, not publication. A normal authenticated user may create a pending request; only the canonical Gardenpedia curator role can review/approve it. Approval does not write the public catalog or authorize automatic AI publication.
