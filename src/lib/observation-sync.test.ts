import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ObservationDraft } from '../domain/types'

const mocks = vi.hoisted(() => ({
  createObservation: vi.fn(),
  getCycle: vi.fn(),
  deleteObservationDraft: vi.fn(),
  saveObservationDraft: vi.fn(),
}))

vi.mock('./garden-api', () => ({
  createObservation: mocks.createObservation,
  getCycle: mocks.getCycle,
}))

vi.mock('./offline-observation-store', () => ({
  deleteObservationDraft: mocks.deleteObservationDraft,
  saveObservationDraft: mocks.saveObservationDraft,
}))

import { syncObservationDraft } from './observation-sync'

const draft: ObservationDraft = {
  id: 'draft-1',
  requestId: 'request-1',
  growCycleId: 'cycle-1',
  createdAt: '2026-09-07T06:00:00.000Z',
  note: 'Hojas firmes.',
  photo: new Blob(['photo'], { type: 'image/jpeg' }),
  photoMetadata: { originalFilename: 'photo.jpg', contentType: 'image/jpeg', byteSize: 5 },
  status: 'queued',
}

function cycleWith(eventId: string, uploadStatus: 'uploaded' | 'pending') {
  return {
    history: [{ id: eventId, photo: { upload_status: uploadStatus } }],
  }
}

describe('syncObservationDraft', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.saveObservationDraft.mockResolvedValue('draft-1')
    mocks.deleteObservationDraft.mockResolvedValue(undefined)
    mocks.createObservation.mockResolvedValue({ eventId: 'event-1', photoId: 'photo-1', storagePath: 'path' })
  })

  it('elimina el borrador solo después de leer el evento y foto confirmados', async () => {
    mocks.getCycle.mockResolvedValue(cycleWith('event-1', 'uploaded'))

    await expect(syncObservationDraft(draft)).resolves.toEqual({ result: 'synced' })

    expect(mocks.deleteObservationDraft).toHaveBeenCalledWith('draft-1')
    expect(mocks.saveObservationDraft).toHaveBeenCalledWith(expect.objectContaining({ status: 'syncing' }))
  })

  it('conserva el borrador cuando el servidor no devuelve el evento exacto', async () => {
    mocks.getCycle.mockResolvedValue(cycleWith('other-event', 'uploaded'))

    await expect(syncObservationDraft(draft)).resolves.toMatchObject({ result: 'retryable_error' })

    expect(mocks.deleteObservationDraft).not.toHaveBeenCalled()
    expect(mocks.saveObservationDraft).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'retryable_error' }))
  })

  it('conserva el borrador si la observación existe pero la foto sigue pendiente', async () => {
    mocks.getCycle.mockResolvedValue(cycleWith('event-1', 'pending'))

    await expect(syncObservationDraft(draft)).resolves.toMatchObject({ result: 'retryable_error' })

    expect(mocks.deleteObservationDraft).not.toHaveBeenCalled()
  })

  it('no vuelve a enviar automáticamente un conflicto de ciclo', async () => {
    mocks.createObservation.mockRejectedValue(new Error('Current grow cycle not found'))

    await expect(syncObservationDraft(draft)).resolves.toMatchObject({ result: 'needs_review' })

    expect(mocks.deleteObservationDraft).not.toHaveBeenCalled()
    expect(mocks.getCycle).not.toHaveBeenCalled()
  })
})
