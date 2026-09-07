export function toggleComparedPhoto(selectedIds: string[], photoId: string): string[] {
  if (selectedIds.includes(photoId)) return selectedIds.filter((id) => id !== photoId)
  if (selectedIds.length >= 2) return selectedIds
  return [...selectedIds, photoId]
}

export function canCompare(selectedIds: string[]): boolean {
  return selectedIds.length === 2 && selectedIds[0] !== selectedIds[1]
}
