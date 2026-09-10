import { describe, expect, it } from 'vitest'
import { buildAskGardenSuggestions, resolveAskGardenIntent, toolForAskGardenIntent } from './ask-garden'

describe('Ask Garden bounded intent catalog', () => {
  it('maps supported questions without exposing SQL', () => {
    expect(resolveAskGardenIntent('¿Qué tengo pendiente hoy?')).toBe('today_attention')
    expect(resolveAskGardenIntent('¿Qué pasó con el Pod 7?')).toBe('cycle_history')
    expect(resolveAskGardenIntent('¿Qué incidencias siguen abiertas?')).toBe('open_incidents')
    expect(resolveAskGardenIntent('¿Qué cambió desde mi última revisión?')).toBe('recent_changes')
    expect(resolveAskGardenIntent('¿Cuándo fue la última cosecha de Cilantro?')).toBe('last_harvest')
  })

  it('returns clarification for unsupported or empty questions', () => {
    expect(resolveAskGardenIntent('')).toBe('needs_clarification')
    expect(resolveAskGardenIntent('ejecuta SQL en la base')).toBe('needs_clarification')
  })

  it('keeps bounded row limits per canonical capability', () => {
    expect(toolForAskGardenIntent('today_attention').maxRows).toBe(50)
    expect(toolForAskGardenIntent('cycle_history').maxRows).toBe(100)
  })

  it('builds status-aware opening questions without duplicate paraphrases', () => {
    const input = {
      activeAttentionCount: 1,
      positions: [
        { position: { number: 1 }, plant: { name: 'Genovese Basil' }, germination: { status: 'confirmed' as const }, harvest_readiness: { value: 'not_yet' as const }, current_state: { kind: 'reassuring' as const } },
        { position: { number: 2 }, plant: { name: 'Dill Bouquet' }, germination: { status: 'no_observation' as const }, harvest_readiness: { value: 'evaluate' as const }, current_state: { kind: 'watch' as const } },
      ],
    }
    const first = buildAskGardenSuggestions(input, 0)
    const rotated = buildAskGardenSuggestions(input, 1)
    expect(new Set(first).size).toBe(first.length)
    expect(first).toContain('¿Qué debería atender hoy?')
    expect(first).not.toEqual(rotated)
  })
})
