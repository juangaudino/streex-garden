// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { PlaceLink, PlaceNavigationOwner } from './PlaceLink'
import { PlaceIdentity } from './PlaceIdentity'
import { PlantStudio } from '../features/cycles/PlantStudio'
import type { GrowCycleDetail } from '../domain/types'

const place = { placeId: 'p7', number: 7, gardenId: 'g', cropName: 'Chives' }
const cycle: GrowCycleDetail = { id: 'c', crop_name: 'Chives', planted_on: '2026-08-01', planted_on_precision: 'exact', harvest_readiness: 'not_yet', state: 'active', revision: 1, position: { id: 'p7', position_number: 7 }, garden: { id: 'g', name: 'Garden' }, history: [], corrections: [] }
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) })
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 430 })
  window.scrollTo = vi.fn()
  HTMLElement.prototype.scrollIntoView = vi.fn()
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: undefined })
})
afterEach(() => { cleanup(); vi.useRealTimers() })
function Profile({ delay = 0 }: { delay?: number }) {
  const [ready, setReady] = useState(delay === 0)
  useEffect(() => { const timer = setTimeout(() => setReady(true), delay); return () => clearTimeout(timer) }, [delay])
  return ready ? <PlantStudio cycle={cycle} onOpen={vi.fn()} onCoverChanged={async () => {}} onMessage={vi.fn()} /> : <section aria-busy="true">Cargando</section>
}
function Controls() {
  const navigate = useNavigate(), location = useLocation()
  return <><PlaceNavigationOwner /><button onClick={() => navigate(-1)}>Atrás</button><button onClick={() => navigate('/cycle/other')}>Otro ciclo</button><output>{location.pathname}</output><output aria-label="Contexto">{JSON.stringify(location.state)}</output></>
}
function Journey({ origin = 'row', delay = 0, entry = '/garden/g', target, targetCycle = 'c' }: { origin?: string; delay?: number; entry?: string; target?: string; targetCycle?: string }) {
  return <MemoryRouter initialEntries={[entry]}><Controls /><Routes>
    <Route path="/garden/g" element={<article><PlaceIdentity placeId="p7" number={7} origin={origin} /><PlaceLink to={`/cycle/${targetCycle}`} place={place} origin={origin} target={target}>Abrir Chives</PlaceLink></article>} />
    <Route path="/cycle/c" element={<Profile delay={delay} />} />
    <Route path="/cycle/other" element={<PlantStudio cycle={{ ...cycle, id: 'other', crop_name: 'Cilantro' }} onOpen={vi.fn()} onCoverChanged={async () => {}} onMessage={vi.fn()} />} />
  </Routes></MemoryRouter>
}
const heading = () => screen.getByRole('heading', { name: 'Chives' })
it.each(['row', 'map'])('restores focus and scroll from the real PlantStudio badge to %s', async origin => {
  render(<Journey origin={origin} />)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }))
  await waitFor(() => expect(document.activeElement).toBe(heading()))
  expect(document.querySelector('[data-place-origin="profile"]')?.getAttribute('data-place-cycle-id')).toBe('c')
  expect(JSON.parse(screen.getByLabelText('Contexto').textContent!).place).toEqual(place)
  fireEvent.click(screen.getByRole('link', { name: /Garden.*Posición 7/ }))
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Abrir Chives' })))
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 430, behavior: 'instant' })
  expect(document.querySelector('.place-flight')).toBeNull()
})
it('restores a recorded origin on router browser-back', async () => {
  render(<Journey />)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }))
  await waitFor(() => expect(document.activeElement).toBe(heading()))
  fireEvent.click(screen.getByRole('button', { name: 'Atrás' }))
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Abrir Chives' })))
})
it('waits beyond the old 650ms cutoff for a ready real profile', async () => {
  vi.useFakeTimers()
  render(<Journey delay={1500} />)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(800) })
  expect(window.scrollTo).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(800) })
  expect(document.activeElement).toBe(heading())
})
it('cancels a slow arrival when another cycle takes over, without fabricated return', async () => {
  vi.useFakeTimers()
  render(<Journey delay={1500} />)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }))
  fireEvent.click(screen.getByRole('button', { name: 'Otro ciclo' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
  expect(window.scrollTo).not.toHaveBeenCalled()
  expect(document.querySelector('.place-flight')).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: /Garden.*Posición 7/ }))
  await act(async () => {})
  expect(document.activeElement).not.toBe(screen.getByRole('link', { name: 'Abrir Chives' }))
})
it('uses direct-entry fallback without inventing a row origin', async () => {
  render(<Journey entry="/cycle/other" />)
  fireEvent.click(screen.getByRole('link', { name: /Garden.*Posición 7/ }))
  await act(async () => {})
  expect(window.scrollTo).not.toHaveBeenCalled()
})
it('cleans decorative clones without View Transition API', async () => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) })
  render(<Journey />)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }))
  await waitFor(() => expect(document.activeElement).toBe(heading()))
  expect(document.querySelector('.place-flight')).toBeNull()
})
it('cleans native snapshot names after completion', async () => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) })
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: (update: () => Promise<void>) => ({ finished: update(), skipTransition: vi.fn() }) })
  render(<Journey />)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }))
  await waitFor(() => expect(document.activeElement).toBe(heading()))
  expect(document.querySelector<HTMLElement>('[data-place-origin="profile"]')?.style.viewTransitionName).toBe('')
  expect(document.documentElement.dataset.placeDirection).toBeUndefined()
})
it('preserves modified links and explicit new tabs', () => {
  const view = render(<Journey />)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }), { ctrlKey: true })
  expect(screen.queryByRole('heading', { name: 'Chives' })).toBeNull()
  view.unmount()
  render(<Journey target="_blank" />)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }))
  expect(screen.queryByRole('heading', { name: 'Chives' })).toBeNull()
})

it('cancels native snapshots and pending observers when a rapid route supersedes them', async () => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) })
  const skip = vi.fn()
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: (update: () => Promise<void>) => ({ finished: update(), skipTransition: skip }) })
  vi.useFakeTimers(); render(<Journey delay={1500} />)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }))
  fireEvent.click(screen.getByRole('button', { name: 'Otro ciclo' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
  expect(skip).toHaveBeenCalled()
  expect(document.documentElement.dataset.placeDirection).toBeUndefined()
  expect(window.scrollTo).not.toHaveBeenCalled()
})
it('cancels a pending fallback flight on rapid navigation', async () => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) })
  vi.useFakeTimers(); render(<Journey delay={1500} />)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }))
  expect(document.querySelector('.place-flight')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Otro ciclo' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
  expect(document.querySelector('.place-flight')).toBeNull()
  expect(window.scrollTo).not.toHaveBeenCalled()
})

it('falls back to navigation/focus when native snapshots throw synchronously', async () => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) })
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: () => { throw new Error('Snapshots unavailable') } })
  render(<Journey />); fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }))
  await waitFor(() => expect(document.activeElement).toBe(heading()))
  expect(document.documentElement.dataset.placeDirection).toBeUndefined()
})
it('restores a hidden destination and removes an active fallback flight on route change', async () => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) })
  let finish!: () => void
  const cancel = vi.fn(() => finish())
  Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: () => ({ finished: new Promise<void>(r => { finish = r }), cancel }) })
  try {
    render(<Journey />); fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }))
    await act(async () => {})
    const target = document.querySelector<HTMLElement>('[data-place-origin="profile"]')!
    expect(target.style.visibility).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Otro ciclo' }))
    await act(async () => {})
    expect(cancel).toHaveBeenCalled(); expect(target.style.visibility).toBe('')
    expect(document.querySelector('.place-flight')).toBeNull()
  } finally { delete (HTMLElement.prototype as Partial<HTMLElement>).animate }
})

it('does not restore focus/scroll to a row now pointing at a different occupant', async () => {
  vi.useFakeTimers(); const view = render(<Journey />)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }))
  await act(async () => {})
  expect(document.activeElement).toBe(heading())
  view.rerender(<Journey targetCycle="other" />)
  vi.mocked(window.scrollTo).mockClear()
  fireEvent.click(screen.getByRole('link', { name: /Garden.*Posición 7/ }))
  await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
  expect(window.scrollTo).not.toHaveBeenCalled()
  expect(document.activeElement).not.toBe(screen.getByRole('link', { name: 'Abrir Chives' }))
})
