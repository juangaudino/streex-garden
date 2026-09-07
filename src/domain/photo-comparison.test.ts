import { describe, expect, it } from 'vitest'
import { canCompare, toggleComparedPhoto } from './photo-comparison'

describe('selección de comparación fotográfica', () => {
  it('elige como máximo dos fotos y permite deseleccionarlas', () => {
    expect(toggleComparedPhoto([], 'a')).toEqual(['a'])
    expect(toggleComparedPhoto(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleComparedPhoto(['a', 'b'], 'c')).toEqual(['a', 'b'])
    expect(toggleComparedPhoto(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('solo habilita comparar con dos fotos distintas', () => {
    expect(canCompare([])).toBe(false)
    expect(canCompare(['a'])).toBe(false)
    expect(canCompare(['a', 'a'])).toBe(false)
    expect(canCompare(['a', 'b'])).toBe(true)
  })
})
