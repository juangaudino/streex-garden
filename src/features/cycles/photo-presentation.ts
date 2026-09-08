import type { CycleHistoryEvent, PhotoEvidence } from '../../domain/types'

export function captureLabel(photo: PhotoEvidence): string {
  if (!photo.captured_at || photo.captured_at_precision === 'unknown') return 'Captura: fecha desconocida'
  const value = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(photo.captured_at))
  return `${photo.captured_at_precision === 'approximate' ? 'Captura aproximada' : 'Capturada'}: ${value}`
}
export function recordLabel(event: CycleHistoryEvent): string {
  if (event.occurred_at_precision === 'date' && event.occurred_on) return `${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${event.occurred_on}T12:00:00`))} · Hora no registrada`
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.occurred_at))
}
export function isToday(event: CycleHistoryEvent, now = new Date()): boolean {
  const date = event.occurred_at_precision === 'date' && event.occurred_on ? new Date(`${event.occurred_on}T12:00:00`) : new Date(event.occurred_at)
  return date.toDateString() === now.toDateString()
}
export function storyInterval(events: CycleHistoryEvent[]): string {
  if (!events.length) return 'La historia fotográfica comienza con tu primera imagen.'
  // Registration is always known; never substitute it for an unknown capture date.
  const dates = events.map((event) => event.occurred_at_precision === 'date' && event.occurred_on ? new Date(`${event.occurred_on}T12:00:00`) : new Date(event.occurred_at)).sort((a, b) => +a - +b)
  const format = (date: Date) => new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(date)
  return `Fechas de los registros: ${format(dates[0])}${dates.length > 1 ? ` → ${format(dates[dates.length - 1])}` : ''}`
}
