import { beforeEach, expect, it } from 'vitest'
import { createDataset, scenarios } from './data'
import { failRead, invoke, reset, snapshot } from './services'
import { loadFilmCatalogue } from '../../src/features/cycles/growth-film-loader'
import type { GardenDetail, GrowCycleDetail } from '../../src/domain/types'

beforeEach(() => reset())

it('orders history within its own cycle and keeps the previous occupant before the successor', () => {
  for (const scenario of scenarios) {
    const d = createDataset(scenario)
    for (const c of d.cycles) {
      const dates = c.history.map(e => e.occurred_at!)
      expect(dates).toEqual([...dates].sort().reverse())
      for (const date of dates) expect(date.slice(0, 10) >= c.planted_on!).toBe(true)
    }
    for (const e of d.cycles[3].history) expect(e.occurred_at! < d.cycles[0].planted_on!).toBe(true)
  }
})

it('keeps IDs, occupancy, tasks and session context coherent across every scenario', () => {
  for (const scenario of scenarios) {
    const d = createDataset(scenario)
    for (const g of d.gardens) for (const p of g.positions) {
      if (!p.current_cycle) continue
      const c = d.cycles.find(c => c.id === p.current_cycle?.id)!
      expect(c.garden.id).toBe(g.id); expect(c.position.id).toBe(p.id); expect(c.state).toBe('active')
    }
    for (const t of d.attention) expect(d.cycles.find(c => c.id === t.grow_cycle_id)?.position.id).toBe(t.position_id)
    for (const p of d.session.positions) {
      expect(d.cycles.find(c => c.id === p.captured_grow_cycle_id)?.position.id).toBe(p.position_id)
      expect(p.health_confirmed).toBe(false)
    }
  }
})

it('returns cloned reads: consumers cannot mutate shared canonical fixture state', async () => {
  const before = snapshot().dataset
  const c = await invoke('getCycle', ['qa-cycle-1']) as GrowCycleDetail
  c.history.length = 0; c.state = 'closed'
  expect(snapshot().dataset).toEqual(before)
  expect((await invoke('getCycle', ['qa-cycle-1']) as GrowCycleDetail).history.length).toBe(6)
})

it('records visits separately without claiming that navigation has no persistence contract', async () => {
  const before = snapshot().dataset
  await invoke('getHomeDashboard', [null]); await invoke('acknowledgeHomeSnapshot', ['qa-visit', 12])
  expect(snapshot().calls.map(c => c.kind)).toEqual(['read', 'visit'])
  expect(snapshot().dataset).toEqual(before)
})

it('blocks writes and unimplemented services instead of fabricating successful operations', async () => {
  const before = snapshot().dataset
  for (const name of ['recordCycleFact', 'createObservation', 'createAttentionItem', 'completeAttentionItem', 'markMaintenancePositionInspected', 'progressMaintenancePosition', 'moveCycle', 'signOut', 'askGarden', 'requestAiCheck', 'unknownPort']) {
    await expect(invoke(name, [{ requestId: 'qa-request' }])).rejects.toThrow('bloqueado')
  }
  expect(snapshot().calls.every(c => c.kind === 'blocked')).toBe(true)
  expect(snapshot().dataset).toEqual(before)
})

it('rejects unknown IDs and media paths without substituting another cycle or original', async () => {
  await expect(invoke('getCycle', ['not-in-fixture'])).rejects.toThrow('No existe')
  await expect(invoke('getSignedPhotoUrl', ['https://private.example/photo'])).rejects.toThrow('synthetic')
})

it('recovers an injected read failure without changing data or starting an operation', async () => {
  const before = snapshot().dataset
  failRead('getCycle')
  await expect(invoke('getCycle', ['qa-cycle-1'])).rejects.toThrow('simulado')
  expect(await invoke('getCycle', ['qa-cycle-1'])).toEqual(before.cycles[0])
  expect(snapshot().dataset).toEqual(before)
})

it('feeds the real Film loader with current and historical cycles and preserves provenance', async () => {
  const reader = { getCycle: async (id: string) => await invoke('getCycle', [id]) as GrowCycleDetail, getGarden: async (id: string) => await invoke('getGarden', [id]) as GardenDetail }
  const before = snapshot().dataset
  const film = await loadFilmCatalogue({ kind: 'garden', id: 'qa-garden-1' }, reader, new AbortController().signal)
  expect(new Set(film.moments.map(m => m.source.cycleId))).toEqual(new Set(['qa-cycle-1', 'qa-cycle-2', 'qa-cycle-4']))
  for (const m of film.moments) {
    const c = before.cycles.find(c => c.id === m.source.cycleId)!
    expect(c.history.some(e => e.id === m.source.historyId && e.photo?.id === m.photoId)).toBe(true)
    expect(m.source.cycleRevision).toBe(c.revision)
    expect(m.source.provenance).toBeDefined()
  }
  expect(snapshot().dataset).toEqual(before)
})
