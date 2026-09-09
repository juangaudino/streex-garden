import { describe, expect, it } from 'vitest'
import { buildPlantStoryMilestones } from './plant-story'

describe('Plant Story milestones', () => {
  it('curates canonical events in chronological order without creating narrative events', () => {
    const milestones = buildPlantStoryMilestones({ planted_on: '2026-08-24', crop_name: 'Cherry Tomato', history: [
      { id: 'harvest', event_type: 'harvest', occurred_at: '2026-09-04T12:00:00Z', occurred_on: '2026-09-04', note: null, event_data: {}, revision: 1, photo: null },
      { id: 'incident', event_type: 'incident_opened', occurred_at: '2026-08-31T12:00:00Z', occurred_on: '2026-08-31', note: 'Domo desplazado', event_data: { severity: 'watch' }, revision: 1, photo: null },
    ] })
    expect(milestones.map((item) => item.label)).toEqual(['Comienza el ciclo', 'Incidencia: vigilar', 'Cosecha realizada'])
    expect(milestones.filter((item) => item.event === null)).toHaveLength(1)
  })
})
