import { describe, expect, it } from 'vitest'
import { resolveAskGardenIntent, toolForAskGardenIntent } from './ask-garden'

describe('Ask Garden bounded intent catalog', () => {
  it('maps supported questions without exposing SQL', () => {
    expect(resolveAskGardenIntent('¿Qué tengo pendiente hoy?')).toBe('today_attention')
    expect(resolveAskGardenIntent('¿Qué pasó con el Pod 7?')).toBe('cycle_history')
    expect(resolveAskGardenIntent('¿Qué incidencias siguen abiertas?')).toBe('open_incidents')
    expect(resolveAskGardenIntent('¿Qué cambió desde mi última revisión?')).toBe('recent_changes')
  })

  it('returns clarification for unsupported or empty questions', () => {
    expect(resolveAskGardenIntent('')).toBe('needs_clarification')
    expect(resolveAskGardenIntent('ejecuta SQL en la base')).toBe('needs_clarification')
  })

  it('keeps bounded row limits per canonical capability', () => {
    expect(toolForAskGardenIntent('today_attention').maxRows).toBe(50)
    expect(toolForAskGardenIntent('cycle_history').maxRows).toBe(100)
  })
})
