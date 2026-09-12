# Garden X Grow Guide — Prototype Contract

## Purpose

This prototype validates the product shape of a future Garden X knowledge layer before production integration.

It is intentionally separate from the Garden X runtime, Supabase schema, Garden AI, and canonical plant history.

## Product principle

The guide describes **how a crop is generally managed**. Plant Story describes **what actually happened to one specific plant**.

Those two concepts must remain separate when this prototype is eventually integrated.

## Evidence contract

Every section of every plant guide carries one of three evidence states:

1. `source_backed`
   - Directly supported by one or more listed sources.
   - Source context still matters (soil, hydroponic, commercial production, etc.).

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

## V0 architecture

- Static HTML
- CSS
- Vanilla JavaScript
- JSON plant library
- JSON source registry
- JSON locale layer
- JSON visual-reference registry
- PWA manifest
- Offline service worker
- No database
- No authentication
- No LLM
- No embeddings / RAG

This is deliberate. For a curated library of ~60 plants, structured retrieval is cheaper, more deterministic and easier to audit than semantic retrieval.

## Bilingual contract — V0.3+

The prototype supports Spanish and English through an explicit `ES / EN` control.

- Spanish is the initial User Zero language unless a previous choice exists in local storage.
- The selected language persists on the device.
- Search remains bilingual regardless of interface language.
- In Spanish, the common Spanish name is primary and the English name secondary; in English the hierarchy is reversed.
- Section titles, UI labels, metric labels/notes, guidance, evidence states and confidence labels switch language.
- Scientific names are never translated.
- Publisher names and source document titles remain in their original form so evidence identity is not rewritten.
- English agronomic content remains the base canonical editorial layer for this prototype; Spanish lives in a separate locale file and must not change facts, ranges, confidence or evidence classification.

## Visual Guide contract — V0.4

Visual guidance is a separate evidence surface, not decorative plant photography.

A visual reference may be a real instructional photo, diagram, video demonstration, or authoritative guide when it materially improves understanding of an action such as thinning or pruning.

Each visual reference stores:
- crop association,
- action (`thinning`, `pruning`, etc.),
- media type,
- bilingual explanatory copy,
- source name and URL,
- credit,
- optional remote thumbnail URL,
- rights status.

Rights states currently used:
- `source_link_only`: Garden links to the authoritative source and does not reproduce the source asset.
- `review_before_production`: a remote thumbnail may be used in the private prototype for UX evaluation, but production reuse requires explicit rights/licensing review or replacement with a permitted asset.

Third-party visual files are **not committed to this repository** and the service worker does **not cache cross-origin visual assets**. Garden can therefore validate whether the visual treatment is useful without treating external educational media as owned content.

Initial V0.4 visual references include:
- hydroponic tomato sucker-removal photography from Oklahoma State University Extension,
- tomato sucker/cut-location diagram from University of Wisconsin–Madison Division of Extension,
- basil pruning demonstration from Johnny's Selected Seeds,
- seedling-thinning guidance from Utah State University Extension for crowded lettuce/cilantro-style seedlings.

## Data model

Each plant contains:

- identity
- English name
- Spanish name
- scientific name
- variety / cultivar context
- category
- search tags
- quick metrics
- guide sections

Initial guide sections:

- germination
- thinning
- pruning
- harvest
- flowering / bolting
- hydroponics
- common issues

Each section contains:

- short label
- actionable guidance
- optional steps
- optional warnings
- source context
- evidence type
- confidence
- source IDs

Sources live separately so evidence can be reused and updated without duplicating URLs across plant records. Visual references also live separately so media/rights can evolve without rewriting agronomic claims.

## Current User Zero library

The prototype currently contains 17 crops/varieties from the two active hydroponic gardens, spanning branching herbs, slow perennial herbs, cluster-forming alliums, leafy greens and a fruiting crop.

This diversity is intentional: it has already shown that Garden cannot use a universal thinning or pruning rule across crops.

## Validation questions

1. Can the user find the plant quickly in either language?
2. Is the first useful action obvious?
3. Are guide sections too long or too shallow?
4. Is evidence labeling useful or noisy?
5. Does the guide answer `where / when / how much` clearly enough?
6. Which actions require a visual CUT / KEEP / REMOVE guide?
7. Does language switching preserve comprehension without changing agronomic meaning?
8. Do sourced visual references resolve ambiguity faster than text alone?
9. Which external visuals are worth licensing/replacing for production?

## Future Garden X integration

Potential consumers of this structured knowledge:

- Plant Detail / Plant Story
- Maintenance
- AI Check
- Ask Garden
- future visual cut/keep/remove guidance

AI should receive selected structured facts from Grow Guide as context. AI should not become the canonical source of agronomic facts.

## Integration gate

This prototype remains **DO NOT MERGE** until User Zero validates the experience in real use. A successful prototype does not by itself authorize changes to Garden X production architecture.
