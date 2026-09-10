import { describe, expect, it } from 'vitest'
import { GROWTH_FILM_MAX_EXPORT_FRAMES, nearbyFilmIndexes, selectFilmFrameIndexes } from './growth-film-media'

describe('Growth Film media planning', () => {
  it('uses every real moment when the cycle is short', () => {
    expect(selectFilmFrameIndexes(4)).toEqual([0, 1, 2, 3])
  })
  it('bounds a generated clip while preserving the chronological endpoints', () => {
    const indexes = selectFilmFrameIndexes(43)
    expect(indexes).toHaveLength(GROWTH_FILM_MAX_EXPORT_FRAMES)
    expect(indexes[0]).toBe(0)
    expect(indexes.at(-1)).toBe(42)
    expect(indexes.every((value, index) => index === 0 || value > indexes[index - 1])).toBe(true)
  })
  it('warms only the active photo and immediate neighbors', () => {
    expect(nearbyFilmIndexes(8, 0)).toEqual([0, 1])
    expect(nearbyFilmIndexes(8, 4)).toEqual([4, 3, 5])
    expect(nearbyFilmIndexes(8, 7)).toEqual([7, 6])
  })
})
