import { describe, expect, it } from 'vitest'
import { photoTransformFor } from './photo-renditions'

describe('photo presentation renditions', () => {
  it('keeps originals untouched and uses constrained variants for UI surfaces', () => {
    expect(photoTransformFor('original')).toBeNull()
    expect(photoTransformFor('thumbnail')).toEqual({ width: 480, height: 360, resize: 'cover', quality: 60 })
    expect(photoTransformFor('story')).toEqual({ width: 900, height: 1125, resize: 'cover', quality: 72 })
    expect(photoTransformFor('hero')).toEqual({ width: 1600, quality: 78 })
  })
})
