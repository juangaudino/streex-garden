/** Date-only values are represented at UTC noon to avoid crossing a calendar day. */
export function dateOnlyToUtcNoon(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return `${value}T12:00:00.000Z`;
}

export function dateOnlyFromIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}
