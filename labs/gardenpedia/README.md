# Garden Labs — Garden Library Prototype

Standalone Garden X laboratory prototype.

Garden Labs is the experimental shell. Garden Library is the current experiment inside it.

## Current product shape

Garden Library contains two user-facing layers:

- **Grow Guide / Guide** — structured, sourced knowledge about what a crop is and how to manage it.
- **Seeds** — the user's personal seed inventory: which packets are owned, package state, approximate quantity, location and optional germination notes.

These surfaces are connected in the UX but keep separate sources of truth.

## Goals

- Validate useful Garden X experiences with User Zero before production integration.
- Keep agronomic guidance structured, sourced and portable.
- Keep personal inventory state separate from botanical/agronomic knowledge.
- Preserve the 29 real User Zero seed varieties already documented from packet evidence.
- Remain independent from Supabase, Garden AI and the production Garden X application during prototyping.

## Prototype stack

- HTML
- CSS
- Vanilla JavaScript
- JSON data
- localStorage for mutable Lab-only seed inventory state
- PWA manifest + service worker

## Current V0.6

- Installed PWA identity: **Garden Labs**.
- Current experiment: **Garden Library**.
- Two top-level Library surfaces: **Guide** and **Seeds**.
- 29 Grow Guide crop/variety records.
- 29 packet-evidence records from User Zero's real seed collection.
- Full ES / EN interface with Spanish default and persisted preference.
- Bilingual search.
- Evidence states: source-backed, Garden adaptation, needs validation.
- Visual Guide references for actions where a real photo, diagram, video or Extension guide materially improves understanding.
- Neighbor compatibility layer with evidence distinctions.
- Seeds inventory filters and quick editing for opened/unopened, qualitative quantity, storage location, purchase year, germination test and notes.
- Add/remove/restore custom Lab inventory records.
- Deterministic duplicate warning for exact normalized packet/variety names.
- Cross-links between Guide and Seeds.
- Mutable inventory state remains local to the device; packet evidence JSON is not rewritten by those edits.

## Guardrails

- `main` is not modified by this prototype.
- No Supabase schema is introduced.
- No authentication, LLM, RAG or production Garden AI dependency is required.
- Packet evidence is not silently changed by Lab inventory edits.
- Owning a packet does not retroactively rewrite an already-growing plant identity.
- The branch/folder remain `prototype/grow-guide` and `prototypes/grow-guide/` for continuity even though the user-facing Lab identity is now broader.

This folder is intentionally separate from the production app. The draft PR is **DO NOT MERGE** until User Zero validation and a production integration decision.
