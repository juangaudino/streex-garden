# Harvest Use V0.1 — Pilot Contract

## Purpose

Harvest Use answers one practical question inside Garden Library:

> I just harvested this. What can I do with it now?

It is not a recipe collection. It is a compact, source-backed post-harvest decision layer that helps the user choose between immediate use and sensible preservation options.

## Pilot crops

V0.1 covers six deliberately different crops:

- Genovese Basil
- Cilantro
- Rosemary
- Red Romaine Lettuce
- Evergreen Bunching Onion Nebuka / Nabuka
- Cherry Tomato

The mix tests delicate herbs, sturdy herbs, leafy greens, alliums and fruiting crops.

## UX contract

The module lives inside the existing Library plant detail.

It may show:

- edible part
- a primary / best-use recommendation
- quick use ideas that are not recipes
- relevant methods such as fresh use, refrigeration, freezing or drying
- method status: Best choice / Good option / Possible / Not recommended
- short actionable steps
- source links
- an explicit food-safety note when needed

Not every crop receives every method. Gardenpedia should show what is useful, not fill a matrix for completeness.

## Evidence contract

Harvest Use applies a stricter standard than ordinary quality guidance because food preservation can become a safety issue.

- Food-safety and preservation claims must be directly source-backed.
- University Extension, government guidance and the National Center for Home Food Preservation are preferred.
- Quality statements such as texture or flavor changes are kept distinct from safety instructions.
- Shelf life is never inferred.
- Conflicting institutional guidance remains visible or results in a cautious recommendation rather than a silent merge.
- Unknown is better than invented precision.

## Data contract

Canonical pilot data lives in:

`data/harvest-use-v0.1.json`

The data is structured and deterministic. The UI renderer lives in:

`harvest-use-v0.1.js`

and styles in:

`harvest-use-v0.1.css`.

Harvest Use does not modify Garden X canonical plant history and does not require a new Supabase table in V0.1.

## Current source set

The pilot uses University of Minnesota Extension, Utah State University Extension, University of Illinois Extension, Penn State Extension, Oregon State University Extension, and the National Center for Home Food Preservation.

Each method card links to its supporting source.

## QA gate

Before broad expansion, User Zero should test the module during real harvest/use moments and answer:

- Does it tell me what to do quickly enough?
- Is the best option obvious?
- Are methods concise enough for use in the kitchen?
- Do source links feel useful rather than noisy?
- Are quality advice and safety advice clearly different?
- Is anything drifting into recipe-book territory?
- Are there preservation options shown that are technically possible but practically not worth recommending?

Only after that QA should Harvest Use expand broadly through Gardenpedia enrichment.
