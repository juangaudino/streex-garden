import type { GardenAiCheckProposalV1 } from '../domain/ai'

export interface AiProviderRequest {
  operation: 'ai_check' | 'ask_garden'
  context: unknown
  imageDataUrl?: string
  standardVersion: string
  promptVersion: string
}

export interface AiProviderResponse {
  raw: unknown
  model: string
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
}

export interface AiProviderAdapter {
  readonly id: string
  analyze(request: AiProviderRequest): Promise<AiProviderResponse>
}

/** Deterministic provider used by tests and local UI development. */
export class MockAiProvider implements AiProviderAdapter {
  readonly id = 'mock_v1'

  async analyze(request: AiProviderRequest): Promise<AiProviderResponse> {
    if (request.operation === 'ask_garden') {
      return {
        model: 'mock-text',
        raw: {
          schema_version: 'garden_ai_ask_v1',
          answer_type: 'insufficient_evidence',
          answer: 'No hay suficiente evidencia en este contexto.',
          confirmed_facts: [],
          suggested_next_actions: [],
        },
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      }
    }
    const photoId = typeof request.context === 'object' && request.context !== null && 'selected_photo_id' in request.context
      ? String((request.context as { selected_photo_id: string }).selected_photo_id)
      : 'mock-photo'
    const proposal: GardenAiCheckProposalV1 = {
      schema_version: 'garden_ai_check_v1',
      status: 'insufficient_evidence',
      summary: 'La evidencia no alcanza para recomendar una acción.',
      evidence_used: [{ kind: 'photo', id: photoId }],
      overall_visible_state: 'insufficient_evidence',
      development_recommendations: [],
      possible_harvest_readiness: 'insufficient_evidence',
      possible_incident: 'insufficient_evidence',
      observations: [],
      uncertainty: ['Proveedor mock: no se realizó análisis visual.'],
      questions: ['¿Puedes registrar una observación con más contexto?'],
      suggested_next_actions: [{ kind: 'none', rationale: 'La salida mock no ejecuta acciones.' }],
      confidence: 'low',
    }
    return { model: 'mock-vision', raw: proposal, usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 } }
  }
}
