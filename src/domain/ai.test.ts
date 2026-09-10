import { describe, expect, it } from 'vitest'
import { buildCanonicalActions, validateGardenAiCheckProposal } from './ai'

const context = {
  growCycleId: 'cycle-1',
  gardenId: 'garden-1',
  positionId: 'position-1',
  evidenceRef: { kind: 'photo' as const, id: 'photo-1' },
}

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 'garden_ai_check_v1',
    status: 'complete',
    summary: 'La evidencia permite una evaluación limitada.',
    evidence_used: [{ kind: 'photo', id: 'photo-1' }],
    overall_visible_state: 'watch',
    development_recommendations: [],
    possible_harvest_readiness: 'not_assessed',
    possible_incident: 'no_visible_signs',
    observations: ['Se observa crecimiento visible.'],
    uncertainty: [],
    questions: [],
    suggested_next_actions: [{ kind: 'none', rationale: 'No hay una acción sustentada.' }],
    confidence: 'medium',
    ...overrides,
  }
}

describe('Garden AI proposal contract', () => {
  it('accepts a valid proposal and ignores unknown optional fields', () => {
    const result = validateGardenAiCheckProposal(proposal({ future_field: { provider: 'x' } }))
    expect(result?.schema_version).toBe('garden_ai_check_v1')
    expect(result).not.toHaveProperty('future_field')
  })

  it('rejects none_observed because it implies an unsupported absence claim', () => {
    expect(validateGardenAiCheckProposal(proposal({ possible_incident: 'none_observed' }))).toBeNull()
  })

  it('rejects malformed output before it can reach the UI', () => {
    expect(validateGardenAiCheckProposal(proposal({ evidence_used: [{ kind: 'photo' }] }))).toBeNull()
    expect(validateGardenAiCheckProposal(proposal({ suggested_next_actions: [{ kind: 'delete_data', rationale: 'x' }] }))).toBeNull()
  })

  it('maps suggestions to existing canonical flows without saving anything', () => {
    const result = validateGardenAiCheckProposal(proposal({
      development_recommendations: [{ kind: 'thinning', recommendation: 'evaluate', rationale: 'Hay varias plántulas visibles.', confidence: 'medium' }],
      possible_incident: 'possible',
      possible_harvest_readiness: 'possible_evaluate',
    }))!
    expect(buildCanonicalActions(result, context).map((action) => action.label)).toEqual([
      'Evaluar aclareo',
      'Registrar incidencia',
      'Evaluar preparación para cosecha',
    ])
    expect(buildCanonicalActions(result, context)[0].context.growCycleId).toBe('cycle-1')
  })
})
