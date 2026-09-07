export function homeVisitStorageKey(userId: string): string {
  return `streex-garden:home-visit:${userId}`
}

export function validVisitId(value: string | null): string | null {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null
}

export function attentionTimingLabel(item: { due_on: string | null; next_review_on: string | null }, today: string): string {
  const relevantDate = item.due_on ?? item.next_review_on
  if (!relevantDate) return 'Sin fecha'
  if (relevantDate < today) return 'Vencida'
  if (relevantDate === today) return 'Para hoy'
  return `Programada: ${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${relevantDate}T12:00:00`))}`
}
