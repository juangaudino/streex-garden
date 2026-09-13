import type { AttentionItem, AttentionPurpose, ControlPosition, ControlProjection, GardenHarvestRecord, GardenSummary, HomeDashboard, PhotoEvidence, ObservationDraft } from '../../src/domain/types'
import type { AskGardenAnswerV1 } from '../../src/domain/ai'
import { attentionPurposeLabel, cycleAttentionPurposes, gardenAttentionPurposes } from '../../src/domain/attention-purpose'

function todayLocal() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export type Scenario = 'normal' | 'single' | 'empty' | 'dense' | 'no-photo' | 'first-visit' | 'cached' | 'open-session' | 'read-error' | 'mixed-attention' | 'tasks-empty' | 'partial-context' | 'ai-answer' | 'ai-long' | 'ai-clarification' | 'ai-no-sources' | 'ai-error'
export const scenarios: Scenario[] = ['normal', 'single', 'empty', 'dense', 'no-photo', 'first-visit', 'cached', 'open-session', 'read-error', 'mixed-attention', 'tasks-empty', 'partial-context', 'ai-answer', 'ai-long', 'ai-clarification', 'ai-no-sources', 'ai-error']
export const ownerId = '33333333-3333-4333-8333-333333333333'
export const visitId = '44444444-4444-4444-8444-444444444444'
export const calls: Array<{ name: string; input: unknown }> = []
let dashboard: HomeDashboard
let activeScenario: Scenario = 'normal'
let openSession: { id: string; state: 'paused'; started_at: string } | null = null
let failRead = false, failWrite = false, delay = 0
const photo = (i: number): PhotoEvidence => ({ id: `qa-cover-${i}`, storage_path: `qa-synthetic-${i}`, original_filename: 'QA-sintetica.svg', content_type: 'image/png', byte_size: 1, checksum_sha256: null, captured_at: null, captured_at_precision: 'unknown', upload_status: 'uploaded' })
export function resetScenario(scenario: Scenario) {
  activeScenario = scenario
  calls.length = 0; failRead = scenario === 'cached' || scenario === 'read-error'; failWrite = false; delay = 0
  const count = scenario === 'empty' ? 0 : scenario === 'single' ? 1 : scenario === 'dense' ? 7 : 2
  const gardens: GardenSummary[] = Array.from({ length: count }, (_, i) => ({ id: `qa-garden-${i}`, name: scenario === 'dense' && i === 0 ? 'El jardín de la ventana con un nombre especialmente largo' : `Jardín de prueba ${i + 1}`, system_model: i === 0 ? 'URUQ' : null, position_capacity: 8, active_positions: i + 1, map_layout: 'uruq_8_v1', cover_photo: scenario === 'no-photo' || i % 2 ? null : photo(i) }))
  dashboard = { visit: { id: visitId, base_cursor: 1, snapshot_cursor: 12, snapshot_at: '2026-09-13T12:00:00Z', first_visit: scenario === 'first-visit', visit_gap_minutes: 30 }, gardens, since_last_time: { changes: count === 0 ? [] : Array.from({ length: scenario === 'dense' ? 12 : 4 }, (_, i) => ({ cursor: i + 2, kind: 'event', garden_id: 'qa-garden-0', grow_cycle_id: i % 2 ? null : 'qa-cycle', occurred_at: '2026-09-13T12:00:00Z', committed_at: '2026-09-13T12:00:00Z', summary: `Registro sintético ${i + 1}: observación de prueba sin datos reales.` })) }, attention: { items: count === 0 ? [] : [{ id: 'qa-task', garden_id: 'qa-garden-0', garden_name: gardens[0].name, grow_cycle_id: 'qa-cycle', crop_name: 'Cultivo de prueba', position_number: 1, purpose: 'evaluate_pruning', title: 'Evaluar poda · simulada', subject_key: 'general', origin: 'manual', due_on: '2099-01-01', next_review_on: null, created_at: '2026-09-13T12:00:00Z' }, { id: 'qa-task-system', garden_id: 'qa-garden-0', garden_name: gardens[0].name, grow_cycle_id: null, purpose: 'perform_nutrients', title: 'Aplicar nutrientes · simulado', subject_key: 'general', origin: 'manual', due_on: null, next_review_on: null, created_at: '2026-09-13T12:00:00Z' }] } }
  if (scenario === 'tasks-empty') dashboard.attention.items = []
  if (scenario === 'mixed-attention' || scenario === 'partial-context') {
    const dates = ['2000-01-01', todayLocal(), '2099-01-01', null]
    dashboard.attention.items = [...cycleAttentionPurposes, ...gardenAttentionPurposes].map((choice, i): AttentionItem => ({
      id: `qa-task-${i}`, garden_id: gardens[0].id, garden_name: gardens[0].name,
      grow_cycle_id: i < cycleAttentionPurposes.length ? 'qa-cycle' : null,
      crop_name: 'Cultivo de prueba', position_number: 1, purpose: choice.value,
      title: attentionPurposeLabel(choice.value), subject_key: 'general', origin: 'manual',
      due_on: dates[i % dates.length], next_review_on: null, created_at: '2026-09-13T12:00:00Z',
    }))
    if (scenario === 'partial-context') dashboard.attention.items[0] = { ...dashboard.attention.items[0], garden_id: null, garden_name: undefined, grow_cycle_id: null, crop_name: undefined, position_number: undefined }
  }
  openSession = scenario === 'open-session' ? { id: 'qa-session', state: 'paused', started_at: '2026-09-13T12:00:00Z' } : null
  // The harness has its own origin and a synthetic owner; never seed a real account key.
  const key = `streex-garden:home-visit:${ownerId}`
  localStorage.removeItem(key); localStorage.removeItem(`${key}:snapshot`)
  if (scenario === 'cached') { localStorage.setItem(key, visitId); localStorage.setItem(`${key}:snapshot`, JSON.stringify(dashboard)) }
}
export function failNextRead() { failRead = true }
export function failNextWrite() { failWrite = true }
export function setReadDelay(enabled: boolean) { delay = enabled ? 1800 : 0 }
async function read(name: string, input: unknown = null) {
  calls.push({ name, input }); if (delay) await new Promise(resolve => setTimeout(resolve, delay))
  if (failRead) { failRead = false; throw new Error('Lectura fallida simulada. No se consultó ningún servicio real.') }
}
function write(name: string, input: unknown) {
  calls.push({ name, input })
  if (failWrite) { failWrite = false; throw new Error('Guardado fallido simulado. No cambió ningún dato real.') }
}
export async function getHomeDashboard(id: string | null) { await read('getHomeDashboard', id); return structuredClone(dashboard) }
export async function getHome() { await read('getHome'); return structuredClone(dashboard.gardens) }
export async function getHomeMedia() { await read('getHomeMedia'); return { home_headline: 'Tu jardín, vivo. · QA sintética', home_hero_photo: dashboard.gardens[0]?.cover_photo ?? null, home_hero_choices: [] } }
export async function getGardenCoverPhotos(id: string) { await read('getGardenCoverPhotos', id); return [] }
export async function getOpenMaintenanceSession() { await read('getOpenMaintenanceSession'); return structuredClone(openSession) }
export async function acknowledgeHomeSnapshot(id: string, cursor: number) { calls.push({ name: 'acknowledgeHomeSnapshot', input: { id, cursor } }) }
export async function startMaintenanceSession(requestId: string, gardenIds: string[]) { write('startMaintenanceSession', { requestId, gardenIds }); return { session_id: 'qa-session-new' } }
export async function setMaintenanceSessionState(requestId: string, id: string, state: string) { write('setMaintenanceSessionState', { requestId, id, state }); openSession = null }
export async function createGarden(input: { requestId: string; name: string; systemModel: string; positionCapacity: number }) { write('createGarden', input); return { garden_id: 'qa-garden-new' } }
export async function getSignedPhotoUrl(path: string, rendition: string) {
  calls.push({ name: 'getSignedPhotoUrl', input: { path, rendition } })
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="#c5d2b7"/><path d="M450 560Q380 320 465 100" stroke="#526e49" stroke-width="10" fill="none"/><ellipse cx="340" cy="320" rx="155" ry="70" fill="#769264" transform="rotate(25 340 320)"/><ellipse cx="560" cy="210" rx="160" ry="70" fill="#8ca576" transform="rotate(-30 560 210)"/><text x="30" y="560" fill="#193a30" font-size="22">QA · IMAGEN SINTÉTICA · SIN DATOS REALES</text></svg>'
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
export async function getObservationDrafts(): Promise<ObservationDraft[]> { return [] }
export async function clearObservationDrafts() { /* No real drafts exist in the harness. */ }
export function downloadObservationDrafts() { throw new Error('Exportación de borradores fuera de esta prueba.') }
function blocked(): never { throw new Error('Operación fuera del alcance del harness aislado de Fase 03.') }
export const signOut = blocked
export const setGardenCover = blocked
export const uploadScopedPhoto = blocked
export async function getAttention() { await read('getAttention'); return structuredClone(dashboard.attention.items) }
export async function createAttentionItem(input: { requestId: string; gardenId: string; growCycleId: string | null; purpose: AttentionPurpose; subjectKey: string; dueOn: string | null }) {
  write('createAttentionItem', input)
  const existing = dashboard.attention.items.find(item => item.garden_id === input.gardenId && item.grow_cycle_id === input.growCycleId && item.purpose === input.purpose && item.subject_key === input.subjectKey)
  if (existing) return { task_id: existing.id, created: false }
  const id = `qa-created-${input.requestId}`
  dashboard.attention.items.push({ id, garden_id: input.gardenId, garden_name: dashboard.gardens.find(garden => garden.id === input.gardenId)?.name, grow_cycle_id: input.growCycleId, purpose: input.purpose, subject_key: input.subjectKey, title: attentionPurposeLabel(input.purpose), origin: 'manual', due_on: input.dueOn, next_review_on: null, created_at: new Date().toISOString() })
  return { task_id: id, created: true }
}
export async function completeAttentionItem(input: { requestId: string; taskId: string; note?: string; reviewResult?: string | null }) {
  write('completeAttentionItem', input)
  dashboard.attention.items = dashboard.attention.items.filter(item => item.id !== input.taskId)
  return { task_id: input.taskId, event_id: `qa-event-${input.requestId}` }
}
export async function deferAttentionItem(input: { requestId: string; taskId: string; nextReviewOn: string; reason?: string }) {
  write('deferAttentionItem', input)
  const task = dashboard.attention.items.find(item => item.id === input.taskId)
  if (task) task.next_review_on = input.nextReviewOn
}
export async function dismissAttentionItem(input: { requestId: string; taskId: string; reason: string }) {
  write('dismissAttentionItem', input)
  dashboard.attention.items = dashboard.attention.items.filter(item => item.id !== input.taskId)
}
export async function getControlV2(): Promise<ControlProjection> {
  await read('getControlV2')
  const positions: ControlPosition[] = dashboard.gardens.length === 0 ? [] : Array.from({ length: 3 }, (_, i) => ({
    position: { id: `qa-position-${i}`, number: i + 1 }, grow_cycle_id: `qa-cycle-${i}`,
    plant: { name: ['Genovese Basil', 'Common Mint', 'English Thyme'][i] }, planting: { date: '2026-09-01', precision: 'exact' },
    age: { days: 12, status: 'known', precision: 'exact' }, last_thinning: null,
    next_thinning_evaluation: { kind: 'not_scheduled', task: null, evidence: null },
    harvest_readiness: { value: i === 0 ? 'evaluate' : 'not_yet', reason: null, evidence: null },
    current_state: { kind: i === 1 ? 'watch' : 'insufficient_evidence', evidence: null, reason: null },
    germination: { status: 'no_observation', evidence: null }, plant_count: null, action: null,
  }))
  return { reference_date: todayLocal(), interpretation: 'Contexto sintético, sin servicios reales.', gardens: [], positions }
}
export async function getHarvestHistory(): Promise<GardenHarvestRecord[]> {
  await read('getHarvestHistory')
  return dashboard.gardens.length === 0 ? [] : [{ event_id: 'qa-harvest', grow_cycle_id: 'qa-cycle', garden_id: dashboard.gardens[0].id, garden_name: dashboard.gardens[0].name, position_id: 'qa-position-0', position_number: 1, crop_name: 'Genovese Basil', occurred_on: '2026-09-01', occurred_at: '2026-09-01T12:00:00Z', note: null }]
}
// This is a local fixture, never the product gateway and never a provider call.
export function aiGatewayStatus(): 'ready' | 'disabled' { return activeScenario.startsWith('ai-') ? 'ready' : 'disabled' }
export async function askGarden(input: { question: string; requestKey: string; conversation?: Array<{ question: string; answer: string }> }): Promise<AskGardenAnswerV1> {
  await read('askGarden (SIMULATED)', input)
  if (activeScenario === 'ai-error') throw new Error('Respuesta AI fallida simulada. No se contactó a Garden AI.')
  return {
    schema_version: 'garden_ai_ask_v1', answer_type: activeScenario === 'ai-clarification' ? 'needs_clarification' : 'answer',
    answer: activeScenario === 'ai-clarification' ? 'Hay dos plantas de prueba. ¿A cuál te refieres?' : activeScenario === 'ai-long' ? Array.from({ length: 12 }, (_, i) => `Párrafo ${i + 1}. Esta interpretación sintética mantiene separados los datos confirmados y la observación. No registra hechos ni activa servicios reales.`).join('\n\n') : 'La fotografía de prueba permite observar el crecimiento, pero no confirma un estado nuevo. Esta respuesta es simulada.',
    confirmed_facts: activeScenario === 'ai-no-sources' ? [] : [{ source: { kind: 'photo', id: 'qa-photo' }, claim: 'Fotografía sintética' }, { source: { kind: 'event', id: 'qa-event' }, claim: 'Hecho sintético' }, { source: { kind: 'control', id: 'qa-control' }, claim: 'Proyección sintética' }],
    suggested_next_actions: ['Una propuesta simulada no guarda ningún dato'],
  }
}
