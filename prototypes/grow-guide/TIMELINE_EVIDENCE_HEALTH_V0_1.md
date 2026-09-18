# Grow Timeline / Action Calendar V0.1 + Evidence Health V0.1

Status: implemented in Garden Labs.

## 9. Grow Timeline / Action Calendar
Deterministic only. It reads timing windows already present in the Library metrics and exposes them as windows from sowing (Day 0). It never converts a crop age into a fake exact deadline.

Rules:
- Numeric source ranges remain ranges.
- A single approximate day is rendered as a small orientation window, not an exact due date.
- If the Library has no sufficiently supported numeric timing, the UI says so instead of inventing one.
- Every displayed phase carries the evidence state of its corresponding guide section.
- Plant observations and actual Garden X events remain canonical; this reference timeline does not write them.

Current phases: sowing, germination, flowering when a numeric window exists, and harvest/maturity when a numeric window exists. The action cue remains observational: the user decides from the real plant state.

## 10. Evidence Health / Knowledge Quality Map
Deterministic audit of the current Library knowledge, not plant health.

Per guide it shows:
- source-backed section count;
- Garden-adaptation section count;
- needs-validation count;
- source coverage percentage;
- priority gaps (missing source, pending confidence, or needs-validation).

Library overview aggregates the same dimensions across all currently loaded guides.

Quality labels are descriptive evidence states only:
- Strong base: no pending sections and >=85% section source coverage.
- Mixed base: <=2 pending sections and >=60% source coverage.
- Building: below those thresholds.

No AI score, opaque ranking, or invented confidence is used.

## Product boundary
This layer describes the quality and timing of Gardenpedia knowledge. It does not alter Garden X canonical plant history, diagnose plant condition, or create maintenance events.
