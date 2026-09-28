# Garden Media Architecture V1

## User Zero approved ingestion policy

User Zero approved the initial Garden Media V1 policy after visually comparing five representative real Garden photos: full-plant views, close plant/leaf details (including zoom), and varied lighting/backgrounds. The approved candidate was **B · smaller balanced** in `scripts/photo-media-experiment.html`.

The centralized policy for newly ingested Garden photos is `apps/garden-x/src/lib/photo-media-policy.ts`:

| Tier | Maximum long edge | JPEG quality | Purpose |
| --- | ---: | ---: | --- |
| Master | 2304 px | 0.86 | Canonical Garden visual evidence, reasonable zoom, and detailed AI use when needed |
| Display | 1440 px | 0.80 | Plant Journal, Photos, Compare, Growth Film, and other large UI presentation |
| Preview | 600 px | 0.68 | Home, galleries, thumbnails, navigation, and lightweight visual lists |

Shared processing applies image orientation, preserves aspect ratio, never upscales, encodes JPEGs, and strips source metadata. Normal Garden ingestion does not retain the phone/raw source as a fourth permanent media tier. **Master is the highest-quality canonical Garden visual evidence tier.**

In the five-photo quality gate, candidate B produced observed sample sizes of approximately 0.9–1.1 MB for master, 350–425 KB for display, and 70–85 KB for preview. These are sample observations only, not byte limits, rejection thresholds, or guarantees for future photos. The policy contract is defined by tier dimensions and JPEG quality, not by encoded byte size.

The current compatibility model still stores the new Garden master at the existing `original.jpg` path because the photo record/storage contract has not been renamed. That path is a legacy semantic alias: for new uploads its contents are the normalized Garden master, not the raw phone file. Historical `original.jpg` objects remain untouched and may still contain larger phone uploads. `display.jpg` and `preview.jpg` remain sibling derivatives. No database or Storage migration is part of this policy approval.

## Upload, health and retry

New event and garden-cover images are decoded and all three JPEG tiers are prepared locally before their media record is marked uploaded. The master is stored at the existing `original.jpg` path; the two derivatives use the existing sidecar paths. Create-only writes use `upsert:false`. A collision is accepted only after downloading that object and confirming byte identity. Storage writes get one bounded automatic retry; the canonical photo remains pending unless all tiers and the final upload confirmation succeed.

If a Record Moment's canonical event exists but its photo upload is incomplete, the composer offers a user-triggered retry against the same event/photo IDs. It re-prepares the selected local image, uses the idempotent photo RPC, and never creates a second Moment. Failures increment safe development diagnostics and remain visible as an error to the user. No automatic retry loop or background upload queue was added. Images which cannot be decoded/normalized are rejected before a Record Moment is written.

Diagnostics are dev-only and contain tier/state only; they never log photo IDs, paths, signed URLs, tokens or image bytes.

## Rendition request rules

Browser UI tier lookup is exact: `preview` requests only `preview.jpg`, and `display` requests only `display.jpg`. A missing or failed sidecar becomes an explicit unavailable/error state; the user can retry a stale/network error manually. It never silently switches to the master. Durable cache keys were versioned so bytes stored under the old fallback behavior cannot satisfy the new exact-tier contract.

Explicit AI Check/Compare calls still allow the existing server-side vision helper to read `display.jpg`, then the compatibility master if that derivative is absent. A UI `PhotoImage` caller that explicitly requests `master` is also supported, but no current Garden X component does so. The upload idempotency verifier may download an existing object after a create-only collision; it compares hashes and does not display it.

Two unchanged guest-story Edge Functions (`guest-garden-story` and `guest-plant-story`) still sign the compatibility `original.jpg` path to preserve their legacy response shape, including `original_url` when a display sidecar exists and `url` fallback when it does not. Current Garden public-story components consume `url` through `PhotoImage`; that component now refuses a signed master/original URL, so it does not download the fallback. The signed `original_url` field is not consumed by the current UI, but remains an externally retrievable short-lived compatibility URL until those Edge Functions are separately tightened. No Edge Function was deployed or changed here.

## Local visual experiment

Open `scripts/photo-media-experiment.html` in a browser and select 5–10 local representative images. The page generates three candidate master/display/preview policies, previews them side by side and reports dimensions, JPEG quality, bytes and reduction from each selected file. It uses only local file input, browser decoding, canvas, Blob URLs and local downloads: no fetch, upload, or repository image is involved. Candidate B is now marked as the User Zero approved Garden Media V1 policy. The raw input is only a local comparison source; raw phone files are not part of the intended normal permanent Garden media model.

## Historical migration preparation

The existing `garden-photo-rendition-backfill` inventory helpers are useful building blocks: owner-pinned manifest validation, upload-status filtering, folder inspection with byte-level JPEG decode/dimension checks, create-only uploads, progress/cursors, and post-write verification. The earlier `scripts/backfill-photo-renditions.mjs` is not safe to reuse as the migration itself: it leaves the master untouched, uses `sips`, and is not a transactional replacement-master workflow.

The future ~224-photo migration must write a new optimized master to a staging/sibling key, validate master + display + preview and verify the source checksum before changing the canonical pointer or deleting any old object. The only old valid image must survive any failed individual-photo transform. No historical media was read or written by the policy change.

## Provider portability

The browser photo signer, create-only uploader, downloader and remover now pass through `photoStorageProvider` in `apps/garden-x/src/lib/photo-storage-provider.ts`; `PhotoImage` and callers speak photo IDs/tiers rather than Supabase APIs. The adapter still maps to the `garden-originals` bucket and Supabase Auth session, and database RPCs still return Supabase storage paths. AI Edge Functions, guest-story signing, delete/cleanup, RLS and RPC contracts also remain Supabase-specific. R2 evaluation would need an authenticated upload/sign/download/delete adapter plus a safe bucket/object-key bridge for those server functions and cleanup RPCs. This boundary reduces UI rework but is not a provider migration or a generic storage framework.
