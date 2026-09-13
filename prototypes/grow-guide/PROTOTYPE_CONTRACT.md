# Garden Labs — Garden Library Prototype Contract

## Purpose

Garden Labs is the experimental environment for Garden X. It exists to validate product ideas, UX and lightweight technical approaches with User Zero before deciding whether they belong in Garden X production.

Garden Library is the current experiment inside Garden Labs.

The prototype remains intentionally separate from the Garden X production runtime, Supabase schema, Garden AI and canonical plant history.

## Product layers

Garden Library currently contains two connected but separate domains:

1. **Grow Guide / Guide**
   - What a crop is.
   - How that crop is generally managed.
   - Agronomic facts, evidence and Garden adaptations.

2. **Seeds**
   - Which seed packets the user actually owns.
   - Opened/unopened state.
   - Approximate quantity.
   - Storage location.
   - Optional purchase and germination notes.

Garden Library may surface both in one experience, but they must not merge their sources of truth.

## Canonical separation

- Guide knowledge never becomes personal inventory state.
- Inventory state never becomes agronomic truth.
- Packet evidence does not automatically rewrite the identity of an already-growing plant.
- Plant Story remains the canonical history of what happened to an individual plant.
- A Lab action never modifies Garden X canonical data.

## Evidence contract — Guide

Every section of every plant guide carries one of three evidence states:

1. `source_backed`
   - Directly supported by one or more listed sources.
   - Source context still matters.

2. `garden_adaptation`
   - A practical Garden interpretation of source-backed knowledge for the user's system or product UX.
   - Must never be presented as if the source explicitly said it.

3. `needs_validation`
   - The product has identified the information need but has not accepted a sufficiently strong source yet.
   - Missing data is preferable to invented precision.

## Human confirmation

Grow Guide may recommend an action, but it never changes canonical history.

Examples:
- `This basil appears ready for first pruning` = recommendation/inference.
- `Pruning completed Sep 12` = canonical fact only after user confirmation.

## Garden Labs V0.6 architecture

- Static HTML
- CSS
- Vanilla JavaScript
- JSON plant library
- JSON source registry
- JSON locale layer
- JSON visual-reference registry
- JSON packet-evidence seed inventory
- localStorage for mutable Lab-only personal seed state
- PWA manifest
- Offline service worker
- No production database
- No authentication
- No LLM
- No embeddings / RAG

This is deliberate. The prototype should optimize for learning speed, deterministic behavior and auditability rather than prematurely reproducing the production architecture.

## Seeds Lab contract

The checked-in `data/seed-inventory.json` represents packet evidence captured from User Zero's real seed collection.

Mutable fields such as opened/unopened, approximate quantity, storage location, purchase year, germination test and notes are stored separately in localStorage for the experiment.

Rules:
- Editing personal state must not rewrite packet evidence JSON.
- Removing a canonical packet from the active inventory archives it locally; it does not erase the documented packet evidence.
- Custom Lab seeds may be added and deleted locally.
- Duplicate detection is deterministic when an exact normalized packet/variety name already exists.
- Duplicate warnings inform; they do not block a second packet.
- Exact seed counting and automatic decrements after sowing remain out of scope.

## Bilingual contract

The prototype supports Spanish and English through an explicit `ES / EN` control.

- Spanish is the initial User Zero language unless a previous choice exists in local storage.
- The selected language persists on the device.
- Search remains bilingual where the underlying data allows it.
- Scientific names are never translated.
- Publisher names and source document titles remain in their original form.
- Changing language must not change facts, ranges, confidence or evidence classification.

## Visual Guide contract

Visual guidance is a separate evidence surface, not decorative plant photography.

A visual reference may be a real instructional photo, diagram, video demonstration or authoritative guide when it materially improves understanding of an action such as thinning or pruning.

Third-party visual files are not committed to this repository and the service worker does not cache cross-origin visual assets. Production reuse requires rights/licensing review or replacement with a permitted asset.

## Current User Zero library

Garden Library currently validates against 29 unique crop/variety records and 29 packet-evidence seed records.

That diversity is intentional. It tests herbs, leafy greens, alliums, fruiting crops, roots and ornamentals while reinforcing that thinning, pruning and hydroponic compatibility rules are not universal.

## Garden Labs UX contract

- Installed PWA identity: **Garden Labs**.
- Current experiment inside it: **Garden Library**.
- Garden Library exposes **Guide** and **Seeds** as sibling surfaces.
- Guide remains the deeper knowledge surface.
- Seeds is intentionally faster and more inventory-oriented.
- The two surfaces may link to each other when identity is known.
- Garden Labs chrome uses the approved indigo/violet/aqua visual identity so it cannot be confused with the green/gold production Garden identity.
- The existing Git branch and folder names remain unchanged for repository continuity.

## Validation questions

1. Can User Zero understand immediately that Garden Labs is experimental?
2. Does Garden Library feel like one experience without hiding the difference between Guide and Seeds?
3. Can the user find a plant/seed quickly in either language?
4. Is inventory state fast enough to update that it does not become administrative work?
5. Does `In your seed inventory` add useful context to Guide?
6. Is the first useful growing action obvious?
7. Are evidence labels useful or noisy?
8. Which actions require stronger visual guidance?
9. Which Lab capabilities deserve production implementation?

## Future Garden X integration

A successful Lab experiment does not authorize direct production integration.

Potential future consumers include Plant Detail / Plant Story, Maintenance, AI Check, Ask Garden, sowing/replacement flows and future Garden Library surfaces.

Production implementation remains a separate Codex task that must review the real Garden X schema and botanical identity model before adding Supabase or canonical entities.

## Integration gate

This prototype remains **DO NOT MERGE** until User Zero validates the experience and an explicit production integration decision is made.
