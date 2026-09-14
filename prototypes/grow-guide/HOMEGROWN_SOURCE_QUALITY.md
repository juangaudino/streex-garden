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

### Evergreen Bunching onion naming + bulb-language anomaly
The guide identifies the crop as **Evergreen Bunching Nabuka** and correctly lists the species as `Allium fistulosum`, but two issues require explicit reconciliation:
- Garden/User Zero history and external seed/research references consistently use the cultivar spelling **Nebuka**. Garden keeps `Nabuka` only as manufacturer/packet provenance and uses `Nebuka` as normalized search/display identity.
- The Home Grown section later refers to spacing for **“bulb development”** and to leaving **“bulbs”** in the ground. This conflicts with the non-bulbing bunching-onion identity of `A. fistulosum` described by Extension/research references and with Johnny's bunching-onion production guidance.

Garden handling:
- do not promote the bulb-development language;
- do not convert Home Grown's 6–12 inch outdoor spacing into a hydroponic pod rule;
- preserve the manufacturer wording in provenance so the discrepancy remains inspectable;
- retain the existing internal plant ID for storage compatibility even though the display/search normalization uses Nebuka.

## Product implication
These anomalies validate Garden's V0.8 architecture: source provenance and reconciliation are not optional metadata. Garden must be able to say that a source contains useful guidance while rejecting a specific erroneous section from the same source.
