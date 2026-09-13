# Garden Labs — ChatGPT Sites handoff

## Current status
The runtime migration is **complete and validated by User Zero**.

- Garden Labs V0.7.3 is published as a private ChatGPT Site.
- Library ↔ Seeds, ES/EN, Mobile/Tablet/Desktop preview, frameless mode, DEMO return, exact purchase date and all 29 records were validated.
- Offline mode does not work in Sites, but User Zero explicitly confirmed that offline is **not a requirement** for Garden Labs.
- Future Vercel auto-deploys for `prototype/grow-guide` are disabled on the prototype branch. Do not alter the production Garden X Vercel project.

## Source of truth
- Repository: `juangaudino/streex-garden`
- Branch: `prototype/grow-guide`
- Path: `prototypes/grow-guide/`
- GitHub remains the property and memory of the code.
- Do **not** move or copy the prototype to another repository.
- Do **not** merge into `main`.
- Do **not** connect the Lab to Garden X Supabase.

## Validated prototype
Garden Labs contains a reusable Demo Shell with two sibling demos:
- **Library** — Grow Guide / Plant Knowledge
- **Seeds** — Seed Inventory lab

Validated behavior to preserve:
- 29 User Zero guide/seed records
- ES / EN
- Visual Guide
- Neighbors
- Seed inventory
- exact purchase date field (`purchaseDate`) while preserving legacy `purchaseYear` until replaced
- Mobile / Tablet / Desktop preview controls
- “Abrir sin marco” / frameless mode
- discreet `DEMO` return control
- exact User Zero-approved Garden Labs icon artwork

## Active next phase — Sites Storage V1
The next lab experiment is **durable Sites-native persistence for Seeds personal state** so the same inventory state can be seen from iPhone and desktop.

Implementation contract:
- `SITES_STORAGE_V1.md`

Use ChatGPT Sites **D1** for durable structured state. Keep packet/manufacturer evidence separate and immutable. Do not write to Garden X canonical data or Supabase.

Persist only experimental personal-state fields such as:
- opened / unopened
- qualitative quantity
- storage location
- purchase date
- germination test date/result
- notes
- archive/restore state
- manually added Lab seeds

`localStorage` may remain as fallback/cache during the experiment, but after successful migration D1 is the Lab source of truth for mutable Seeds state.

## Sites update workflow
1. Open the **existing** Garden Labs Site in Sites/Work/Codex.
2. Use the current `prototype/grow-guide` branch and `SITES_STORAGE_V1.md` as the implementation contract.
3. Add D1 durable storage to the existing Site; do not create a second Site unless technically unavoidable.
4. Save a reviewable version first.
5. Run the cross-device acceptance tests in `SITES_STORAGE_V1.md`.
6. Deploy the approved saved version to the existing Site URL.
7. Record the resulting storage binding/migrations in source control where Sites exposes them (for example `.openai/hosting.json` and migration files).

## Guardrails
This remains an infrastructure/data-persistence experiment, not a product redesign.

Do not:
- redesign the UI
- expand the 29-record catalog
- modify canonical evidence
- change the relationship between Library and Seeds
- add Garden X production auth/schema
- connect to Garden X Supabase
- implement Home Grown enrichment during Storage V1
- add monetization, OCR, AI inventory recognition, automatic decrement, or pod integration

## Vercel status
Do not delete or reconfigure the production `streex-garden` Vercel project. The prototype was a branch preview, not a separate production project.

Future Vercel deployments from `prototype/grow-guide` are disabled on that branch. Historical preview deployments may remain until removed through a Vercel surface with deletion permission.

## Later phase — intentionally deferred
After Sites + shared persistence are validated, a separate phase will enrich the 20 Home Grown-covered varieties using:
- the two Home Grown guides supplied by User Zero
- Home Grown blog
- explicit provenance
- conflict detection / source reconciliation

Do not execute that phase during Sites Storage V1.
