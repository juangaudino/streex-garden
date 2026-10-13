#!/usr/bin/env node

// Retired during Garden OLD decommission. This tool writes derivatives to the
// legacy Supabase Storage `garden-originals` bucket. Current Garden X media
// uses Media V1 renditions in Cloudflare R2 through the `garden-media` gateway.
// Keep this explicit failure at the old entry point so stale operator commands
// cannot silently restore the retired storage path.
console.error(
  'Retired: this script writes to legacy Supabase Storage. Use the current Media V1/R2 tooling instead.',
)
process.exitCode = 1
