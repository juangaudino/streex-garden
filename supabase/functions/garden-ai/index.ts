import { createClient } from 'npm:@supabase/supabase-js@2.115.0'
import { OpenAiResponsesAdapter } from '../_shared/ai-provider.ts'
import { gardenAiInstructions, GARDEN_AI_RUNTIME_PROMPT_VERSION } from '../_shared/garden-ai-instructions.ts'
import { runAiCheckRuntime } from '../_shared/garden-ai-runtime.ts'
import { GARDEN_AI_ASK_JSON_SCHEMA, GARDEN_AI_CHECK_JSON_SCHEMA, GARDEN_AI_PROPOSAL_SCHEMA_VERSION, GARDEN_AI_STANDARD_VERSION, validateAiCheckProposal, validateAskGardenAnswer } from '../_shared/ai-contract.ts'

const allowedOrigin = Deno.env.get('GARDEN_AI_ALLOWED_ORIGIN') ?? 'https://garden.getstreex.com'
const corsHeaders = { 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Origin': allowedOrigin, 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders })
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const requestKey = (value: unknown): value is string => typeof value === 'string' && value.length >= 16 && value.length <= 160 && /^[a-zA-Z0-9:_-]+$/.test(value)
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const featureEnabled = Deno.env.get('GARDEN_AI_ENABLED') === 'true'
const providerName = Deno.env.get('GARDEN_AI_PROVIDER') ?? 'openai'
// Luna is the only normal V1 model. Benchmark candidates are isolated in the
// garden-ai-benchmark function and cannot change this production capability.
const model = 'gpt-5.6-luna'
if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase server configuration')

async function startRequest(client: ReturnType<typeof createClient>, ownerId: string, key: string, type: 'ai_check' | 'ask_garden', evidenceRefs: unknown[]) {
  const response = await client.rpc('garden_ai_start_request', { p_request_key: key, p_request_type: type, p_evidence_refs: evidenceRefs, p_proposal_schema_version: type === 'ai_check' ? GARDEN_AI_PROPOSAL_SCHEMA_VERSION : 'garden_ai_ask_v1' })
  if (response.error || !response.data || typeof response.data !== 'object') throw new Error('AI request could not be created')
  const row = response.data as { id?: string; status?: string; proposal?: unknown; model_identifier?: string }
  if (!row.id) throw new Error('AI request could not be created')
  if (row.status === 'completed') return { existing: row }
  if (row.status === 'started' && row.proposal === null) return { existing: null, id: row.id }
  throw new Error('AI request already in progress')
}

async function finishRequest(client: ReturnType<typeof createClient>, id: string, patch: Record<string, unknown>) {
  const result = await client.rpc('garden_ai_finish_request', { p_request_id: id, p_status: patch.status, p_proposal: patch.proposal ?? null, p_model_identifier: patch.model_identifier ?? null, p_duration_ms: patch.duration_ms ?? null, p_usage_metadata: patch.usage_metadata ?? {}, p_error_code: patch.error_code ?? null })
  if (result.error) throw new Error('AI audit update failed')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const origin = request.headers.get('Origin')
  if (origin && origin !== allowedOrigin) return json({ error: 'Origin not allowed' }, 403)
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401)
  const token = authorization.slice('Bearer '.length)
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'Authentication required' }, 401)
  if (!featureEnabled) return json({ error: 'Garden AI is disabled' }, 503)
  const auditClient = userClient

  let body: { operation?: unknown; grow_cycle_id?: unknown; photo_id?: unknown; compare_photo_id?: unknown; question?: unknown; conversation?: unknown; draft_image_data_url?: unknown; request_key?: unknown }
  try { body = await request.json() as typeof body } catch { return json({ error: 'Invalid request' }, 400) }
  if (!requestKey(body.request_key)) return json({ error: 'A valid request key is required' }, 400)
  if (providerName === 'mock') return json({ error: 'Mock provider is available in local tests only' }, 503)
  if (providerName !== 'openai' || !Deno.env.get('OPENAI_API_KEY') || !model) return json({ error: 'AI provider is not configured' }, 503)
  const provider = new OpenAiResponsesAdapter(Deno.env.get('OPENAI_API_KEY')!, model)

  try {
    if (body.operation === 'ai_check') {
      if (!uuid(body.grow_cycle_id) || !uuid(body.photo_id) || (body.compare_photo_id !== undefined && body.compare_photo_id !== null && !uuid(body.compare_photo_id))) return json({ error: 'AI Check requires valid cycle and photo identifiers' }, 400)
      const started = await startRequest(auditClient, userData.user.id, body.request_key, 'ai_check', [{ kind: 'photo', id: body.photo_id }].concat(body.compare_photo_id ? [{ kind: 'photo', id: body.compare_photo_id }] : []))
      if (started.existing) return json({ proposal: started.existing.proposal, request_id: started.existing.id, idempotent: true })
      const runtime = await runAiCheckRuntime({ userClient, storageClient: userClient, ownerId: userData.user.id, growCycleId: body.grow_cycle_id, photoId: body.photo_id, comparePhotoId: body.compare_photo_id as string | null | undefined, provider, standardVersion: GARDEN_AI_STANDARD_VERSION, promptVersion: GARDEN_AI_RUNTIME_PROMPT_VERSION, jsonSchema: GARDEN_AI_CHECK_JSON_SCHEMA, instructions: gardenAiInstructions })
      const startedAt = Date.now()
      const response = await provider.analyze(runtime.providerRequest)
      const proposal = validateAiCheckProposal(response.raw)
      if (!proposal) { await finishRequest(auditClient, started.id, { status: 'failed', error_code: 'invalid_structured_output', duration_ms: Date.now() - startedAt, model_identifier: response.model }); return json({ error: 'Provider returned invalid structured output' }, 502) }
      await finishRequest(auditClient, started.id, { status: 'completed', proposal, model_identifier: response.model, duration_ms: Date.now() - startedAt, usage_metadata: response.usage ?? {} })
      return json({ proposal, request_id: started.id, idempotent: false })
    }

    if (body.operation === 'ai_check_draft') {
      if (!uuid(body.grow_cycle_id) || typeof body.draft_image_data_url !== 'string' || !body.draft_image_data_url.startsWith('data:image/jpeg;base64,')) return json({ error: 'AI Check requires a valid pending photo' }, 400)
      if (body.draft_image_data_url.length > 7_000_000) return json({ error: 'Pending photo exceeds the AI image limit' }, 400)
      const started = await startRequest(auditClient, userData.user.id, body.request_key, 'ai_check', [{ kind: 'ephemeral_photo', id: 'pending_observation' }])
      if (started.existing) return json({ proposal: started.existing.proposal, request_id: started.existing.id, idempotent: true })
      const contextResponse = await userClient.rpc('garden_get_ai_draft_cycle_context', { p_grow_cycle_id: body.grow_cycle_id })
      if (contextResponse.error || !contextResponse.data) throw new Error('Authorized AI draft context is unavailable')
      const startedAt = Date.now()
      const response = await provider.analyze({ operation: 'ai_check', context: contextResponse.data, imageDataUrl: body.draft_image_data_url, standardVersion: GARDEN_AI_STANDARD_VERSION, promptVersion: GARDEN_AI_RUNTIME_PROMPT_VERSION, jsonSchema: GARDEN_AI_CHECK_JSON_SCHEMA, instructions: gardenAiInstructions })
      const proposal = validateAiCheckProposal(response.raw)
      if (!proposal) { await finishRequest(auditClient, started.id, { status: 'failed', error_code: 'invalid_structured_output', duration_ms: Date.now() - startedAt, model_identifier: response.model }); return json({ error: 'Provider returned invalid structured output' }, 502) }
      await finishRequest(auditClient, started.id, { status: 'completed', proposal, model_identifier: response.model, duration_ms: Date.now() - startedAt, usage_metadata: response.usage ?? {} })
      return json({ proposal, request_id: started.id, idempotent: false })
    }

    if (body.operation === 'ask_garden') {
      if (typeof body.question !== 'string' || body.question.trim().length < 2 || body.question.length > 2000) return json({ error: 'Ask Garden question is invalid' }, 400)
      const started = await startRequest(auditClient, userData.user.id, body.request_key, 'ask_garden', [])
      if (started.existing) return json({ answer: started.existing.proposal, request_id: started.existing.id, idempotent: true })
      const askContext = await userClient.rpc('garden_get_ai_ask_context')
      if (askContext.error || !askContext.data) throw new Error('Authorized Ask Garden context is unavailable')
      const conversation = Array.isArray(body.conversation) ? body.conversation.slice(-4).map((item) => typeof item === 'object' && item !== null ? { question: String((item as Record<string, unknown>).question ?? '').slice(0, 300), answer: String((item as Record<string, unknown>).answer ?? '').slice(0, 500), status: 'unconfirmed_conversation_context' } : null).filter(Boolean) : []
      const response = await provider.analyze({ operation: 'ask_garden', context: { question: body.question, canonical_context: askContext.data, conversation }, standardVersion: GARDEN_AI_STANDARD_VERSION, promptVersion: GARDEN_AI_RUNTIME_PROMPT_VERSION, jsonSchema: GARDEN_AI_ASK_JSON_SCHEMA, instructions: gardenAiInstructions })
      const answer = validateAskGardenAnswer(response.raw)
      if (!answer) { await finishRequest(auditClient, started.id, { status: 'failed', error_code: 'invalid_structured_output', model_identifier: response.model }); return json({ error: 'Provider returned invalid structured output' }, 502) }
      await finishRequest(auditClient, started.id, { status: 'completed', proposal: answer, model_identifier: response.model, usage_metadata: response.usage ?? {} })
      return json({ answer, request_id: started.id, idempotent: false })
    }
    return json({ error: 'Unsupported AI operation' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'AI request failed' }, 502)
  }
})
