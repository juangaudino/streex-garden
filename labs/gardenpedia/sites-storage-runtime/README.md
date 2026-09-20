# Sites Storage V1 runtime source

This directory preserves the storage-specific server and D1 source synchronized from the validated Garden Labs Site source commit `b80002a2425538aa750382e7555fa7995e528f19`.

- The Lab's browser client lives beside this folder in `app.js`, `index.html`, `sites-storage-bootstrap.js`, and `sites-storage-v1.js`.
- `app/api/seed-state/route.ts`, `db/`, and `drizzle/` hold the Site API, D1 schema, and migration history.
- `.openai/hosting.json` records the existing Site project and its logical `DB` binding. It does not contain credentials.

This is a source snapshot within the Lab, not a separate Site or a second deployment target. The deployed Site remains the existing private Garden Labs Site. Do not connect this experiment to Supabase or Garden X production.
