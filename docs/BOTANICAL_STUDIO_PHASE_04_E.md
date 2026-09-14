# Botanical Studio · Phase 04.E — Global Experience Review

**Date:** 2026-09-14  
**Branch:** `sofi/phase04-d`  
**Phase 04 base:** `28ca687`  
**04.D closure:** `3a9d3cf`  
**04.E reflow fix:** `4e9549e`  
**04.E test alignment:** `9e520b1`  
**Production deploy:** No

## Status

Phase 04 Experience Consolidation is closed locally after the global 04.E review.

The review preserved the approved Botanical Studio direction and canonical Garden behavior.

No backend, schema, Garden AI runtime, persistence contract, route contract, Growth Film renderer contract, Maintenance semantics, or canonical data semantics were changed.

`GARDEN_AI_ENABLED` remains false.

## E1 · Static global audit

Closed with no product changes.

Confirmed:

- no viewport zoom restriction;
- reduced-motion coverage remains present;
- no dangerous rigid global minimum width was demonstrated;
- Phase 04 diff remained bounded;
- Visual Depth Study remained outside scope and untouched.

Potential breakpoint seams were isolated for targeted runtime validation rather than changed by intuition.

## E2 · Today / Ask breakpoint seams

Closed as no-op.

Validated:

- Today at `640 → 641`;
- Today at `719 → 720`;
- Ask at `640 → 641`;
- Ask at `719 → 720`.

No horizontal overflow or blocked controls were demonstrated.

The Ask change at 720 px was confirmed as an intentional layout regime change rather than a regression.

## E3 · Gardens grids / Maintenance short height

Closed as no-op.

Gardens grid transitions were validated at:

- `619 → 620`;
- `819 → 820`.

Expected responsive transitions remained healthy.

Maintenance was also validated at short viewport height across its responsive regimes. Operational controls remained usable between the sticky context and footer.

No product change was justified.

## E4 · Text resize / reflow at 200%

The audit identified real reflow defects in:

1. global topbar actions under enlarged text;
2. Today `Añadir seguimiento` at mobile width;
3. Plant topbar actions under enlarged text.

Two detector candidates were classified as non-regressions:

- Plant breadcrumb geometry remained stable;
- Growth Film thumbnail vertical clipping already existed at baseline inside the intentionally fixed thumbnail geometry.

### Product fix

Commit:

`4e9549e fix(garden): preserve reflow with enlarged text`

Only:

- `src/styles.css`
- `src/features/gardens/surfaces-botanical.css`

were modified.

The fix:

- allows the global topbar to wrap naturally under enlarged text;
- preserves its 72 px minimum height;
- keeps topbar actions inside the available width;
- allows Today create chrome, heading, and CTA to reflow correctly.

### Real CSS verification

Validated with the actual repository CSS, without runtime QA CSS injection.

**Home · 390 px · 200%**
- root font: 32 px;
- logout remains inside viewport;
- `offscreen: []`.

**Today · 390 px · 200%**
- create right: 354;
- heading right: 240;
- follow-up CTA right: 335;
- viewport: 390;
- `offscreen: []`.

**Plant · 820 px · 200%**
- settings and logout remain inside viewport;
- `offscreen: []`.

## Font readiness

The historical harness had previously observed waits exceeding eight seconds around `document.fonts.ready`.

Targeted 04.E validation produced:

- `document.fonts.ready`: resolved;
- measured wait: 1 ms;
- `document.fonts.status`: `loaded`;
- DM Sans available: true;
- Fraunces available: true;
- Google Fonts resource timing: approximately 73–77 ms.

Conclusion:

The previous long font wait is not a reproducible Garden product regression and is classified as a historical harness/network artifact.

No typography redesign or font-system change is justified.

## E5 · Final technical gate

The first final-suite run exposed one stale test import:

`src/features/gardens/GX00Navigation.test.tsx`

The test still imported `AttentionList` from `GardensPage` after the intentional Phase 04.D extraction of that component into `AttentionList.tsx`.

This was a test alignment defect, not a product behavior regression.

Commit:

`9e520b1 test(garden): update attention list import`

The correction changed only the import source.

Final validation:

- full suite: 35 files / 222 tests passed;
- lint passed;
- TypeScript typecheck passed;
- production build passed;
- experience-integration TypeScript validation passed;
- experience-integration fixtures passed;
- experience-integration Vite build passed;
- `git diff --check` passed.

The previously unstable long integrated `agent-browser` runner was not repeated. Earlier repeated `ETIMEDOUT` failures were classified as external browser-automation instability rather than a demonstrated Garden defect.

Bounded runtime checks and isolated deterministic Ask validation provided the required product evidence.

## Preserved contracts

Phase 04 does not change:

- Plant Story semantics;
- Growth Film canonical provenance;
- Growth Film preview/export composition contract;
- Maintenance decision semantics;
- `Siguiente planta` semantics;
- photo-save independence from AI;
- AI Check confirmation boundaries;
- deterministic Ask Garden behavior;
- Attention purposes or canonical write semantics;
- Grow Cycle ownership;
- storage/privacy boundaries;
- routes;
- backend;
- Supabase schema;
- Garden AI runtime configuration.

## Visual Depth Study

Still explicitly outside Phase 04.

The following local files remain untracked and untouched:

- `docs/VISUAL_DEPTH_STUDY.md`
- `qa/depth-study-api.ts`
- `qa/depth-study.config.ts`
- `qa/depth-study.css`
- `qa/depth-study.html`
- `qa/depth-study.tsx`

They are not part of the Phase 04 closure.

## Remaining QA outside Phase 04

Authenticated and physical-device QA remain separate follow-ups, including:

- real Supabase data and Storage;
- real photos and signed URLs;
- real Maintenance sessions;
- Growth Film export with real photos/audio;
- native fullscreen and orientation behavior;
- iPhone Safari safe areas;
- virtual keyboard;
- landscape;
- pinch zoom;
- authenticated Attention / Ask before-and-after canonical counts.

These are not blockers to the local Phase 04 Experience Consolidation closure.

## Final conclusion

Phase 04 achieved its intended goal: consolidate the approved Botanical Studio experience across Garden without reopening product direction or altering canonical behavior.

The only product correction required during 04.E was the bounded CSS reflow fix for enlarged text.

No production deployment was performed.
