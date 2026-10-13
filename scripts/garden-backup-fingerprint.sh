#!/usr/bin/env bash
set -euo pipefail

service_name="${1:?connection service name required}"
service_file="${2:?connection service file required}"
output_file="${3:?output TSV path required}"
export PGSERVICEFILE="$service_file"

tables_file="$(mktemp)"
trap 'rm -f "$tables_file"' EXIT
psql "service=$service_name" -XAtq --set ON_ERROR_STOP=1 \
  --command "select format('%I.%I', table_schema, table_name) from information_schema.tables where table_schema in ('auth','garden') and table_type = 'BASE TABLE' order by 1" \
  > "$tables_file"

grep -qx '"auth"."users"' "$tables_file"
grep -qx '"garden"."photos"' "$tables_file"
: > "$output_file"

while IFS= read -r table; do
  [[ "$table" =~ ^\"(auth|garden)\"\.\"[a-zA-Z0-9_]+\"$ ]] || {
    printf '%s\n' 'Unsupported relation name in canonical backup fingerprint.' >&2
    exit 1
  }
  row_count="$(psql "service=$service_name" -XAtq --set ON_ERROR_STOP=1 \
    --command "select count(*) from $table")"
  row_hash="$(psql "service=$service_name" -XAtq --set ON_ERROR_STOP=1 \
    --command "copy (select to_jsonb(t)::text from $table as t order by to_jsonb(t)::text) to stdout" \
    | sha256sum | awk '{print $1}')"
  printf '%s\t%s\t%s\n' "$table" "$row_count" "$row_hash" >> "$output_file"
done < "$tables_file"
