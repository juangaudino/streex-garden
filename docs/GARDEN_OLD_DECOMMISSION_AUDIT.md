# Garden OLD decommission evidence

## Runtime and local references

The current Production bundle was previously verified to use Supabase project `fnhggqqnkhkrfwmnsqmy`. Garden X function calls in `apps/garden-x/src/lib/garden-backend.ts` use the build-time `VITE_SUPABASE_URL`; Gardenpedia's publisher validates that exact Production URL before injecting it into the published transport. Neither runtime is configured to call OLD by project ref.

`prototypes/grow-guide/supabase-lab-transport.js` contained a hard-coded OLD URL and was not in the Garden Labs sync file list. It has been replaced by a retirement marker. The deployed Gardenpedia transport comes from `labs/gardenpedia/supabase-lab-transport.js`, which uses build placeholders and is populated from the canonical Production URL. `docs/OPERATIONS_AND_DEPLOYMENT.md` now targets the canonical Production project for function deploy/list commands.

## OLD Edge Functions

All eight functions listed below remain deployed and `ACTIVE` on OLD. The available OLD log stream for 2026-10-12 02:37 UTC through 2026-10-13 02:37 UTC contained 3,212 `edge_logs` rows and zero `event_message` matches for `/functions/v1/`. The stream did not expose a separate `function_edge_logs` source, so this does not establish zero invocations across all gateway logs or outside that 24-hour window. The OLD database also had no `pg_cron` or `pg_net` extension and no `cron.job` relation. External schedulers still require owner-side confirmation.

| OLD function | Current code evidence | OLD disposition |
| --- | --- | --- |
| `historical-photos-v1-import` | No caller found in the current repository; it serves the completed historical import. | Historical/obsolete in code; external caller status unverified. |
| `guest-plant-story` | Current Garden X calls this route through the build-time Supabase URL. | Product capability is active; the OLD deployment is not the configured Production target. Verify its Production replacement before retiring OLD. |
| `guest-garden-story` | Current Garden X calls this route through the build-time Supabase URL. | Product capability is active; the OLD deployment is not the configured Production target. Verify its Production replacement before retiring OLD. |
| `garden-ai` | Ask Garden calls this route through the build-time Supabase URL. | Product capability is active; the OLD deployment is not the configured Production target. Verify its Production replacement before retiring OLD. |
| `garden-ai-benchmark` | No current app caller found; repository references are limited to benchmark/deployment documentation. | Historical/likely obsolete; external scheduled caller status unverified. |
| `garden-identify` | Plant identification calls this route through the build-time Supabase URL. | Product capability is active; the OLD deployment is not the configured Production target. Verify its Production replacement before retiring OLD. |
| `gardenpedia-research` | Published Gardenpedia calls this route through its build-injected Supabase URL. | Product capability is active; the OLD deployment is not the configured Production target. Verify its Production replacement before retiring OLD. |
| `garden-photo-rendition-backfill` | Administrative backfill tool; historical photo recovery is complete and no current app caller was found. | Recovery-only/obsolete; external scheduled caller status unverified. |

The Supabase API denied access to Production project details and deployed functions, and the Vercel API denied access to project `streex-garden` and its environment metadata. Therefore the Production replacement deployments and current scheduled Vercel jobs have not been verified in this audit. Do not disable or delete OLD functions based only on the available 24-hour log window.

## Retirement gate

Historical photo recovery is recorded complete in `recovery-evidence/final-completion-report.json`. OLD itself has not been modified. OLD deletion remains blocked until Production function deployment/configuration, external consumers, project Auth configuration backup, and the current independent backup/restore drill are verified.
