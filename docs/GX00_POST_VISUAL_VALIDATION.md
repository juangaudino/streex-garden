> **Registro histórico:** validación GX-00 previa a Garden AI y a los pases posteriores de UX. Para QA actual consulta [QA_FIELD_CHECKLIST.md](QA_FIELD_CHECKLIST.md).

# GX-00 + UX post-visual validation

## Automated evidence

- The Control V2 UI keeps `Vigilar` separate from `Sin evaluación suficiente`.
- A structured plant count is sent as `plant_count_observed`; it is not created as a task or recommendation.
- Today renders the Garden, Position and Plant context beside a cycle task.
- The transversal Register flow selects a Garden and active cycle before reusing the existing observation capture.

## Authenticated Supabase validation after applying the migrations

1. Create a cycle task, close or replace that cycle, and verify the task becomes dismissed with reason `Ciclo cerrado`; it must not become completed and must not appear for the successor.
2. Record germination, a count, a visual review, a thinning intervention and a readiness review through `Registrar hecho`. Verify each is dated evidence in the same cycle history.
3. Create an action-required review and verify a follow-up visual-review task appears once. Invalidate the review and verify Control no longer uses it as current evidence.
4. In Control, verify unknown planting date renders age as `—`, no evaluation renders the neutral category, and a later intervention after a reassuring review returns the current state to insufficient evidence.
5. Create a garden-level maintenance task and confirm it appears once under that Garden's shared actions, not once per pod.
6. Confirm a thinning task on one Grow Cycle appears only on that current position. Move the cycle and confirm its task follows the cycle to the new position.

## UX smoke test

1. From Jardines, open a Garden, find `Control`, and start or continue maintenance.
2. Open a plant from its position, use `Registrar` to save an observation, and find `Historial`.
3. Open `La historia de tu…`; with two photos, continue to `Comparar dos momentos`.
4. Open Hoy and identify Garden, Position, Plant, timing and the pending action.
5. Use the compact top-bar `Registrar` outside a Cycle and confirm the selected observation appears only in that plant's history.

## Deliberate limits

- Reference-date Control is a current reconstruction from currently valid evidence; it is not a persistent snapshot or a reconstruction of the application's past knowledge.
- Historical Import remains separate. Its candidates must be confirmed against the structured fact contract before becoming facts.
- No AI, new export format, generalized rules engine, or global navigation tab was added.
