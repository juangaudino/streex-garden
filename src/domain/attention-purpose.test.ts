import { describe, expect, it } from 'vitest'
import { attentionPurposeLabel } from './attention-purpose'

describe('propósitos de atención', () => {
  it('mantiene etiquetas explícitas para acciones que registran un hecho', () => {
    expect(attentionPurposeLabel('perform_water_change')).toBe('Cambiar toda el agua')
    expect(attentionPurposeLabel('evaluate_visual_review')).toBe('Revisión visual')
    expect(attentionPurposeLabel('perform_harvest')).toBe('Realizar cosecha')
  })
})
