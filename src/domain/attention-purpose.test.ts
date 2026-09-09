import { describe, expect, it } from 'vitest'
import { attentionPurposeLabel, cycleAttentionPurposes } from './attention-purpose'

describe('support follow-up semantics', () => {
  it('offers removing support as a distinct future action', () => {
    expect(cycleAttentionPurposes).toContainEqual({ value: 'perform_support_remove', label: 'Retirar soporte' })
    expect(attentionPurposeLabel('perform_support_remove')).toBe('Retirar soporte')
  })
})
