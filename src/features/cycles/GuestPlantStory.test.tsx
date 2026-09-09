// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GuestPlantStoryManager } from './GuestPlantStoryManager'
import { GuestPlantStoryPage } from './GuestPlantStoryPage'
import { createGuestPlantStory, getCycle, getGuestPlantStories, getGuestPlantStory, revokeGuestPlantStory } from '../../lib/garden-api'
import type { GrowCycleDetail, GuestPlantStory } from '../../domain/types'

vi.mock('../../components/AppShell', () => ({ AppShell: ({ children, title }: { children: React.ReactNode; title?: string }) => <main><h1>{title}</h1>{children}</main> }))
vi.mock('../../components/StatePanel', () => ({ StatePanel: ({ children, title, onRetry }: { children?: React.ReactNode; title: string; onRetry?: () => void }) => <section><h2>{title}</h2>{children}{onRetry && <button onClick={onRetry}>Reintentar</button>}</section> }))
vi.mock('../../lib/garden-api', () => ({ createGuestPlantStory: vi.fn(), getCycle: vi.fn(), getGuestPlantStories: vi.fn(), getGuestPlantStory: vi.fn(), revokeGuestPlantStory: vi.fn() }))

const cycle: GrowCycleDetail = {
  id: 'cycle-guest', crop_name: 'Chives', planted_on: '2026-08-28', planted_on_precision: 'exact', harvest_readiness: 'not_yet', state: 'active', revision: 1,
  position: { id: 'position-guest', position_number: 7 }, garden: { id: 'garden-guest', name: 'Jardín' },
  history: [{ id: 'event-guest', event_type: 'observation', occurred_at: '2026-09-01T12:00:00Z', occurred_at_precision: 'timestamp', occurred_on: null, note: 'Observar hojas nuevas', revision: 1, photo: null }], corrections: [],
}

const story: GuestPlantStory = {
  id: 'story-guest', crop_name: 'Chives', planted_on: '2026-08-28', planted_on_precision: 'exact', state: 'active', garden: { name: 'Jardín' }, position: { position_number: 7 }, created_at: '2026-09-01T12:00:00Z',
  history: [{ id: 'event-guest', event_type: 'observation', occurred_at: '2026-09-01T12:00:00Z', occurred_at_precision: 'timestamp', occurred_on: null, note: 'Observar hojas nuevas', photo: null }],
}

describe('Guest Plant Story', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(getCycle).mockResolvedValue(cycle); vi.mocked(getGuestPlantStories).mockResolvedValue([]) })
  afterEach(cleanup)

  it('creates a read-only link with only the selected note', async () => {
    vi.mocked(createGuestPlantStory).mockResolvedValue({ story_id: 'story-guest', url: 'https://garden.test/guest/token' })
    render(<MemoryRouter initialEntries={['/cycle/cycle-guest/share']}><Routes><Route path="/cycle/:cycleId/share" element={<GuestPlantStoryManager />} /></Routes></MemoryRouter>)
    const note = await screen.findByLabelText('Incluir nota: Observar hojas nuevas')
    fireEvent.click(note)
    fireEvent.click(screen.getByRole('button', { name: 'Crear nuevo enlace' }))
    await waitFor(() => expect(createGuestPlantStory).toHaveBeenCalledWith(expect.objectContaining({ growCycleId: 'cycle-guest', itemSelection: [{ event_id: 'event-guest', include_note: true }] })))
    expect(await screen.findByDisplayValue('https://garden.test/guest/token')).toBeTruthy()
  })

  it('renders a public story without account navigation and can reload it', async () => {
    vi.mocked(getGuestPlantStory).mockResolvedValue({ story, expires_in: 300 })
    render(<MemoryRouter initialEntries={['/guest/token']}><Routes><Route path="/guest/:token" element={<GuestPlantStoryPage />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'La historia de tu Chives' })).toBeTruthy()
    expect(screen.getByText('Observar hojas nuevas')).toBeTruthy()
    expect(screen.queryByText('Home')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    await waitFor(() => expect(getGuestPlantStory).toHaveBeenCalledTimes(2))
  })

  it('revokes an active link from the owner screen', async () => {
    vi.mocked(getGuestPlantStories).mockResolvedValue([{ id: 'story-guest', created_at: '2026-09-01T12:00:00Z', revoked_at: null, active: true }])
    vi.mocked(revokeGuestPlantStory).mockResolvedValue()
    render(<MemoryRouter initialEntries={['/cycle/cycle-guest/share']}><Routes><Route path="/cycle/:cycleId/share" element={<GuestPlantStoryManager />} /></Routes></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Revocar' }))
    await waitFor(() => expect(revokeGuestPlantStory).toHaveBeenCalledWith(expect.any(String), 'story-guest'))
  })
})
