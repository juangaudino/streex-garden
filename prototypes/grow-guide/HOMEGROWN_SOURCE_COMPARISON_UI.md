# Garden Labs V0.8 — Source comparison surface

## Purpose
Expose Home Grown manufacturer guidance inside the **existing plant detail** without turning every guide into a research report. The comparison should help User Zero answer: **does this source agree, add something useful, or disagree with what Garden currently says?**

This is a Garden Labs UX experiment only.

## Placement
Place the surface after **Quick Facts** and before **Neighbors / Visual Guide**.

Reason: the user first sees the plant identity and current Garden answer; source comparison is supporting context, not the primary answer.

## Compact default
Default state is collapsed/compact.

Header:
- eyebrow: `SOURCE COMPARISON` / `COMPARACIÓN DE FUENTES`
- title: `Home Grown · Manufacturer guidance`
- one summary sentence, e.g. `2 coincidencias · 1 diferencia contextual`
- status chip using one of:
  - `Coincide` / `Matches`
  - `Complementa` / `Adds context`
  - `Difiere` / `Differs`
  - `Pendiente de identidad` / `Identity hold`

Do not present Home Grown as `Source-backed` in the same visual vocabulary used for Extension/research. It gets its own label: **Manufacturer guidance**.

## Expanded state
Show only reconciliation topics that change understanding or confidence. Avoid dumping every packet/grow-guide fact.

Each row contains:
1. Topic: `Germinación`, `Cosecha`, `Raleo`, etc.
2. `Garden actual` — concise current value/position.
3. `Home Grown` — concise manufacturer value/position.
4. Resolution/status sentence.
5. Provenance locator, e.g. `Home Grown 30 Herb Grow Guide · pp. 43–46`.

## Visual semantics
- **Green / positive neutral:** strong agreement.
- **Blue / neutral:** useful supplement.
- **Amber:** contextual or material difference.
- Never use danger/error red merely because two sources disagree.
- `Identity hold` uses a neutral outlined state, not an error state.

## Pilot behavior by plant
### Genovese Basil
Default summary: `Coincide · poda y cosecha`
Expanded high-value rows:
- Germination: 5–10 days ↔ 5–10 days.
- Harvest/pruning: 6–8 in + cut above node ↔ Garden node-based branching rule.

### Cilantro
Default summary: `Difiere · germinación / spacing`
Expanded high-value rows:
- Germination: Garden ~21 days (USU context) vs Home Grown 7–10 days around 70°F indoors.
- Harvest cue: Garden 4–6 in vs Home Grown 6+ in → near-match.
- Field spacing: Garden/USU ~2 in leaf-production context vs Home Grown 6–8 in outdoor context → never translate either directly into pod count.

This is the primary UX test for whether Garden can display disagreement without confusing the user.

### Rosemary
Default summary: `Complementa · stratification pendiente`
Expanded high-value rows:
- Germination: 14–21 vs 14–28 days.
- Light requirement: agreement.
- Cold-moist stratification 10–12 weeks: manufacturer-only candidate; not promoted to primary Garden guidance.

### Red Romaine
Default summary: `Coincide · modo de cosecha`
- Outer-leaf vs whole-head modes agree.
- Home Grown 60–75°F is a broader operating range than Garden's 60–68°F optimum wording.

### Buttercrunch
Default summary: `Complementa · tolerancia al calor`
- Harvest modes agree.
- Home Grown presents relative heat tolerance as variety context; Garden still warns that bolting can occur.

### Black Seeded Simpson
Default summary: `Coincide · loose-leaf / cosecha repetida`
- Loose-leaf identity agrees.
- Cut-and-come-again / outer-leaf harvesting agrees strongly.

## Thyme special case
Do not show a Home Grown comparison on the live Huerto 1 German Thyme as if it were an identity match.

If a thyme comparison is surfaced later, show:
`Pendiente de identidad — la guía Home Grown describe English Thyme; la planta confirmada por User Zero es German Thyme.`

No action, recommendation or canonical identity changes from this source until reconciled.

## Density rules
- Default: max 1 summary line + 1 status chip.
- Expanded: max 3 reconciliation rows for Pilot 1.
- Longer source notes stay behind `Ver fuente / Source details`.
- No full research matrix on mobile.
- No duplicated Grow Guide paragraphs.

## What this experiment is testing
1. Can User Zero understand provenance without slowing down maintenance?
2. Does `Coincide / Complementa / Difiere` make source quality clearer?
3. Are conflicts useful or just noise?
4. Does the manufacturer layer increase trust without making Home Grown look authoritative beyond its role?
5. Which reconciled facts deserve promotion into the main Grow Guide later?

## Acceptance criteria before expanding beyond six plants
- User Zero can explain what the status means after seeing 2–3 examples.
- Cilantro disagreement is understandable without implying Garden is broken.
- Home Grown never visually outranks Extension/research evidence.
- Thyme identity hold is explicit.
- Plant detail remains fast to scan on iPhone.
- No changes to canonical history, packet evidence, D1 personal state or Garden X production.
