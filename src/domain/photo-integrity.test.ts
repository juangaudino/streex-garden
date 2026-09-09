import { describe, expect, it } from 'vitest'
import { normalizeExifCapture } from './photo-integrity'

describe('normalización de captura EXIF', () => {
  it('conserva el offset EXIF en vez de interpretarlo como UTC', () => {
    expect(normalizeExifCapture('2026-09-09T13:31:00', '-06:00')).toBe('2026-09-09T19:31:00.000Z')
  })

  it('usa la zona local del dispositivo cuando EXIF no trae offset', () => {
    const normalized = normalizeExifCapture('2026-09-09T13:31:00')
    expect(normalized).toMatch(/^2026-09-09T\d{2}:\d{2}:\d{2}\.000Z$/)
  })
})
