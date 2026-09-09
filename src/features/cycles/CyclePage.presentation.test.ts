// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { eventDetail, eventLabel } from './CyclePage'
import type { CycleHistoryEvent } from '../../domain/types'

const event = (event_type: CycleHistoryEvent['event_type'], event_data: Record<string, unknown> = {}): CycleHistoryEvent => ({ id: 'e', event_type, event_data, occurred_at: '2026-09-08T12:00:00Z', note: null, revision: 1, photo: null })

describe('Cycle Story event presentation', () => {
  it('uses explicit support semantics and keeps legacy support generic', () => {
    expect(eventLabel(event('intervention', { class: 'support', operation: 'removed' }))).toBe('Soporte retirado')
    expect(eventLabel(event('intervention', { class: 'support' }))).toBe('Intervención de soporte')
  })
  it('renders structured details without inventing missing data', () => {
    expect(eventDetail(event('plant_count_observed', { count: 3, count_kind: 'plants_kept' }))).toBe('Cantidad: 3 conservadas')
    expect(eventDetail(event('intervention', { class: 'support' }))).toBe('')
  })
})
