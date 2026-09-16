# Garden X · Visual Fidelity Integration

Branch: `sofi/visual-depth-study`
Baseline: Phase 04 closed at `a0b1da6`

## Purpose

Port the approved Botanical Studio / Codex visual demo into the current production markup without reopening product direction or changing canonical Garden behavior.

The demo is a visual target, not a source of truth for data or old markup. Production functionality, provenance, routes, storage, Garden AI boundaries, Maintenance semantics and Growth Film contracts remain authoritative.

## Approved in User Zero review

- Home desktop — approved after responsive correction.
- Plant · `Su historia` mobile — approved after restoring the compact add action, four-photo rail and calmer canonical timeline.

Do not restyle these surfaces again without a new regression or explicit product reason.

## Integrated and awaiting one consolidated visual review

### Maintenance
- photo-first guided review composition;
- compact sticky context/progress;
- editorial overlay copy;
- calmer action rows and icon surfaces;
- stable two-action footer;
- mobile proportions tuned to the approved demo.

### Plant profile
- compact editorial portrait;
- `UNA MIRADA MÁS CERCA` overlay;
- lower position badge;
- canonical capture reference retained;
- identity/facts/CTA spacing tuned without removing current functionality.

### Documentary Photo Viewer
- dark editorial stage;
- `REFERENCIA LOCAL` / `La fotografía original` hierarchy;
- original image remains the evidence source;
- real capture metadata and filename retained;
- canonical cover actions preserved.

## Depth language already integrated

- smoked-paper navigation glass;
- photographic Home hero depth;
- garden-card elevation;
- physical map 2.5D tray treatment;
- plant portrait depth;
- reduced-motion and reduced-transparency fallbacks.

## Deliberately unchanged

- backend / Supabase schema;
- domain models;
- canonical writes and provenance;
- routing;
- Maintenance meanings (`Se ve bien`, `Omitir`, structural progress);
- photo-save independence from AI;
- Growth Film renderer/export contract;
- Garden AI configuration (`GARDEN_AI_ENABLED=false`).

## Current implementation shape

The visual work remains isolated in:

- `src/visual-depth-integration.css`
- `src/visual-fidelity-pass.css`

with small presentation-only markup adjustments in:

- `src/features/cycles/PlantStudio.tsx`
- `src/features/cycles/PlantHistory.tsx`
- `src/features/cycles/DocumentaryPhoto.tsx`

The original depth-study QA/reference files are preserved under `qa/depth-study*` and `docs/VISUAL_DEPTH_STUDY.md`.

## Release-candidate gate after visual approval

1. One consolidated visual acceptance pass for Maintenance, Plant profile and Photo Viewer.
2. Fold approved additive CSS back into owning stylesheets; remove temporary integration imports/layers.
3. Run full tests, lint, typecheck and production build.
4. Run targeted responsive/accessibility regression at mobile/tablet/desktop seams.
5. Keep authenticated real-data and physical iPhone Safari QA as the final separate field gate.

No production deployment is implied by this document.
