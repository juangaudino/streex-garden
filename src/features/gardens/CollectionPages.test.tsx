// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import type { HomeDashboard, PhotoEvidence } from '../../domain/types'
import * as api from '../../lib/garden-api'
import { homeVisitStorageKey } from '../../domain/home-visit'
import { HomePage } from './HomePage'
import { GardensPage } from './GardensPage'

vi.mock('../../lib/garden-api', () => ({
  getHome: vi.fn(), getHomeDashboard: vi.fn(), getHomeMedia: vi.fn(), getGardenCoverPhotos: vi.fn(), getSignedPhotoUrl: vi.fn(),
  acknowledgeHomeSnapshot: vi.fn(), getOpenMaintenanceSession: vi.fn(), startMaintenanceSession: vi.fn(), setMaintenanceSessionState: vi.fn(), createGarden: vi.fn(), signOut: vi.fn(),
}))
vi.mock('../../components/PwaUpdateNotice', () => ({ PwaUpdateNotice: () => null }))
vi.mock('../../lib/offline-observation-store', () => ({ getObservationDrafts: vi.fn(async () => []), clearObservationDrafts: vi.fn() }))

const user = { id: '11111111-1111-4111-8111-111111111111' } as User
const visitId = '22222222-2222-4222-8222-222222222222'
const photo: PhotoEvidence = { id: 'cover', storage_path: 'synthetic-cover', original_filename: 'synthetic.png', content_type: 'image/png', byte_size: 1, checksum_sha256: null, captured_at: null, captured_at_precision: 'unknown', upload_status: 'uploaded' }
let dashboard: HomeDashboard
let frames: FrameRequestCallback[]
function Destination() { return <p>Destino: {useLocation().pathname}</p> }
function show(page: 'home' | 'gardens') {
  return render(<MemoryRouter initialEntries={[page === 'home' ? '/' : '/gardens']}><Routes><Route path="/" element={<HomePage user={user} />} /><Route path="/gardens" element={<GardensPage user={user} />} /><Route path="*" element={<Destination />} /></Routes></MemoryRouter>)
}
function section(id: string) { return document.querySelector<HTMLElement>(`[aria-labelledby="${id}"]`)! }
function noOperations() {
  expect(api.createGarden).not.toHaveBeenCalled()
  expect(api.startMaintenanceSession).not.toHaveBeenCalled()
  expect(api.setMaintenanceSessionState).not.toHaveBeenCalled()
}
beforeEach(() => {
  vi.resetAllMocks(); window.localStorage.clear(); window.sessionStorage.clear(); window.sessionStorage.setItem('streex-garden-entry-seen', '1')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  frames = []; vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.push(fn); return frames.length }); vi.stubGlobal('cancelAnimationFrame', vi.fn())
  dashboard = {
    visit: { id: visitId, base_cursor: 1, snapshot_cursor: 9, snapshot_at: '2026-09-13T12:00:00Z', first_visit: false, visit_gap_minutes: 30 },
    gardens: [{ id: 'garden-a', name: 'Jardín de la ventana', system_model: 'URUQ', position_capacity: 8, map_layout: 'uruq_8_v1', active_positions: 3, cover_photo: photo }, { id: 'garden-b', name: 'Otro jardín', system_model: null, position_capacity: 12, map_layout: 'uruq_12_v1', active_positions: 4 }],
    since_last_time: { changes: Array.from({ length: 4 }, (_, i) => ({ cursor: i + 2, kind: 'event', garden_id: i === 1 ? 'garden-a' : null, grow_cycle_id: i === 0 ? 'cycle-a' : null, occurred_at: '2026-09-13T12:00:00Z', committed_at: '2026-09-13T12:00:00Z', summary: `Hecho confirmado ${i}` })) },
    attention: { items: [{ id: 'task-a', garden_id: 'garden-a', garden_name: 'Jardín de la ventana', grow_cycle_id: 'cycle-a', crop_name: 'Basil', position_number: 1, purpose: 'evaluate_pruning', title: 'Evaluar poda', subject_key: 'general', origin: 'manual', due_on: '2099-01-01', next_review_on: null, created_at: '2026-09-13T12:00:00Z' }, { id: 'task-b', garden_id: 'garden-b', grow_cycle_id: null, purpose: 'perform_nutrients', title: 'Aplicar nutrientes', subject_key: 'general', origin: 'manual', due_on: null, next_review_on: null, created_at: '2026-09-13T12:00:00Z' }] },
  }
  vi.mocked(api.getHomeDashboard).mockImplementation(async () => structuredClone(dashboard))
  vi.mocked(api.getHome).mockImplementation(async () => structuredClone(dashboard.gardens))
  vi.mocked(api.getHomeMedia).mockResolvedValue({ home_headline: 'El jardín que cuidas cada día', home_hero_photo: photo, home_hero_choices: [] })
  vi.mocked(api.getGardenCoverPhotos).mockResolvedValue([]); vi.mocked(api.getSignedPhotoUrl).mockResolvedValue('data:image/png;base64,AA==')
  vi.mocked(api.getOpenMaintenanceSession).mockResolvedValue(null); vi.mocked(api.acknowledgeHomeSnapshot).mockResolvedValue()
  vi.mocked(api.startMaintenanceSession).mockResolvedValue({ session_id: 'session-new' }); vi.mocked(api.setMaintenanceSessionState).mockResolvedValue()
  vi.mocked(api.createGarden).mockResolvedValue({ garden_id: 'garden-new' })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Home collection integration', () => {
  it('preserves media, occupancy, card routes and all attention while limiting changes to three', async () => {
    show('home'); await screen.findByRole('heading', { name: 'El jardín que cuidas cada día' })
    expect(api.getHomeDashboard).toHaveBeenCalledWith(null)
    expect(api.getGardenCoverPhotos).toHaveBeenCalledTimes(2)
    expect(api.getSignedPhotoUrl).toHaveBeenCalledWith(photo.storage_path, 'hero')
    expect(within(section('home-gardens')).getByRole('link', { name: /Jardín de la ventana/ }).getAttribute('href')).toBe('/garden/garden-a')
    expect(screen.getByText('3 activas · 8 posiciones')).toBeTruthy()
    const changes = within(section('home-changes'))
    expect(changes.getAllByRole('link')).toHaveLength(3)
    expect(changes.getByRole('link', { name: 'Hecho confirmado 0' }).getAttribute('href')).toBe('/cycle/cycle-a')
    expect(changes.getByRole('link', { name: 'Hecho confirmado 1' }).getAttribute('href')).toBe('/garden/garden-a')
    expect(changes.getByRole('link', { name: 'Hecho confirmado 2' }).getAttribute('href')).toBe('/gardens')
    expect(screen.queryByText('Hecho confirmado 3')).toBeNull()
    expect(within(section('home-attention')).getByText(/Programada:/)).toBeTruthy()
    expect(within(section('home-attention')).getByText(/Sin fecha/)).toBeTruthy()
    expect(api.acknowledgeHomeSnapshot).not.toHaveBeenCalled(); noOperations()
  })
  it('offers the catalog when empty without implying health or creating data', async () => {
    dashboard.gardens = []; dashboard.since_last_time.changes = []; dashboard.attention.items = []
    show('home'); await screen.findByRole('heading', { name: 'Tu jardín empieza aquí' })
    fireEvent.click(within(section('home-gardens')).getByRole('link', { name: 'Ver jardines' }))
    await screen.findByRole('heading', { name: 'Tus jardines' }); noOperations()
  })
  it('keeps loading/error/retry and restores content after a failed read', async () => {
    vi.mocked(api.getHomeDashboard).mockRejectedValueOnce(new Error('Lectura fallida'))
    show('home'); expect(screen.getByText('Preparando Home')).toBeTruthy()
    await screen.findByText('Lectura fallida'); fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByRole('heading', { name: 'El jardín que cuidas cada día' }); noOperations()
  })
})

describe('Gardens collection contracts', () => {
  it('reuses the valid owner visit and only acknowledges online content after the scheduled frame', async () => {
    window.localStorage.setItem(homeVisitStorageKey(user.id), visitId)
    show('gardens'); await screen.findByRole('heading', { name: 'Jardín de la ventana' })
    expect(api.getHomeDashboard).toHaveBeenCalledWith(visitId)
    expect(api.acknowledgeHomeSnapshot).not.toHaveBeenCalled()
    await act(async () => { frames.forEach(fn => fn(1)) })
    expect(api.acknowledgeHomeSnapshot).toHaveBeenCalledWith(visitId, 9)
    expect(JSON.parse(window.localStorage.getItem(`${homeVisitStorageKey(user.id)}:snapshot`)!).visit.snapshot_cursor).toBe(9)
    expect(within(section('since-last-time')).getAllByText(/Hecho confirmado/)).toHaveLength(4)
    expect(screen.getByText('Sistema sin especificar')).toBeTruthy(); noOperations()
  })
  it('rejects an invalid visit ID without borrowing another owner snapshot', async () => {
    window.localStorage.setItem(homeVisitStorageKey(user.id), 'invalid')
    window.localStorage.setItem('streex-garden:home-visit:another-owner:snapshot', JSON.stringify(dashboard))
    vi.mocked(api.getHomeDashboard).mockRejectedValue(new Error('Sin conexión al servicio'))
    show('gardens'); await screen.findByText('Sin conexión al servicio')
    expect(api.getHomeDashboard).toHaveBeenCalledWith(null)
    expect(screen.queryByRole('heading', { name: 'Jardín de la ventana' })).toBeNull()
  })
  it('renders cached content and timestamp without acknowledging or starting a session', async () => {
    window.localStorage.setItem(`${homeVisitStorageKey(user.id)}:snapshot`, JSON.stringify(dashboard))
    vi.mocked(api.getHomeDashboard).mockRejectedValue(new Error('Offline'))
    show('gardens'); await screen.findByText(/Mostrando la última instantánea guardada/)
    await act(async () => { frames.forEach(fn => fn(1)) })
    expect(api.acknowledgeHomeSnapshot).not.toHaveBeenCalled(); noOperations()
  })
  it('preserves first-visit and no-change states instead of invented health conclusions', async () => {
    dashboard.visit.first_visit = true; show('gardens')
    await screen.findByRole('heading', { name: 'Tu primera vista' })
    expect(screen.queryByText('Hecho confirmado 0')).toBeNull(); cleanup()
    dashboard.visit.first_visit = false; dashboard.since_last_time.changes = []
    show('gardens'); await screen.findByRole('heading', { name: 'No hay cambios registrados' }); noOperations()
  })
  it.each([8, 12, 6])('creates a garden of capacity %i through the unchanged form and navigates to its ID', async capacity => {
    show('gardens'); await screen.findByRole('heading', { name: 'Jardín de la ventana' })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir jardín' }))
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nuevo jardín' } })
    if (capacity === 12) fireEvent.click(screen.getByLabelText('URUQ de 12 posiciones'))
    if (capacity === 6) { fireEvent.click(screen.getByLabelText('Otro sistema / mapa personalizado')); expect(screen.getByLabelText('Espacios iniciales de cultivo').getAttribute('max')).toBe('36') }
    fireEvent.click(screen.getByRole('button', { name: 'Crear jardín' }))
    await screen.findByText('Destino: /garden/garden-new')
    expect(api.createGarden).toHaveBeenCalledWith({ requestId: expect.any(String), name: 'Nuevo jardín', systemModel: 'URUQ', positionCapacity: capacity })
    expect(api.createGarden).toHaveBeenCalledTimes(1)
  })
  it('cancels creation before submission without a write', async () => {
    dashboard.gardens = []; show('gardens'); await screen.findByRole('heading', { name: 'Empieza con tu primer jardín' })
    fireEvent.click(screen.getByRole('button', { name: 'Crear primer jardín' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByLabelText('Nombre')).toBeNull(); noOperations()
  })
  it('starts only the selected gardens and disables an empty selection', async () => {
    show('gardens'); await screen.findByRole('heading', { name: 'Jardín de la ventana' })
    fireEvent.click(screen.getByRole('button', { name: 'Mantenimiento' }))
    fireEvent.click(screen.getByLabelText('Otro jardín')); fireEvent.click(screen.getByLabelText('Jardín de la ventana'))
    expect((screen.getByRole('button', { name: 'Iniciar recorrido' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Jardín de la ventana')); fireEvent.click(screen.getByRole('button', { name: 'Iniciar recorrido' }))
    await screen.findByText('Destino: /maintenance/session-new')
    expect(api.startMaintenanceSession).toHaveBeenCalledWith(expect.any(String), ['garden-a'])
  })
  it('blocks starting offline and cancellation of selection does not write', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    show('gardens'); await screen.findByRole('heading', { name: 'Jardín de la ventana' })
    fireEvent.click(screen.getByRole('button', { name: 'Mantenimiento' }))
    expect((screen.getByRole('button', { name: 'Iniciar recorrido' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })); noOperations()
  })
  it('resumes an existing session without creating a second one', async () => {
    vi.mocked(api.getOpenMaintenanceSession).mockResolvedValue({ id: 'session-open', state: 'paused', started_at: '2026-09-13T12:00:00Z' })
    show('gardens'); fireEvent.click(await screen.findByRole('link', { name: 'Reanudar recorrido' }))
    await screen.findByText('Destino: /maintenance/session-open'); noOperations()
  })
  it('abandons only after confirmation, preserving the existing state operation', async () => {
    vi.mocked(api.getOpenMaintenanceSession).mockResolvedValue({ id: 'session-open', state: 'in_progress', started_at: '2026-09-13T12:00:00Z' })
    show('gardens'); fireEvent.click(await screen.findByRole('button', { name: 'Cancelar recorrido' }))
    noOperations(); fireEvent.click(screen.getByRole('button', { name: 'Volver' })); noOperations()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar recorrido' })); fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar recorrido' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Reanudar recorrido' })).toBeNull())
    expect(api.setMaintenanceSessionState).toHaveBeenCalledWith(expect.any(String), 'session-open', 'abandoned')
    expect(api.startMaintenanceSession).not.toHaveBeenCalled()
  })
  it('shows an operation error while preserving the catalog', async () => {
    vi.mocked(api.startMaintenanceSession).mockRejectedValue(new Error('Inicio fallido'))
    show('gardens'); await screen.findByRole('heading', { name: 'Jardín de la ventana' })
    fireEvent.click(screen.getByRole('button', { name: 'Mantenimiento' })); fireEvent.click(screen.getByRole('button', { name: 'Iniciar recorrido' }))
    await screen.findByText('Inicio fallido'); expect(screen.getByRole('heading', { name: 'Jardín de la ventana' })).toBeTruthy()
  })
})
