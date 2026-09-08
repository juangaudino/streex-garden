// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AttentionList } from './GardensPage'
import { RegisterPage } from '../cycles/RegisterPage'
import { getGarden, getHome } from '../../lib/garden-api'

vi.mock('../../lib/garden-api', () => ({ getGarden: vi.fn(), getHome: vi.fn() }))
vi.mock('../../components/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))
vi.mock('../cycles/ObservationComposer', () => ({ ObservationComposer: ({ growCycleId }: { growCycleId: string }) => <div>Registro para {growCycleId}</div> }))

beforeEach(() => {
  vi.mocked(getHome).mockResolvedValue([{ id: 'garden-1', name: 'Huerto 1', system_model: 'URUQ', position_capacity: 8, map_layout: 'uruq_8_v1', active_positions: 1 }])
  vi.mocked(getGarden).mockResolvedValue({ id: 'garden-1', name: 'Huerto 1', system_model: 'URUQ', position_capacity: 8, map_layout: 'uruq_8_v1', layout_sites: [], positions: [{ id: 'position-7', position_number: 7, current_cycle: { id: 'cycle-7', crop_name: 'Chives', planted_on: null, planted_on_precision: 'unknown', harvest_readiness: 'not_yet' }, previous_cycles: [] }] })
})

describe('GX-00 discoverability', () => {
  it('puts garden, position and plant next to an actionable Today item', () => {
    render(<MemoryRouter><AttentionList items={[{ id: 'task-7', garden_id: 'garden-1', garden_name: 'Huerto 1', grow_cycle_id: 'cycle-7', position_id: 'position-7', position_number: 7, crop_name: 'Chives', purpose: 'evaluate_thinning', subject_key: 'general', title: 'Evaluar aclareo', origin: 'manual', due_on: null, next_review_on: null, created_at: '2026-09-08T00:00:00Z' }]} /></MemoryRouter>)
    expect(screen.getByText(/Huerto 1 · Posición 7 · Chives/)).toBeTruthy()
  })

  it('offers a short Garden and plant selection before a transversal registration', async () => {
    render(<MemoryRouter><RegisterPage /></MemoryRouter>)
    expect(await screen.findByLabelText('Jardín')).toBeTruthy()
    await waitFor(() => expect(screen.getByLabelText('Planta / posición')).toBeTruthy())
    expect(screen.getByText('Registro para cycle-7')).toBeTruthy()
  })
})
