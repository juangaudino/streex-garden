import { describe, expect, it } from 'vitest'
import { attentionTimingLabel, homeVisitStorageKey, validVisitId } from './home-visit'

describe('contrato de visita y atención', () => {
  it('aísla la referencia de visita por propietario y acepta solo UUID válidos', () => {
    expect(homeVisitStorageKey('owner-a')).not.toBe(homeVisitStorageKey('owner-b'))
    expect(validVisitId('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
    expect(validVisitId('no-es-una-visita')).toBeNull()
  })

  it('mantiene el estado de atención explícito y no depende solo del color', () => {
    expect(attentionTimingLabel({ due_on: '2026-09-06', next_review_on: null }, '2026-09-07')).toBe('Vencida')
    expect(attentionTimingLabel({ due_on: '2026-09-07', next_review_on: null }, '2026-09-07')).toBe('Para hoy')
    expect(attentionTimingLabel({ due_on: null, next_review_on: null }, '2026-09-07')).toBe('Sin fecha')
  })
})
