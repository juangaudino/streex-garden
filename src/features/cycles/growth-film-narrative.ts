import type { CycleHistoryEvent } from '../../domain/types'

export interface GrowthFilmNarrative {
  title: string
  detail: string | null
}

const minorEvents = new Set(['visual_review', 'development_review', 'readiness_review', 'plant_count_observed'])

function readinessPhrase(value: unknown): string {
  if (value === 'ready') return 'La planta quedó lista para cosechar.'
  if (value === 'evaluate') return 'Quedó pendiente una nueva revisión antes de cosechar.'
  if (value === 'not_yet') return 'Todavía necesita tiempo para crecer.'
  return 'Se revisó su preparación para la cosecha.'
}

/**
 * Turns canonical events into short editorial copy. It never changes the
 * event, infers a stage, or adds an event that is not present in the cycle.
 */
export function growthFilmNarrative(event: Pick<CycleHistoryEvent, 'event_type' | 'event_data' | 'note'>): GrowthFilmNarrative {
  const data = event.event_data ?? {}
  if (event.event_type === 'planting' || event.event_type === 'cycle_started') return { title: 'Aquí comienza su historia.', detail: event.note }
  if (event.event_type === 'germination_confirmed') return { title: 'Aparecieron sus primeros brotes confirmados.', detail: event.note }
  if (event.event_type === 'germination_observed') return { title: 'Se registraron sus primeros brotes.', detail: event.note }
  if (event.event_type === 'intervention') {
    if (data.class === 'thinning') return { title: 'Se hizo un raleo para darle más espacio.', detail: event.note }
    if (data.class === 'pruning') return { title: 'Recibió una poda para seguir creciendo con equilibrio.', detail: event.note }
    if (data.class === 'support') {
      if (data.operation === 'removed') return { title: 'El soporte dejó de ser necesario.', detail: event.note }
      if (data.operation === 'adjusted') return { title: 'Se ajustó el soporte para que creciera más firme.', detail: event.note }
      return { title: 'Necesitó un pequeño soporte para crecer más firme.', detail: event.note }
    }
    return { title: 'Se hizo una intervención para acompañar su crecimiento.', detail: event.note }
  }
  if (event.event_type === 'harvest') return { title: 'Llegó el momento de la cosecha.', detail: event.note }
  if (event.event_type === 'incident_opened') return { title: 'Apareció algo para vigilar de cerca.', detail: event.note }
  if (event.event_type === 'incident_resolved') return { title: 'La incidencia quedó resuelta.', detail: event.note }
  if (event.event_type === 'readiness_review') return { title: readinessPhrase(data.readiness), detail: event.note }
  if (event.event_type === 'development_review') return { title: 'Se revisó su desarrollo.', detail: event.note }
  if (event.event_type === 'plant_count_observed') {
    const count = typeof data.count === 'number' ? `Se registraron ${data.count} plantas en este momento.` : 'Se hizo un recuento para seguir su avance.'
    return { title: count, detail: event.note }
  }
  if (event.event_type === 'cycle_ended') return { title: 'El ciclo llegó a su cierre.', detail: event.note }
  if (event.event_type === 'photo_evidence') return { title: 'Un momento más en su historia.', detail: event.note }
  if (event.event_type === 'observation' && event.note) return { title: event.note, detail: null }
  if (event.note) return { title: event.note, detail: null }
  return { title: 'Se registró un nuevo momento.', detail: null }
}

export function isMinorGrowthFilmEvent(event: Pick<CycleHistoryEvent, 'event_type'>): boolean {
  return minorEvents.has(event.event_type)
}

export function groupedGrowthFilmNarratives(events: CycleHistoryEvent[]): Array<{ id: string; title: string; detail: string | null; count: number }> {
  const result: Array<{ id: string; title: string; detail: string | null; count: number }> = []
  for (const event of events) {
    const narrative = growthFilmNarrative(event)
    const previous = result[result.length - 1]
    const sameDay = previous && event.occurred_at.slice(0, 10) === events.find((candidate) => candidate.id === previous.id)?.occurred_at.slice(0, 10)
    if (sameDay && isMinorGrowthFilmEvent(event) && previous.count > 0 && previous.count < 3 && isMinorGrowthFilmEvent(events.find((candidate) => candidate.id === previous.id) ?? event)) {
      previous.count += 1
      previous.detail = 'Varios registros de seguimiento confirmados en este momento.'
      continue
    }
    result.push({ id: event.id, title: narrative.title, detail: narrative.detail, count: 1 })
  }
  return result
}
