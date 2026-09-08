# Visual Fidelity Pass B — Refinement Pass

## Scope

Pass B completes the visual refinement approved after Pass A. It changes only
presentation: CSS composition, responsive layouts and motion fallbacks. It does
not change routes, domain types, API contracts, database schema, storage, RLS,
sync, offline behaviour, navigation or user actions.

## What changed

- **Home:** garden scenes lead the page with deeper image treatment, clearer
  editorial hierarchy and quieter operational sections. On tablet and desktop,
  the heading and garden pair use the available width as a composition rather
  than a stretched phone layout.
- **Garden:** the garden opening and physical layout share a continuous surface.
  Site states retain their existing labels, icons and actions; controlled
  shadows and boundaries make the layout legible without introducing a new map
  meaning.
- **Cycle:** the documentary image, place identity and data surface form one
  portrait. The data remains on an opaque surface, so it never depends on image
  contrast.
- **Maintenance:** the current plant reads as a focused review tray while its
  existing sequence and completion semantics remain intact.
- **Today and Control:** dense operational views keep their utility while
  inheriting the same paper, edge and depth family.
- **History and Photo Story:** rings remain place identity only. Time stays a
  linear, documentary trail with stronger current-event focus and more visible
  rails.

## Motion and accessibility

The existing Garden-to-Cycle continuity remains the signature transition from
Pass A. Pass B refines tactile feedback on contextual links, site states and
timeline nodes. It adds no perpetual animation and does not claim a result
before the underlying action completes.

With `prefers-reduced-motion`, these presentation transitions and transforms
are removed. Garden-to-Cycle opens directly, with no flight layer or spatial
transition. All controls retain their normal operation.

## Visual QA evidence

The local QA harness was extended only to render the existing Home, Today and
Control views from simulated data. It never imports the production entry point
or writes to Supabase. It produced the following ignored local artifacts:

| Representative flow | Mobile | Tablet | Desktop |
| --- | --- | --- | --- |
| Home | `artifacts/pass-b-home-safari-mobile.png` | `artifacts/pass-b-home-safari-tablet.png` | `artifacts/pass-b-home-safari-desktop.png` |
| Cycle | `artifacts/pass-b-cycle-mobile.png` | `artifacts/pass-b-cycle-safari-tablet.png` | `artifacts/pass-b-cycle-safari-desktop.png` |
| Maintenance | `artifacts/pass-b-maintenance-mobile.png` | — | `artifacts/pass-b-maintenance-safari-desktop.png` |
| Today / Control | `artifacts/pass-b-today.png` | — | `artifacts/pass-b-control.png` |

Garden was also reviewed on the mobile fixture (`artifacts/pass-b-garden-mobile.png`).

At a 390 px mobile viewport, Home, Garden, Cycle, Maintenance, Today, Control
and Photo Story were checked for horizontal overflow; none had it. The
reduced-motion Cycle route was also checked: it had no `.place-flight` layer,
no transition direction state, and no horizontal overflow.

## A to B comparison

Pass A established the required experiences: documentary Cycle portrait,
Garden-to-Cycle continuity, focused Maintenance, linear History and Photo
Story. Pass B narrows the remaining distance to the approved mockup by making
those experiences read as a single visual system:

- the Home garden pair becomes the clear visual entry point;
- the Cycle photo and data surface overlap with intentional depth rather than
  appearing as separate stacked cards;
- Garden places use rings only as spatial identity, while temporal views stay
  explicitly linear;
- tablet and desktop gain composition-specific scale and spacing;
- utility-heavy views receive material depth without losing scanning speed.

The old Pass A captures and the corresponding B captures remain local QA
evidence. Neither is production evidence or a substitute for review with real
garden photography and history.
