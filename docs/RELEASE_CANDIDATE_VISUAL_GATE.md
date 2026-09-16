# Garden X · Visual Release Candidate Gate

Branch: `sofi/visual-depth-study`
Baseline: `sofi/phase04-d` / Phase 04 closed at `a0b1da6`

## Purpose

Validate the approved Visual Depth / Fidelity integration as a release-candidate input without changing canonical Garden behavior.

## User Zero approvals already frozen

- Home desktop.
- Plant `Su historia` mobile.
- Garden detail/map after removing the heavy dark cover block and exaggerated 3D treatment.
- Documentary photo viewer direction after editorial cleanup.
- Growth Film current-photo expand now opens the real photo; full rendered playback remains a separate action.

These surfaces should not be redesigned again unless a concrete regression is found.

## Functional boundaries preserved

- No backend or Supabase schema changes.
- No canonical write/provenance changes.
- No routing contract changes beyond presentation affordances already reviewed.
- Maintenance meanings remain unchanged.
- Photo save remains independent from AI.
- Growth Film render/export contract remains unchanged.
- `GARDEN_AI_ENABLED=false` remains unchanged.

## RC verification

The repository `Verify` workflow is the authoritative automated gate for this candidate and runs:

1. `npm ci`
2. `npm run typecheck`
3. `npm test -- --run`
4. `npm run lint`
5. `npm run build`

Vercel preview/build remains a separate deployment check.

## After automated gate

Only then:

- consolidate temporary visual integration layers without changing computed presentation;
- rerun the same gate;
- perform targeted authenticated/physical iPhone Safari QA;
- create the final release candidate checkpoint.

No production deployment is authorized by this document.
