# Garden Labs — ChatGPT Sites handoff

## Purpose
Migrate the **runtime only** of the current Garden Labs prototype to ChatGPT Sites.

## Source of truth
- Repository: `juangaudino/streex-garden`
- Branch: `prototype/grow-guide`
- Path: `prototypes/grow-guide/`
- GitHub remains the property and memory of the code.
- Do **not** move or copy the prototype to another repository.
- Do **not** merge into `main`.
- Do **not** add Supabase.

## Current validated prototype
Garden Labs currently contains a reusable Demo Shell with two sibling demos:
- **Library** — Grow Guide / Plant Knowledge
- **Seeds** — Seed Inventory lab

Current behavior to preserve:
- 29 User Zero guide/seed records
- ES / EN
- Visual Guide
- Neighbors
- Seed inventory with local personal state
- exact purchase date field (`purchaseDate`) while preserving legacy `purchaseYear` until replaced
- Mobile / Tablet / Desktop preview controls
- “Abrir sin marco” / frameless mode
- discreet `DEMO` return control
- PWA/offline behavior
- exact User Zero-approved Garden Labs icon artwork

## Migration constraints
This is an **infrastructure migration, not a product redesign**.

Do not:
- redesign the UI
- expand features
- alter the 29-record catalog
- modify canonical evidence
- change the relationship between Library and Seeds
- add production auth/schema
- connect to Garden X Supabase
- implement the Home Grown enrichment phase yet

## Sites objective
1. Create a ChatGPT Site from the current branch/path.
2. Preserve the current UX and behavior.
3. Verify the Site before changing any Vercel configuration.
4. Return the Site URL.

## Validation checklist on Sites
- [ ] Garden Labs shell loads
- [ ] Library opens
- [ ] Seeds opens
- [ ] Library ↔ Seeds switching works
- [ ] 29 records are present
- [ ] ES / EN works
- [ ] Mobile / Tablet / Desktop preview works
- [ ] “Abrir sin marco” works
- [ ] `DEMO` returns to shell
- [ ] PWA icon uses the approved Garden Labs artwork
- [ ] Purchase date supports day/month/year
- [ ] Existing lab state is not silently promoted to canonical/product data

## Storage experiment after runtime verification
Once the Site itself is verified, the next lab step is to evaluate Sites-native persistence for **Seeds personal state** so the same inventory can be seen from iPhone and desktop.

Persist only experimental personal-state fields such as:
- opened / unopened
- qualitative quantity
- storage location
- purchase date
- germination test date/result
- notes

Keep packet/manufacturer evidence separate from mutable personal state.
Do not write to Garden X canonical data or Supabase.

## Vercel rule
Keep the current Vercel preview alive until the ChatGPT Site has been created and verified. Only then retire prototype-only Vercel runtime/configuration.

## Later phase — intentionally deferred
After Sites + shared persistence are validated, a separate phase will enrich the 20 Home Grown-covered varieties using:
- the two Home Grown guides supplied by User Zero
- Home Grown blog
- explicit provenance
- conflict detection / source reconciliation

Do not execute that phase during the Sites migration.
