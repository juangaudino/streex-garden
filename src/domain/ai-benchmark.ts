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
  valid_structured_output: boolean
  latency_ms: number
  usage_total_tokens: number
  error?: string
}

export async function runAiBenchmark(adapter: AiProviderAdapter, fixtures: AiBenchmarkFixture[]): Promise<AiBenchmarkResult[]> {
  const results: AiBenchmarkResult[] = []
  for (const fixture of fixtures) {
    const started = performance.now()
    try {
      const response = await adapter.analyze({ operation: fixture.operation, context: fixture.context, standardVersion: 'garden_ai_standard_v1', promptVersion: 'benchmark' })
      const valid = fixture.operation === 'ai_check' ? Boolean(validateGardenAiCheckProposal(response.raw)) : isAskGardenOutput(response.raw)
      results.push({ fixture_id: fixture.id, valid_structured_output: valid, latency_ms: Math.round(performance.now() - started), usage_total_tokens: response.usage?.total_tokens ?? 0 })
    } catch (error) {
      results.push({ fixture_id: fixture.id, valid_structured_output: false, latency_ms: Math.round(performance.now() - started), usage_total_tokens: 0, error: error instanceof Error ? error.message : 'unknown_error' })
    }
  }
  return results
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
