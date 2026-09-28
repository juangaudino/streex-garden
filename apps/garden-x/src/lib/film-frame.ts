/** Keep full-resolution frame work bounded while leaving the whole sequence as metadata. */
export function visibleFilmFrames<T>(items: readonly T[], currentIndex: number) {
  if (!items.length) return [] as Array<{ item: T; index: number }>;
  const current = Math.min(Math.max(0, currentIndex), items.length - 1);
  return items
    .slice(current, Math.min(items.length, current + 2))
    .map((item, offset) => ({ item, index: current + offset }));
}
