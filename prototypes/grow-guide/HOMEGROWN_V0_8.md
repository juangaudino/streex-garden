# Garden Labs V0.8 — Home Grown enrichment

## Status
Active pilot. Garden Labs continues as the validation surface; this phase does **not** promote Library/Seeds into Garden X production.

## Frozen baseline
- Validated baseline before Home Grown enrichment: `18a3354a564e2d865baf55821c37b51d0e6b3fbb`.
- Sites Storage V1 is already validated separately.
- `main`, Garden X Supabase and production remain out of scope.
- The 29-guide catalog remains intact.

## Objective
Add Home Grown as a **manufacturer-guidance layer** with explicit provenance and conflict handling. Home Grown guidance may corroborate, supplement or conflict with existing Extension/grower references, but it never silently replaces them.

## Source hierarchy for this phase
1. Existing university Extension / strong grower references remain visible as their own evidence.
2. Home Grown PDFs are classified as `manufacturer_guidance`.
3. Home Grown blog posts are secondary manufacturer editorial and are candidates/context unless independently reconciled.
4. Garden adaptations remain clearly labeled as adaptations.
5. Missing information remains missing rather than being inferred.

## Guardrails
- Never rewrite packet evidence from `data/seed-inventory.json`.
- Never rewrite historical/canonical plant data.
- Never convert soil/container spacing directly into a hydroponic pod rule.
- Never convert a manufacturer statement into an Extension/research statement.
- Never auto-resolve source conflicts.
- Do not add precise hydroponic pH/EC values from these Home Grown guides unless the source explicitly supports hydroponics.
- A recommendation may be promoted later only after reconciliation and User Zero validation.

## Pilot 1 — six live/relevant varieties
Structured evidence lives in `data/homegrown-manufacturer-guidance.json`.

### 1. Genovese Basil
**Result:** strong corroboration.
- Home Grown and the current Grow Guide both support a 5–10 day germination window.
- Home Grown says harvest can start around 6–8 inches and stem cuts just above a leaf node encourage bushier growth.
- This closely matches Garden's current structural pruning/harvest model.

**Decision:** keep current Garden guidance; Home Grown becomes visible manufacturer corroboration, not a replacement.

### 2. Cilantro
**Result:** valuable conflict case.
- Current Garden/USU reference: germination can take about 21 days.
- Home Grown: 7–10 days around 70°F for its indoor method.
- Current Garden/USU field leaf-production spacing: about 2 inches.
- Home Grown outdoor thinning: 6–8 inches.
- Harvest cue is much closer: Garden 4–6 inches vs Home Grown 6+ inches.

**Decision:** preserve both germination/spacing claims with their contexts. Do not collapse either spacing into a hydroponic pod rule. This is the pilot example for explicit source disagreement.

### 3. Rosemary
**Result:** useful supplement plus one unresolved manufacturer-only recommendation.
- Home Grown broadens the germination window to 14–28 days; current Garden uses 14–21 days.
- Both support light-assisted germination.
- Home Grown additionally recommends cold-moist stratification for 10–12 weeks.

**Decision:** keep current Garden germination guidance; retain stratification as `manufacturer_only_candidate` until independently reconciled before it becomes a Garden recommendation.

### 4. Red Romaine Lettuce
**Result:** strong harvest-mode corroboration.
- Home Grown: 55–70 days, romaine type, 10–12 inches.
- Home Grown supports individual-leaf or full-head harvest.
- Its 60–75°F germination range is broader than Garden's 60–68°F optimum wording.

**Decision:** keep Garden's optimum wording and preserve Home Grown as a broader manufacturer range. Harvest-mode agreement is high-value.

### 5. Buttercrunch Lettuce
**Result:** strong harvest-mode corroboration and useful variety context.
- Home Grown: butterhead, 8–10 inches, 50–60 days.
- Home Grown presents Buttercrunch as comparatively heat tolerant and suitable for repeated-leaf or whole-head harvest.

**Decision:** add variety context without implying that Buttercrunch cannot bolt.

### 6. Black Seeded Simpson
**Result:** strong corroboration.
- Home Grown explicitly classifies it as loose-leaf and gives 28–50 days to harvest.
- Home Grown's guide/blog support individual outer-leaf / cut-and-come-again harvest.
- This reinforces Garden's existing rule that an open loose-leaf form is normal and not failed heading.

**Decision:** strong candidate for visible manufacturer corroboration in Labs.

## Important identity hold — Thyme
Do **not** apply the Home Grown English Thyme pages to the corrected live Huerto 1 plant automatically.

User Zero confirmed Huerto 1 Pod 4 as **German Thyme**, while the Home Grown guide explicitly describes **English thyme**. Until identity is reconciled, Home Grown thyme remains a separate source candidate and must not rewrite the live plant identity or its guide.

## Blog use
Initial Home Grown blog review found useful secondary context around:
- cut-and-come-again lettuce harvest,
- basil pinching above nodes,
- cilantro bolting in heat,
- indoor lettuce/herb growing.

These blog claims are intentionally lower in the hierarchy than the supplied manufacturer PDFs and Extension references. Do not promote them merely because they agree with an existing statement.

## Next execution steps
- [x] Freeze the pre-V0.8 baseline.
- [x] Register the two supplied Home Grown guides with explicit manufacturer provenance.
- [x] Register selected Home Grown blog pages as secondary editorial context.
- [x] Build Pilot 1 reconciliation for six relevant varieties.
- [x] Record explicit conflicts instead of overwriting Garden guidance.
- [x] Put English Thyme on identity hold because User Zero's live plant is German Thyme.
- [ ] Add a compact **Manufacturer guidance / Source comparison** surface to the six pilot plant details in Garden Labs.
- [ ] User Zero reviews whether that comparison helps during real maintenance.
- [ ] Adjust information density/labels based on that review.
- [ ] Expand reconciliation to the remaining Home Grown-covered varieties.
- [ ] Only after the layer is useful, decide whether any reconciled facts should be promoted into the primary Grow Guide.

## Promotion rule
A Home Grown statement may move from manufacturer layer into primary Grow Guide only when:
1. identity is sufficiently matched;
2. its context is clear;
3. conflicts have been resolved or explicitly retained;
4. the resulting guidance adds practical value;
5. User Zero has validated the presentation/behavior in Garden Labs.

No production integration is implied by passing this phase.
