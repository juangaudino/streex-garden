import { describe, expect, it } from 'vitest'
import { germinationEvidence, seedCountLabel } from './precision-semantics'

describe('precision semantics', () => {
  it('keeps confirmed_by separate from an exact germination date', () => {
    expect(germinationEvidence({ event_id: 'g1', event_type: 'germination_confirmed', confirmed_by: '2026-09-08' }))
      .toEqual({ occurred_on: null, confirmed_by: '2026-09-08' })
  })

  it('never renders a minimum seed count as an exact count', () => {
    expect(seedCountLabel({ count: null, count_min: 6, count_precision: 'minimum' })).toBe('Al menos 6')
  })

  it('preserves existing exact germination and seed count behavior', () => {
    expect(germinationEvidence({ event_id: 'g2', event_type: 'germination_observed', occurred_on: '2026-08-05' }))
      .toEqual({ occurred_on: '2026-08-05', confirmed_by: null })
    expect(seedCountLabel({ count: 3, count_min: null, count_precision: 'exact' })).toBe('3')
  })
})
