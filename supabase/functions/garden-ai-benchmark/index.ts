import { createClient } from 'npm:@supabase/supabase-js@2.115.0'
import { OpenAiResponsesAdapter } from './_shared/ai-provider.ts'
import { GARDEN_AI_ASK_JSON_SCHEMA, GARDEN_AI_CHECK_JSON_SCHEMA, GARDEN_AI_PROPOSAL_SCHEMA_VERSION, GARDEN_AI_STANDARD_VERSION, validateAiCheckProposal, validateAskGardenAnswer } from './_shared/ai-contract.ts'

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
const fixtures = [
  ...['normal_no_action', 'possible_thinning', 'premature_thinning', 'possible_support', 'possible_incident', 'insufficient_evidence', 'bad_perspective', 'temporal_comparison_valid', 'temporal_comparison_unreliable', 'confirmed_fact_priority'].map((id) => ({ id, operation: 'ai_check' as const, context: { fixture_id: id } })),
  ...['ask_today', 'ask_cycle_history', 'ask_missing_germination', 'ask_open_incidents', 'ask_harvest_candidates'].map((id) => ({ id, operation: 'ask_garden' as const, context: { fixture_id: id } })),
]
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Access-Control-Allow-Origin': 'https://garden.getstreex.com', 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' } })

function estimate(model: string, inputTokens = 2500, outputTokens = 500): number {
  const p = pricing[model]
  return ((inputTokens / 1_000_000) * p.input) + ((outputTokens / 1_000_000) * p.output)
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
  let body: { run_key?: unknown; models?: unknown; fixture_ids?: unknown }
  try { body = await request.json() as typeof body } catch { return json({ error: 'Invalid request' }, 400) }
  if (typeof body.run_key !== 'string' || body.run_key.length < 16 || body.run_key.length > 120 || !/^[a-zA-Z0-9:_-]+$/.test(body.run_key)) return json({ error: 'A valid run_key is required' }, 400)
  const models = body.models === undefined ? [...candidateModels] : Array.isArray(body.models) ? body.models : []
  if (models.length < 1 || models.some((model) => !candidateModels.includes(model as typeof candidateModels[number]))) return json({ error: 'Only the approved benchmark models are allowed' }, 400)
  const selectedFixtures = body.fixture_ids === undefined ? fixtures : Array.isArray(body.fixture_ids) ? fixtures.filter((fixture) => body.fixture_ids?.includes(fixture.id)) : []
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
        const response = await provider.analyze({ operation: fixture.operation, context: fixture.context, standardVersion: GARDEN_AI_STANDARD_VERSION, promptVersion: 'benchmark_v1', jsonSchema: fixture.operation === 'ai_check' ? GARDEN_AI_CHECK_JSON_SCHEMA : GARDEN_AI_ASK_JSON_SCHEMA })
        const valid = fixture.operation === 'ai_check' ? Boolean(validateAiCheckProposal(response.raw)) : Boolean(validateAskGardenAnswer(response.raw))
        const estimatedCost = response.usage ? Number((((response.usage.input_tokens ?? 0) / 1_000_000) * pricing[model].input + ((response.usage.output_tokens ?? 0) / 1_000_000) * pricing[model].output).toFixed(6)) : null
        await userClient.rpc('garden_ai_finish_request', { p_request_id: audit.id, p_status: valid ? 'completed' : 'failed', p_proposal: valid ? response.raw : null, p_model_identifier: response.model, p_duration_ms: Date.now() - startedAt, p_usage_metadata: response.usage ?? {}, p_error_code: valid ? null : 'invalid_structured_output' })
        const recordedCost = estimatedCost === null ? null : await userClient.rpc('garden_ai_record_cost', { p_request_id: audit.id, p_estimated_cost_usd: estimatedCost })
        const rawText = typeof response.raw === 'string' ? response.raw : JSON.stringify(response.raw) ?? String(response.raw)
        results.push({ fixture_id: fixture.id, model, idempotent: false, valid_structured_output: valid, latency_ms: Date.now() - startedAt, usage: response.usage ?? {}, estimated_cost_usd: estimatedCost, audit_cost_recorded: estimatedCost === null ? null : !recordedCost?.error, ...(recordedCost?.error ? { audit_cost_warning: 'estimated_cost_not_recorded' } : {}), ...(valid ? {} : { raw_preview: rawText.slice(0, 600) }) })
      } catch (error) {
        await userClient.rpc('garden_ai_finish_request', { p_request_id: audit.id, p_status: 'failed', p_error_code: error instanceof Error ? error.message.slice(0, 120) : 'provider_error' })
        results.push({ fixture_id: fixture.id, model, idempotent: false, valid_structured_output: false, latency_ms: Date.now() - startedAt, error: error instanceof Error ? error.message : 'provider_error' })
      }
    }
  }
  return json({ run_key: body.run_key, owner_id: userData.user.id, fixture_count: selectedFixtures.length, models, upper_bound_usd: Number(upperBound.toFixed(6)), results })
})
