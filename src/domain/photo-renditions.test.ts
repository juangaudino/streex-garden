import { describe, expect, it } from 'vitest'
import { photoRenditionPath, renditionDimensions, storedRenditionFor } from './photo-renditions'

describe('private photo renditions', () => {
  it('keeps originals canonical and maps visual surfaces to two stored derivatives', () => {
    expect(storedRenditionFor('original')).toBeNull()
    expect(storedRenditionFor('thumbnail')).toBe('preview')
    expect(storedRenditionFor('history')).toBe('preview')
    expect(storedRenditionFor('card')).toBe('preview')
    expect(storedRenditionFor('story')).toBe('display')
    expect(storedRenditionFor('hero')).toBe('display')
  })

  it('stores derivatives beside every original without changing the original path', () => {
    const original = 'owner-id/historical-photos-v1/garden-2/cycle-evidence/photo-id/original.jpeg'
    expect(photoRenditionPath(original, 'preview')).toBe('owner-id/historical-photos-v1/garden-2/cycle-evidence/photo-id/preview.jpg')
    expect(photoRenditionPath(original, 'display')).toBe('owner-id/historical-photos-v1/garden-2/cycle-evidence/photo-id/display.jpg')
  })

  it('uses bounded JPEG sizes suited to the Free plan', () => {
    expect(renditionDimensions('preview')).toEqual({ maxEdge: 640, quality: 0.68 })
    expect(renditionDimensions('display')).toEqual({ maxEdge: 1600, quality: 0.78 })
  })
})
