# Gardenpedia account vertical — handoff status

Updated: 2026-09-26

## State of the vertical

The authenticated Gardenpedia experience is part of Garden X. Shared plant and
machine knowledge remains versioned in the repository; personal inventory,
requests and proposals remain private Supabase data. A request or approved
proposal is never itself a public Gardenpedia identity.

## Canonical data paths

- Published plant identities and sources live in `labs/gardenpedia/data/`.
- `scripts/publish-gardenpedia.mjs` validates those files and generates the
  Garden X manifest and public assets. `/api/garden-library/catalog` serves
  that generated catalog and synchronizes its public identity cache.
- My Seeds is `garden.seed_packages`, accessed through authenticated,
  owner-scoped RPCs. A package has one nullable `library_plant_id`; unresolved
  packages retain the user's entered seed name. Linking a later-published
  identity is a human choice in package editing.
- My Machines reads the authenticated user's `garden.system_instances` through
  `gardenpedia_get_my_machines`. The optional `gardenpedia_model_id` is only
  populated for proven mappings; private instance metadata is not copied into
  public model records.
- `garden_lab` machine data is legacy only. Local seed data remains available
  for explicit, idempotent reconciliation; it is not the account inventory
  source. The 37 historical packet records were not imported or deleted.

## Identity, requests and proposals

`labs/gardenpedia/identity-resolver-v1.js` is shared by Library and My Seeds.
It normalizes text and reports exact/alias/prefix/substring candidates. A user
confirms an identity; a match never creates or links an identity automatically.
If there is no exact identity, the user can request research and can still save
an unresolved seed package.

Requests are stored in `garden.gardenpedia_requests`; structured noncanonical
proposals are stored in `garden.gardenpedia_proposals`. RLS is enabled and
direct table grants are revoked. Owner APIs return only that user's request
status; the curator queue and review/export operations check the private
`garden.gardenpedia_curators` allowlist inside security-definer functions.

`gardenpedia-research` is a JWT-protected Edge Function using the existing
Garden AI OpenAI secret/model and web-search transport. It is curator-triggered,
uses approved institutional/primary domains, validates compatibilityProfile
v1 and evidence shape, verifies cited URLs against returned citations, converts
URLs to source IDs, and stores a proposal. Research never writes the catalog.

The status path is:

`requested → researching → proposal_ready → approved → publishing → published`

Research failures, returned-for-revision, decline, and publication failures are
also persisted with an auditable note. Human approval records curator and time;
approval does not publish.

## Versioned publication

After curator approval, Garden X exports an approved, traceable JSON bundle.
The curator starts the repository's
`.github/workflows/gardenpedia-publication.yml` workflow and supplies that
bundle. GitHub Actions uses its scoped built-in token to run
`scripts/gardenpedia-prepare-publication.mjs`, reject duplicate IDs, invalid
Grow Guide/profile/source references, unresolved URLs and private metadata,
run tests/typecheck and build Garden X, then create a versioned pull request.
The workflow does not deploy Garden Labs. The curator reviews and merges the
PR; Vercel deploys Garden X through its existing main integration. Once the
catalog endpoint synchronizes the merged identity, a database trigger marks
the matching approved proposal/request as published and records catalog
version and timestamp.

If validation fails, no catalog source change reaches main. The curator can
record the publication error in Gardenpedia and re-export/retry without
discarding the approved proposal. The browser never writes a public catalog row.

## Applied infrastructure and verification snapshot

Applied Supabase migrations:

- `20260926165631_gardenpedia_account_seed_packages`
- `20260926165809_gardenpedia_requests_proposals`
- `20260926173442_gardenpedia_vertical_completion`

The final migration adds owner-scoped package deletion, lifecycle statuses,
curator research/review/publication RPCs, approval audit fields and the
catalog-publication reconciliation trigger. Production checks confirmed RLS
enabled with no direct `anon` or `authenticated` table privileges on
`seed_packages`, requests or proposals; sensitive RPCs are unavailable to
`anon` and curator operations enforce the server-side allowlist.

At closure validation, the public catalog cache contained 43 identities and
the private tables contained no test seed packages, requests or proposals.
`gardenpedia-research` was deployed with JWT verification enabled; an
unauthenticated smoke request received HTTP 401. No canonical user test data
was created.
