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
- PWA manifest
- Offline service worker
- No database
- No authentication
- No LLM
- No embeddings / RAG

This is deliberate. For a curated library of ~60 plants, structured retrieval is cheaper, more deterministic and easier to audit than semantic retrieval.

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

Sources live separately in `data/sources.json` so evidence can be reused and updated without duplicating URLs across plant records.

## V0 pilot crops

1. Genovese Basil
2. Cilantro
3. Red Romaine Lettuce
4. Common Mint
5. Cherry Tomato

These intentionally represent different management patterns:

- branching herb
- cool-season herb
- leafy green
- aggressive perennial herb
- fruiting crop

## Next validation step

Use the V0 as a real reference during maintenance and answer:

1. Can the user find the plant quickly?
2. Is the first useful action obvious?
3. Are guide sections too long or too shallow?
4. Is evidence labeling useful or noisy?
5. Does the guide answer "where / when / how much" clearly enough?
6. Which actions require a visual CUT / KEEP / REMOVE guide?

Only after the information architecture passes this test should the library expand to the complete current Garden crop set and then toward ~60 curated plants.

## Future Garden X integration

Potential consumers of this structured knowledge:

- Plant Detail / Plant Story
- Maintenance
- AI Check
- Ask Garden
- future visual cut/keep/remove guidance

AI should receive selected structured facts from Grow Guide as context. AI should not become the canonical source of agronomic facts.
