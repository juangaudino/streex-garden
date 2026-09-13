// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { AttentionItem, AttentionPurpose, ControlProjection, GardenSummary } from '../../domain/types'
import type { AskGardenAnswerV1 } from '../../domain/ai'
import { cycleAttentionPurposes, gardenAttentionPurposes } from '../../domain/attention-purpose'
import * as api from '../../lib/garden-api'
import * as gateway from '../../lib/ai-gateway'
import { TodayPage } from './TodayPage'
import { AskGardenPage } from './AskGardenPage'

vi.mock('../../lib/garden-api', () => ({
  getAttention: vi.fn(), getHome: vi.fn(), getControlV2: vi.fn(), getHarvestHistory: vi.fn(),
  createAttentionItem: vi.fn(), completeAttentionItem: vi.fn(), deferAttentionItem: vi.fn(), dismissAttentionItem: vi.fn(), signOut: vi.fn(),
}))
vi.mock('../../lib/ai-gateway', () => ({ aiGatewayStatus: vi.fn(), askGarden: vi.fn() }))
vi.mock('../../components/PwaUpdateNotice', () => ({ PwaUpdateNotice: () => null }))
vi.mock('../../lib/offline-observation-store', () => ({ getObservationDrafts: vi.fn(async () => []), clearObservationDrafts: vi.fn() }))

const gardens: GardenSummary[] = [
  { id: 'garden-a', name: 'La ventana', system_model: 'URUQ', position_capacity: 8, map_layout: 'uruq_8_v1', active_positions: 2 },
  { id: 'garden-b', name: 'La terraza', system_model: null, position_capacity: 8, map_layout: 'uruq_8_v1', active_positions: 1 },
]
const control: ControlProjection = { reference_date: '2026-09-13', interpretation: 'Contexto confirmado', gardens: [], positions: [] }
const aiAnswer: AskGardenAnswerV1 = {
  schema_version: 'garden_ai_ask_v1', answer_type: 'answer', answer: 'Interpretación de prueba, sin confirmar hechos nuevos.',
  confirmed_facts: [{ source: { kind: 'event', id: 'event-a' }, claim: 'Registro existente' }, { source: { kind: 'photo', id: 'photo-a' }, claim: 'Foto existente' }],
  suggested_next_actions: ['Observa la planta'],
}
function task(purpose: AttentionPurpose = 'evaluate_pruning', id = 'task-a'): AttentionItem {
  return { id, garden_id: 'garden-a', garden_name: 'La ventana', grow_cycle_id: 'cycle-a', crop_name: 'Basil', position_number: 1, purpose, title: `Pendiente ${id}`, subject_key: 'general', origin: 'manual', due_on: '2099-01-01', next_review_on: null, created_at: '2026-09-13T12:00:00Z' }
}
function Destination() { return <p>Destino: {useLocation().pathname}</p> }
function show(page: 'today' | 'ask-garden') {
  return render(<MemoryRouter initialEntries={[`/${page}`]}><Routes>
    <Route path="/today" element={<TodayPage />} /><Route path="/ask-garden" element={<AskGardenPage />} />
    <Route path="*" element={<Destination />} />
  </Routes></MemoryRouter>)
}
function noWrites() {
  for (const fn of [api.createAttentionItem, api.completeAttentionItem, api.deferAttentionItem, api.dismissAttentionItem]) expect(fn).not.toHaveBeenCalled()
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
async function send(question: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Pregunta para Ask Garden' }), { target: { value: question } })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }))
  await waitFor(() => expect(screen.queryByText('Consultando Garden X…')).toBeNull())
}
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); sessionStorage.setItem('streex-garden-entry-seen', '1')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
  Element.prototype.scrollIntoView = vi.fn()
  vi.mocked(api.getHome).mockResolvedValue(structuredClone(gardens))
  vi.mocked(api.getAttention).mockResolvedValue([task()])
  vi.mocked(api.getControlV2).mockResolvedValue(structuredClone(control))
  vi.mocked(api.getHarvestHistory).mockResolvedValue([])
  vi.mocked(api.createAttentionItem).mockResolvedValue({ task_id: 'new-task', created: true })
  vi.mocked(api.completeAttentionItem).mockResolvedValue({ task_id: 'task-a', event_id: 'event-new' })
  vi.mocked(api.deferAttentionItem).mockResolvedValue()
  vi.mocked(api.dismissAttentionItem).mockResolvedValue()
  vi.mocked(gateway.aiGatewayStatus).mockReturnValue('disabled')
  vi.mocked(gateway.askGarden).mockResolvedValue(structuredClone(aiAnswer))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Hoy — operational presentation preserves Attention contracts', () => {
  it('exposes all thirteen supported purposes without filtering or losing editor families', async () => {
    const purposes = [...cycleAttentionPurposes, ...gardenAttentionPurposes]
    vi.mocked(api.getAttention).mockResolvedValue(purposes.map((choice, i) => task(choice.value, String(i))))
    show('today'); await screen.findByText('Pendiente 12')
    expect(document.querySelectorAll('.attention-item--managed')).toHaveLength(13)
    expect(screen.getAllByRole('button', { name: 'Guardar revisión' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Guardar evaluación' })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: 'Registrar y completar' })).toHaveLength(9); noWrites()
  })
  it('keeps queue order, all timing states and incomplete context without writing on display/navigation', async () => {
    const items = [task('evaluate_visual_review', 'visual'), task('perform_pruning', 'perform'), task('evaluate_support', 'evaluate'), task('perform_refill', 'system')]
    items[0].due_on = '2000-01-01'
    items[1].due_on = new Date().toLocaleDateString('sv-SE')
    items[3] = { ...items[3], garden_id: null, garden_name: undefined, grow_cycle_id: null, due_on: null }
    vi.mocked(api.getAttention).mockResolvedValue(items)
    show('today'); await screen.findByText('Pendiente visual')
    const queue = document.querySelector('[aria-labelledby="today-queue-title"]')!
    expect(within(queue as HTMLElement).getAllByRole('article').map(el => el.querySelector('strong')?.textContent)).toEqual(items.map(item => item.title))
    for (const text of [/Vencida/, /Para hoy/, /Programada/, /Sin fecha/, /Sistema/]) expect(within(queue as HTMLElement).getByText(text)).toBeTruthy()
    noWrites()
    fireEvent.click(screen.getAllByRole('link', { name: 'Ask Garden' })[0])
    await screen.findByRole('heading', { name: 'Ask Garden' }); noWrites()
  })
  it('recovers initial read errors, shows empty queue and omits creation when no gardens exist', async () => {
    vi.mocked(api.getAttention).mockRejectedValueOnce(new Error('Lectura fallida')).mockResolvedValue([])
    vi.mocked(api.getHome).mockResolvedValue([])
    show('today'); expect(screen.getByText('Consultando atención')).toBeTruthy()
    await screen.findByText('Lectura fallida'); fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByText('Sin pendientes')
    expect(screen.queryByRole('button', { name: 'Añadir seguimiento' })).toBeNull(); noWrites()
  })
  it.each([
    ['Se ve bien', 'reassuring'], ['Vigilar', 'watch'], ['Requiere acción', 'action_required'], ['Evidencia insuficiente', 'insufficient_evidence'],
  ])('saves explicit visual review %s only after confirmation', async (label, result) => {
    vi.mocked(api.getAttention).mockResolvedValue([task('evaluate_visual_review')])
    show('today'); fireEvent.click(await screen.findByRole('button', { name: 'Guardar revisión' }))
    fireEvent.click(screen.getByRole('radio', { name: label })); noWrites()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar mi observación visual' }))
    await waitFor(() => expect(api.completeAttentionItem).toHaveBeenCalledWith({ requestId: expect.any(String), taskId: 'task-a', note: undefined, reviewResult: result }))
  })
  it.each([['Listo', 'ready'], ['Todavía no', 'not_yet'], ['No requerido', 'not_required'], ['No determinado', 'undetermined']])('preserves development evaluation %s', async (label, result) => {
    show('today'); fireEvent.click(await screen.findByRole('button', { name: 'Guardar evaluación' }))
    fireEvent.click(screen.getByRole('radio', { name: label }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y completar' }))
    await waitFor(() => expect(api.completeAttentionItem).toHaveBeenCalledWith(expect.objectContaining({ reviewResult: result, taskId: 'task-a' })))
  })
  it('registers a performed action with no invented evaluation and blocks repeated submission while saving', async () => {
    vi.mocked(api.getAttention).mockResolvedValue([task('perform_pruning')])
    const pending = deferred<{ task_id: string; event_id: string }>(); vi.mocked(api.completeAttentionItem).mockReturnValue(pending.promise)
    show('today'); fireEvent.click(await screen.findByRole('button', { name: 'Registrar y completar' }))
    expect(screen.queryByRole('radio')).toBeNull()
    const form = screen.getByRole('button', { name: 'Confirmar y completar' }).closest('form')!
    fireEvent.submit(form); fireEvent.submit(form)
    expect(api.completeAttentionItem).toHaveBeenCalledTimes(1)
    expect(api.completeAttentionItem).toHaveBeenCalledWith(expect.objectContaining({ reviewResult: null }))
    expect(screen.getByRole('button', { name: 'Confirmando…' }).hasAttribute('disabled')).toBe(true)
    await act(async () => pending.resolve({ task_id: 'task-a', event_id: 'event-new' }))
  })
  it('preserves required deferral date, optional note and cancel without writes', async () => {
    show('today'); fireEvent.click(await screen.findByRole('button', { name: 'Posponer' }))
    const date = screen.getByLabelText('Volver a destacar el') as HTMLInputElement
    expect(date.required).toBe(true); expect(date.checkValidity()).toBe(false); noWrites()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' })); noWrites()
    fireEvent.click(screen.getByRole('button', { name: 'Posponer' }))
    fireEvent.change(screen.getByLabelText('Volver a destacar el'), { target: { value: '2026-10-01' } })
    fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: 'Revisar después' } })
    fireEvent.click(screen.getByRole('button', { name: 'Posponer atención' }))
    await waitFor(() => expect(api.deferAttentionItem).toHaveBeenCalledWith({ requestId: expect.any(String), taskId: 'task-a', nextReviewOn: '2026-10-01', reason: 'Revisar después' }))
  })
  it('requires a dismissal reason and preserves its payload', async () => {
    show('today'); fireEvent.click(await screen.findByRole('button', { name: 'No hace falta' }))
    const reason = screen.getByLabelText('Por qué no hace falta') as HTMLTextAreaElement
    expect(reason.required).toBe(true); expect(reason.checkValidity()).toBe(false); noWrites()
    fireEvent.change(reason, { target: { value: 'Ya no corresponde' } })
    fireEvent.click(screen.getByRole('button', { name: 'Descartar atención' }))
    await waitFor(() => expect(api.dismissAttentionItem).toHaveBeenCalledWith({ requestId: expect.any(String), taskId: 'task-a', reason: 'Ya no corresponde' }))
  })
  it('blocks offline completion and reuses request identity after a failed online save', async () => {
    show('today'); fireEvent.click(await screen.findByRole('button', { name: 'Guardar evaluación' }))
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y completar' }))
    await screen.findByRole('alert'); noWrites()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    vi.mocked(api.completeAttentionItem).mockRejectedValueOnce(new Error('Guardado fallido'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y completar' }))
    await screen.findByText('Guardado fallido')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y completar' }))
    await waitFor(() => expect(api.completeAttentionItem).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.completeAttentionItem).mock.calls[1][0]).toEqual(vi.mocked(api.completeAttentionItem).mock.calls[0][0])
  })
  it('creates a distinct garden follow-up and retains the selected garden after reload', async () => {
    show('today'); await screen.findByText('Pendiente task-a')
    fireEvent.change(screen.getByRole('combobox', { name: 'Jardín' }), { target: { value: 'garden-b' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir seguimiento' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Qué requiere seguimiento' }), { target: { value: 'perform_nutrients' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Crear por separado' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Asunto que lo diferencia' }), { target: { value: '  Depósito  ' } })
    noWrites(); fireEvent.click(screen.getByRole('button', { name: 'Crear atención' }))
    await waitFor(() => expect(api.createAttentionItem).toHaveBeenCalledWith({ requestId: expect.any(String), gardenId: 'garden-b', growCycleId: null, purpose: 'perform_nutrients', subjectKey: 'Depósito', dueOn: null }))
    await screen.findByRole('button', { name: 'Añadir seguimiento' })
    expect((screen.getByRole('combobox', { name: 'Jardín' }) as HTMLSelectElement).value).toBe('garden-b')
  })
  it('keeps an already-existing follow-up open without treating it as a new record', async () => {
    vi.mocked(api.createAttentionItem).mockResolvedValue({ task_id: 'task-a', created: false })
    show('today'); fireEvent.click(await screen.findByRole('button', { name: 'Añadir seguimiento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear atención' }))
    await screen.findByText('Ya había una atención abierta con este mismo propósito y asunto.')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy()
  })
  it('falls back only when a previously selected garden disappears from refreshed data', async () => {
    show('today'); await screen.findByText('Pendiente task-a')
    fireEvent.change(screen.getByRole('combobox', { name: 'Jardín' }), { target: { value: 'garden-b' } })
    vi.mocked(api.getHome).mockResolvedValue([gardens[0]])
    fireEvent.click(screen.getByRole('button', { name: 'Guardar evaluación' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y completar' }))
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Jardín' })).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Añadir seguimiento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Crear atención' }))
    await waitFor(() => expect(api.createAttentionItem).toHaveBeenCalledWith(expect.objectContaining({ gardenId: 'garden-a' })))
  })
})

describe('Ask Garden — read-only deterministic and AI presentation', () => {
  it('recovers context errors and exposes three suggestions beneath their separate label', async () => {
    vi.mocked(api.getControlV2).mockRejectedValueOnce(new Error('Sin contexto'))
    show('ask-garden'); expect(screen.getByText('Preparando contexto de tu jardín')).toBeTruthy()
    await screen.findByText('Sin contexto'); fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByRole('heading', { name: '¿Qué quieres saber?' })
    const suggestions = document.querySelector('.ask-garden-suggestions')!
    expect(within(suggestions as HTMLElement).getAllByRole('button')).toHaveLength(3)
    expect(suggestions.querySelector('.ask-garden-suggestions__label')).toBeNull(); noWrites()
  })
  it('uses deterministic confirmed facts even when the gateway is ready, and its action is navigation only', async () => {
    vi.mocked(gateway.aiGatewayStatus).mockReturnValue('ready')
    show('ask-garden'); await screen.findByRole('heading', { name: '¿Qué quieres saber?' })
    await send('¿Qué pendientes tengo hoy?')
    expect(screen.getByText(/Pendiente task-a/)).toBeTruthy()
    expect(screen.getByText('Fuentes confirmadas')).toBeTruthy()
    expect(gateway.askGarden).not.toHaveBeenCalled(); noWrites()
    fireEvent.click(screen.getByRole('link', { name: 'Abrir Hoy' }))
    await screen.findByRole('heading', { name: 'Hoy' }); noWrites()
  })
  it('does not activate AI for an ambiguous question when disabled', async () => {
    show('ask-garden'); await screen.findByRole('heading', { name: '¿Qué quieres saber?' })
    await send('¿Cómo va la albahaca?')
    expect(gateway.askGarden).not.toHaveBeenCalled(); noWrites()
  })
  it('keeps confirmed harvest date, cycle route and provenance on the deterministic path', async () => {
    vi.mocked(api.getHarvestHistory).mockResolvedValue([{ event_id: 'harvest-a', grow_cycle_id: 'cycle-a', garden_id: 'garden-a', garden_name: 'La ventana', position_id: 'position-a', position_number: 1, crop_name: 'Cilantro', occurred_on: '2026-09-01', occurred_at: '2026-09-01T12:00:00Z', note: null }])
    show('ask-garden'); await screen.findByRole('heading', { name: '¿Qué quieres saber?' })
    await send('¿Cuándo fue la última cosecha de cilantro?')
    expect(screen.getByText(/Última cosecha registrada de Cilantro/i)).toBeTruthy()
    const date = new Intl.DateTimeFormat('es-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date('2026-09-01T12:00:00Z'))
    expect(screen.getByText(new RegExp(date))).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir ciclo' }).getAttribute('href')).toBe('/cycle/cycle-a')
    fireEvent.click(screen.getByText('Fuentes confirmadas'))
    expect(screen.getByText('Historial de Grow Cycle')).toBeTruthy(); expect(gateway.askGarden).not.toHaveBeenCalled(); noWrites()
  })
  it('shows the question immediately during slow AI and renders interpretation/sources without executing suggested actions', async () => {
    vi.mocked(gateway.aiGatewayStatus).mockReturnValue('ready')
    const pending = deferred<AskGardenAnswerV1>(); vi.mocked(gateway.askGarden).mockReturnValue(pending.promise)
    show('ask-garden'); await screen.findByRole('heading', { name: '¿Qué quieres saber?' })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '¿Cómo va Basil?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar pregunta' }))
    expect(screen.getByText('¿Cómo va Basil?')).toBeTruthy()
    expect(screen.getByText('Consultando Garden X…')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Consultando' }).hasAttribute('disabled')).toBe(true)
    noWrites(); await act(async () => pending.resolve(aiAnswer))
    await screen.findByText(aiAnswer.answer)
    fireEvent.click(screen.getByText('Interpretación de Garden AI'))
    expect(screen.getByText('Historial confirmado · Evidencia fotográfica')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Observa la planta' })).toBeNull(); noWrites()
  })
  it('preserves bounded conversation history and request keys', async () => {
    vi.mocked(gateway.aiGatewayStatus).mockReturnValue('ready')
    vi.mocked(gateway.askGarden).mockResolvedValue({ ...aiAnswer, answer: 'A'.repeat(650) })
    show('ask-garden'); await screen.findByRole('heading', { name: '¿Qué quieres saber?' })
    for (let i = 0; i < 6; i++) await send(`Consulta ${i} ${'x'.repeat(320)}`)
    const calls = vi.mocked(gateway.askGarden).mock.calls
    expect(calls[5][0].conversation).toHaveLength(4)
    expect(calls[5][0].conversation?.[0].question.startsWith('Consulta 1')).toBe(true)
    expect(calls[5][0].conversation?.every(item => item.question.length === 300 && item.answer.length === 500)).toBe(true)
    expect(new Set(calls.map(([input]) => input.requestKey)).size).toBe(6); noWrites()
  })
  it('retains a failed question, supports retrying a new request, and omits sources when none exist', async () => {
    vi.mocked(gateway.aiGatewayStatus).mockReturnValue('ready')
    vi.mocked(gateway.askGarden).mockRejectedValueOnce(new Error('Consulta fallida')).mockResolvedValue({ ...aiAnswer, confirmed_facts: [], answer_type: 'needs_clarification', answer: '¿De qué jardín?' })
    show('ask-garden'); await screen.findByRole('heading', { name: '¿Qué quieres saber?' })
    await send('¿Cómo va Basil?'); expect(screen.getByRole('alert').textContent).toBe('Consulta fallida')
    expect(screen.getByText('¿Cómo va Basil?')).toBeTruthy()
    await send('Basil de la ventana'); await screen.findByText('¿De qué jardín?')
    expect(screen.queryByText('Interpretación de Garden AI')).toBeNull(); noWrites()
  })
  it('keeps Enter submission, Shift+Enter editing, maxlength and new-session semantics', async () => {
    show('ask-garden'); await screen.findByRole('heading', { name: '¿Qué quieres saber?' })
    const input = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(input.maxLength).toBe(2000)
    fireEvent.change(input, { target: { value: '¿Qué pendientes tengo hoy?' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true }); expect(screen.queryByText('Fuentes confirmadas')).toBeNull()
    fireEvent.keyDown(input, { key: 'Enter' }); await screen.findByText('Fuentes confirmadas')
    fireEvent.click(screen.getByRole('button', { name: 'Nueva sesión' }))
    await screen.findByRole('heading', { name: '¿Qué quieres saber?' })
    expect(screen.queryByText('Fuentes confirmadas')).toBeNull(); expect(input.value).toBe(''); noWrites()
  })
  it('honors reduced motion for thread scrolling', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    show('ask-garden'); await screen.findByRole('heading', { name: '¿Qué quieres saber?' }); await send('¿Qué pendientes tengo hoy?')
    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'end' }); noWrites()
  })
})
