// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GrowCycleDetail, MaintenancePosition } from '../../domain/types'
import { getCycle } from '../../lib/garden-api'
import { getObservationDrafts, saveObservationDraft } from '../../lib/offline-observation-store'
import { syncObservationDraft } from '../../lib/observation-sync'
import { MaintenancePositionActions } from './MaintenancePositionActions'

vi.mock('../../lib/garden-api', () => ({ getCycle: vi.fn() }))
vi.mock('../../lib/offline-observation-store', () => ({ getObservationDrafts: vi.fn().mockResolvedValue([]), saveObservationDraft: vi.fn() }))
vi.mock('../../lib/observation-sync', () => ({ syncObservationDraft: vi.fn() }))
vi.mock('../cycles/ObservationComposer', () => ({ ObservationComposer: ({ onSaved }: { onSaved: () => Promise<void> }) => <button type="button" onClick={() => void onSaved()}>Guardar observación canónica</button> }))
vi.mock('../cycles/CycleFactRecorder', () => ({ CycleFactRecorder: ({ onSaved }: { onSaved: () => Promise<void> }) => <button type="button" onClick={() => void onSaved()}>Guardar hecho canónico</button> }))
vi.mock('./AttentionTaskTools', () => ({ AttentionTaskForm: ({ onCreated }: { onCreated: () => void }) => <button type="button" onClick={onCreated}>Crear Attention canónico</button> }))

afterEach(cleanup)

const position: MaintenancePosition = {
  id: 'session-position', garden_id: 'garden', garden_name: 'Garden 2', position_id: 'position-9', position_number: 9,
  captured_grow_cycle_id: 'cycle', current_grow_cycle_id: 'cycle', crop_name: 'Cherry Tomato', progress: 'not_reviewed',
  inspected_at: null, inspection_source: null, health_confirmed: false, ordinal: 9,
}
const cycle: GrowCycleDetail = {
  id: 'cycle', crop_name: 'Cherry Tomato', planted_on: null, planted_on_precision: 'unknown', harvest_readiness: 'not_yet',
  state: 'active', revision: 1, position: { id: 'position-9', position_number: 9 }, garden: { id: 'garden', name: 'Garden 2' }, history: [], corrections: [],
}

describe('Maintenance contextual canonical actions', () => {
  it('exposes observation, fact and Attention progressively without duplicating a domain flow', async () => {
    vi.mocked(getCycle).mockResolvedValue(cycle)
    const onInspectionRecorded = vi.fn().mockResolvedValue(undefined)
    render(<MaintenancePositionActions position={position} onInspectionRecorded={onInspectionRecorded} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Foto / observación' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Foto / observación' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar observación canónica' }))
    await waitFor(() => expect(onInspectionRecorded).toHaveBeenCalledWith('observation'))

    fireEvent.click(screen.getByRole('button', { name: 'Registrar hecho' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar hecho canónico' }))
    await waitFor(() => expect(onInspectionRecorded).toHaveBeenCalledWith('fact'))

    fireEvent.click(screen.getByRole('button', { name: 'Seguimiento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear Attention canónico' }))
    expect(onInspectionRecorded).not.toHaveBeenCalledWith('manual')
    expect(screen.getByText(/no declara por sí sola/)).toBeTruthy()
  })

  it('offers an explicit inspected-only completion for a future task or a failed session update', async () => {
    vi.mocked(getCycle).mockResolvedValue(cycle)
    const onInspectionRecorded = vi.fn().mockResolvedValue(undefined)
    render(<MaintenancePositionActions position={position} onInspectionRecorded={onInspectionRecorded} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar inspeccionada sin declarar salud' }))
    await waitFor(() => expect(onInspectionRecorded).toHaveBeenCalledWith('manual'))
  })

  it('keeps the canonical offline photo recovery path inside Maintenance', async () => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: {} })
    vi.mocked(getCycle).mockResolvedValue(cycle)
    vi.mocked(getObservationDrafts).mockResolvedValue([{
      id: 'draft', createdAt: '2026-09-09T12:00:00Z', status: 'retryable_error', growCycleId: 'cycle', note: 'Dos seedlings',
      photo: new Blob(['x'], { type: 'image/jpeg' }), photoMetadata: { originalFilename: 'tomato.jpg', contentType: 'image/jpeg', byteSize: 1 }, requestId: 'request',
    }])
    vi.mocked(syncObservationDraft).mockResolvedValue({ result: 'synced' })
    const onInspectionRecorded = vi.fn().mockResolvedValue(undefined)
    render(<MaintenancePositionActions position={position} onInspectionRecorded={onInspectionRecorded} />)
    const input = await screen.findByLabelText('Volver a elegir original')
    fireEvent.change(input, { target: { files: [new File(['x'], 'tomato.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(saveObservationDraft).toHaveBeenCalled())
    await waitFor(() => expect(syncObservationDraft).toHaveBeenCalled())
    expect(onInspectionRecorded).toHaveBeenCalledWith('observation')
  })
})
