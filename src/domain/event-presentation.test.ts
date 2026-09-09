import { describe, expect, it } from 'vitest'
import { eventDetail, eventLabel } from './event-presentation'

describe('event presentation', () => {
  it('uses structured intervention semantics and preserves generic legacy events', () => {
    expect(eventLabel({ event_type: 'intervention', event_data: { class: 'support', operation: 'adjusted' } })).toBe('Soporte ajustado')
    expect(eventLabel({ event_type: 'intervention', event_data: {} })).toBe('Intervención realizada')
  })
  it('renders stored structured details without inventing facts', () => {
    expect(eventDetail({ event_type: 'plant_count_observed', event_data: { count: 2, count_kind: 'plants_kept' } })).toBe('Cantidad: 2 conservadas')
    expect(eventDetail({ event_type: 'harvest', event_data: {} })).toBe('')
  })
})
