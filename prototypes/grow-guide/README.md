# Garden Grow Guide Prototype

Standalone prototype for the Garden X plant knowledge layer.

## Goals
- Validate UX for plant-specific growing guidance before integrating into Garden X.
- Keep agronomic guidance structured, sourced, and portable.
- Start with the plants currently grown in Juan's hydroponic gardens, then expand toward ~60 curated crops/varieties.
- Remain independent from Supabase, AI, and the production Garden X application during prototyping.

## Prototype stack
- HTML
- CSS
- Vanilla JavaScript
- JSON data
- PWA manifest + service worker

## Current V0.4
- 17 current User Zero crops/varieties.
- Full ES / EN interface with Spanish default and persisted preference.
- Bilingual search.
- Evidence states: source-backed, Garden adaptation, needs validation.
- Visual Guide references for actions where a real photo, diagram, video, or Extension guide materially improves understanding.
- Visual references keep source, credit and a rights-status field separate from agronomic claims.
- Third-party visual assets are not stored in this repository or cached by the service worker. Remote thumbnails are prototype references only and require rights review before production reuse.

## Initial guide sections
- Germination
- Seedling stage
- Thinning
- Pruning
- Harvest
- Flowering / bolting
- Hydroponics
- Common issues
- Sources / evidence
- Visual Guide when useful

This folder is intentionally separate from the production app. The draft PR is **DO NOT MERGE** until User Zero validation and a production integration decision.
