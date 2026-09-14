// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../../lib/garden-api'
import { getObservationDrafts, saveObservationDraft } from '../../lib/offline-observation-store'
import { syncObservationDraft } from '../../lib/observation-sync'
import { requestAiCheck, requestDraftAiCheck } from '../../lib/ai-gateway'
import type { AttentionItem, CycleHistoryEvent, GardenDetail, GrowCycleDetail, ObservationDraft, PhotoEvidence } from '../../domain/types'
import type { GardenAiCheckProposalV1 } from '../../domain/ai'
import { CyclePage } from './CyclePage'
import { plantArrivalIntent, plantAiIntent } from './plant-intents'
import { plantPresentation, plantingSummary } from './plant-presentation'

vi.mock('../../lib/garden-api', () => ({
  getCycle: vi.fn(), getGarden: vi.fn(), getAttention: vi.fn(), getSignedPhotoUrl: vi.fn(),
  recordCycleFact: vi.fn(), createAttentionItem: vi.fn(), completeAttentionItem: vi.fn(), deferAttentionItem: vi.fn(), dismissAttentionItem: vi.fn(),
  recordHarvest: vi.fn(), moveCycle: vi.fn(), closeCycle: vi.fn(), correctCyclePlanting: vi.fn(), replaceCycle: vi.fn(), reopenCycle: vi.fn(), invalidateEvent: vi.fn(),
  setCycleCover: vi.fn(), setGardenCover: vi.fn(), setHomeHero: vi.fn(), retryPendingPhoto: vi.fn(), signOut: vi.fn(),
}))
vi.mock('../../lib/offline-observation-store', () => ({ getObservationDrafts: vi.fn(), saveObservationDraft: vi.fn(), clearObservationDrafts: vi.fn() }))
vi.mock('../../lib/observation-sync', () => ({ syncObservationDraft: vi.fn() }))
vi.mock('../../lib/ai-gateway', () => ({ requestAiCheck: vi.fn(), requestDraftAiCheck: vi.fn() }))
vi.mock('../../components/PwaUpdateNotice', () => ({ PwaUpdateNotice: () => null }))

const photo = (id = 'photo-a'): PhotoEvidence => ({ id, storage_path: `${id}.jpg`, original_filename: `${id}.jpg`, content_type: 'image/jpeg', byte_size: 4, checksum_sha256: 'checksum', captured_at: null, captured_at_precision: 'unknown', upload_status: 'uploaded' })
const event = (id: string, event_type: CycleHistoryEvent['event_type'] = 'observation', note: string | null = 'Hoy observé hojas nuevas.'): CycleHistoryEvent => ({ id, event_type, note, revision: 1, occurred_at: '2026-09-10T17:00:00Z', photo: null })
const base: GrowCycleDetail = { id: 'cycle', crop_name: 'Genovese Basil', planted_on: '2026-08-01', planted_on_precision: 'exact', harvest_readiness: 'evaluate', state: 'active', revision: 3, position: { id: 'pos-a', position_number: 1 }, garden: { id: 'garden', name: 'Garden 1' }, history: [event('observation')], corrections: [] }
const proposal: GardenAiCheckProposalV1 = { schema_version: 'garden_ai_check_v1', status: 'complete', summary: 'La densidad merece una revisión.', evidence_used: [], overall_visible_state: 'insufficient_evidence', development_recommendations: [{ kind: 'thinning', recommendation: 'evaluate', rationale: 'Densidad visible.', confidence: 'medium' }], possible_harvest_readiness: 'not_assessed', possible_incident: 'no_visible_signs', observations: ['Se ven hojas agrupadas.'], uncertainty: ['Una fotografía no confirma el estado actual.'], questions: [], suggested_next_actions: [], confidence: 'medium' }
let cycle: GrowCycleDetail
const task = (id: string, grow_cycle_id = 'cycle'): AttentionItem => ({ id, grow_cycle_id, garden_id: 'garden', purpose: 'evaluate_pruning', subject_key: 'general', title: `Revisar poda ${id}`, origin: 'manual', due_on: null, next_review_on: null, created_at: '2026-09-10T17:00:00Z' })
function Navigation() {
  const navigate = useNavigate(), location = useLocation()
  return <><button onClick={() => navigate('/cycle/cycle#cycle-fact')}>Enlace al formulario</button><button onClick={() => navigate('/cycle/next')}>Otro ciclo</button><output aria-label="Ruta actual">{location.pathname}{location.hash}</output></>
}
const mount = (entry: string | { pathname: string; hash?: string; state?: unknown } = '/cycle/cycle') => render(<MemoryRouter initialEntries={[entry]}><Navigation /><Routes><Route path="/cycle/:cycleId" element={<CyclePage />} /></Routes></MemoryRouter>)
const dialog = () => within(screen.getByRole('dialog'))
const open = async (name: string) => { fireEvent.click(await screen.findByRole('button', { name: 'Registrar un momento' })); fireEvent.click(dialog().getByRole('button', { name: new RegExp(`^${name}`) })) }
const noDomainWrites = () => {
  for (const fn of [api.recordCycleFact, api.createAttentionItem, api.completeAttentionItem, api.recordHarvest, api.moveCycle, api.closeCycle, api.replaceCycle, api.reopenCycle, api.invalidateEvent]) expect(fn).not.toHaveBeenCalled()
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }

beforeEach(() => {
  vi.resetAllMocks(); cycle = structuredClone(base)
  sessionStorage.setItem('streex-garden-entry-seen', '1')
  vi.mocked(api.getCycle).mockImplementation(async id => id === 'cycle' ? structuredClone(cycle) : { ...base, id, crop_name: 'Otro cultivo' })
  vi.mocked(api.getAttention).mockResolvedValue([])
  vi.mocked(api.getSignedPhotoUrl).mockResolvedValue('data:image/jpeg;base64,AA==')
  vi.mocked(api.recordCycleFact).mockResolvedValue({ event_id: 'fact' })
  vi.mocked(api.createAttentionItem).mockResolvedValue({ created: true, task_id: 'task' })
  vi.mocked(getObservationDrafts).mockResolvedValue([])
  vi.mocked(saveObservationDraft).mockResolvedValue('draft')
  vi.mocked(syncObservationDraft).mockResolvedValue({ result: 'synced' })
  vi.mocked(requestAiCheck).mockResolvedValue(proposal)
  vi.mocked(requestDraftAiCheck).mockResolvedValue(proposal)
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValue('blob:preview') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute('open') } })
})
afterEach(cleanup)

describe('Planta canonical integration', () => {
  it('mounts the approved identity, reads only an observation, and navigates without writing', async () => {
    cycle.history.unshift(event('review', 'visual_review', 'Una evaluación diferente.'))
    mount(); await screen.findByRole('heading', { name: 'Albahaca genovesa', level: 1 })
    expect(screen.getByText('Genovese Basil · Ocimum basilicum')).toBeTruthy()
    expect(document.querySelector('[data-place-origin="profile"]')?.getAttribute('data-place-cycle-id')).toBe('cycle')
    expect(screen.getByRole('heading', { name: 'Albahaca genovesa', level: 1 }).tabIndex).toBe(-1)
    expect(document.querySelector('.plant-page .breadcrumb')?.getAttribute('href')).toBe('/garden/garden')
    expect(screen.getByRole('heading', { name: 'Hoy observé hojas nuevas.' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Su historia/ }))
    fireEvent.click(screen.getByRole('tab', { name: 'Su presente' }))
    fireEvent.click(screen.getByRole('button', { name: /Una segunda mirada/ }))
    fireEvent.click(dialog().getByRole('button', { name: 'Cerrar análisis' }))
    noDomainWrites(); expect(requestAiCheck).not.toHaveBeenCalled()
  })

  it.each(['germination', 'count', 'intervention', 'incident'])('preserves the real %s form and its payload', async choice => {
    mount(); await open('Registrar estado o acción')
    fireEvent.change(dialog().getByLabelText('Qué confirmé'), { target: { value: choice } })
    if (choice === 'count') { fireEvent.change(dialog().getByLabelText('Cantidad observada'), { target: { value: '3' } }); fireEvent.change(dialog().getByLabelText('Representa'), { target: { value: 'plants_kept' } }) }
    if (choice === 'intervention') { fireEvent.change(dialog().getByLabelText('Intervención realizada'), { target: { value: 'support' } }); fireEvent.change(dialog().getByLabelText('Operación del soporte'), { target: { value: 'removed' } }) }
    if (choice === 'incident') fireEvent.change(dialog().getByLabelText('Nota requerida'), { target: { value: 'Tallo inclinado.' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Guardar registro' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const payloads = { germination: { factType: 'germination_observed', factData: {} }, count: { factType: 'plant_count_observed', factData: { count: 3, count_kind: 'plants_kept' } }, intervention: { factType: 'intervention', factData: { class: 'support', operation: 'removed' } }, incident: { factType: 'incident_opened', note: 'Tallo inclinado.' } }
    expect(api.recordCycleFact).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ growCycleId: 'cycle', ...payloads[choice as keyof typeof payloads] }))
    expect(screen.getByLabelText('Ruta actual').textContent).toBe('/cycle/cycle')
    expect(api.createAttentionItem).not.toHaveBeenCalled()
  })

  it('resolves the selected canonical incident rather than replacing it with an observation', async () => {
    cycle.history.push(event('incident-1', 'incident_opened', 'Tallo inclinado.'))
    mount(); await open('Registrar estado o acción')
    fireEvent.change(dialog().getByLabelText('Qué confirmé'), { target: { value: 'resolve_incident' } })
    fireEvent.change(dialog().getByLabelText('Incidencia resuelta'), { target: { value: 'incident-1' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Guardar registro' }))
    await waitFor(() => expect(api.recordCycleFact).toHaveBeenCalledWith(expect.objectContaining({ factType: 'incident_resolved', factData: { incident_event_id: 'incident-1' } })))
  })

  it('keeps fields and the request ID after failure, blocks double submission, and does not retry a successful write after a read failure', async () => {
    const write = deferred<{ event_id: string }>()
    vi.mocked(api.recordCycleFact).mockRejectedValueOnce(new Error('No disponible')).mockImplementationOnce(() => write.promise)
    mount(); await open('Registrar estado o acción')
    fireEvent.change(dialog().getByLabelText('Qué confirmé'), { target: { value: 'count' } })
    fireEvent.change(dialog().getByLabelText('Cantidad observada'), { target: { value: '4' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Guardar registro' }))
    await screen.findByText('No disponible')
    expect((dialog().getByLabelText('Cantidad observada') as HTMLInputElement).value).toBe('4')
    const requestId = vi.mocked(api.recordCycleFact).mock.calls[0][0].requestId
    fireEvent.click(dialog().getByRole('button', { name: 'Guardar registro' }))
    fireEvent.submit(dialog().getByLabelText('Cantidad observada').closest('form')!)
    expect(api.recordCycleFact).toHaveBeenCalledTimes(2)
    vi.mocked(api.getCycle).mockRejectedValue(new Error('Lectura interrumpida'))
    await act(async () => write.resolve({ event_id: 'saved' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(vi.mocked(api.recordCycleFact).mock.calls[1][0].requestId).toBe(requestId)
    await screen.findByText(/La vista necesita actualizarse/)
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(api.recordCycleFact).toHaveBeenCalledTimes(2)
  })

  it('opens same-route form links immediately and consumes them so cancel does not reopen', async () => {
    mount({ pathname: '/cycle/cycle', hash: '#cycle-attention', state: { aiAction: 'evaluate_support' } })
    await screen.findByRole('dialog')
    expect((dialog().getByLabelText('Qué requiere seguimiento') as HTMLSelectElement).value).toBe('evaluate_support')
    fireEvent.click(dialog().getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Enlace al formulario' }))
    await screen.findByRole('dialog'); expect(dialog().getByLabelText('Qué confirmé')).toBeTruthy()
    fireEvent.click(dialog().getByRole('button', { name: 'Cancelar' }))
    noDomainWrites()
  })

  it('creates a follow-up with chosen purpose and date, then completes only a cycle-scoped evaluation', async () => {
    vi.mocked(api.getAttention).mockResolvedValue([task('ours'), task('elsewhere', 'another')])
    mount(); await open('Algo para revisar después')
    fireEvent.change(dialog().getByLabelText('Qué requiere seguimiento'), { target: { value: 'evaluate_pruning' } })
    fireEvent.change(dialog().getByLabelText(/Fecha prevista/), { target: { value: '2026-09-18' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Crear seguimiento' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.createAttentionItem).toHaveBeenCalledWith(expect.objectContaining({ growCycleId: 'cycle', purpose: 'evaluate_pruning', dueOn: '2026-09-18' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    fireEvent.click(await screen.findByRole('button', { name: /Revisar poda ours/ }))
    expect(screen.queryByText('Revisar poda elsewhere')).toBeNull()
    fireEvent.click(dialog().getByRole('button', { name: 'Guardar evaluación' }))
    fireEvent.click(dialog().getByLabelText('Todavía no'))
    fireEvent.click(dialog().getByRole('button', { name: 'Confirmar y completar' }))
    await waitFor(() => expect(api.completeAttentionItem).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'ours', reviewResult: 'not_yet' })))
    expect(api.recordCycleFact).not.toHaveBeenCalled(); expect(api.recordHarvest).not.toHaveBeenCalled()
  })

  it('shows follow-up read failure rather than an empty state and can retry', async () => {
    vi.mocked(api.getAttention).mockRejectedValueOnce(new Error('Network')).mockResolvedValueOnce([task('ours')])
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Revisar' }))
    await screen.findByText(/No se pudieron cargar los seguimientos/)
    expect(screen.queryByText('Esta planta no tiene seguimientos abiertos.')).toBeNull()
    fireEvent.click(dialog().getByRole('button', { name: 'Reintentar' }))
    await screen.findByRole('button', { name: /Revisar poda ours/ })
    noDomainWrites()
  })

  it.each(['occupied', 'empty'])('moves into a %s position using the original operation and revision', async occupancy => {
    vi.mocked(api.getGarden).mockResolvedValue({ positions: [{ id: 'pos-a', position_number: 1, current_cycle: cycle }, { id: 'pos-b', position_number: 2, current_cycle: occupancy === 'occupied' ? { ...base, id: 'other', crop_name: 'Chives' } : null }] } as GardenDetail)
    mount(); await open('Algo que hice'); fireEvent.click(dialog().getByRole('button', { name: 'Trasladar' }))
    await screen.findByRole('option', { name: new RegExp(occupancy === 'occupied' ? 'Ocupada' : 'Vacía') })
    fireEvent.change(dialog().getByLabelText('Nueva posición'), { target: { value: 'pos-b' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Confirmar cambio' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.moveCycle).toHaveBeenCalledWith(expect.objectContaining({ growCycleId: 'cycle', expectedRevision: 3, targetPositionId: 'pos-b' }))
  })

  it('navigates only to the replacement cycle returned by the operation', async () => {
    vi.mocked(api.replaceCycle).mockResolvedValue({ grow_cycle_id: 'next' })
    mount(); await open('Algo que hice'); fireEvent.click(dialog().getByRole('button', { name: 'Reemplazar / resembrar' }))
    fireEvent.change(dialog().getByLabelText('Nuevo cultivo'), { target: { value: 'Otro cultivo' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Confirmar cambio' }))
    await screen.findByRole('heading', { name: 'Otro cultivo', level: 1 })
    expect(screen.getByLabelText('Ruta actual').textContent).toBe('/cycle/next')
    expect(api.replaceCycle).toHaveBeenCalledWith(expect.objectContaining({ growCycleId: 'cycle', expectedRevision: 3 }))
  })

  it('closed cycles retain history and explicit reopening, with no active record entry', async () => {
    cycle.state = 'closed'
    mount('/cycle/cycle#cycle-fact'); await screen.findByRole('heading', { name: 'Albahaca genovesa' })
    expect(screen.queryByRole('button', { name: 'Registrar un momento' })).toBeNull()
    expect((screen.getByRole('button', { name: 'Registrar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Opciones de la planta' }))
    fireEvent.click(dialog().getByRole('button', { name: 'Operaciones de la planta' }))
    fireEvent.click(dialog().getByRole('button', { name: 'Solicitar reapertura' }))
    fireEvent.change(dialog().getByLabelText('Motivo'), { target: { value: 'La posición está vacía.' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Confirmar cambio' }))
    await waitFor(() => expect(api.reopenCycle).toHaveBeenCalledWith(expect.objectContaining({ growCycleId: 'cycle', expectedRevision: 3 })))
    expect(api.recordCycleFact).not.toHaveBeenCalled()
  })

  it('retains an unsaved photo and note through AI action cancellation, then saves once', async () => {
    mount(); await open('Una observación')
    fireEvent.change(dialog().getByLabelText('Lo que observas'), { target: { value: 'Mi nota pendiente.' } })
    fireEvent.change(dialog().getByLabelText(/Elegir foto/), { target: { files: [new File(['test'], 'new.jpg', { type: 'image/jpeg' })] } })
    fireEvent.click(dialog().getByRole('button', { name: 'Analizar con Garden AI' }))
    await screen.findByText(proposal.summary)
    expect(saveObservationDraft).not.toHaveBeenCalled(); noDomainWrites()
    fireEvent.click(dialog().getByRole('button', { name: 'Evaluar aclareo' }))
    fireEvent.click(dialog().getByRole('button', { name: 'Cancelar' }))
    expect((dialog().getByLabelText('Lo que observas') as HTMLTextAreaElement).value).toBe('Mi nota pendiente.')
    expect(dialog().getByAltText('Vista previa de la fotografía que guardarás')).toBeTruthy()
    fireEvent.click(dialog().getByRole('button', { name: 'Cerrar análisis' }))
    fireEvent.click(dialog().getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(saveObservationDraft).toHaveBeenCalledTimes(1); expect(syncObservationDraft).toHaveBeenCalledTimes(1)
    expect(saveObservationDraft).toHaveBeenCalledWith(expect.objectContaining({ growCycleId: 'cycle', note: 'Mi nota pendiente.', photo: expect.any(Blob) }))
    expect(api.createAttentionItem).not.toHaveBeenCalled()
  })

  it('queues an observation offline without treating its photo as confirmed remote evidence', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    mount(); await open('Una observación')
    fireEvent.change(dialog().getByLabelText('Lo que observas'), { target: { value: 'Nota sin conexión.' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Guardar' }))
    await screen.findByText('Pendiente de subir: se guardó en este dispositivo.')
    expect(syncObservationDraft).not.toHaveBeenCalled(); noDomainWrites()
    expect(saveObservationDraft).toHaveBeenCalledWith(expect.objectContaining({ status: 'queued', note: 'Nota sin conexión.' }))
    fireEvent.click(dialog().getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByText('0')).toBeTruthy()
  })

  it('retries an interrupted syncing draft but never automatically sends a conflict', async () => {
    const pending: ObservationDraft = { id: 'interrupted', requestId: 'same-request', growCycleId: 'cycle', note: 'Observación pendiente.', status: 'syncing', createdAt: '2026-09-10T17:00:00Z' }
    const conflict: ObservationDraft = { ...pending, id: 'conflict', status: 'needs_review' }
    vi.mocked(getObservationDrafts).mockResolvedValueOnce([pending, conflict]).mockResolvedValue([conflict])
    mount()
    await waitFor(() => expect(syncObservationDraft).toHaveBeenCalledExactlyOnceWith(pending))
    await screen.findByText(/Revisar conflicto: 1 observación/)
    fireEvent(window, new Event('online'))
    expect(syncObservationDraft).toHaveBeenCalledTimes(1)
    expect(api.recordCycleFact).not.toHaveBeenCalled()
  })

  it('keeps pending-original recovery accessible from the history detail', async () => {
    cycle.history[0].photo = { ...photo('pending'), upload_status: 'failed' }
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Ver el registro' }))
    fireEvent.change(dialog().getByLabelText('Seleccionar el original'), { target: { files: [new File(['test'], 'original.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(api.retryPendingPhoto).toHaveBeenCalledWith(expect.objectContaining({ id: 'pending', upload_status: 'failed' }), expect.any(File)))
    expect(api.recordCycleFact).not.toHaveBeenCalled()
  })

  it.each(['harvest', 'close', 'correct'])('retains the real %s operation and canonical revision', async action => {
    mount(); await open('Algo que hice')
    fireEvent.click(dialog().getByRole('button', { name: action === 'harvest' ? 'Cosechar' : action === 'close' ? 'Cerrar ciclo' : 'Corregir siembra' }))
    if (action === 'correct') fireEvent.change(dialog().getByLabelText('Motivo de la corrección'), { target: { value: 'Fecha confirmada.' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Confirmar cambio' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(action === 'harvest' ? api.recordHarvest : action === 'close' ? api.closeCycle : api.correctCyclePlanting).toHaveBeenCalledWith(expect.objectContaining({ growCycleId: 'cycle', expectedRevision: 3 }))
    expect(api.recordCycleFact).not.toHaveBeenCalled()
  })

  it('returns to the photograph after saving an AI-proposed follow-up without saving the photo', async () => {
    mount(); await open('Una observación')
    fireEvent.change(dialog().getByLabelText('Lo que observas'), { target: { value: 'Nota conservada.' } })
    fireEvent.change(dialog().getByLabelText(/Elegir foto/), { target: { files: [new File(['test'], 'new.jpg', { type: 'image/jpeg' })] } })
    fireEvent.click(dialog().getByRole('button', { name: 'Analizar con Garden AI' }))
    await screen.findByText(proposal.summary)
    fireEvent.click(dialog().getByRole('button', { name: 'Evaluar aclareo' }))
    fireEvent.click(dialog().getByRole('button', { name: 'Crear seguimiento' }))
    await waitFor(() => expect((dialog().getByLabelText('Lo que observas') as HTMLTextAreaElement).value).toBe('Nota conservada.'))
    expect(dialog().getByAltText('Vista previa de la fotografía que guardarás')).toBeTruthy()
    expect(api.createAttentionItem).toHaveBeenCalledTimes(1)
    expect(saveObservationDraft).not.toHaveBeenCalled(); expect(syncObservationDraft).not.toHaveBeenCalled()
  })

  it('does not navigate back when an old replacement resolves after leaving its cycle', async () => {
    const late = deferred<{ grow_cycle_id: string }>()
    vi.mocked(api.replaceCycle).mockImplementation(() => late.promise)
    mount(); await open('Algo que hice'); fireEvent.click(dialog().getByRole('button', { name: 'Reemplazar / resembrar' }))
    fireEvent.change(dialog().getByLabelText('Nuevo cultivo'), { target: { value: 'Nuevo cultivo' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Confirmar cambio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Otro ciclo' }))
    await screen.findByRole('heading', { name: 'Otro cultivo' })
    await act(async () => late.resolve({ grow_cycle_id: 'old-successor' }))
    expect(screen.getByLabelText('Ruta actual').textContent).toBe('/cycle/next')
    expect(api.replaceCycle).toHaveBeenCalledTimes(1)
  })

  it('analyzes a stored photo only explicitly, opens the real suggested form without reload, and ignores late results from another selection', async () => {
    cycle.history = [{ ...event('a'), photo: photo('a') }, { ...event('b'), photo: photo('b') }]
    const late = deferred<GardenAiCheckProposalV1>()
    vi.mocked(requestAiCheck).mockImplementationOnce(() => late.promise).mockResolvedValueOnce(proposal)
    mount(); fireEvent.click(await screen.findByRole('button', { name: /Une? segunda mirada|Una segunda mirada/ }))
    fireEvent.click(dialog().getByRole('button', { name: 'Analizar con Garden AI' }))
    fireEvent.change(dialog().getByLabelText('Fotografía a analizar'), { target: { value: 'b' } })
    await act(async () => late.resolve({ ...proposal, summary: 'Respuesta antigua.' }))
    expect(screen.queryByText('Respuesta antigua.')).toBeNull()
    fireEvent.click(dialog().getByRole('button', { name: 'Analizar con Garden AI' }))
    await screen.findByText(proposal.summary)
    fireEvent.click(dialog().getByRole('button', { name: 'Evaluar aclareo' }))
    expect(dialog().getByLabelText('Qué requiere seguimiento')).toBeTruthy()
    noDomainWrites(); expect(api.getCycle).toHaveBeenCalledTimes(1)
  })

  it('changes the selected cover and preserves it after a fresh read, without an upload', async () => {
    cycle.cover_photo = photo('cover-a'); cycle.history[0].photo = photo('cover-b')
    vi.mocked(api.setCycleCover).mockImplementation(async () => { cycle.cover_photo = photo('cover-b') })
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Ver el registro' }))
    fireEvent.click(dialog().getByRole('button', { name: 'Usar como portada' }))
    fireEvent.click(dialog().getByRole('menuitem', { name: 'Portada de la planta' }))
    await waitFor(() => expect(api.getCycle).toHaveBeenCalledTimes(2))
    fireEvent.click(dialog().getByRole('button', { name: 'Cerrar' }))
    await screen.findByRole('button', { name: 'Abrir fotografía cover-b.jpg' })
    expect(api.setCycleCover).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ photoId: 'cover-b', growCycleId: 'cycle' }))
    expect(saveObservationDraft).not.toHaveBeenCalled()
  })

  it('paginates ten records and retains typed details, corrections and photo-only provenance', async () => {
    cycle.history = Array.from({ length: 23 }, (_, i) => event(`e-${i}`, i === 0 ? 'photo_evidence' : 'observation', `Nota ${i}`))
    cycle.history[0].photo = photo('historic')
    cycle.corrections = [{ id: 'correction', operation: 'planting_corrected', reason: 'Fecha corregida.', revision: 2, created_at: '2026-09-10T17:00:00Z' }]
    mount(); fireEvent.click(await screen.findByRole('tab', { name: /Su historia/ }))
    expect(screen.queryByText('Nota 10')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver 10 más' })); expect(screen.getByText('Nota 19')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar menos' })); expect(screen.queryByText('Nota 10')).toBeNull()
    expect(screen.getByText('Fecha corregida.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Nota 0/ }))
    expect(dialog().getByText('Evidencia fotográfica histórica')).toBeTruthy()
    expect(dialog().queryByRole('button', { name: 'Invalidar registro' })).toBeNull()
    fireEvent.click(dialog().getByRole('button', { name: 'Cerrar' }))
    fireEvent.click(screen.getByRole('button', { name: /Nota 1$/ }))
    fireEvent.click(dialog().getByRole('button', { name: 'Invalidar registro' }))
    fireEvent.change(dialog().getByLabelText('Motivo de la invalidación'), { target: { value: 'Registro incorrecto.' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Invalidar registro' }))
    await waitFor(() => expect(api.invalidateEvent).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e-1', expectedRevision: 1 })))
  })

  it('does not let a stale cycle load replace the next cycle data', async () => {
    const late = deferred<GrowCycleDetail>()
    vi.mocked(api.getCycle).mockImplementationOnce(() => late.promise)
    mount(); fireEvent.click(screen.getByRole('button', { name: 'Otro ciclo' }))
    await screen.findByRole('heading', { name: 'Otro cultivo' })
    await act(async () => late.resolve(base))
    expect(screen.queryByRole('heading', { name: 'Albahaca genovesa' })).toBeNull()
    noDomainWrites()
  })
})

describe('Planta deterministic projection and boundaries', () => {
  it('deduplicates available photos, preserves cover and ignores pending media as uploaded', () => {
    cycle.cover_photo = photo('chosen')
    cycle.history = [{ ...event('a'), photo: photo('chosen') }, { ...event('b'), photo: { ...photo('pending'), upload_status: 'pending' } }]
    expect(plantPresentation(cycle).photos.map(p => p.id)).toEqual(['chosen'])
    expect(plantPresentation(cycle).portrait?.id).toBe('chosen')
  })
  it('keeps unknown cultivar names and date uncertainty without guessing age or health', () => {
    cycle.crop_name = 'Genovese Basil experimental hybrid'
    cycle.history = [event('review', 'visual_review', 'Evaluación')]
    cycle.planted_on_precision = 'unknown'
    const presentation = plantPresentation(cycle)
    expect(presentation.name.common).toBe(cycle.crop_name)
    expect(presentation.name.subtitle).toBe('Nombre botánico sin confirmar')
    expect(presentation.observation).toBeNull(); expect(presentation.planting.value).toBe('Sin fecha')
    cycle.planted_on_precision = 'approximate'
    expect(plantingSummary(cycle, new Date('2026-09-10T12:00:00')).value).toBe('≈ 40')
    cycle.state = 'closed'
    expect(plantingSummary(cycle, new Date('2027-09-10T12:00:00')).unit).toBe('')
  })
  it('rejects canonical AI contexts from another cycle and unknown link actions', () => {
    expect(plantAiIntent({ kind: 'record_incident', label: 'Registrar incidencia', context: { growCycleId: 'another', gardenId: 'garden', positionId: 'pos-a', evidenceRef: { kind: 'photo', id: 'p' } } }, cycle)).toBeNull()
    expect(plantArrivalIntent('', 'made-up-operation', cycle)).toBeNull()
  })
})
