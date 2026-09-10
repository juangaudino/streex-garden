import type { AiProviderAdapter } from '../lib/ai-provider'
import { validateGardenAiCheckProposal } from './ai'

export type AiBenchmarkFixture = {
  id: string
  operation: 'ai_check' | 'ask_garden'
  context: unknown
  expected: {
    no_unrequested_action?: boolean
    valid_structured_output?: boolean
    evidence_grounded?: boolean
  }
}

export type AiBenchmarkResult = {
  fixture_id: string
  model: string
  provider_adapter_version: string
  valid_structured_output: boolean
  latency_ms: number
  usage_total_tokens: number
  estimated_cost_usd: number | null
  error?: string
}

export type AiModelPricing = { inputPerMillionUsd: number; outputPerMillionUsd: number }

export type AiBenchmarkProvider = { name: string; adapter: AiProviderAdapter; pricing?: AiModelPricing }

export const GARDEN_AI_BENCHMARK_CANDIDATES = ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol'] as const
export const GARDEN_AI_FIRST_RUN_BUDGET_USD = 2

export async function runAiBenchmark(adapter: AiProviderAdapter, fixtures: AiBenchmarkFixture[], pricing?: AiModelPricing): Promise<AiBenchmarkResult[]> {
  const results: AiBenchmarkResult[] = []
  for (const fixture of fixtures) {
    const started = performance.now()
    try {
      const response = await adapter.analyze({ operation: fixture.operation, context: fixture.context, standardVersion: 'garden_ai_standard_v1', promptVersion: 'benchmark' })
      const valid = fixture.operation === 'ai_check' ? Boolean(validateGardenAiCheckProposal(response.raw)) : isAskGardenOutput(response.raw)
      results.push({ fixture_id: fixture.id, model: response.model, provider_adapter_version: adapter.id, valid_structured_output: valid, latency_ms: Math.round(performance.now() - started), usage_total_tokens: response.usage?.total_tokens ?? 0, estimated_cost_usd: pricing && response.usage ? estimateCostUsd(response.usage, pricing) : null })
    } catch (error) {
      results.push({ fixture_id: fixture.id, model: 'unknown', provider_adapter_version: adapter.id, valid_structured_output: false, latency_ms: Math.round(performance.now() - started), usage_total_tokens: 0, estimated_cost_usd: null, error: error instanceof Error ? error.message : 'unknown_error' })
    }
  }
  return results
}

export function estimateCostUsd(usage: { input_tokens?: number; output_tokens?: number }, pricing: AiModelPricing): number {
  return Number((((usage.input_tokens ?? 0) / 1_000_000) * pricing.inputPerMillionUsd + ((usage.output_tokens ?? 0) / 1_000_000) * pricing.outputPerMillionUsd).toFixed(6))
}

export async function runAiBenchmarkMatrix(providers: AiBenchmarkProvider[], fixtures: AiBenchmarkFixture[], budget: { maxInputTokensPerFixture?: number; maxOutputTokensPerFixture?: number; maxBudgetUsd?: number } = {}): Promise<AiBenchmarkResult[]> {
  assertBenchmarkBudget({
    providers,
    fixtureCount: fixtures.length,
    maxInputTokensPerFixture: budget.maxInputTokensPerFixture ?? 2500,
    maxOutputTokensPerFixture: budget.maxOutputTokensPerFixture ?? 500,
    maxBudgetUsd: budget.maxBudgetUsd,
  })
  const runs = await Promise.all(providers.map((provider) => runAiBenchmark(provider.adapter, fixtures, provider.pricing)))
  return runs.flat()
}

/** Refuses to start a real run unless every model has an explicit price and the
 * configured worst-case envelope fits the hard budget. */
export function assertBenchmarkBudget(input: {
  providers: AiBenchmarkProvider[]
  fixtureCount: number
  maxInputTokensPerFixture: number
  maxOutputTokensPerFixture: number
  maxBudgetUsd?: number
}): number {
  const budget = input.maxBudgetUsd ?? GARDEN_AI_FIRST_RUN_BUDGET_USD
  if (input.providers.some((provider) => !provider.pricing)) throw new Error('Benchmark pricing is required before real calls can start.')
  const upperBound = input.providers.reduce((total, provider) => total + input.fixtureCount * (((input.maxInputTokensPerFixture / 1_000_000) * provider.pricing!.inputPerMillionUsd) + ((input.maxOutputTokensPerFixture / 1_000_000) * provider.pricing!.outputPerMillionUsd)), 0)
  if (upperBound > budget) throw new Error(`Benchmark worst-case estimate $${upperBound.toFixed(2)} exceeds the $${budget.toFixed(2)} guard.`)
  return Number(upperBound.toFixed(6))
}

function isAskGardenOutput(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { schema_version?: unknown; answer_type?: unknown; answer?: unknown; confirmed_facts?: unknown; suggested_next_actions?: unknown }
  return candidate.schema_version === 'garden_ai_ask_v1'
    && ['answer', 'insufficient_evidence', 'needs_clarification'].includes(String(candidate.answer_type))
    && typeof candidate.answer === 'string'
    && Array.isArray(candidate.confirmed_facts)
    && Array.isArray(candidate.suggested_next_actions)
}

export const gardenAiBenchmarkFixtures: AiBenchmarkFixture[] = [
  ['normal_no_action', 'possible_thinning', 'premature_thinning', 'possible_support', 'possible_incident', 'insufficient_evidence', 'bad_perspective', 'temporal_comparison_valid', 'temporal_comparison_unreliable', 'confirmed_fact_priority'].map((id) => ({ id, operation: 'ai_check' as const, context: { fixture_id: id }, expected: { valid_structured_output: true } })),
  ['ask_today', 'ask_cycle_history', 'ask_missing_germination', 'ask_open_incidents', 'ask_harvest_candidates'].map((id) => ({ id, operation: 'ask_garden' as const, context: { fixture_id: id }, expected: { valid_structured_output: true } })),
].flat()
