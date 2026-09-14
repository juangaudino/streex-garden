// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { AppShell } from './AppShell'
import { signOut } from '../lib/garden-api'
import { clearObservationDrafts, getObservationDrafts } from '../lib/offline-observation-store'
import { downloadObservationDrafts } from '../lib/export-download'
import type { ObservationDraft } from '../domain/types'
vi.mock('../lib/garden-api', () => ({ signOut: vi.fn() }))
vi.mock('../lib/offline-observation-store', () => ({ clearObservationDrafts: vi.fn(), getObservationDrafts: vi.fn() }))
vi.mock('../lib/export-download', () => ({ downloadObservationDrafts: vi.fn() }))
vi.mock('./PwaUpdateNotice', () => ({ PwaUpdateNotice: () => null }))
const draft: ObservationDraft = { id: 'draft', growCycleId: 'cycle', requestId: 'request', note: 'Pendiente', createdAt: '2026-09-13T12:00:00Z', status: 'queued' }
function RouteState() { const location = useLocation(); return <output aria-label="Ruta">{location.pathname}</output> }
const mount = (path = '/today') => render(<MemoryRouter initialEntries={[path]}><AppShell><RouteState /></AppShell></MemoryRouter>)
beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.setItem('streex-garden-entry-seen', '1')
  localStorage.clear(); localStorage.setItem('streex-garden:private', 'draft'); localStorage.setItem('other-app', 'keep')
  vi.mocked(getObservationDrafts).mockResolvedValue([draft])
  vi.mocked(signOut).mockResolvedValue(undefined)
  vi.mocked(clearObservationDrafts).mockResolvedValue(undefined)
  vi.mocked(downloadObservationDrafts).mockResolvedValue(undefined)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
  Object.defineProperty(HTMLElement.prototype, 'getClientRects', { configurable: true, value() { return [{ width: 44, height: 44 }] } })
})
afterEach(() => { cleanup(); document.body.style.overflow = '' })
async function open() {
  const trigger = screen.getByRole('button', { name: 'Cerrar sesión' }); trigger.focus(); fireEvent.click(trigger)
  return within(await screen.findByRole('dialog'))
}
it.each(['Volver a sincronizar', 'Cerrar'])('cancel via %s preserves drafts and restores focus/scroll ownership', async name => {
  document.body.style.overflow = 'auto'; mount(); const modal = await open()
  expect(document.activeElement).toBe(modal.getByRole('heading', { name: 'Hay borradores pendientes' }))
  expect(document.body.style.overflow).toBe('hidden')
  fireEvent.click(modal.getByRole('button', { name }))
  expect(screen.queryByRole('dialog')).toBeNull(); expect(document.body.style.overflow).toBe('auto')
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar sesión' }))
  expect(signOut).not.toHaveBeenCalled(); expect(clearObservationDrafts).not.toHaveBeenCalled(); expect(downloadObservationDrafts).not.toHaveBeenCalled()
  expect(localStorage.getItem('streex-garden:private')).toBe('draft')
})
it('contains keyboard focus and native Escape closes without writes', async () => {
  mount(); const modal = await open(); const last = modal.getByRole('button', { name: 'Descartar y cerrar' })
  last.focus(); fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
  expect(document.activeElement).toBe(modal.getByRole('button', { name: 'Cerrar' }))
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(screen.queryByRole('dialog')).toBeNull(); expect(signOut).not.toHaveBeenCalled()
})
it.each(['Exportar y cerrar', 'Descartar y cerrar'])('explicit %s preserves export → signOut → draft/key cleanup → navigation', async choice => {
  mount(); const modal = await open(); const order: string[] = []
  vi.mocked(downloadObservationDrafts).mockImplementation(async () => { order.push('export') })
  vi.mocked(signOut).mockImplementation(async () => { expect(localStorage.getItem('streex-garden:private')).toBe('draft'); order.push('signOut') })
  vi.mocked(clearObservationDrafts).mockImplementation(async () => { expect(localStorage.getItem('streex-garden:private')).toBe('draft'); expect(screen.getByLabelText('Ruta').textContent).toBe('/today'); order.push('clear') })
  fireEvent.click(modal.getByRole('button', { name: choice }))
  await waitFor(() => expect(screen.getByLabelText('Ruta').textContent).toBe('/'))
  expect(order).toEqual(choice.startsWith('Exportar') ? ['export', 'signOut', 'clear'] : ['signOut', 'clear'])
  expect(localStorage.getItem('streex-garden:private')).toBeNull(); expect(localStorage.getItem('other-app')).toBe('keep')
})
it('blocks Escape/choices while busy and preserves drafts after a signOut error', async () => {
  mount(); const modal = await open(); let reject!: (reason: Error) => void
  vi.mocked(signOut).mockReturnValue(new Promise((_, r) => { reject = r }))
  fireEvent.click(modal.getByRole('button', { name: 'Descartar y cerrar' }))
  expect(modal.getByRole('button', { name: 'Volver a sincronizar' }).hasAttribute('disabled')).toBe(true)
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true })); expect(screen.getByRole('dialog')).toBeTruthy()
  await act(async () => reject(new Error('Salida falló')))
  expect(modal.getByRole('alert').textContent).toBe('Salida falló'); expect(clearObservationDrafts).not.toHaveBeenCalled()
  expect(localStorage.getItem('streex-garden:private')).toBe('draft'); expect(screen.getByLabelText('Ruta').textContent).toBe('/today')
})
it('does not sign out or clear drafts when export fails', async () => {
  mount(); const modal = await open(); vi.mocked(downloadObservationDrafts).mockRejectedValue(new Error('Exportación falló'))
  fireEvent.click(modal.getByRole('button', { name: 'Exportar y cerrar' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Exportación falló')
  expect(signOut).not.toHaveBeenCalled(); expect(clearObservationDrafts).not.toHaveBeenCalled()
})
it.each(['/', '/gardens', '/garden/g', '/today', '/ask-garden', '/cycle/c'])('aria-current follows existing nav active conditions at %s', path => {
  mount(path)
  for (const nav of screen.getAllByRole('navigation')) {
    const links = within(nav).getAllByRole('link')
    expect(links.filter(l => l.getAttribute('aria-current') === 'page')).toEqual(links.filter(l => l.className.includes('--active')))
  }
})

it('does not remove local keys or navigate when draft cleanup fails after signOut', async () => {
  mount(); const modal = await open()
  vi.mocked(clearObservationDrafts).mockRejectedValue(new Error('Limpieza falló'))
  fireEvent.click(modal.getByRole('button', { name: 'Descartar y cerrar' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Limpieza falló')
  expect(signOut).toHaveBeenCalledTimes(1)
  expect(localStorage.getItem('streex-garden:private')).toBe('draft')
  expect(screen.getByLabelText('Ruta').textContent).toBe('/today')
})
