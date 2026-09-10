import { describe, expect, it } from 'vitest'
import { MockAiProvider } from '../lib/ai-provider'
import { GARDEN_AI_BENCHMARK_CANDIDATES, assertBenchmarkBudget, gardenAiBenchmarkFixtures, runAiBenchmark } from './ai-benchmark'

describe('Garden AI benchmark harness', () => {
  it('runs the approved fixture catalog without a provider call', async () => {
    const results = await runAiBenchmark(new MockAiProvider(), gardenAiBenchmarkFixtures)
    expect(results).toHaveLength(15)
    expect(results.every((result) => result.latency_ms >= 0)).toBe(true)
    expect(results.filter((result) => result.valid_structured_output)).toHaveLength(15)
  })

  it('keeps the three requested model candidates explicit', () => {
    expect(GARDEN_AI_BENCHMARK_CANDIDATES).toEqual(['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol'])
  })

  it('requires explicit pricing and refuses a run above the hard budget', () => {
    expect(() => assertBenchmarkBudget({ providers: [{ name: 'mock', adapter: new MockAiProvider() }], fixtureCount: 15, maxInputTokensPerFixture: 2500, maxOutputTokensPerFixture: 500 })).toThrow('pricing is required')
    const pricing = { inputPerMillionUsd: 1, outputPerMillionUsd: 2 }
    expect(assertBenchmarkBudget({ providers: [{ name: 'cheap', adapter: new MockAiProvider(), pricing }], fixtureCount: 15, maxInputTokensPerFixture: 2500, maxOutputTokensPerFixture: 500, maxBudgetUsd: 2 })).toBe(0.0525)
    expect(() => assertBenchmarkBudget({ providers: [{ name: 'expensive', adapter: new MockAiProvider(), pricing: { inputPerMillionUsd: 100, outputPerMillionUsd: 100 } }], fixtureCount: 15, maxInputTokensPerFixture: 2500, maxOutputTokensPerFixture: 500, maxBudgetUsd: 2 })).toThrow('exceeds')
  })
})
