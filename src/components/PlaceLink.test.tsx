// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlaceBackLink, PlaceLink } from './PlaceLink'
import { PlaceIdentity } from './PlaceIdentity'

const place = { placeId: 'p7', number: 7, gardenId: 'g', cropName: 'Chives' }
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) })
  window.scrollTo = vi.fn()
})
afterEach(cleanup)
function Journey() {
  return <MemoryRouter initialEntries={['/garden/g']}><Routes>
    <Route path="/garden/g" element={<article><PlaceIdentity placeId="p7" number={7} origin="row" /><PlaceLink to="/cycle/c" place={place} origin="row">Abrir Chives</PlaceLink></article>} />
    <Route path="/cycle/c" element={<section className="botanical-portrait"><PlaceIdentity placeId="p7" number={7} /><h1 tabIndex={-1}>Chives</h1><PlaceBackLink to="/garden/g">Volver</PlaceBackLink></section>} />
  </Routes></MemoryRouter>
}
it('moves keyboard focus into the profile and back to its row without spatial motion', async () => {
  render(<Journey />)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }))
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Chives' })))
  fireEvent.click(screen.getByRole('link', { name: 'Volver' }))
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Abrir Chives' })))
  expect(document.querySelector('.place-flight')).toBeNull()
})
it('preserves modified links for opening another tab', () => {
  render(<Journey />)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir Chives' }), { ctrlKey: true })
  expect(screen.queryByRole('heading', { name: 'Chives' })).toBeNull()
})
