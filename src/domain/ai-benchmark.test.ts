import { describe, expect, it } from 'vitest'
import { MockAiProvider } from '../lib/ai-provider'
import { gardenAiBenchmarkFixtures, runAiBenchmark } from './ai-benchmark'

describe('Garden AI benchmark harness', () => {
  it('runs the approved fixture catalog without a provider call', async () => {
    const results = await runAiBenchmark(new MockAiProvider(), gardenAiBenchmarkFixtures)
    expect(results).toHaveLength(15)
    expect(results.every((result) => result.latency_ms >= 0)).toBe(true)
    expect(results.filter((result) => result.valid_structured_output)).toHaveLength(15)
  })
})
