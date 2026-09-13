# Garden Labs — Sites Storage V1

## Status
Sites Storage V1 is implemented and deployed to the existing private Garden Labs Site. User Zero approved the hosted QA, including persistence across clients/devices. The corresponding validated Sites source commit is `b80002a2425538aa750382e7555fa7995e528f19`; the synchronized API/schema/migration source is retained under `sites-storage-runtime/`.

## Goal
Replace device-only persistence for mutable Seeds state with ChatGPT Sites **D1 durable structured storage**, while preserving `localStorage` as a fallback/cache during the experiment.

The result must let User Zero edit Seeds on one device and see the same saved personal state from another device when opening the same private Site.

## Guardrails
- Lab only. Do not merge into `main`.
- Do not connect to Garden X Supabase.
- Do not mutate packet/manufacturer evidence in `data/seed-inventory.json`.
- Do not convert inferences or recommendations into canonical facts.
- Do not add monetization, OCR, AI inventory recognition, automatic decrement, or pod integration.
- Keep the existing 29 guide/seed records unchanged.
- Preserve current Library ↔ Seeds UX, ES/EN, preview modes, frameless mode, DEMO control and purchase-date behavior.
- Offline support is not a requirement for ChatGPT Sites.

## Storage model
Use Sites D1 for durable structured data. The hosted binding should be named `DB` when Sites provisions the relational database.

### Entity: `seed_personal_state`
Mutable personal state only.

Fields:
- `seed_key` TEXT PRIMARY KEY — stable key for a packet/seed record.
- `package_status` TEXT — `opened`, `unopened`, or `unknown`.
- `quantity_level` TEXT — `full`, `high`, `medium`, `low`, `almost_empty`, or `unknown`.
- `storage_location` TEXT NULL.
- `purchase_date` TEXT NULL — ISO `YYYY-MM-DD` when known.
- `legacy_purchase_year` TEXT NULL — preserve pre-V0.7 data until a full purchase date replaces it.
- `germination_test_date` TEXT NULL — ISO date.
- `germination_result_pct` INTEGER NULL — 0–100.
- `notes` TEXT NULL.
- `archived` INTEGER NOT NULL DEFAULT 0.
- `updated_at` TEXT NOT NULL — ISO timestamp.

### Entity: `custom_seeds`
Seeds created manually inside the Lab. These are experimental inventory records, not canonical botanical identities.

Fields:
- `seed_key` TEXT PRIMARY KEY.
- `packet_name` TEXT NOT NULL.
- `brand` TEXT NULL.
- `created_at` TEXT NOT NULL — ISO timestamp.
- `updated_at` TEXT NOT NULL — ISO timestamp.

Personal-state fields for a custom seed live in `seed_personal_state`, keyed by the same `seed_key`.

## Evidence separation
`data/seed-inventory.json` remains immutable evidence reconstructed from packet photos.

D1 stores **only mutable User Zero state** plus manually created Lab seeds. Saving or deleting personal state must never edit the packet evidence JSON or Grow Guide data.

## Migration from current device state
Current local keys:
- `gardenLabsSeedStateV1`
- `gardenLabsCustomSeedsV1`

On first successful D1-enabled load:
1. Read remote D1 state.
2. If remote storage is empty and local state exists, offer/perform a one-time import of the local Lab state into D1.
3. Preserve `purchaseDate` when present.
4. Preserve legacy `purchaseYear` separately when a full date has not yet replaced it.
5. Never overwrite non-empty remote state silently with device-local state.
6. After a successful remote save, keep localStorage only as cache/fallback; D1 becomes the Lab source of truth for mutable Seeds state.

## Runtime behavior
- Loading Seeds should retrieve D1 state before presenting the final inventory state when the hosted database is available.
- Saves should write to D1 and then refresh/update the local cache.
- If D1 is temporarily unavailable, the UI should remain usable with local fallback and clearly avoid claiming that cross-device sync succeeded.
- Do not block Library/Grow Guide if storage fails.

## UI copy
When D1 is active, replace device-only wording such as:
- `Estado personal local`
- `Guardado localmente ... en este dispositivo`

with neutral Lab wording such as:
- ES: `Estado personal del Lab · sincronizado en este Site`
- EN: `Lab personal state · synced in this Site`

Do not call this Garden X production sync.

## Acceptance tests
### Persistence
- Edit an existing seed packet on iPhone.
- Reload the Site: change remains.
- Fully close/reopen the Site: change remains.
- Open the same private Site on desktop: the same state appears.
- Edit on desktop and confirm the change appears on iPhone after refresh.

### Fields
Verify persistence for:
- opened/unopened
- quantity level
- storage location
- exact purchase date
- germination date/result
- notes
- archive/restore
- manually added custom seed

### Integrity
- All 29 guide/seed records remain available.
- Packet/manufacturer evidence remains unchanged.
- Grow Guide content remains unchanged.
- `main` remains unchanged.
- Garden X Supabase receives no writes.

### Failure behavior
- Simulate/observe a storage failure if practical: Library still loads and Seeds does not lose the local fallback state.
- No destructive migration occurs without a recoverable copy of the prior local state.

## Sites deployment rule
This storage phase must be implemented in the existing Garden Labs Site, reviewed as a saved version first, then deployed only after the persistence tests pass.

Do not create a second Garden Labs Site unless there is a technical blocker that requires it.

## Success condition
Storage V1 is complete when **the same Seeds personal state is demonstrably shared between iPhone and desktop through the existing private Garden Labs Site**, while packet evidence and Garden X production data remain untouched.
