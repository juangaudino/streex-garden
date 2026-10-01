# Gardenpedia Labs evidence pipeline V1

Gardenpedia Labs keeps research inputs separate from published knowledge:

```text
raw evidence
  -> claim candidate
  -> taxonomic scope
  -> source quality
  -> reconciliation
  -> canonical knowledge
  -> Garden adaptation
```

The publication boundary is human approval. Provider output, packet observations,
and discovery material never write directly to the canonical plant files.

Every published claim keeps its `evidenceType`, `confidence`, `sourceIds`, and
the narrowest supported `taxonomicScope`. Missing evidence is represented by
`needs_validation`, `unknown`, or `pending`; it is not completed by copying a
related cultivar or by promoting a species-level source to cultivar certainty.

The source registry loader normalizes historical records at load time. Existing
source files remain valid and are not rewritten solely to satisfy this layer.
