// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ControlPage } from './ControlPage'
import { getControlV2 } from '../../lib/garden-api'
import type { ControlProjection } from '../../domain/types'

vi.mock('../../lib/garden-api', () => ({ getControlV2: vi.fn(), exportOwnerData: vi.fn() }))
vi.mock('../../lib/export-download', () => ({ downloadControlCsv: vi.fn(), downloadOwnerExport: vi.fn() }))
vi.mock('../../components/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }))

const projection: ControlProjection = {
  reference_date: '2026-09-08', interpretation: 'Reconstruido.', positions: [], gardens: [{
    garden_id: 'garden-1', garden_name: 'Huerto 1', shared_actions: [], relevant_facts: [],
    germination_coverage: { confirmed_positions: 1, occupied_positions: 2 },
    summary: { pendiente_vigilar: { count: 1, positions: [4] }, sin_evaluacion_suficiente: { count: 1, positions: [7] } },
    positions: [
      { position: { id: 'pod-4', number: 4 }, grow_cycle_id: 'cycle-4', plant: { name: 'English Thyme' }, planting: { date: '2026-07-31', precision: 'exact' }, age: { days: 39, status: 'known', precision: 'exact' }, last_thinning: null, next_thinning_evaluation: { kind: 'evaluate_today', task: null, evidence: null }, harvest_readiness: { value: 'evaluate', reason: 'Sin evaluación registrada', evidence: null }, current_state: { kind: 'watch', reason: null, evidence: { event_id: 'review-4', occurred_on: '2026-09-08', note: 'Denso, varias plantas' } }, germination: { status: 'confirmed', evidence: { event_id: 'g-4', occurred_on: '2026-08-01', note: null } }, plant_count: { event_id: 'count-4', occurred_on: '2026-09-08', note: null, count: '3', count_kind: 'seedlings_visible' }, action: null },
      { position: { id: 'pod-7', number: 7 }, grow_cycle_id: 'cycle-7', plant: { name: 'Chives' }, planting: { date: null, precision: 'unknown' }, age: { days: null, status: 'unknown', precision: 'unknown' }, last_thinning: null, next_thinning_evaluation: { kind: 'not_scheduled', task: null, evidence: null }, harvest_readiness: { value: 'evaluate', reason: 'Sin evaluación registrada', evidence: null }, current_state: { kind: 'insufficient_evidence', reason: 'Sin evaluación registrada', evidence: null }, germination: { status: 'no_observation', evidence: null }, plant_count: null, action: null },
    ],
  }],
}

beforeEach(() => { vi.mocked(getControlV2).mockResolvedValue(projection) })

describe('Control V2 projection', () => {
  it('keeps watch and insufficient evidence distinct instead of calling both healthy', async () => {
    render(<MemoryRouter><ControlPage /></MemoryRouter>)
    expect(await screen.findByText('Huerto 1')).toBeTruthy()
    expect(screen.getAllByText('Pendiente / Vigilar').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sin evaluación suficiente').length).toBeGreaterThan(0)
    expect(screen.getByText('English Thyme')).toBeTruthy()
    expect(screen.getByText('Chives')).toBeTruthy()
    expect(screen.getByText('Evaluar hoy')).toBeTruthy()
  })
})
