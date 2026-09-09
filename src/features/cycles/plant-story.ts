import type { CycleHistoryEvent, GrowCycleDetail } from '../../domain/types'
import { eventLabel } from '../../domain/event-presentation'

export interface PlantStoryMilestone { id: string; date: string | null; label: string; note: string | null; event: CycleHistoryEvent | null }

export function buildPlantStoryMilestones(cycle: Pick<GrowCycleDetail, 'planted_on' | 'crop_name' | 'history'>): PlantStoryMilestone[] {
  const milestones: PlantStoryMilestone[] = []
  if (cycle.planted_on) milestones.push({ id: `planting:${cycle.planted_on}`, date: cycle.planted_on, label: 'Comienza el ciclo', note: `${cycle.crop_name} fue plantado.`, event: null })
  const significant = cycle.history.filter((event) => ['germination_observed', 'germination_confirmed', 'incident_opened', 'incident_resolved', 'intervention', 'harvest', 'cycle_ended', 'development_review', 'readiness_review', 'photo_evidence'].includes(event.event_type))
  for (const event of significant) milestones.push({ id: event.id, date: event.occurred_on ?? event.occurred_at, label: eventLabel(event), note: event.note, event })
  return milestones.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.id.localeCompare(b.id))
}
