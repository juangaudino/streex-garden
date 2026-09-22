// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { HomePage } from './HomePage'
import { getGardenCoverPhotos, getHome, getHomeDashboard, getHomeMedia } from '../../lib/garden-api'

vi.mock('../../lib/garden-api', () => ({
  getGardenCoverPhotos: vi.fn(),
  getHome: vi.fn(),
  getHomeDashboard: vi.fn(),
  getHomeMedia: vi.fn(),
}))
vi.mock('../../components/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))
vi.mock('./GardenCover', () => ({ GardenCoverImage: () => null }))
vi.mock('./GardensPage', () => ({ AttentionList: () => null }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getHomeDashboard).mockResolvedValue({
    visit: { id: 'visit-1', base_cursor: 1, snapshot_cursor: 1, snapshot_at: '2026-09-21T00:00:00Z', first_visit: true, visit_gap_minutes: 0 },
    gardens: [{ id: 'garden-1', name: 'Garden 1', system_model: 'URUQ', map_layout: 'uruq_8_v1', active_positions: 1, position_capacity: 8, cover_photo: null }],
    since_last_time: { changes: [] },
    attention: { items: [] },
  })
  vi.mocked(getHome).mockResolvedValue([{ id: 'garden-1', name: 'Garden 1', system_model: 'URUQ', position_capacity: 8, map_layout: 'uruq_8_v1', active_positions: 1, cover_photo: null }])
  vi.mocked(getHomeMedia).mockResolvedValue({ home_headline: 'Tu jardín, vivo.', home_hero_photo: null, home_hero_choices: [] })
})

describe('Home cover projection', () => {
  it('uses covers from getHome without fanning out cover-photo requests', async () => {
    render(<MemoryRouter><HomePage user={{ id: 'user-1' } as User} /></MemoryRouter>)
    await waitFor(() => expect(getHomeDashboard).toHaveBeenCalled())
    expect(getGardenCoverPhotos).not.toHaveBeenCalled()
  })
})
