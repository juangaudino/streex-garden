// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CycleFactRecorder } from './CycleFactRecorder'
import { recordCycleFact } from '../../lib/garden-api'
import type { GrowCycleDetail } from '../../domain/types'

vi.mock('../../lib/garden-api', () => ({ recordCycleFact: vi.fn() }))

const cycle: GrowCycleDetail = {
  id: 'cycle-7', crop_name: 'Chives', planted_on: '2026-08-28', planted_on_precision: 'exact', harvest_readiness: 'not_yet',
  state: 'active', revision: 1, position: { id: 'position-7', position_number: 7 }, garden: { id: 'garden-1', name: 'Jardín 1' }, history: [], corrections: [],
}

describe('CycleFactRecorder', () => {
  beforeEach(() => cleanup())
  it('records a confirmed plant count as evidence, not as a task or recommendation', async () => {
    vi.mocked(recordCycleFact).mockResolvedValue({ event_id: 'count-event' })
    const onSaved = vi.fn().mockResolvedValue(undefined)
    render(<CycleFactRecorder cycle={cycle} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar hecho' }))
    fireEvent.change(screen.getByLabelText('Qué confirmé'), { target: { value: 'count' } })
    fireEvent.change(screen.getByLabelText('Cantidad observada'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar hecho' }))
    await waitFor(() => expect(recordCycleFact).toHaveBeenCalledWith(expect.objectContaining({
      growCycleId: 'cycle-7', factType: 'plant_count_observed', factData: { count: 3, count_kind: 'seedlings_visible' },
    })))
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it.each([
    ['installed', 'Soporte instalado'],
    ['adjusted', 'Soporte ajustado'],
    ['removed', 'Soporte retirado'],
  ])('persists the explicit support operation: %s', async (operation) => {
    vi.mocked(recordCycleFact).mockResolvedValue({ event_id: 'support-event' })
    render(<CycleFactRecorder cycle={cycle} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar hecho' }))
    fireEvent.change(screen.getByLabelText('Qué confirmé'), { target: { value: 'intervention' } })
    fireEvent.change(screen.getByLabelText('Intervención realizada'), { target: { value: 'support' } })
    fireEvent.change(screen.getByLabelText('Operación del soporte'), { target: { value: operation } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar hecho' }))
    await waitFor(() => expect(recordCycleFact).toHaveBeenCalledWith(expect.objectContaining({ factType: 'intervention', factData: { class: 'support', operation } })))
  })
})
