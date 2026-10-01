# Garden X mobile keyboard contract

Garden X does not resize or translate the app from `window.visualViewport`.
On iOS, the browser owns the relationship between the layout viewport, visual
viewport, fixed controls, and the software keyboard. Adding a second height or
offset calculation causes stale reserves, double compensation, and broken
dialogs.

`useGardenMobileViewport` only publishes the shared editing policy through
`html[data-garden-keyboard="open|closed"]`. It listens to focus transitions on
editable controls; it does not listen to `visualViewport`, `innerHeight`, or
resize events and it does not write viewport dimensions or keyboard offsets.

When editing is active, the shell hides mobile bottom navigation and removes
its normal bottom reserve. That is the only keyboard-specific layout policy.
Chat routes use one bounded column with one scrollable conversation and a
normal-flow composer. Long forms and sheets use one bounded surface with one
scrollable body; they do not recenter or translate themselves when focus
changes. Dialogs and sheets must keep children at `min-width: 0`, and any
intentional horizontal rail owns its own horizontal overflow. A screen must
not add a second keyboard-height calculation, fixed composer compensation, or
focus-specific viewport listener.
