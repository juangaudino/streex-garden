// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DocumentaryPhoto } from './DocumentaryPhoto'
import { MaintenancePortrait } from '../gardens/MaintenancePortrait'
import { MaintenancePage } from '../gardens/MaintenancePage'
import { PhotoGalleryPage } from './PhotoGalleryPage'
import { captureLabel, isToday, storyInterval } from './photo-presentation'
import { getCycle, getSignedPhotoUrl, getMaintenanceSession, progressMaintenancePosition, setGardenCover, setHomeHero } from '../../lib/garden-api'
import type { GrowCycleDetail, MaintenancePosition, MaintenanceSession, PhotoEvidence } from '../../domain/types'

vi.mock('../../lib/garden-api', () => ({ getCycle: vi.fn(), getSignedPhotoUrl: vi.fn(), getMaintenanceSession: vi.fn(), markMaintenancePositionInspected: vi.fn(), progressMaintenancePosition: vi.fn(), setMaintenanceSessionState: vi.fn(), setGardenCover: vi.fn(), setHomeHero: vi.fn() }))
vi.mock('../../components/AppShell', () => ({ AppShell: ({ children, title }: { children: React.ReactNode; title?: string }) => <main><h1>{title}</h1>{children}</main> }))
const photo: PhotoEvidence = { id: 'photo-a', storage_path: 'a', original_filename: 'a.jpeg', content_type: 'image/jpeg', byte_size: 1, checksum_sha256: null, captured_at: null, captured_at_precision: 'unknown', upload_status: 'uploaded' }
const event = { id: 'event', event_type: 'observation' as const, occurred_at: '2026-06-12T00:00:00Z', occurred_at_precision: 'date' as const, occurred_on: '2026-06-12', note: 'Nota completa', revision: 1, photo }
const cycle: GrowCycleDetail = { id: 'cycle-a', crop_name: 'Chives', planted_on: null, planted_on_precision: 'unknown', harvest_readiness: 'not_yet', state: 'active', revision: 1, position: { id: 'place-a', position_number: 7 }, garden: { id: 'garden', name: 'Jardín' }, history: [event], corrections: [] }
const position: MaintenancePosition = { id: 'step-a', garden_id: 'garden', garden_name: 'Jardín', position_id: 'place-a', position_number: 7, captured_grow_cycle_id: 'cycle-a', current_grow_cycle_id: 'cycle-a', crop_name: 'Chives', progress: 'not_reviewed', inspected_at: null, inspection_source: null, health_confirmed: false, ordinal: 1 }
const session: MaintenanceSession = { id: 'session', state: 'in_progress', started_at: '2026-09-07T12:00:00Z', cursor_position: 1, positions: [position] }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getSignedPhotoUrl).mockResolvedValue('/photo-a.jpeg'); vi.mocked(getCycle).mockResolvedValue(cycle); Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) }) })
afterEach(cleanup)

describe('Evidence provenance in presentation', () => {
  it('never treats a populated timestamp with unknown precision as a known capture', () => {
    expect(captureLabel({ ...photo, captured_at: '2026-06-12T12:00:00Z' })).toContain('desconocida')
    expect(storyInterval([event])).toContain('Fechas de los registros:')
    expect(storyInterval([event])).not.toContain('hoy')
    expect(isToday(event, new Date(2026, 5, 12, 18))).toBe(true)
    expect(isToday(event, new Date(2026, 5, 13, 1))).toBe(false)
  })
  it('does not show a previous or late signed URL after evidence changes', async () => {
    let resolveFirst!: (url: string) => void
    vi.mocked(getSignedPhotoUrl).mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve })).mockResolvedValueOnce('/b.jpeg')
    const view = render(<DocumentaryPhoto photo={photo} eager />)
    view.rerender(<DocumentaryPhoto photo={{ ...photo, id: 'b', storage_path: 'b', original_filename: 'b.jpeg' }} eager />)
    await waitFor(() => expect(screen.getByRole('img').getAttribute('src')).toBe('/b.jpeg'))
    await act(async () => resolveFirst('/a.jpeg'))
    expect(screen.getByRole('img').getAttribute('src')).toBe('/b.jpeg')
  })
  it('does not request documentary evidence for a replaced occupant', () => {
    render(<MaintenancePortrait position={{ ...position, current_grow_cycle_id: 'successor' }} />)
    expect(getCycle).not.toHaveBeenCalled()
    expect(screen.getByText('Ocupante cambiado')).toBeTruthy()
  })
  it('does not display a moved cycle as the current plant', async () => {
    vi.mocked(getCycle).mockResolvedValue({ ...cycle, position: { id: 'elsewhere', position_number: 2 } })
    render(<MaintenancePortrait position={position} />)
    await waitFor(() => expect(getCycle).toHaveBeenCalled())
    expect(getSignedPhotoUrl).not.toHaveBeenCalled()
  })
  it('keeps contextual Maintenance actions closed when the captured occupant has changed', async () => {
    vi.mocked(getMaintenanceSession).mockResolvedValue({ ...session, positions: [{ ...position, current_grow_cycle_id: 'successor' }] })
    render(<MemoryRouter initialEntries={['/maintenance/session']}><Routes><Route path="/maintenance/:sessionId" element={<MaintenancePage />} /></Routes></MemoryRouter>)
    expect(await screen.findByText('Ocupante cambiado')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Foto / observación' })).toBeNull()
  })
})
describe('Maintenance confirmed feedback', () => {
  it('does not advance or claim success before remote confirmation or on failure', async () => {
    vi.mocked(getMaintenanceSession).mockResolvedValue(session)
    let reject!: (reason: Error) => void
    vi.mocked(progressMaintenancePosition).mockImplementation(() => new Promise((_, failure) => { reject = failure }))
    render(<MemoryRouter initialEntries={['/maintenance/session']}><Routes><Route path="/maintenance/:sessionId" element={<MaintenancePage />} /></Routes></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Se ve bien' }))
    expect(screen.queryByText(/revisión guardada/)).toBeNull()
    expect(getMaintenanceSession).toHaveBeenCalledTimes(1)
    await act(async () => reject(new Error('Sin conexión')))
    expect(await screen.findByText('Sin conexión')).toBeTruthy()
    expect(screen.queryByText(/revisión guardada/)).toBeNull()
  })
  it('labels skip as omitted without a review', async () => {
    vi.mocked(getMaintenanceSession).mockResolvedValueOnce(session).mockResolvedValue({ ...session, positions: [{ ...position, progress: 'skipped' }] })
    vi.mocked(progressMaintenancePosition).mockResolvedValue()
    render(<MemoryRouter initialEntries={['/maintenance/session']}><Routes><Route path="/maintenance/:sessionId" element={<MaintenancePage />} /></Routes></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Omitir' }))
    expect(await screen.findByText(/omitida, sin revisión/)).toBeTruthy()
    expect(screen.queryByText(/revisión guardada/)).toBeNull()
  })
})
it('shows a one-photo story while keeping comparison unavailable', async () => {
  render(<MemoryRouter initialEntries={['/cycle/cycle-a/photos']}><Routes><Route path="/cycle/:cycleId/photos" element={<PhotoGalleryPage />} /></Routes></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'La historia de tu Chives' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Abrir fotografía a.jpeg' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Comparar fotos' })).toBeNull()
  expect(screen.getByText('Nota completa')).toBeTruthy()
})
it('offers garden and Home cover actions from the photo viewer', async () => {
  vi.mocked(setGardenCover).mockResolvedValue()
  vi.mocked(setHomeHero).mockResolvedValue()
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: vi.fn() })
  render(<MemoryRouter initialEntries={['/cycle/cycle-a/photos']}><Routes><Route path="/cycle/:cycleId/photos" element={<PhotoGalleryPage />} /></Routes></MemoryRouter>)
  fireEvent.click(await screen.findByRole('button', { name: 'Abrir fotografía a.jpeg' }))
  fireEvent.click(screen.getByRole('button', { name: 'Portada del jardín', hidden: true }))
  await waitFor(() => expect(setGardenCover).toHaveBeenCalledWith(expect.objectContaining({ gardenId: 'garden', photoId: 'photo-a' })))
  fireEvent.click(screen.getByRole('button', { name: 'Portada Home', hidden: true }))
  await waitFor(() => expect(setHomeHero).toHaveBeenCalledWith(expect.objectContaining({ photoId: 'photo-a' })))
})
