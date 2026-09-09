# AI Evidence / Context architecture

Garden X Core remains the source of truth: Grow Cycles, valid events,
corrections/invalidation, provenance, Control V2 and Attention determine facts.
`garden.resolve_cycle_evidence` is a small internal context resolver. It accepts
an already-authorized owner and cycle, a temporal boundary, and explicit note /
historical-photo selection. It returns structured evidence and private photo
identity/metadata only. It has no model, proposal, delivery URL, grant, or write
behavior.

## Consumers

- **AI Check** will authorize the owner and selected cycle/photo, ask the
  resolver for the pertinent evidence, then produce a non-canonical proposal.
  Only a later explicit user action can call existing canonical Garden RPCs.
- **Ask Garden** will authorize its internal scope, use Control V2, Attention,
  Home Dashboard and Cycle APIs as canonical projections, then use this resolver
  only for evidence/history/photo context relevant to the question.
- **Guest Plant Story** already uses the resolver, then adapts its output to the
  unchanged human story contract. Its Edge Function remains responsible for
  short-lived signed URLs.
- **Sofi / external sharing** is deferred. If later justified, it should add an
  authorization and delivery adapter outside this resolver; it must not make
  internal AI depend on external grants or signed URLs.

## Deliberately deferred decisions

No provider/model, prompt, proposal persistence/versioning, retention, image
budget, conversation policy, or final AI privacy policy is chosen here. The
future phase must define proposal schema, owner authorization scopes, question
context selection and `as_of` semantics before adding public AI endpoints.

## Photo delivery

Private Storage is unchanged and files are never duplicated. The resolver emits
photo identity, capture precision, provenance and private storage metadata to a
trusted server boundary. Each consumer chooses delivery later: server-side bytes
for AI Check, metadata-first retrieval for Ask Garden, signed URLs for Guest,
and an independently approved mechanism for any future external consumer.
