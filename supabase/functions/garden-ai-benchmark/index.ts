import { createClient } from 'npm:@supabase/supabase-js@2.115.0'
import { OpenAiResponsesAdapter } from '../_shared/ai-provider.ts'
import { runAiCheckRuntime } from '../_shared/garden-ai-runtime.ts'
import { GARDEN_AI_ASK_JSON_SCHEMA, GARDEN_AI_CHECK_JSON_SCHEMA, GARDEN_AI_PROPOSAL_SCHEMA_VERSION, GARDEN_AI_STANDARD_VERSION, validateAiCheckProposal, validateAskGardenAnswer } from '../_shared/ai-contract.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const enabled = Deno.env.get('GARDEN_AI_BENCHMARK_ENABLED') === 'true'
const maxBudgetUsd = 2
const maxCasesPerInvocation = 15
const candidateModels = ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol'] as const
const pricing: Record<string, { input: number; output: number }> = {
  'gpt-5.6-luna': { input: 0.2, output: 1.2 },
  'gpt-5.6-terra': { input: 2, output: 12 },
  'gpt-5.6-sol': { input: 4, output: 20 },
}
type BenchmarkFixture = {
  id: string
  operation: 'ai_check' | 'ask_garden'
  context: Record<string, unknown>
  expectation: {
    evidence_ids: string[]
    insufficient_evidence?: boolean
    no_unrequested_action?: boolean
    expected_action?: 'thinning' | 'support' | 'incident' | 'none'
    expected_answer_type?: 'answer' | 'insufficient_evidence'
  }
}

const cycleContext = { garden: 'Garden 2', pod: 'Pod 9', plant: 'Cherry Tomato (tomate cherry)', cycle_id: 'fixture-cycle-09', position_id: 'fixture-position-09' }
const fixtures: BenchmarkFixture[] = [
  { id: 'normal_no_action', operation: 'ai_check', context: { ...cycleContext, fixture_id: 'normal_no_action', task: 'Assess the selected current photo.', photo: { id: 'photo-current', captured_at: '2026-09-09T16:25:00-06:00', visual: 'healthy green leaves, upright stems, even density, no visible damage' }, canonical_facts: [{ id: 'event-planting', type: 'cycle_started', occurred_on: '2026-08-24' }] }, expectation: { evidence_ids: ['photo-current', 'event-planting'], no_unrequested_action: true, expected_action: 'none', expected_answer_type: 'answer' } },
  { id: 'possible_thinning', operation: 'ai_check', context: { ...cycleContext, fixture_id: 'possible_thinning', task: 'Assess whether thinning should be evaluated.', photo: { id: 'photo-current', visual: 'three seedlings crowded in one site with overlapping leaves' }, canonical_facts: [{ id: 'event-seeds', type: 'seeds_added', occurred_on: '2026-08-24', count: 3 }] }, expectation: { evidence_ids: ['photo-current', 'event-seeds'], expected_action: 'thinning', expected_answer_type: 'answer' } },
  { id: 'premature_thinning', operation: 'ai_check', context: { ...cycleContext, fixture_id: 'premature_thinning', task: 'Assess development and thinning prudently.', photo: { id: 'photo-current', visual: 'one small seedling, sparse growth, no crowding visible' }, canonical_facts: [{ id: 'event-seeds', type: 'seeds_added', occurred_on: '2026-08-24', count: 1 }] }, expectation: { evidence_ids: ['photo-current', 'event-seeds'], no_unrequested_action: true, expected_action: 'none', expected_answer_type: 'answer' } },
  { id: 'possible_support', operation: 'ai_check', context: { ...cycleContext, fixture_id: 'possible_support', task: 'Assess whether support should be evaluated.', photo: { id: 'photo-current', visual: 'stem visibly leaning toward the light, leaves otherwise intact' } }, expectation: { evidence_ids: ['photo-current'], expected_action: 'support', expected_answer_type: 'answer' } },
  { id: 'possible_incident', operation: 'ai_check', context: { ...cycleContext, fixture_id: 'possible_incident', task: 'Assess possible visible incident.', photo: { id: 'photo-current', visual: 'plant appears displaced from the site and one stem is bent' }, canonical_facts: [{ id: 'event-incident', type: 'incident_opened', occurred_on: '2026-08-31', note: 'Dome shifted and plant moved.' }] }, expectation: { evidence_ids: ['photo-current', 'event-incident'], expected_action: 'incident', expected_answer_type: 'answer' } },
  { id: 'insufficient_evidence', operation: 'ai_check', context: { ...cycleContext, fixture_id: 'insufficient_evidence', task: 'Assess only what the image supports.', photo: { id: 'photo-current', visual: 'blurred and heavily occluded image; plant cannot be assessed' } }, expectation: { evidence_ids: ['photo-current'], insufficient_evidence: true, no_unrequested_action: true, expected_action: 'none', expected_answer_type: 'insufficient_evidence' } },
  { id: 'bad_perspective', operation: 'ai_check', context: { ...cycleContext, fixture_id: 'bad_perspective', task: 'Assess whether a reliable comparison is possible.', photo: { id: 'photo-current', visual: 'close crop with most of the site outside frame; perspective prevents density assessment' } }, expectation: { evidence_ids: ['photo-current'], insufficient_evidence: true, no_unrequested_action: true, expected_action: 'none', expected_answer_type: 'insufficient_evidence' } },
  { id: 'temporal_comparison_valid', operation: 'ai_check', context: { ...cycleContext, fixture_id: 'temporal_comparison_valid', task: 'Compare the current photo with the prior comparable photo.', photo: { id: 'photo-current', captured_at: '2026-09-09T16:25:00-06:00', visual: 'two upright plants with larger leaves' }, comparison_photo: { id: 'photo-prior', captured_at: '2026-09-05T16:20:00-06:00', visual: 'same angle and lighting, two smaller upright plants' } }, expectation: { evidence_ids: ['photo-current', 'photo-prior'], no_unrequested_action: true, expected_action: 'none', expected_answer_type: 'answer' } },
  { id: 'temporal_comparison_unreliable', operation: 'ai_check', context: { ...cycleContext, fixture_id: 'temporal_comparison_unreliable', task: 'Do not claim change when comparison is unreliable.', photo: { id: 'photo-current', captured_at: '2026-09-09T16:25:00-06:00', visual: 'plant photographed from above in bright light' }, comparison_photo: { id: 'photo-prior', captured_at: '2026-09-05T16:20:00-06:00', visual: 'plant photographed from the side in low light; framing differs materially' } }, expectation: { evidence_ids: ['photo-current', 'photo-prior'], insufficient_evidence: true, no_unrequested_action: true, expected_action: 'none', expected_answer_type: 'insufficient_evidence' } },
  { id: 'confirmed_fact_priority', operation: 'ai_check', context: { ...cycleContext, fixture_id: 'confirmed_fact_priority', task: 'Do not contradict the confirmed count based on an ambiguous photo.', photo: { id: 'photo-current', visual: 'ambiguous overlap; possibly more than two shoots but not countable' }, canonical_facts: [{ id: 'event-count', type: 'plant_count_observed', occurred_on: '2026-09-08', count: 2, confirmation: 'confirmed' }] }, expectation: { evidence_ids: ['photo-current', 'event-count'], no_unrequested_action: true, expected_action: 'none', expected_answer_type: 'answer' } },
  { id: 'ask_today', operation: 'ask_garden', context: { ...cycleContext, fixture_id: 'ask_today', question: 'What do I need to review today?', projections: { attention: [{ id: 'attention-1', purpose: 'evaluate_thinning', due_on: '2026-09-10', status: 'active' }], today: true } }, expectation: { evidence_ids: ['attention-1'], expected_answer_type: 'answer' } },
  { id: 'ask_cycle_history', operation: 'ask_garden', context: { ...cycleContext, fixture_id: 'ask_cycle_history', question: 'What happened with Pod 9?', history: [{ id: 'event-planting', type: 'cycle_started', occurred_on: '2026-08-24' }, { id: 'event-incident', type: 'incident_opened', occurred_on: '2026-08-31' }, { id: 'event-resolution', type: 'incident_resolved', occurred_on: '2026-09-02' }] }, expectation: { evidence_ids: ['event-planting', 'event-incident', 'event-resolution'], expected_answer_type: 'answer' } },
  { id: 'ask_missing_germination', operation: 'ask_garden', context: { ...cycleContext, fixture_id: 'ask_missing_germination', question: 'Which positions still lack confirmed germination?', projections: { positions_without_confirmed_germination: [{ id: 'position-03', label: 'Pod 3 Rosemary' }, { id: 'position-04', label: 'Pod 4 Lavender Vera' }] } }, expectation: { evidence_ids: ['positions_without_confirmed_germination'], expected_answer_type: 'answer' } },
  { id: 'ask_open_incidents', operation: 'ask_garden', context: { ...cycleContext, fixture_id: 'ask_open_incidents', question: 'Which plants have open incidents?', projections: { open_incidents: [{ id: 'incident-1', position: 'Pod 9', status: 'open', opened_on: '2026-09-09' }] } }, expectation: { evidence_ids: ['incident-1'], expected_answer_type: 'answer' } },
  { id: 'ask_harvest_candidates', operation: 'ask_garden', context: { ...cycleContext, fixture_id: 'ask_harvest_candidates', question: 'Which plants should I evaluate for harvest?', projections: { harvest_candidates: [{ id: 'control-09', position: 'Pod 9', readiness: 'evaluate' }, { id: 'control-05', position: 'Pod 5', readiness: 'not_yet' }] } }, expectation: { evidence_ids: ['control-09', 'control-05'], expected_answer_type: 'answer' } },
]
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Access-Control-Allow-Origin': 'https://garden.getstreex.com', 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } })

function estimate(model: string, inputTokens = 2500, outputTokens = 500): number {
  const p = pricing[model]
  return ((inputTokens / 1_000_000) * p.input) + ((outputTokens / 1_000_000) * p.output)
}

function evaluateBenchmarkOutput(fixture: BenchmarkFixture, raw: Record<string, unknown>, visualOverreach?: (raw: Record<string, unknown>) => boolean): { grounding_pass: boolean; prudence_pass: boolean; usefulness_pass: boolean; visual_overreach_pass?: boolean; hard_failures: string[] } {
  const evidence = Array.isArray(raw.evidence_used)
    ? raw.evidence_used.flatMap((item) => typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string' ? [(item as { id: string }).id] : [])
    : Array.isArray(raw.confirmed_facts)
      ? raw.confirmed_facts.flatMap((item) => typeof item === 'object' && item !== null && typeof (item as { source?: { id?: unknown } }).source?.id === 'string' ? [(item as { source: { id: string } }).source.id] : [])
      : []
  const grounding_pass = fixture.expectation.evidence_ids.every((id) => evidence.some((actual) => actual === id || actual.includes(id) || id.includes(actual)))
  const recommendations = Array.isArray(raw.development_recommendations) ? raw.development_recommendations as Array<{ kind?: unknown; recommendation?: unknown }> : []
  const actions = Array.isArray(raw.suggested_next_actions) ? raw.suggested_next_actions as Array<{ kind?: unknown }> : []
  // A follow-up can be the correct response to insufficient or ambiguous
  // evidence. Only prohibit actions that would create or confirm canonical
  // facts without an explicit user decision.
  const forbiddenActions = new Set(['record_incident', 'confirm_plant_count', 'evaluate_harvest_readiness'])
  const hasUnrequestedAction = fixture.expectation.no_unrequested_action === true && (
    recommendations.some((item) => item.recommendation === 'action_recommended')
    || actions.some((item) => typeof item.kind === 'string' && forbiddenActions.has(item.kind))
  )
  const expectedActionPass = fixture.expectation.expected_action === undefined || fixture.expectation.expected_action === 'none'
    ? true
    : fixture.expectation.expected_action === 'incident'
      ? raw.possible_incident === 'possible'
      : recommendations.some((item) => item.kind === fixture.expectation.expected_action && ['evaluate', 'action_recommended'].includes(String(item.recommendation)))
  const prudence_pass = !hasUnrequestedAction && expectedActionPass
  const expectedAnswerType = fixture.expectation.expected_answer_type
  // AI Check uses the proposal's `status` contract (`complete` or
  // `insufficient_evidence`); Ask Garden uses `answer_type`. Keep the
  // evaluator aligned with each canonical schema instead of treating a
  // healthy AI Check proposal as an unhelpful answer merely because it has no
  // Ask Garden field.
  const answerTypePass = expectedAnswerType === undefined || (
    fixture.operation === 'ai_check'
      ? raw.status === (expectedAnswerType === 'answer' ? 'complete' : expectedAnswerType)
      : raw.answer_type === expectedAnswerType
  )
  const usefulness_pass = typeof raw.answer === 'string' ? raw.answer.trim().length > 0 && answerTypePass : typeof raw.summary === 'string' && raw.summary.trim().length > 0 && answerTypePass
  const visual_overreach_pass = visualOverreach ? visualOverreach(raw) : undefined
  const hard_failures: string[] = []
  if (!grounding_pass) hard_failures.push('ungrounded_evidence')
  if (!prudence_pass) hard_failures.push(fixture.expectation.no_unrequested_action ? 'unrequested_action' : 'expected_signal_missing')
  if (!usefulness_pass) hard_failures.push('unhelpful_or_wrong_answer_type')
  if (fixture.expectation.insufficient_evidence === true && raw.status !== 'insufficient_evidence' && raw.answer_type !== 'insufficient_evidence') hard_failures.push('insufficient_evidence_presented_as_certain')
  if (visual_overreach_pass === false) hard_failures.push('visual_overreach')
  return { grounding_pass, prudence_pass, usefulness_pass, ...(visual_overreach_pass === undefined ? {} : { visual_overreach_pass }), hard_failures }
}

function visualOverreachRule(caseId: string): (raw: Record<string, unknown>) => boolean {
  return (raw: Record<string, unknown>) => {
    const recommendations = (raw.development_recommendations as Array<{ kind?: unknown; recommendation?: unknown }> | undefined) ?? []
    const actions = (raw.suggested_next_actions as Array<{ kind?: unknown }> | undefined) ?? []
    const text = [raw.summary, ...(Array.isArray(raw.observations) ? raw.observations : []), ...(Array.isArray(raw.uncertainty) ? raw.uncertainty : [])].filter((value): value is string => typeof value === 'string').join(' ').toLowerCase()
    if (caseId === 'density_possible_thinning') return raw.possible_incident !== 'possible' && !recommendations.some((item) => item.kind === 'thinning' && item.recommendation === 'action_recommended')
    if (caseId === 'ambiguous_inclination') return raw.possible_incident !== 'possible' && !recommendations.some((item) => ['support', 'pruning'].includes(String(item.kind)) && item.recommendation === 'action_recommended')
    if (caseId === 'germination_doubtful') return !/(germinaci[oó]n\s+confirmada|confirmed\s+germination|germinated\s+as\s+a\s+fact)/i.test(text)
    if (caseId === 'visual_insufficient') return raw.possible_incident !== 'possible' && !actions.some((item) => item.kind === 'record_incident') && !recommendations.some((item) => item.recommendation === 'action_recommended') && Array.isArray(raw.uncertainty) && raw.uncertainty.length > 0
    return true
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!enabled) return json({ error: 'Benchmark is disabled' }, 503)
  if (!supabaseUrl || !anonKey) return json({ error: 'Missing Supabase server configuration' }, 503)
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401)
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
  const token = authorization.slice('Bearer '.length)
  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'Authentication required' }, 401)
  let body: { run_key?: unknown; models?: unknown; fixture_ids?: unknown; visual_smoke?: unknown }
  try { body = await request.json() as typeof body } catch { return json({ error: 'Invalid request' }, 400) }
  if (typeof body.run_key !== 'string' || body.run_key.length < 16 || body.run_key.length > 120 || !/^[a-zA-Z0-9:_-]+$/.test(body.run_key)) return json({ error: 'A valid run_key is required' }, 400)
  const models = body.models === undefined ? [...candidateModels] : Array.isArray(body.models) ? body.models : []
  if (models.length < 1 || models.some((model) => !candidateModels.includes(model as typeof candidateModels[number]))) return json({ error: 'Only the approved benchmark models are allowed' }, 400)
  const visualSmoke = body.visual_smoke && typeof body.visual_smoke === 'object' ? body.visual_smoke as Record<string, unknown> : null
  const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  if (visualSmoke) {
    if (models.length !== 1 || !isUuid(visualSmoke.grow_cycle_id) || !isUuid(visualSmoke.photo_id) || (visualSmoke.compare_photo_id !== undefined && visualSmoke.compare_photo_id !== null && !isUuid(visualSmoke.compare_photo_id))) return json({ error: 'visual_smoke requires one model and valid cycle/photo identifiers' }, 400)
  }
  const visualCaseId = typeof visualSmoke?.case_id === 'string' ? visualSmoke.case_id : 'live_visual_smoke'
  const selectedFixtures = visualSmoke
    ? [{ id: visualCaseId, operation: 'ai_check' as const, context: { fixture_id: visualCaseId, task: 'Assess only the selected private Garden X photograph.' }, expectation: { evidence_ids: [], expected_answer_type: 'answer' as const } }]
    : body.fixture_ids === undefined ? fixtures : Array.isArray(body.fixture_ids) ? fixtures.filter((fixture) => body.fixture_ids?.includes(fixture.id)) : []
  if (selectedFixtures.length < 1 || selectedFixtures.length > fixtures.length) return json({ error: 'fixture_ids must select at least one approved fixture' }, 400)
  const caseCount = models.length * selectedFixtures.length
  if (caseCount > maxCasesPerInvocation) return json({ error: 'Benchmark batch too large', code: 'batch_too_large', case_count: caseCount, max_cases_per_invocation: maxCasesPerInvocation, hint: 'Run one model at a time or split fixture_ids into smaller batches.' }, 400)
  const upperBound = models.reduce((sum, model) => sum + selectedFixtures.length * estimate(String(model)), 0)
  if (upperBound > maxBudgetUsd) return json({ error: 'Benchmark budget guard exceeded', upper_bound_usd: Number(upperBound.toFixed(6)) }, 400)
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return json({ error: 'OPENAI_API_KEY is not configured' }, 503)

  const results: Array<Record<string, unknown>> = []
  for (const model of models as string[]) {
    const provider = new OpenAiResponsesAdapter(apiKey, model)
    for (const fixture of selectedFixtures) {
      const requestKey = `benchmark:${body.run_key}:${model}:${fixture.id}`.slice(0, 160)
      const started = await userClient.rpc('garden_ai_start_request', { p_request_key: requestKey, p_request_type: fixture.operation, p_evidence_refs: [], p_proposal_schema_version: fixture.operation === 'ai_check' ? GARDEN_AI_PROPOSAL_SCHEMA_VERSION : 'garden_ai_ask_v1' })
      if (started.error || !started.data || typeof started.data !== 'object') return json({ error: 'Could not create benchmark audit row', fixture_id: fixture.id, model }, 502)
      const audit = started.data as { id?: string; status?: string; proposal?: unknown }
      if (!audit.id) return json({ error: 'Benchmark audit row has no id', fixture_id: fixture.id, model }, 502)
      if (audit.status === 'completed') { results.push({ fixture_id: fixture.id, model, idempotent: true, valid_structured_output: fixture.operation === 'ai_check' ? Boolean(validateAiCheckProposal(audit.proposal)) : Boolean(validateAskGardenAnswer(audit.proposal)) }); continue }
      const startedAt = Date.now()
      try {
        const runtime = visualSmoke
          ? await runAiCheckRuntime({ userClient, storageClient: userClient, ownerId: userData.user.id, growCycleId: visualSmoke.grow_cycle_id as string, photoId: visualSmoke.photo_id as string, comparePhotoId: visualSmoke.compare_photo_id as string | null | undefined, provider, standardVersion: GARDEN_AI_STANDARD_VERSION, promptVersion: 'benchmark_visual_smoke_v1', jsonSchema: GARDEN_AI_CHECK_JSON_SCHEMA })
          : null
        const response = await provider.analyze(runtime?.providerRequest ?? { operation: fixture.operation, context: fixture.context, standardVersion: GARDEN_AI_STANDARD_VERSION, promptVersion: 'benchmark_v1', jsonSchema: fixture.operation === 'ai_check' ? GARDEN_AI_CHECK_JSON_SCHEMA : GARDEN_AI_ASK_JSON_SCHEMA })
        const valid = fixture.operation === 'ai_check' ? Boolean(validateAiCheckProposal(response.raw)) : Boolean(validateAskGardenAnswer(response.raw))
        const evaluation = valid && typeof response.raw === 'object' && response.raw !== null ? evaluateBenchmarkOutput(fixture, response.raw as Record<string, unknown>, visualSmoke ? visualOverreachRule(visualCaseId) : undefined) : null
        const estimatedCost = response.usage ? Number((((response.usage.input_tokens ?? 0) / 1_000_000) * pricing[model].input + ((response.usage.output_tokens ?? 0) / 1_000_000) * pricing[model].output).toFixed(6)) : null
        const usageMetadata = { ...(response.usage ?? {}), benchmark_evaluation: evaluation }
        await userClient.rpc('garden_ai_finish_request', { p_request_id: audit.id, p_status: valid ? 'completed' : 'failed', p_proposal: valid ? response.raw : null, p_model_identifier: response.model, p_duration_ms: Date.now() - startedAt, p_usage_metadata: usageMetadata, p_error_code: valid ? null : 'invalid_structured_output' })
        const recordedCost = estimatedCost === null ? null : await userClient.rpc('garden_ai_record_cost', { p_request_id: audit.id, p_estimated_cost_usd: estimatedCost })
        const rawText = typeof response.raw === 'string' ? response.raw : JSON.stringify(response.raw) ?? String(response.raw)
        results.push({ fixture_id: fixture.id, model, idempotent: false, valid_structured_output: valid, evaluation, visual_input: Boolean(runtime), photo_id: visualSmoke?.photo_id ?? null, latency_ms: Date.now() - startedAt, usage: response.usage ?? {}, estimated_cost_usd: estimatedCost, audit_cost_recorded: estimatedCost === null ? null : !recordedCost?.error, ...(recordedCost?.error ? { audit_cost_warning: 'estimated_cost_not_recorded' } : {}), ...(valid ? {} : { raw_preview: rawText.slice(0, 600) }) })
      } catch (error) {
        await userClient.rpc('garden_ai_finish_request', { p_request_id: audit.id, p_status: 'failed', p_error_code: error instanceof Error ? error.message.slice(0, 120) : 'provider_error' })
        results.push({ fixture_id: fixture.id, model, idempotent: false, valid_structured_output: false, latency_ms: Date.now() - startedAt, error: error instanceof Error ? error.message : 'provider_error' })
      }
    }
  }
  return json({ run_key: body.run_key, owner_id: userData.user.id, fixture_count: selectedFixtures.length, models, upper_bound_usd: Number(upperBound.toFixed(6)), results })
})
