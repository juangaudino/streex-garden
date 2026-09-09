import type { CycleHistoryEvent } from './types'

const labels: Record<string, string> = {
  observation: 'Observación', planting: 'Siembra', harvest: 'Cosecha realizada', action: 'Acción',
  cycle_started: 'Ciclo iniciado', cycle_ended: 'Ciclo cerrado', cycle_moved: 'Ciclo trasladado', seeds_added: 'Siembra adicional',
  germination_observed: 'Germinación observada', germination_confirmed: 'Germinación confirmada hasta una fecha',
  plant_count_observed: 'Cantidad de plantas observada', visual_review: 'Revisión visual', development_review: 'Revisión de desarrollo',
  intervention: 'Intervención realizada', incident_opened: 'Incidencia abierta', incident_resolved: 'Incidencia resuelta',
  system_maintenance: 'Mantenimiento del sistema', measurement: 'Medición', readiness_review: 'Evaluación de preparación para cosecha', photo_evidence: 'Fotografía documental',
}

export function eventLabel(event: Pick<CycleHistoryEvent, 'event_data'> & { event_type: string }): string {
  const data = event.event_data ?? {}
  if (event.event_type === 'intervention') {
    if (data.class === 'thinning') return 'Aclareo realizado'
    if (data.class === 'pruning') return 'Poda realizada'
    if (data.class === 'support') return ({ installed: 'Soporte instalado', adjusted: 'Soporte ajustado', removed: 'Soporte retirado' } as Record<string, string>)[String(data.operation)] ?? 'Intervención de soporte'
  }
  if (event.event_type === 'incident_opened' && data.severity) return data.severity === 'action_required' ? 'Incidencia: requiere acción' : 'Incidencia: vigilar'
  return labels[event.event_type] ?? 'Registro'
}

export function eventDetail(event: Pick<CycleHistoryEvent, 'event_data'> & { event_type: string }): string {
  const data = event.event_data ?? {}
  if (event.event_type === 'plant_count_observed' && data.count !== undefined) return `Cantidad: ${data.count} ${data.count_kind === 'plants_kept' ? 'conservadas' : 'visibles'}`
  if (event.event_type === 'germination_observed' && data.count !== undefined) return `Plántulas observadas: ${data.count}`
  if (event.event_type === 'development_review' && data.purpose) return `Evaluación: ${String(data.purpose).replace('evaluate_', '')}`
  if (event.event_type === 'readiness_review' && data.readiness) return `Preparación para cosecha: ${String(data.readiness).replaceAll('_', ' ')}`
  if (event.event_type === 'intervention' && data.count_removed !== undefined) return `Retiradas: ${data.count_removed}${data.count_retained !== undefined ? ` · Conservadas: ${data.count_retained}` : ''}`
  return ''
}
