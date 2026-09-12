# Garden Grow Guide Prototype

Standalone prototype for the Garden X plant knowledge layer.

## Current V0.3

- 17 crops/varieties currently grown by User Zero.
- Full ES / EN language switcher in the header.
- Spanish is the default language for the prototype; the selected language is remembered locally.
- Plant cards invert name hierarchy by language: Spanish name first in ES, English name first in EN.
- Guide content, section labels, evidence states, filters, metrics and UI chrome switch language.
- Scientific names and source titles remain unchanged to preserve evidence identity.
- Bilingual search continues to match both English and Spanish plant names.

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
- JSON locale layer
- PWA manifest + service worker

## Guide sections

- Germination
- Thinning / Raleo
- Pruning / Poda
- Harvest / Cosecha
- Flowering / bolting
- Hydroponics / Hidroponía
- Common issues / Problemas comunes
- Sources / evidence

This folder is intentionally separate from the production app. The draft PR is **DO NOT MERGE** until User Zero validates the product experience.
