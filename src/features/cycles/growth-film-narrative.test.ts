import { describe, expect, it } from 'vitest'
import type { CycleHistoryEvent } from '../../domain/types'
import { groupedGrowthFilmNarratives, growthFilmNarrative } from './growth-film-narrative'

describe('Growth Film narrative layer', () => {
  it('translates canonical interventions without changing their meaning', () => {
    expect(growthFilmNarrative({ event_type: 'intervention', event_data: { class: 'thinning' }, note: null }).title)
      .toBe('Se hizo un raleo para darle más espacio.')
    expect(growthFilmNarrative({ event_type: 'intervention', event_data: { class: 'support', operation: 'installed' }, note: null }).title)
      .toBe('Necesitó un pequeño soporte para crecer más firme.')
  })

  it('groups only nearby minor records and keeps a count for the timeline', () => {
    const events: CycleHistoryEvent[] = [
      { id: 'a', event_type: 'development_review', occurred_at: '2026-09-10T09:00:00Z', note: null, event_data: {}, revision: 1, photo: null },
      { id: 'b', event_type: 'readiness_review', occurred_at: '2026-09-10T10:00:00Z', note: null, event_data: {}, revision: 1, photo: null },
      { id: 'c', event_type: 'intervention', occurred_at: '2026-09-10T11:00:00Z', note: null, event_data: { class: 'pruning' }, revision: 1, photo: null },
    ]
    const result = groupedGrowthFilmNarratives(events)
    expect(result).toHaveLength(2)
    expect(result[0].count).toBe(2)
    expect(result[1].title).toContain('poda')
  })
})
