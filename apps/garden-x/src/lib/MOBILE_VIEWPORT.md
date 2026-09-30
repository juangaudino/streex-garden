# Garden X mobile viewport rule

`useGardenMobileViewport` in `mobile-viewport.ts` is the only owner of mobile visual viewport and keyboard state.

The authenticated shell mounts it once and publishes:

- `--garden-visual-viewport-height`
- `--garden-visual-viewport-offset-top`
- `--garden-keyboard-inset`
- `data-garden-keyboard="open|closed"`

Screens and shared overlays consume those values. They must not add their own `visualViewport`, `innerHeight`, resize, or keyboard-reserve listeners. The mobile navigation is hidden centrally while the keyboard is open. Full-screen conversations use the shared visual viewport frame; dialogs use the shared visual viewport max-height/top rule. A screen may own its content scrolling, but it must not add a second viewport-height calculation.
