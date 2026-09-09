// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GuestGardenStoryManager } from './GuestGardenStoryManager'
import { GuestGardenStoryPage } from './GuestGardenStoryPage'
import { createGuestGardenStory, getGarden, getGuestGardenStories, getGuestGardenStory, revokeGuestGardenStory } from '../../lib/garden-api'
import type { GardenDetail, GuestGardenStory } from '../../domain/types'

vi.mock('../../components/AppShell', () => ({ AppShell: ({ children, title }: { children: React.ReactNode; title?: string }) => <main><h1>{title}</h1>{children}</main> }))
vi.mock('../../components/StatePanel', () => ({ StatePanel: ({ children, title, onRetry }: { children?: React.ReactNode; title: string; onRetry?: () => void }) => <section><h2>{title}</h2>{children}{onRetry && <button onClick={onRetry}>Reintentar</button>}</section> }))
vi.mock('../../lib/garden-api', () => ({ createGuestGardenStory: vi.fn(), getGarden: vi.fn(), getGuestGardenStories: vi.fn(), getGuestGardenStory: vi.fn(), revokeGuestGardenStory: vi.fn() }))

const garden: GardenDetail = {
  id: 'garden-guest', name: 'Jardín completo', system_model: 'URUQ', position_capacity: 8, map_layout: 'uruq_8_v1',
  positions: [], layout_sites: [],
}

const story: GuestGardenStory = {
  id: 'garden-story', garden: { id: garden.id, name: garden.name, system_model: garden.system_model },
  cycles: [{ grow_cycle_id: 'cycle-1', crop_name: 'Chives', planted_on: '2026-08-28', planted_on_precision: 'exact', state: 'active', position_number: 7 }],
  created_at: '2026-09-09T12:00:00Z',
  history: [{ id: 'event-1', grow_cycle_id: 'cycle-1', event_type: 'germination_confirmed', occurred_at: '2026-09-08T12:00:00Z', occurred_at_precision: 'timestamp', occurred_on: null, note: 'Primer brote', crop_name: 'Chives', position_number: 7, event_data: {}, photo: null }],
}

const storyWithPhoto: GuestGardenStory = {
  ...story,
  history: [{ ...story.history[0], photo: {
    id: 'photo-1', original_filename: 'chives.jpg', content_type: 'image/jpeg', byte_size: 42, checksum_sha256: null,
    captured_at: '2026-09-08T12:00:00Z', captured_at_precision: 'exact', upload_status: 'uploaded', url: 'https://signed.example/chives.jpg',
  } }],
}

describe('Guest Garden Story', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getGarden).mockResolvedValue(garden)
    vi.mocked(getGuestGardenStories).mockResolvedValue([])
  })
  afterEach(cleanup)

  it('creates and revokes a complete-garden link', async () => {
    vi.mocked(createGuestGardenStory).mockResolvedValue({ story_id: 'garden-story', url: 'https://garden.test/guest/garden/token' })
    vi.mocked(revokeGuestGardenStory).mockResolvedValue()
    render(<MemoryRouter initialEntries={['/garden/garden-guest/share']}><Routes><Route path="/garden/:gardenId/share" element={<GuestGardenStoryManager />} /></Routes></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Crear nuevo enlace' }))
    await waitFor(() => expect(createGuestGardenStory).toHaveBeenCalledWith(expect.any(String), 'garden-guest'))
    expect(await screen.findByDisplayValue('https://garden.test/guest/garden/token')).toBeTruthy()
  })

  it('renders the garden story with readable event labels', async () => {
    vi.mocked(getGuestGardenStory).mockResolvedValue({ story, expires_in: 300 })
    render(<MemoryRouter initialEntries={['/guest/garden/token']}><Routes><Route path="/guest/garden/:token" element={<GuestGardenStoryPage />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Jardín completo' })).toBeTruthy()
    expect(screen.getByText('Germinación confirmada')).toBeTruthy()
    expect(screen.getByText('Chives · Posición 7')).toBeTruthy()
  })

  it('renders signed garden photos in the public story', async () => {
    vi.mocked(getGuestGardenStory).mockResolvedValue({ story: storyWithPhoto, expires_in: 300 })
    render(<MemoryRouter initialEntries={['/guest/garden/token']}><Routes><Route path="/guest/garden/:token" element={<GuestGardenStoryPage />} /></Routes></MemoryRouter>)
    const image = await screen.findByRole('img', { name: 'Fotografía documental: chives.jpg' })
    expect(image.getAttribute('src')).toBe('https://signed.example/chives.jpg')
  })

  it('opens a plant detail from the complete garden story', async () => {
    vi.mocked(getGuestGardenStory).mockResolvedValue({ story, expires_in: 300 })
    render(<MemoryRouter initialEntries={['/guest/garden/token/cycle/cycle-1']}><Routes><Route path="/guest/garden/:token/cycle/:cycleId" element={<GuestGardenStoryPage />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'La historia de tu Chives' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '← Volver al jardín completo' })).toBeTruthy()
  })

  it('uses the photo-story composition for a plant opened from a garden link', async () => {
    const secondPhotoStory: GuestGardenStory = { ...storyWithPhoto, history: [{ ...storyWithPhoto.history[0], id: 'event-photo-2', occurred_at: '2026-09-07T12:00:00Z', photo: { ...storyWithPhoto.history[0].photo!, id: 'photo-2', original_filename: 'chives-2.jpg', url: 'https://signed.example/chives-2.jpg' } }, storyWithPhoto.history[0]] }
    vi.mocked(getGuestGardenStory).mockResolvedValue({ story: secondPhotoStory, expires_in: 300 })
    render(<MemoryRouter initialEntries={['/guest/garden/token/cycle/cycle-1']}><Routes><Route path="/guest/garden/:token/cycle/:cycleId" element={<GuestGardenStoryPage />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('region', { name: 'Recorrido fotográfico' })).toBeTruthy()
    expect(screen.getAllByRole('img', { name: /Fotografía documental: chives/ })).toHaveLength(2)
    expect(screen.getByText('Un mismo ciclo, a través de tus fotografías.')).toBeTruthy()
  })
})
