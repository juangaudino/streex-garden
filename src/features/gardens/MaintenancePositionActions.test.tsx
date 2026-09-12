// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { GrowCycleDetail, MaintenancePosition, MaintenanceSession } from '../../domain/types'
import * as api from '../../lib/garden-api'
import { getObservationDrafts, saveObservationDraft } from '../../lib/offline-observation-store'
import { syncObservationDraft } from '../../lib/observation-sync'
import { requestDraftAiCheck } from '../../lib/ai-gateway'
import { MaintenancePage } from './MaintenancePage'

vi.mock('../../lib/garden-api', () => ({
  getCycle: vi.fn(), getGarden: vi.fn(), getSignedPhotoUrl: vi.fn(), getMaintenanceSession: vi.fn(),
  markMaintenancePositionInspected: vi.fn(), progressMaintenancePosition: vi.fn(), setMaintenanceSessionState: vi.fn(),
  recordCycleFact: vi.fn(), createAttentionItem: vi.fn(), recordHarvest: vi.fn(), closeCycle: vi.fn(), moveCycle: vi.fn(),
}))
vi.mock('../../lib/offline-observation-store', () => ({ getObservationDrafts: vi.fn(), saveObservationDraft: vi.fn() }))
vi.mock('../../lib/observation-sync', () => ({ syncObservationDraft: vi.fn() }))
vi.mock('../../lib/ai-gateway', () => ({ requestDraftAiCheck: vi.fn(), requestAiCheck: vi.fn() }))
vi.mock('../../components/PwaUpdateNotice', () => ({ PwaUpdateNotice: () => null }))

const position: MaintenancePosition = {
  id: 'step-a', garden_id: 'garden', garden_name: 'Garden 1', position_id: 'position-a', position_number: 1,
  captured_grow_cycle_id: 'cycle', current_grow_cycle_id: 'cycle', crop_name: 'Genovese Basil', progress: 'not_reviewed',
  inspected_at: null, inspection_source: null, health_confirmed: false, ordinal: 1,
}
const cycle: GrowCycleDetail = {
  id: 'cycle', crop_name: 'Genovese Basil', planted_on: null, planted_on_precision: 'unknown', harvest_readiness: 'not_yet',
  state: 'active', revision: 1, position: { id: 'position-a', position_number: 1 }, garden: { id: 'garden', name: 'Garden 1' }, history: [], corrections: [],
}
let session: MaintenanceSession
const mount = () => render(<MemoryRouter initialEntries={['/maintenance/session']}><Routes><Route path="/maintenance/:sessionId" element={<MaintenancePage />} /></Routes></MemoryRouter>)
const dialog = () => screen.getByRole('dialog')
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const openFact = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /Registrar algo que hice/ }))
  fireEvent.click(within(dialog()).getByRole('button', { name: 'Registrar estado o acción' }))
}
beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  session = { id: 'session', state: 'in_progress', started_at: '2026-09-11T12:00:00Z', cursor_position: 1, positions: [structuredClone(position), { ...position, id: 'step-b', position_id: 'position-b', position_number: 2, captured_grow_cycle_id: 'cycle-b', current_grow_cycle_id: 'cycle-b', crop_name: 'Chives', ordinal: 2 }] }
  vi.mocked(api.getMaintenanceSession).mockImplementation(async () => structuredClone(session))
  vi.mocked(api.getCycle).mockImplementation(async id => id === 'cycle' ? structuredClone(cycle) : { ...cycle, id, crop_name: 'Chives', position: { id: 'position-b', position_number: 2 } })
  vi.mocked(api.markMaintenancePositionInspected).mockImplementation(async (_id, stepId, source) => {
    const step = session.positions.find(p => p.id === stepId)!
    step.progress = 'reviewed'; step.inspection_source = source
  })
  vi.mocked(api.progressMaintenancePosition).mockImplementation(async (_id, stepId, progress) => {
    const step = session.positions.find(p => p.id === stepId)!
    step.progress = progress; step.health_confirmed = progress === 'reviewed'
  })
  vi.mocked(api.setMaintenanceSessionState).mockImplementation(async (_id, _session, state) => { session.state = state })
  vi.mocked(api.recordCycleFact).mockResolvedValue({ event_id: 'confirmed-event' })
  vi.mocked(api.createAttentionItem).mockResolvedValue({ task_id: 'task', created: true })
  vi.mocked(getObservationDrafts).mockResolvedValue([])
  vi.mocked(syncObservationDraft).mockResolvedValue({ result: 'synced' })
  Object.defineProperty(window, 'indexedDB', { configurable: true, value: {} })
  Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn() })
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValue('blob:preview') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute('open') } })
})
afterEach(cleanup)

describe('Botanical Maintenance with canonical forms and session RPCs', () => {
  it('only an explicit healthy confirmation calls the RPC that writes a visual review', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Se ve bien' }))
    expect(api.progressMaintenancePosition).not.toHaveBeenCalled()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Volver' }))
    expect(api.progressMaintenancePosition).not.toHaveBeenCalled()
    fireEvent.click(button('Se ve bien'))
    fireEvent.click(button('Confirmar y avanzar'))
    await screen.findByText('Chives')
    expect(api.progressMaintenancePosition).toHaveBeenCalledTimes(1)
    expect(api.progressMaintenancePosition).toHaveBeenCalledWith(expect.any(String), 'step-a', 'reviewed')
    expect(api.markMaintenancePositionInspected).not.toHaveBeenCalled()
    expect(api.recordCycleFact).not.toHaveBeenCalled()
  })

  it('saves a real count, stays on the plant, and navigates without asserting health', async () => {
    mount(); await openFact()
    const form = within(dialog())
    fireEvent.change(form.getByLabelText('Qué confirmé'), { target: { value: 'count' } })
    fireEvent.change(form.getByLabelText('Cantidad observada'), { target: { value: '3' } })
    fireEvent.click(form.getByRole('button', { name: 'Guardar registro' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.recordCycleFact).toHaveBeenCalledWith(expect.objectContaining({ growCycleId: 'cycle', factType: 'plant_count_observed', factData: { count: 3, count_kind: 'seedlings_visible' } }))
    expect(screen.getByText('Genovese Basil')).toBeTruthy()
    expect(api.markMaintenancePositionInspected).not.toHaveBeenCalled()
    fireEvent.click(button('Siguiente planta'))
    await screen.findByText('Chives')
    expect(api.markMaintenancePositionInspected).toHaveBeenCalledWith(expect.any(String), 'step-a', 'fact')
    expect(api.progressMaintenancePosition).not.toHaveBeenCalled()
    expect(api.recordCycleFact).toHaveBeenCalledTimes(1)
  })

  it('keeps date and purpose of a follow-up and can cancel another sheet before continuing', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /Revisar más adelante/ }))
    fireEvent.change(within(dialog()).getByLabelText('Qué requiere seguimiento'), { target: { value: 'evaluate_pruning' } })
    fireEvent.change(within(dialog()).getByLabelText(/Fecha prevista/), { target: { value: '2026-09-18' } })
    fireEvent.click(button('Crear seguimiento'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.createAttentionItem).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'evaluate_pruning', dueOn: '2026-09-18', growCycleId: 'cycle' }))
    fireEvent.click(button('Registrar algo más'))
    fireEvent.click(within(dialog()).getByRole('button', { name: /Añadir una observación/ }))
    fireEvent.change(screen.getByLabelText('Lo que observas'), { target: { value: 'Sin guardar' } })
    fireEvent.click(button('Cancelar'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(saveObservationDraft).not.toHaveBeenCalled()
    expect(api.createAttentionItem).toHaveBeenCalledTimes(1)
    fireEvent.click(button('Siguiente planta'))
    await waitFor(() => expect(api.markMaintenancePositionInspected).toHaveBeenCalledWith(expect.any(String), 'step-a', 'manual'))
    expect(api.progressMaintenancePosition).not.toHaveBeenCalled()
  })

  it('does not claim a second follow-up was created when one already exists', async () => {
    vi.mocked(api.createAttentionItem).mockResolvedValue({ created: false, task_id: 'existing' })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /Revisar más adelante/ }))
    fireEvent.click(button('Crear seguimiento'))
    await screen.findByText('Ya había una atención abierta con este mismo propósito y asunto.')
    expect(dialog()).toBeTruthy()
    expect(screen.queryByText('Seguimiento guardado')).toBeNull()
    expect(api.markMaintenancePositionInspected).not.toHaveBeenCalled()
  })

  it('preserves input on errors and reuses the request ID for the same retry', async () => {
    vi.mocked(api.recordCycleFact).mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue({ event_id: 'confirmed-event' })
    mount(); await openFact()
    fireEvent.change(screen.getByLabelText('Qué confirmé'), { target: { value: 'count' } })
    fireEvent.change(screen.getByLabelText('Cantidad observada'), { target: { value: '2' } })
    fireEvent.click(button('Guardar registro'))
    await screen.findByText('Sin conexión')
    expect((screen.getByLabelText('Cantidad observada') as HTMLInputElement).value).toBe('2')
    fireEvent.click(button('Guardar registro'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const [first, retry] = vi.mocked(api.recordCycleFact).mock.calls
    expect(retry[0].requestId).toBe(first[0].requestId)
    expect(api.markMaintenancePositionInspected).not.toHaveBeenCalled()
  })

  it('recovers a confirmed progress operation whose following read failed without a new write ID', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Se ve bien' }))
    vi.mocked(api.getMaintenanceSession).mockRejectedValueOnce(new Error('No se pudo recargar'))
    fireEvent.click(button('Confirmar y avanzar'))
    await screen.findByText('No se pudo recargar')
    fireEvent.click(button('Confirmar y avanzar'))
    await screen.findByText('Chives')
    const calls = vi.mocked(api.progressMaintenancePosition).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[1][0]).toBe(calls[0][0])
  })

  it('keeps a completed structural action here until explicit navigation and protects the next occupant', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /Registrar algo que hice/ }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cerrar ciclo' }))
    vi.mocked(api.closeCycle).mockResolvedValue(undefined)
    vi.mocked(api.getCycle).mockResolvedValue({ ...cycle, state: 'closed' })
    fireEvent.click(button('Confirmar cambio'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText('Genovese Basil')).toBeTruthy()
    expect(api.progressMaintenancePosition).not.toHaveBeenCalled()
    fireEvent.click(button('Siguiente planta'))
    await waitFor(() => expect(api.progressMaintenancePosition).toHaveBeenCalledWith(expect.any(String), 'step-a', 'skipped'))
    expect(api.markMaintenancePositionInspected).not.toHaveBeenCalled()
  })

  it('retries a structural save with the same request ID and rejects a duplicate submit in flight', async () => {
    let rejectFirst!: (error: Error) => void
    vi.mocked(api.closeCycle).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject })).mockResolvedValue(undefined)
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /Registrar algo que hice/ }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cerrar ciclo' }))
    const form = button('Confirmar cambio').closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(api.closeCycle).toHaveBeenCalledTimes(1)
    await act(async () => rejectFirst(new Error('No se pudo confirmar el cierre')))
    await screen.findByText('No se pudo confirmar el cierre')
    fireEvent.click(button('Confirmar cambio'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const [first, retry] = vi.mocked(api.closeCycle).mock.calls
    expect(retry[0].requestId).toBe(first[0].requestId)
    expect(api.progressMaintenancePosition).not.toHaveBeenCalled()
  })

  it('pauses and resumes the actual session without changing the plant or recording health', async () => {
    mount()
    await screen.findByRole('button', { name: 'Se ve bien' })
    fireEvent.click(button('Pausar revisión'))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Pausar' }))
    await screen.findByText('La revisión puede esperar.')
    expect(api.setMaintenanceSessionState).toHaveBeenCalledWith(expect.any(String), 'session', 'paused')
    fireEvent.click(button('Retomar revisión'))
    await screen.findByRole('button', { name: 'Se ve bien' })
    expect(screen.getByText('Genovese Basil')).toBeTruthy()
    expect(api.recordCycleFact).not.toHaveBeenCalled()
    expect(api.progressMaintenancePosition).not.toHaveBeenCalled()
    expect(api.markMaintenancePositionInspected).not.toHaveBeenCalled()
  })

  it('restores the continue affordance after reload without treating the UI marker as a health fact', async () => {
    const view = mount(); await openFact()
    fireEvent.click(button('Guardar registro'))
    await screen.findByRole('button', { name: 'Siguiente planta' })
    view.unmount(); mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiente planta' }))
    await waitFor(() => expect(api.markMaintenancePositionInspected).toHaveBeenCalledWith(expect.any(String), 'step-a', 'fact'))
    expect(api.recordCycleFact).toHaveBeenCalledTimes(1)
    expect(api.progressMaintenancePosition).not.toHaveBeenCalled()
  })

  it('blocks navigation with an offline photo and keeps the original recovery route', async () => {
    vi.mocked(getObservationDrafts).mockResolvedValue([{
      id: 'draft', createdAt: '2026-09-09T12:00:00Z', status: 'retryable_error', growCycleId: 'cycle', note: 'Dos plántulas',
      photo: new Blob(['x'], { type: 'image/jpeg' }), photoMetadata: { originalFilename: 'tomato.jpg', contentType: 'image/jpeg', byteSize: 1 }, requestId: 'request',
    }])
    mount()
    const input = await screen.findByLabelText('Volver a elegir original')
    expect((button('Se ve bien') as HTMLButtonElement).disabled).toBe(true)
    expect((button('Omitir') as HTMLButtonElement).disabled).toBe(true)
    vi.mocked(getObservationDrafts).mockResolvedValue([])
    fireEvent.change(input, { target: { files: [new File(['x'], 'tomato.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(syncObservationDraft).toHaveBeenCalledTimes(1))
    await screen.findByRole('button', { name: 'Siguiente planta' })
    expect(saveObservationDraft).toHaveBeenCalledTimes(1)
    expect(api.markMaintenancePositionInspected).not.toHaveBeenCalled()
  })

  it('keeps an unsaved photo and note when an AI suggestion opens and cancels a canonical form', async () => {
    vi.mocked(requestDraftAiCheck).mockResolvedValue({
      schema_version: 'garden_ai_check_v1', status: 'complete', summary: 'Conviene evaluar el espacio.',
      evidence_used: [], development_recommendations: [{ kind: 'thinning', recommendation: 'evaluate', rationale: 'Densidad visible', confidence: 'medium' }],
      observations: ['Varias plántulas visibles.'], uncertainty: [], questions: [], confidence: 'medium',
      suggested_next_actions: [{ kind: 'create_follow_up', rationale: 'Evaluar aclareo' }],
    })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: /Añadir una observación/ }))
    fireEvent.change(screen.getByLabelText('Lo que observas'), { target: { value: 'Nota pendiente' } })
    await act(async () => fireEvent.change(screen.getByLabelText('Elegir foto'), { target: { files: [new File(['x'], 'plant.jpg', { type: 'image/jpeg' })] } }))
    fireEvent.click(button('Analizar con Garden AI'))
    await screen.findByText('Conviene evaluar el espacio.')
    fireEvent.click(button('Evaluar aclareo'))
    expect(saveObservationDraft).not.toHaveBeenCalled()
    expect(api.createAttentionItem).not.toHaveBeenCalled()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancelar' }))
    expect((screen.getByLabelText('Lo que observas') as HTMLTextAreaElement).value).toBe('Nota pendiente')
    expect(screen.getByAltText('Vista previa de la fotografía que guardarás')).toBeTruthy()
    fireEvent.click(button('Cancelar'))
    expect(saveObservationDraft).not.toHaveBeenCalled()
    expect(api.recordCycleFact).not.toHaveBeenCalled()
    expect(api.createAttentionItem).not.toHaveBeenCalled()
  })
})
