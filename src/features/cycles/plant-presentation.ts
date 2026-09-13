import type { CycleHistoryEvent, GrowCycleDetail, PhotoEvidence } from '../../domain/types'
import { plantName } from './plant-names'

export function plantPhotos(cycle: GrowCycleDetail): PhotoEvidence[] {
  const photos = new Map<string, PhotoEvidence>()
  for (const photo of [cycle.cover_photo, ...cycle.history.map(event => event.photo)]) {
    if (photo?.upload_status === 'uploaded' && !photos.has(photo.id)) photos.set(photo.id, photo)
  }
  return [...photos.values()]
}

export function canInvalidatePlantEvent(event: CycleHistoryEvent): boolean {
  // Historical photo IDs are not canonical event IDs.
  return event.event_type !== 'photo_evidence'
}

export function plantingSummary(cycle: GrowCycleDetail, now = new Date()): { value: string; unit: string; label: string } {
  if (!cycle.planted_on || cycle.planted_on_precision === 'unknown') return { value: 'Sin fecha', unit: '', label: 'siembra sin confirmar' }
  const date = new Date(`${cycle.planted_on}T12:00:00`)
  if (!Number.isFinite(+date)) return { value: 'Sin fecha', unit: '', label: 'siembra sin confirmar' }
  if (cycle.state !== 'active') return {
    value: new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(date), unit: '',
    label: cycle.planted_on_precision === 'approximate' ? 'siembra aproximada' : 'fecha de siembra',
  }
  // Calendar days in the user's timezone, independent of daylight saving hours.
  const calendarDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const age = Math.floor((calendarDay(now) - calendarDay(date)) / 86_400_000)
  if (age < 0) return { value: 'Por confirmar', unit: '', label: 'fecha de siembra futura' }
  return { value: `${cycle.planted_on_precision === 'approximate' ? '≈ ' : ''}${age}`, unit: 'días', label: 'desde la siembra' }
}

export function plantPresentation(cycle: GrowCycleDetail, now = new Date()) {
  const photos = plantPhotos(cycle)
  return {
    name: plantName(cycle.crop_name), photos, portrait: photos[0] ?? null,
    planting: plantingSummary(cycle, now),
    // Backend history is already ordered; do not reinterpret another type as observation.
    observation: cycle.history.find(event => event.event_type === 'observation') ?? null,
  }
}
