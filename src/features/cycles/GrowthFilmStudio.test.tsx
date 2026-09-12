// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { CycleHistoryEvent, GardenDetail, GrowCycleDetail } from '../../domain/types'
import * as api from '../../lib/garden-api'
import { buildFilmCatalogue, type FilmComposition } from './growth-film-composition'
import { downloadFilmArtifact, renderGrowthFilm, type FilmArtifact } from './growth-film-export'
import { GrowthFilmPage } from './GrowthFilmPage'
import { GrowthFilmClipEditor } from './GrowthFilmClipEditor'

vi.mock('../../lib/garden-api', () => ({ getCycle: vi.fn(), getGarden: vi.fn(), getSignedPhotoUrl: vi.fn(), recordCycleFact: vi.fn(), createAttentionItem: vi.fn(), recordHarvest: vi.fn(), moveCycle: vi.fn() }))
vi.mock('./growth-film-export', () => ({ renderGrowthFilm: vi.fn(), downloadFilmArtifact: vi.fn() }))

function cycle(count = 3, id = 'c'): GrowCycleDetail {
  const history: CycleHistoryEvent[] = Array.from({ length: count }, (_, index) => ({
    id: `e${index}`, event_type: 'photo_evidence', occurred_at: null as unknown as string, occurred_at_precision: 'date', revision: 1,
    note: index === 0 ? 'Referencia original.' : null, event_data: { source: 'historical_photo' },
    photo: { id: `p${index}`, storage_path: `${id}/p${index}.jpg`, original_filename: `photo-${index}.jpg`, content_type: 'image/jpeg', byte_size: 10, checksum_sha256: null, captured_at: null, captured_at_precision: 'unknown', upload_status: 'uploaded' },
  }))
  return { id, crop_name: 'Cilantro', garden: { id: 'g', name: 'Garden 1' }, position: { id: 'pos', position_number: 5 }, state: 'active', revision: 1, history, corrections: [], planted_on: null, planted_on_precision: 'unknown', harvest_readiness: 'not_yet' }
}
const catalogue = (count = 3) => buildFilmCatalogue({ kind: 'cycle', id: 'c', title: 'Cilantro' }, [cycle(count)])
const mountRoute = (path = '/cycle/c/film') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/cycle/:cycleId/film" element={<GrowthFilmPage />} /><Route path="/garden/:gardenId/film" element={<GrowthFilmPage />} /></Routes></MemoryRouter>)
const button = (name: string | RegExp) => screen.getByRole('button', { name })
let artifacts: FilmArtifact[]
beforeEach(() => {
  vi.resetAllMocks()
  artifacts = []
  vi.mocked(api.getCycle).mockImplementation(async id => cycle(3, id))
  vi.mocked(api.getSignedPhotoUrl).mockImplementation(async path => `https://photos.example/${path}`)
  vi.mocked(renderGrowthFilm).mockImplementation(async plan => {
    const artifact: FilmArtifact = { compositionKey: plan.key, url: `blob:final-${artifacts.length}`, blob: new Blob(['video']), mimeType: 'video/mp4', durationMs: plan.durationMs, dispose: vi.fn() }
    artifacts.push(artifact); return artifact
  })
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) })
  Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: vi.fn().mockResolvedValue(undefined) })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: vi.fn() })
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute('open') } })
})
afterEach(() => {
  cleanup()
  expect(api.recordCycleFact).not.toHaveBeenCalled()
  expect(api.createAttentionItem).not.toHaveBeenCalled()
  expect(api.recordHarvest).not.toHaveBeenCalled()
  expect(api.moveCycle).not.toHaveBeenCalled()
})

describe('Real Growth Film route and editor integration', () => {
  it('opens evidence without background rendering and keeps every diary moment', async () => {
    vi.mocked(api.getCycle).mockResolvedValue(cycle(15))
    mountRoute()
    await screen.findByRole('heading', { name: 'El diario de Cilantro.' })
    expect(within(screen.getByLabelText('Todos los momentos del diario')).getAllByRole('button')).toHaveLength(15)
    expect(renderGrowthFilm).not.toHaveBeenCalled()
    fireEvent.click(button('Ver origen del momento'))
    expect(within(screen.getByRole('dialog')).getByText('Referencia original.')).toBeTruthy()
    expect(screen.getByText('Evidencia fotográfica')).toBeTruthy()
    expect(screen.getByText('Sin fecha confirmada')).toBeTruthy()
  })

  it('downloads the displayed artifact, then invalidates it when visible options change', async () => {
    render(<GrowthFilmClipEditor catalogue={catalogue()} reducedMotion={false} onClose={vi.fn()} />)
    fireEvent.click(button('Continuar')); fireEvent.click(button('Continuar'))
    expect(button('Descargar clip')).toBeDisabled()
    expect(renderGrowthFilm).not.toHaveBeenCalled()
    fireEvent.click(button('Preparar video'))
    await waitFor(() => expect(screen.getByLabelText('Vista previa del video final')).toHaveAttribute('src', artifacts[0].url))
    const video = screen.getByLabelText('Vista previa del video final')
    Object.defineProperty(video, 'duration', { configurable: true, value: 10.36 })
    fireEvent.loadedMetadata(video)
    expect(screen.getByText('Duración del video')).toBeTruthy()
    expect(screen.getByText('10,4 s')).toBeTruthy()
    fireEvent.click(button('Descargar clip'))
    expect(downloadFilmArtifact).toHaveBeenCalledWith(artifacts[0], 'garden-x-cilantro')
    expect(renderGrowthFilm).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('Incluir títulos y relato'))
    expect(artifacts[0].dispose).toHaveBeenCalledTimes(1)
    expect(screen.queryByLabelText('Vista previa del video final')).toBeNull()
    expect(button('Descargar clip')).toBeDisabled()
    fireEvent.click(button('Preparar video'))
    await waitFor(() => expect(renderGrowthFilm).toHaveBeenCalledTimes(2))
    expect(vi.mocked(renderGrowthFilm).mock.calls[1][0].titles).toBe(false)
  })

  it('preserves selection chronology and the chosen track/volume in the prepared video', async () => {
    render(<GrowthFilmClipEditor catalogue={catalogue()} reducedMotion onClose={vi.fn()} />)
    fireEvent.click(button('Quitar momento 1: Cilantro'))
    fireEvent.click(button('Añadir momento 1: Cilantro'))
    fireEvent.click(button('Continuar'))
    fireEvent.click(screen.getByRole('radio', { name: /Garden · Track 4/ }))
    fireEvent.change(screen.getByRole('slider', { name: /Volumen de la música/ }), { target: { value: '17' } })
    fireEvent.click(button('Continuar')); fireEvent.click(button('Preparar video'))
    await waitFor(() => expect(renderGrowthFilm).toHaveBeenCalledTimes(1))
    expect(vi.mocked(renderGrowthFilm).mock.calls[0][0]).toMatchObject({ music: { id: 'track-4', volume: .17 }, reducedMotion: true, fit: 'contain', titles: true })
    expect(vi.mocked(renderGrowthFilm).mock.calls[0][0].moments.map(moment => moment.id)).toEqual(catalogue().moments.map(moment => moment.id))
  })

  it('aborts a pending render on close and disposes a late result', async () => {
    let resolve!: (value: FilmArtifact) => void
    vi.mocked(renderGrowthFilm).mockImplementation(() => new Promise(yes => { resolve = yes }))
    const onClose = vi.fn()
    const view = render(<GrowthFilmClipEditor catalogue={catalogue()} reducedMotion={false} onClose={onClose} />)
    fireEvent.click(button('Continuar')); fireEvent.click(button('Continuar')); fireEvent.click(button('Preparar video'))
    const [plan, options] = vi.mocked(renderGrowthFilm).mock.calls[0]
    fireEvent.click(button('Cerrar'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(options.signal.aborted).toBe(true)
    view.unmount()
    const late: FilmArtifact = { compositionKey: plan.key, url: 'blob:late', blob: new Blob(), mimeType: 'video/mp4', durationMs: 10, dispose: vi.fn() }
    await act(async () => resolve(late))
    expect(late.dispose).toHaveBeenCalledTimes(1)
  })

  it('prepares the complete diary for native fullscreen only after a tap and video readiness', async () => {
    const native = vi.fn()
    Object.defineProperty(HTMLVideoElement.prototype, 'webkitEnterFullscreen', { configurable: true, value: native })
    vi.mocked(api.getCycle).mockResolvedValue(cycle(15))
    mountRoute()
    fireEvent.click(await screen.findByRole('button', { name: 'Preparar película para pantalla completa' }))
    expect(renderGrowthFilm).not.toHaveBeenCalled()
    fireEvent.click(button('Preparar video'))
    const video = await screen.findByLabelText('Vista previa del video final')
    expect(button('Pantalla completa')).toBeDisabled()
    expect((vi.mocked(renderGrowthFilm).mock.calls[0][0] as FilmComposition).moments).toHaveLength(15)
    Object.defineProperty(video, 'readyState', { configurable: true, value: 2 })
    fireEvent.loadedData(video)
    fireEvent.click(button('Pantalla completa'))
    expect(native).toHaveBeenCalledTimes(1)
    fireEvent(video, new Event('webkitbeginfullscreen'))
    expect(button('En pantalla completa')).toBeDisabled()
    fireEvent(video, new Event('webkitendfullscreen'))
    expect(button('Pantalla completa')).not.toBeDisabled()
    fireEvent.click(button('Cerrar'))
    expect(artifacts[0].dispose).toHaveBeenCalledTimes(1)
  })

  it('loads garden histories once, and keeps moved-out histories accessible separately', async () => {
    vi.mocked(api.getGarden).mockResolvedValue({ id: 'g', name: 'Garden 1', positions: [{ current_cycle: { id: 'c' }, previous_cycles: [{ id: 'old' }, { id: 'moved' }] }] } as GardenDetail)
    vi.mocked(api.getCycle).mockImplementation(async id => ({ ...cycle(2, id), garden: { id: id === 'moved' ? 'other' : 'g', name: 'Garden 1' } }))
    mountRoute('/garden/g/film')
    await screen.findByRole('heading', { name: 'El diario de Garden 1.' })
    expect(api.getCycle).toHaveBeenCalledTimes(3)
    expect(within(screen.getByLabelText('Todos los momentos del diario')).getAllByRole('button')).toHaveLength(4)
    fireEvent.click(screen.getByText('Historias trasladadas a otro jardín'))
    expect(screen.getByRole('link', { name: 'Abrir diario del ciclo trasladado' })).toHaveAttribute('href', '/cycle/moved/film')
    expect(renderGrowthFilm).not.toHaveBeenCalled()
  })

  it('retains the current photo until the next image has decoded, and a later request wins', async () => {
    mountRoute()
    await screen.findByRole('img', { name: /Fotografía real/ })
    let decode!: () => void
    vi.mocked(HTMLImageElement.prototype.decode).mockImplementationOnce(() => new Promise<void>(resolve => { decode = resolve }))
    fireEvent.click(button('Ver momento 3: Cilantro'))
    await waitFor(() => expect(decode).toBeTypeOf('function'))
    expect(screen.getByRole('img', { name: /Fotografía real/ })).toHaveAttribute('src', 'https://photos.example/c/p0.jpg')
    fireEvent.click(button('Ver momento 2: Cilantro'))
    await waitFor(() => expect(screen.getByRole('img', { name: /Fotografía real/ })).toHaveAttribute('src', 'https://photos.example/c/p1.jpg'))
    await act(async () => decode())
    expect(screen.getByRole('img', { name: /Fotografía real/ })).toHaveAttribute('src', 'https://photos.example/c/p1.jpg')
  })

  it('ignores a route read that settles after unmount', async () => {
    let resolve!: (value: GrowCycleDetail) => void
    vi.mocked(api.getCycle).mockImplementation(() => new Promise(yes => { resolve = yes }))
    const view = mountRoute()
    view.unmount()
    await act(async () => resolve(cycle()))
    expect(api.getSignedPhotoUrl).not.toHaveBeenCalled()
    expect(renderGrowthFilm).not.toHaveBeenCalled()
  })
})
