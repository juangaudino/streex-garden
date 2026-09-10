export interface AiProviderRequest {
  operation: 'ai_check' | 'ask_garden'
  context: unknown
  imageDataUrl?: string
  standardVersion: string
  promptVersion: string
  jsonSchema?: Record<string, unknown>
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

/** Server-only OpenAI Responses adapter. The key is injected by the Edge Function. */
export class OpenAiResponsesAdapter implements AiProviderAdapter {
  readonly id = 'openai_responses_v1'

  constructor(private readonly apiKey: string, private readonly model: string, private readonly fetchImpl: typeof fetch = fetch) {}

  async analyze(request: AiProviderRequest): Promise<AiProviderResponse> {
    const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: JSON.stringify({ operation: request.operation, context: request.context, standard_version: request.standardVersion, prompt_version: request.promptVersion }) }]
    if (request.imageDataUrl) content.push({ type: 'input_image', image_url: request.imageDataUrl, detail: 'high' })
    const payload: Record<string, unknown> = { model: this.model, input: [{ role: 'user', content }], store: false }
    if (request.jsonSchema) payload.text = { format: { type: 'json_schema', name: 'garden_ai_output', strict: true, schema: request.jsonSchema } }
    const response = await this.fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      let detail = ''
      try {
        const errorBody = await response.json() as { error?: { code?: unknown; message?: unknown } }
        const code = typeof errorBody.error?.code === 'string' ? errorBody.error.code : ''
        const message = typeof errorBody.error?.message === 'string' ? errorBody.error.message : ''
        detail = [code, message].filter(Boolean).join(': ').slice(0, 240)
      } catch { /* preserve the status when the provider body is not JSON */ }
      throw new Error(`AI provider HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
    }
    const body = await response.json() as { output_text?: string; usage?: AiProviderResponse['usage'] }
    let raw: unknown = body.output_text
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw) } catch { /* the caller's schema validator will reject this */ }
    }
    return { raw, model: this.model, usage: body.usage }
  }
}
