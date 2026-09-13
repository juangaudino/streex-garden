# Garden Labs V0.8 — Home Grown source quality notes

## Purpose
Record source-level anomalies separately from plant guidance so Garden does not silently ingest manufacturer material that is internally inconsistent.

## HG Lettuce 5-Pack Grow Guide
Status: **usable with exclusions**.

### Confirmed anomaly
The generic Lettuce 5-Pack profile contains content that does not match lettuce:
- page 6 labels the scientific name as `Matricaria chamomilla` (German chamomile), which is not lettuce;
- page 7 includes medicinal-tea, pollinator, fragrant-bloom and self-seeding claims that read as chamomile content rather than lettuce guidance.

### Garden handling
- Do **not** ingest those generic identity/benefit claims into any lettuce record.
- Treat the individual variety pages for Black Seeded Simpson, Red Romaine, Bibb, Buttercrunch and Iceberg as separate candidate material.
- Treat germination, sowing, harvest and FAQ sections as manufacturer guidance only when the statement is internally consistent with lettuce and does not conflict with stronger sources without context.
- Preserve conflicts rather than repairing the PDF silently.

## 30 Herb Grow Guide
Status: **manufacturer guidance; reconcile per plant**.

No blanket trust is assigned to the guide. Each plant claim is compared with the existing Garden source layer before promotion. Soil/outdoor spacing is never converted directly into a hydroponic pod rule.

## Product implication
This anomaly validates Garden's V0.8 architecture: source provenance and reconciliation are not optional metadata. Garden must be able to say that a source contains useful guidance while rejecting a specific erroneous section from the same source.
