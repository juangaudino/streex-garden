import { describe, expect, it } from 'vitest'
import { canTransitionDraft, harvestReadinessLabel, isValidPlantingDate, validatesObservation } from './invariants'
import { photoContentType, sha256Hex } from './photo-integrity'
import { requiresManualReview } from '../lib/observation-sync'

describe('invariantes del vertical slice', () => {
  it('mantiene el vocabulario canónico de preparación para cosecha', () => {
    expect(harvestReadinessLabel).toEqual({
      not_yet: 'Todavía no',
      evaluate: 'Evaluar',
      ready: 'Lista',
      not_applicable: 'No aplica',
    })
  })

  it('no permite precisión de siembra sin una fecha compatible', () => {
    expect(isValidPlantingDate('', 'unknown')).toBe(true)
    expect(isValidPlantingDate('2026-09-06', 'exact')).toBe(true)
    expect(isValidPlantingDate('', 'exact')).toBe(false)
    expect(isValidPlantingDate('2026-09-06', 'unknown')).toBe(false)
  })

  it('requiere texto o fotografía para una observación', () => {
    expect(validatesObservation({ requestId: 'r', growCycleId: 'c', note: '' })).toBeTruthy()
    expect(validatesObservation({ requestId: 'r', growCycleId: 'c', note: 'Hojas firmes.' })).toBeNull()
  })

  it('limita los originales nuevos a 30 MB', () => {
    expect(validatesObservation({
      requestId: 'r', growCycleId: 'c', note: '', photo: new File(['x'], 'foto.jpg', { type: 'image/jpeg' }),
      photoMetadata: { originalFilename: 'foto.jpg', contentType: 'image/jpeg', byteSize: 31_457_280 },
    })).toBeNull()
    expect(validatesObservation({
      requestId: 'r', growCycleId: 'c', note: '', photo: new File(['x'], 'foto.jpg', { type: 'image/jpeg' }),
      photoMetadata: { originalFilename: 'foto.jpg', contentType: 'image/jpeg', byteSize: 31_457_281 },
    })).toBe('La fotografía supera el límite de 30 MB.')
  })

  it('mantiene la máquina de estados de sincronización explícita', () => {
    expect(canTransitionDraft('draft', 'queued')).toBe(true)
    expect(canTransitionDraft('syncing', 'retryable_error')).toBe(true)
    expect(canTransitionDraft('synced', 'queued')).toBe(false)
    expect(canTransitionDraft('needs_review', 'queued')).toBe(false)
  })

  it('separa los conflictos de dominio de los fallos reintentables de red', () => {
    expect(requiresManualReview(new Error('Current grow cycle not found'))).toBe(true)
    expect(requiresManualReview(new Error('Network request failed'))).toBe(false)
  })

  it('reconoce HEIF y calcula una huella estable del original', async () => {
    const heif = new File(['photo'], 'captura.HEIF', { type: '' })
    expect(photoContentType(heif)).toBe('image/heif')
    expect(await sha256Hex(new TextEncoder().encode('garden').buffer)).toBe('23eeb69c681dfdb8eacc7ce9e55ea007d41c2dd5273848c597f1b3e49dbd86e1')
  })
})
