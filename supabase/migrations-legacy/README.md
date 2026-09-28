# Historical Garden migrations

These SQL files are preserved historical evidence from the pre-baseline Garden
migration history. OLD and the repository migration ledgers diverged, so these
files are not part of the active migration path and must not be replayed
against Garden X Production.

Garden X Production begins its active canonical migration history at version
`20260928000000`.

## Canonical baseline validation

The canonical baseline was generated from and statically compared against the
Garden X Production Garden-owned schema. The comparison covered schemas,
tables, columns, types, defaults, sequences, constraints, indexes, triggers,
functions, RPC signatures, RLS, policies, grants, and the intentional
`storage_cleanup_queue` security state.

Clean local runtime reproduction from zero was not executed during this
migration because Docker/Podman was unavailable. This limitation was
explicitly accepted. Future development environment validation may test the
baseline from zero independently; this baseline is not described as
runtime-reproduced.
