import { describe, expect, it } from 'vitest'
import type { CycleHistoryEvent, GrowCycleDetail, PhotoEvidence } from '../../domain/types'
import { buildFilmCatalogue, composeGrowthFilm, filmFrameAt, type FilmCatalogue } from './growth-film-composition'
import { containFilmImage, filmTextLines } from './growth-film-renderer'

const photo = (id: string, date: string | null = '2026-09-01T12:00:00Z'): PhotoEvidence => ({ id, captured_at: date, captured_at_precision: date ? 'exact' : 'unknown', upload_status: 'uploaded', storage_path: `private/${id}`, original_filename: `${id}.jpg`, content_type: 'image/jpeg', byte_size: 100, checksum_sha256: null })
const event = (id: string, type: CycleHistoryEvent['event_type'], image: PhotoEvidence | null, data = {}): CycleHistoryEvent => ({ id, event_type: type, occurred_at: image?.captured_at ?? '2026-09-01T12:00:00Z', revision: 1, note: null, event_data: data, photo: image })
const cycle = (id: string, history: CycleHistoryEvent[]): GrowCycleDetail => ({ id, garden: { id: 'g', name: 'Garden 1' }, position: { id: 'p', position_number: 1 }, crop_name: 'Genovese Basil', planted_on: '2026-08-01', planted_on_precision: 'exact', harvest_readiness: 'not_yet', state: 'active', revision: 1, corrections: [], history })
const options = (catalogue: FilmCatalogue) => ({ selectedIds: catalogue.moments.map(moment => moment.id), titles: true, reducedMotion: false, trackId: null, volume: .3 })

describe('Botanical Growth Film composition', () => {
  it('uses uploaded evidence once, retains unknown dates, and never borrows a nearby harvest claim', () => {
    const historical = event('import', 'photo_evidence', photo('b', null), { source: 'historical_photo', import_provenance: { grow_cycle_id: 'c' } })
    // Real SQL can return null for an eventless photo despite the old domain string annotation.
    historical.occurred_at = null as unknown as string
    const input = cycle('c', [event('harvest', 'harvest', null), event('a', 'observation', photo('a')), event('dup', 'photo_evidence', photo('a')), historical, event('pending', 'observation', { ...photo('pending'), upload_status: 'pending' })])
    const before = structuredClone(input)
    const catalogue = buildFilmCatalogue({ kind: 'cycle', id: 'c', title: 'Basil' }, [input])
    expect(catalogue.moments.map(moment => moment.photoId)).toEqual(['a', 'b'])
    expect(catalogue.moments[1]).toMatchObject({ capturedAt: null, dateLabel: 'Captura sin fecha', source: { eventId: null, historyId: 'import', recordedAt: null } })
    expect(catalogue.moments.some(moment => moment.title.includes('cosecha'))).toBe(false)
    expect(catalogue.milestones[0].sources[0].eventId).toBe('harvest')
    expect(input).toEqual(before)
  })

  it('groups minor presentation only inside a cycle, retaining every original note and fact', () => {
    const first = event('count', 'plant_count_observed', null, { count: 4 }); first.note = 'Cuatro tallos.'
    const second = event('review', 'development_review', null); second.note = 'Hojas nuevas.'
    const catalogue = buildFilmCatalogue({ kind: 'garden', id: 'g', title: 'Garden 1' }, [cycle('a', [first, second]), cycle('b', [second])])
    expect(catalogue.milestones).toHaveLength(2)
    expect(catalogue.milestones[0].sources.map(source => source.note)).toEqual(['Cuatro tallos.', 'Hojas nuevas.'])
    expect(catalogue.milestones[0].sources[0].provenance.count).toBe(4)
    expect(catalogue.milestones[1].sources).toHaveLength(1)
  })

  it('preserves selection chronology and cycle identity across repeated positions and crops', () => {
    const a = cycle('a', [event('a1', 'observation', photo('a1')), event('a2', 'intervention', photo('a2', '2026-09-03T12:00:00Z'), { class: 'thinning' })])
    const b = cycle('b', [event('b1', 'observation', photo('b1', '2026-09-02T12:00:00Z'))])
    const catalogue = buildFilmCatalogue({ kind: 'garden', id: 'g', title: 'Garden 1' }, [b, a])
    const plan = composeGrowthFilm(catalogue, { ...options(catalogue), selectedIds: ['a:a2', 'a:a1', 'b:b1'] })
    expect(plan.moments.map(moment => moment.id)).toEqual(['a:a1', 'b:b1', 'a:a2'])
    expect(plan.moments.map(moment => moment.cycleLabel)).toEqual(['Ciclo 1', 'Ciclo 2', 'Ciclo 1'])
    expect(filmFrameAt(plan, 3_350)).toEqual({ index: 0, nextIndex: null, blend: 0 })
    expect(filmFrameAt(plan, plan.durationMs)).toEqual({ index: 2, nextIndex: null, blend: 0 })
  })

  it('dissolves only within the same cycle and removes all transitions in reduced motion', () => {
    const catalogue = buildFilmCatalogue({ kind: 'cycle', id: 'a', title: 'Basil' }, [cycle('a', [event('a', 'observation', photo('a')), event('b', 'observation', photo('b', '2026-09-02T12:00:00Z'))])])
    const plan = composeGrowthFilm(catalogue, options(catalogue))
    expect(filmFrameAt(plan, 3_200)).toEqual({ index: 0, nextIndex: 1, blend: .5 })
    expect(filmFrameAt({ ...plan, reducedMotion: true }, 3_200)).toEqual({ index: 0, nextIndex: null, blend: 0 })
    expect(filmFrameAt(plan, -1).index).toBe(0)
  })

  it('invalidates the artifact identity for every visible or audible option and source revision', () => {
    const catalogue = buildFilmCatalogue({ kind: 'cycle', id: 'a', title: 'Basil' }, [cycle('a', [event('a', 'observation', photo('a')), event('b', 'observation', photo('b'))])])
    const input = options(catalogue)
    const base = composeGrowthFilm(catalogue, input)
    for (const change of [{ titles: false }, { reducedMotion: true }, { trackId: 'growing-light' as const }, { trackId: 'track-4' as const, volume: .7 }]) {
      expect(composeGrowthFilm(catalogue, { ...input, ...change }).key).not.toBe(base.key)
    }
    const withMusic = { ...input, trackId: 'track-4' as const }
    expect(composeGrowthFilm(catalogue, withMusic).key).not.toBe(composeGrowthFilm(catalogue, { ...withMusic, volume: .6 }).key)
    const revised = { ...catalogue, moments: catalogue.moments.map(moment => ({ ...moment, source: { ...moment.source, cycleRevision: 2 } })) }
    expect(composeGrowthFilm(revised, input).key).not.toBe(base.key)
    expect(base.fit).toBe('contain')
    expect(base.durationMs).toBe(6_800)
  })

  it('rejects missing selections, duplicates, out-of-scope cycles and invalid volumes', () => {
    const c = cycle('a', [event('a', 'observation', photo('a')), event('b', 'observation', photo('b'))])
    const catalogue = buildFilmCatalogue({ kind: 'cycle', id: 'a', title: 'Basil' }, [c])
    expect(() => buildFilmCatalogue({ kind: 'cycle', id: 'b', title: '' }, [c])).toThrow('no pertenece')
    for (const selectedIds of [[], ['a:a'], ['a:a', 'a:a'], ['a:a', 'missing']]) expect(() => composeGrowthFilm(catalogue, { ...options(catalogue), selectedIds })).toThrow()
    expect(() => composeGrowthFilm(catalogue, { ...options(catalogue), volume: NaN })).toThrow('volumen')
    expect(() => composeGrowthFilm(catalogue, { ...options(catalogue), volume: 2 })).toThrow('volumen')
  })

  it('keeps the complete diary available for native playback without applying the short-clip limit', () => {
    const catalogue = buildFilmCatalogue({ kind: 'cycle', id: 'a', title: 'Basil' }, [cycle('a', Array.from({ length: 15 }, (_, i) => event(`e${i}`, 'observation', photo(`p${i}`))))])
    expect(() => composeGrowthFilm(catalogue, options(catalogue))).toThrow('12')
    const playback = composeGrowthFilm(catalogue, { ...options(catalogue), purpose: 'playback' })
    expect(playback.moments).toHaveLength(15)
    expect(playback.durationMs).toBe(51_000)
  })
})

describe('Export geometry and typography', () => {
  it('retains all edges for portrait and landscape photos', () => {
    expect(containFilmImage(1_600, 900, 720, 900)).toEqual({ x: 0, y: 247.5, width: 720, height: 405 })
    expect(containFilmImage(600, 1_200, 720, 900)).toEqual({ x: 135, y: 0, width: 450, height: 900 })
  })
  it('bounds long words and multiline notes without splitting a Unicode character', () => {
    const measure = (text: string) => [...text].length * 10
    const lines = filmTextLines('🌱🌱🌱🌱🌱🌱 Una nota muy larga para comprobar el límite', 50, 3, measure)
    expect(lines).toHaveLength(3)
    expect(lines.at(-1)).toMatch(/…$/u)
    expect(lines.every(line => measure(line) <= 50)).toBe(true)
    expect(lines[0]).toBe('🌱🌱🌱🌱🌱')
  })
})
