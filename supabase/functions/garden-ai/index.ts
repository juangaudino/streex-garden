import { createClient } from 'npm:@supabase/supabase-js@2.115.0'
import { OpenAiResponsesAdapter } from '../_shared/ai-provider.ts'
import { gardenAiInstructionsFor, gardenCareAskInstructionsFor, gardenShareCaptionInstructionsFor, gardenSummaryInstructionsFor, GARDEN_AI_CARE_ASK_PROMPT_VERSION, GARDEN_AI_RUNTIME_PROMPT_VERSION } from '../_shared/garden-ai-instructions.ts'
import { runAiCheckRuntime } from '../_shared/garden-ai-runtime.ts'
import { GARDEN_AI_ASK_JSON_SCHEMA, GARDEN_AI_CHECK_JSON_SCHEMA, GARDEN_AI_PROPOSAL_SCHEMA_VERSION, GARDEN_AI_STANDARD_VERSION, GARDEN_MEANINGFUL_CHANGE_JSON_SCHEMA, GARDEN_MEANINGFUL_CHANGE_SCHEMA_VERSION, GARDEN_SHARE_CAPTION_JSON_SCHEMA, GARDEN_SHARE_CAPTION_SCHEMA_VERSION, GARDEN_SUMMARY_JSON_SCHEMA, GARDEN_SUMMARY_SCHEMA_VERSION, validateAiCheckProposal, validateAskGardenAnswer, validateCareReviewAttachment, validateMeaningfulChangeProposal, validateGardenSummaryProposal, validateShareCaptionProposal } from '../_shared/ai-contract.ts'

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

async function startRequest(client: ReturnType<typeof createClient>, ownerId: string, key: string, type: 'ai_check' | 'meaningful_change' | 'share_caption' | 'ask_garden' | 'garden_summary_global' | 'garden_summary_local', evidenceRefs: unknown[]) {
  const proposalSchemaVersion = type === 'ai_check' ? GARDEN_AI_PROPOSAL_SCHEMA_VERSION : type === 'meaningful_change' ? GARDEN_MEANINGFUL_CHANGE_SCHEMA_VERSION : type === 'share_caption' ? GARDEN_SHARE_CAPTION_SCHEMA_VERSION : type.startsWith('garden_summary') ? GARDEN_SUMMARY_SCHEMA_VERSION : 'garden_ai_ask_v1'
  const response = await client.rpc('garden_ai_start_request', { p_request_key: key, p_request_type: type, p_evidence_refs: evidenceRefs, p_proposal_schema_version: proposalSchemaVersion })
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

function safeFailure(error: unknown): { code: string; message: string; status: number } {
  const detail = error instanceof Error ? error.message : ''
  const providerStatus = /AI provider HTTP (\d{3})/.exec(detail)?.[1]
  if (providerStatus === '429') return { code: 'provider_rate_limited', message: 'Garden AI alcanzó un límite temporal. Intenta de nuevo en un momento.', status: 429 }
  if (providerStatus && providerStatus.startsWith('5')) return { code: `provider_http_${providerStatus}`, message: 'Garden AI no está disponible temporalmente. Intenta de nuevo en un momento.', status: 503 }
  if (providerStatus) return { code: `provider_http_${providerStatus}`, message: 'Garden AI no pudo completar esta respuesta. Intenta nuevamente.', status: 502 }
  if (detail.includes('Authorized Ask Garden context') || detail.includes('Authorized AI context') || detail.includes('Authorized AI draft context')) return { code: 'authorized_context_unavailable', message: 'Garden AI no pudo preparar el contexto autorizado de este jardín.', status: 503 }
  if (detail.includes('invalid structured output')) return { code: 'invalid_structured_output', message: 'Garden AI devolvió una respuesta no válida. Intenta nuevamente.', status: 502 }
  return { code: 'runtime_failed', message: 'Garden AI no pudo completar la solicitud. Intenta nuevamente.', status: 502 }
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

  let body: { operation?: unknown; grow_cycle_id?: unknown; photo_id?: unknown; compare_photo_id?: unknown; before_photo_id?: unknown; after_photo_id?: unknown; question?: unknown; conversation?: unknown; draft_image_data_url?: unknown; care_review_photo_data_url?: unknown; care_review_context?: unknown; request_key?: unknown; language?: unknown; scope_type?: unknown; garden_id?: unknown; material_fingerprint?: unknown }
  try { body = await request.json() as typeof body } catch { return json({ error: 'Invalid request' }, 400) }
  if (!requestKey(body.request_key)) return json({ error: 'A valid request key is required' }, 400)
  if (providerName === 'mock') return json({ error: 'Mock provider is available in local tests only' }, 503)
  if (providerName !== 'openai' || !Deno.env.get('OPENAI_API_KEY') || !model) return json({ error: 'AI provider is not configured' }, 503)
  const provider = new OpenAiResponsesAdapter(Deno.env.get('OPENAI_API_KEY')!, model)
  const responseLanguage = body.language === 'en' ? 'en' : 'es'
  let activeAudit: { id: string; startedAt: number } | null = null

  try {
    if (body.operation === 'ai_check') {
      if (!uuid(body.grow_cycle_id) || !uuid(body.photo_id) || (body.compare_photo_id !== undefined && body.compare_photo_id !== null && !uuid(body.compare_photo_id))) return json({ error: 'AI Check requires valid cycle and photo identifiers' }, 400)
      const started = await startRequest(auditClient, userData.user.id, body.request_key, 'ai_check', [{ kind: 'photo', id: body.photo_id }].concat(body.compare_photo_id ? [{ kind: 'photo', id: body.compare_photo_id }] : []))
      if (started.existing) return json({ proposal: started.existing.proposal, request_id: started.existing.id, idempotent: true })
      const startedAt = Date.now()
      activeAudit = { id: started.id, startedAt }
      const runtime = await runAiCheckRuntime({ userClient, storageClient: userClient, ownerId: userData.user.id, growCycleId: body.grow_cycle_id, photoId: body.photo_id, comparePhotoId: body.compare_photo_id as string | null | undefined, provider, standardVersion: GARDEN_AI_STANDARD_VERSION, promptVersion: GARDEN_AI_RUNTIME_PROMPT_VERSION, jsonSchema: GARDEN_AI_CHECK_JSON_SCHEMA, instructions: gardenAiInstructionsFor(responseLanguage) })
      const response = await provider.analyze(runtime.providerRequest)
      const proposal = validateAiCheckProposal(response.raw)
      if (!proposal) { await finishRequest(auditClient, started.id, { status: 'failed', error_code: 'invalid_structured_output', duration_ms: Date.now() - startedAt, model_identifier: response.model }); activeAudit = null; return json({ error: 'Provider returned invalid structured output' }, 502) }
      await finishRequest(auditClient, started.id, { status: 'completed', proposal, model_identifier: response.model, duration_ms: Date.now() - startedAt, usage_metadata: response.usage ?? {} })
      activeAudit = null
      return json({ proposal, request_id: started.id, idempotent: false })
    }

    if (body.operation === 'meaningful_change') {
      if (!uuid(body.grow_cycle_id) || !uuid(body.before_photo_id) || !uuid(body.after_photo_id) || body.before_photo_id === body.after_photo_id) return json({ error: 'Meaningful Changes requires two distinct photos from the same cycle' }, 400)
      const started = await startRequest(auditClient, userData.user.id, body.request_key, 'meaningful_change', [{ kind: 'photo', id: body.before_photo_id }, { kind: 'photo', id: body.after_photo_id }])
      if (started.existing) return json({ proposal: started.existing.proposal, request_id: started.existing.id, idempotent: true })
      const startedAt = Date.now()
      activeAudit = { id: started.id, startedAt }
      const runtime = await runAiCheckRuntime({ userClient, storageClient: userClient, ownerId: userData.user.id, growCycleId: body.grow_cycle_id, photoId: body.before_photo_id, comparePhotoId: body.after_photo_id, provider, operation: 'meaningful_change', standardVersion: GARDEN_AI_STANDARD_VERSION, promptVersion: GARDEN_AI_RUNTIME_PROMPT_VERSION, jsonSchema: GARDEN_MEANINGFUL_CHANGE_JSON_SCHEMA, instructions: gardenAiInstructionsFor(responseLanguage) })
      const response = await provider.analyze(runtime.providerRequest)
      const proposal = validateMeaningfulChangeProposal(response.raw)
      if (!proposal) { await finishRequest(auditClient, started.id, { status: 'failed', error_code: 'invalid_structured_output', duration_ms: Date.now() - startedAt, model_identifier: response.model }); activeAudit = null; return json({ error: 'Provider returned invalid structured output' }, 502) }
      await finishRequest(auditClient, started.id, { status: 'completed', proposal, model_identifier: response.model, duration_ms: Date.now() - startedAt, usage_metadata: { ...(response.usage ?? {}), language: responseLanguage } })
      activeAudit = null
      return json({ proposal, request_id: started.id, idempotent: false })
    }

    if (body.operation === 'garden_summary') {
      if (body.scope_type !== 'global' && body.scope_type !== 'garden') return json({ error: 'Garden Summary scope is invalid' }, 400)
      if (body.scope_type === 'garden' && !uuid(body.garden_id)) return json({ error: 'Garden Summary garden is invalid' }, 400)
      if (typeof body.material_fingerprint !== 'string' || !/^[a-f0-9]{32}$/i.test(body.material_fingerprint)) return json({ error: 'Garden Summary fingerprint is invalid' }, 400)
      const requestType = body.scope_type === 'global' ? 'garden_summary_global' : 'garden_summary_local'
      const started = await startRequest(auditClient, userData.user.id, body.request_key, requestType, [{ kind: 'summary_scope', scope_type: body.scope_type, scope_id: body.scope_type === 'garden' ? body.garden_id : null, material_fingerprint: body.material_fingerprint }])
      if (started.existing) return json({ proposal: started.existing.proposal, request_id: started.existing.id, idempotent: true })
      const startedAt = Date.now()
      activeAudit = { id: started.id, startedAt }
      const contextResponse = await userClient.rpc('garden_get_garden_summary_context', { p_scope_type: body.scope_type, p_garden_id: body.scope_type === 'garden' ? body.garden_id : null })
      if (contextResponse.error || !contextResponse.data || typeof contextResponse.data !== 'object') throw new Error('Authorized Garden Summary context is unavailable')
      const context = contextResponse.data as Record<string, unknown>
      if (context.material_fingerprint !== body.material_fingerprint) throw new Error('Garden Summary context changed; retry')
      const response = await provider.analyze({ operation: 'garden_summary', context, standardVersion: GARDEN_AI_STANDARD_VERSION, promptVersion: GARDEN_AI_RUNTIME_PROMPT_VERSION, jsonSchema: GARDEN_SUMMARY_JSON_SCHEMA, instructions: gardenSummaryInstructionsFor(responseLanguage) })
      const proposal = validateGardenSummaryProposal(response.raw)
      const contextArray = (key: string) => Array.isArray(context[key]) ? context[key] as unknown[] : []
      const coverage = proposal?.evidence_coverage && typeof proposal.evidence_coverage === 'object' ? proposal.evidence_coverage as Record<string, unknown> : null
      const expectedCoverage = {
        plant_count: contextArray('plants').length,
        garden_count: contextArray('gardens').length,
        open_attention_count: contextArray('open_attention').length,
        recent_event_count: contextArray('recent_events').length,
        meaningful_change_count: contextArray('meaningful_changes').length,
        ai_check_count: contextArray('ai_checks').length,
      }
      const coverageMatches = coverage && Object.entries(expectedCoverage).every(([key, count]) => coverage[key] === count)
      const idsFor = (key: string, idKey: string) => new Set(contextArray(key).flatMap((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>)[idKey] === 'string' ? [(item as Record<string, unknown>)[idKey] as string] : []))
      const referencesMatch = proposal && Array.isArray(proposal.referenced_plant_instance_ids) && Array.isArray(proposal.referenced_meaningful_change_ids) && Array.isArray(proposal.referenced_ai_check_ids) && proposal.referenced_plant_instance_ids.every((id) => typeof id === 'string' && idsFor('plants', 'plant_instance_id').has(id)) && proposal.referenced_meaningful_change_ids.every((id) => typeof id === 'string' && idsFor('meaningful_changes', 'id').has(id)) && proposal.referenced_ai_check_ids.every((id) => typeof id === 'string' && idsFor('ai_checks', 'id').has(id))
      if (!proposal || proposal.scope_type !== body.scope_type || proposal.scope_id !== (body.scope_type === 'garden' ? body.garden_id : null) || proposal.material_fingerprint !== body.material_fingerprint || !coverageMatches || !referencesMatch) {
        await finishRequest(auditClient, started.id, { status: 'failed', error_code: 'invalid_structured_output', duration_ms: Date.now() - startedAt, model_identifier: response.model }); activeAudit = null; return json({ error: 'Provider returned invalid Garden Summary' }, 502)
      }
      await finishRequest(auditClient, started.id, { status: 'completed', proposal, model_identifier: response.model, duration_ms: Date.now() - startedAt, usage_metadata: { ...(response.usage ?? {}), language: responseLanguage } })
      activeAudit = null
      return json({ proposal, request_id: started.id, idempotent: false })
    }

    if (body.operation === 'share_caption') {
      if (!uuid(body.grow_cycle_id) || !uuid(body.photo_id)) return json({ error: 'Share caption requires valid cycle and photo identifiers' }, 400)
      const started = await startRequest(auditClient, userData.user.id, body.request_key, 'share_caption', [{ kind: 'photo', id: body.photo_id }])
      if (started.existing) return json({ proposal: started.existing.proposal, request_id: started.existing.id, idempotent: true })
      const startedAt = Date.now()
      activeAudit = { id: started.id, startedAt }
      const runtime = await runAiCheckRuntime({ userClient, storageClient: userClient, ownerId: userData.user.id, growCycleId: body.grow_cycle_id, photoId: body.photo_id, provider, operation: 'share_caption', standardVersion: GARDEN_AI_STANDARD_VERSION, promptVersion: GARDEN_AI_RUNTIME_PROMPT_VERSION, jsonSchema: GARDEN_SHARE_CAPTION_JSON_SCHEMA, instructions: gardenShareCaptionInstructionsFor(responseLanguage) })
      const response = await provider.analyze(runtime.providerRequest)
      const proposal = validateShareCaptionProposal(response.raw)
      if (!proposal) { await finishRequest(auditClient, started.id, { status: 'failed', error_code: 'invalid_structured_output', duration_ms: Date.now() - startedAt, model_identifier: response.model }); activeAudit = null; return json({ error: 'Provider returned invalid structured output' }, 502) }
      await finishRequest(auditClient, started.id, { status: 'completed', proposal, model_identifier: response.model, duration_ms: Date.now() - startedAt, usage_metadata: { ...(response.usage ?? {}), language: responseLanguage } })
      activeAudit = null
      return json({ proposal, request_id: started.id, idempotent: false })
    }

    if (body.operation === 'ai_check_draft') {
      if (!uuid(body.grow_cycle_id) || typeof body.draft_image_data_url !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/i.test(body.draft_image_data_url)) return json({ error: 'AI Check requires a valid pending photo' }, 400)
      if (body.draft_image_data_url.length > 7_000_000) return json({ error: 'Pending photo exceeds the AI image limit' }, 400)
      const started = await startRequest(auditClient, userData.user.id, body.request_key, 'ai_check', [{ kind: 'ephemeral_photo', id: 'pending_observation' }])
      if (started.existing) return json({ proposal: started.existing.proposal, request_id: started.existing.id, idempotent: true })
      const startedAt = Date.now()
      activeAudit = { id: started.id, startedAt }
      const contextResponse = await userClient.rpc('garden_get_ai_draft_cycle_context', { p_grow_cycle_id: body.grow_cycle_id })
      if (contextResponse.error || !contextResponse.data) throw new Error('Authorized AI draft context is unavailable')
      const response = await provider.analyze({ operation: 'ai_check', context: contextResponse.data, imageDataUrl: body.draft_image_data_url, standardVersion: GARDEN_AI_STANDARD_VERSION, promptVersion: GARDEN_AI_RUNTIME_PROMPT_VERSION, jsonSchema: GARDEN_AI_CHECK_JSON_SCHEMA, instructions: gardenAiInstructionsFor(responseLanguage) })
      const proposal = validateAiCheckProposal(response.raw)
      if (!proposal) { await finishRequest(auditClient, started.id, { status: 'failed', error_code: 'invalid_structured_output', duration_ms: Date.now() - startedAt, model_identifier: response.model }); activeAudit = null; return json({ error: 'Provider returned invalid structured output' }, 502) }
      await finishRequest(auditClient, started.id, { status: 'completed', proposal, model_identifier: response.model, duration_ms: Date.now() - startedAt, usage_metadata: response.usage ?? {} })
      activeAudit = null
      return json({ proposal, request_id: started.id, idempotent: false })
    }

    if (body.operation === 'ask_garden') {
      if (typeof body.question !== 'string' || body.question.trim().length < 2 || body.question.length > 2000) return json({ error: 'Ask Garden question is invalid' }, 400)
      const hasCarePhoto = body.care_review_photo_data_url !== undefined
      if (!validateCareReviewAttachment(body.care_review_photo_data_url, body.care_review_context)) return json({ error: 'Care follow-up photo or context is invalid' }, 400)
      const started = await startRequest(auditClient, userData.user.id, body.request_key, 'ask_garden', [])
      if (started.existing) return json({ answer: started.existing.proposal, request_id: started.existing.id, idempotent: true })
      const startedAt = Date.now()
      activeAudit = { id: started.id, startedAt }
      const askContext = await userClient.rpc('garden_get_ai_ask_context')
      if (askContext.error || !askContext.data) throw new Error('Authorized Ask Garden context is unavailable')
      const conversation = Array.isArray(body.conversation) ? body.conversation.slice(-4).map((item) => typeof item === 'object' && item !== null ? { question: String((item as Record<string, unknown>).question ?? '').slice(0, 300), answer: String((item as Record<string, unknown>).answer ?? '').slice(0, 500), status: 'unconfirmed_conversation_context' } : null).filter(Boolean) : []
      const careReview = hasCarePhoto ? { provenance: 'temporary_user_provided_photo_and_unconfirmed_ai_check', context: body.care_review_context } : undefined
      const response = await provider.analyze({ operation: 'ask_garden', context: { question: body.question, canonical_context: askContext.data, conversation, ...(careReview ? { current_care_review: careReview } : {}), conversation_rule: 'Use the latest clear plant, Pod, or cycle reference for anaphoric follow-ups; ask for clarification when more than one reference is possible.' }, ...(hasCarePhoto ? { imageDataUrl: body.care_review_photo_data_url as string } : {}), standardVersion: GARDEN_AI_STANDARD_VERSION, promptVersion: careReview ? GARDEN_AI_CARE_ASK_PROMPT_VERSION : GARDEN_AI_RUNTIME_PROMPT_VERSION, jsonSchema: GARDEN_AI_ASK_JSON_SCHEMA, instructions: careReview ? gardenCareAskInstructionsFor(responseLanguage) : gardenAiInstructionsFor(responseLanguage) })
      const answer = validateAskGardenAnswer(response.raw)
      if (!answer) { await finishRequest(auditClient, started.id, { status: 'failed', error_code: 'invalid_structured_output', duration_ms: Date.now() - startedAt, model_identifier: response.model }); activeAudit = null; return json({ error: 'Provider returned invalid structured output' }, 502) }
      await finishRequest(auditClient, started.id, { status: 'completed', proposal: answer, model_identifier: response.model, duration_ms: Date.now() - startedAt, usage_metadata: response.usage ?? {} })
      activeAudit = null
      return json({ answer, request_id: started.id, idempotent: false })
    }
    return json({ error: 'Unsupported AI operation' }, 400)
  } catch (error) {
    const failure = safeFailure(error)
    if (activeAudit) await finishRequest(auditClient, activeAudit.id, { status: 'failed', error_code: failure.code, duration_ms: Date.now() - activeAudit.startedAt }).catch(() => undefined)
    return json({ error: failure.message, code: failure.code }, failure.status)
  }
})
