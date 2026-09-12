import { describe, expect, it, vi } from 'vitest'
import type { GardenDetail, GrowCycleDetail } from '../../domain/types'
import { loadFilmCatalogue, type FilmReader } from './growth-film-loader'

const cycle = (id: string, gardenId = 'g'): GrowCycleDetail => ({ id, crop_name: 'Cilantro', garden: { id: gardenId, name: 'Garden 1' }, position: { id: 'p', position_number: 1 }, state: 'active', revision: 1, history: [], corrections: [], planted_on: null, planted_on_precision: 'unknown', harvest_readiness: 'not_yet' })
const garden = { id: 'g', name: 'Garden 1', positions: [{ current_cycle: { id: 'now' }, previous_cycles: [{ id: 'old' }, { id: 'moved' }] }, { current_cycle: null, previous_cycles: [{ id: 'old' }] }] } as GardenDetail

describe('Read-only Growth Film loader', () => {
  it('loads current and previous cycles once and explicitly reports moved-out histories', async () => {
    const reader: FilmReader = { getGarden: vi.fn().mockResolvedValue(garden), getCycle: vi.fn(async id => cycle(id, id === 'moved' ? 'other' : 'g')) }
    const result = await loadFilmCatalogue({ kind: 'garden', id: 'g' }, reader, new AbortController().signal)
    expect(reader.getCycle).toHaveBeenCalledTimes(3)
    expect(result.scope).toEqual({ kind: 'garden', id: 'g', title: 'Garden 1' })
    expect(result.excludedCycleIds).toEqual(['moved'])
  })
  it('fails the whole load if a cycle cannot be read, rather than presenting incomplete success', async () => {
    const reader: FilmReader = { getGarden: vi.fn().mockResolvedValue(garden), getCycle: vi.fn(async id => { if (id === 'old') throw new Error('Sin conexión'); return cycle(id) }) }
    await expect(loadFilmCatalogue({ kind: 'garden', id: 'g' }, reader, new AbortController().signal)).rejects.toThrow('Sin conexión')
  })
  it('rejects cancelled and cross-cycle route results', async () => {
    const controller = new AbortController(); controller.abort()
    const reader: FilmReader = { getGarden: vi.fn(), getCycle: vi.fn().mockResolvedValue(cycle('wrong')) }
    await expect(loadFilmCatalogue({ kind: 'cycle', id: 'a' }, reader, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(reader.getCycle).not.toHaveBeenCalled()
    await expect(loadFilmCatalogue({ kind: 'cycle', id: 'a' }, reader, new AbortController().signal)).rejects.toThrow('no pertenece')
  })
})
