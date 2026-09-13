import type { AttentionItem, AttentionPurpose, CycleFactType, CycleHistoryEvent, GrowCycleDetail, ObservationDraft, PhotoEvidence } from '../../src/domain/types'
import type { GardenAiCheckProposalV1 } from '../../src/domain/ai'

export type Scenario = 'portrait' | 'landscape' | 'dense' | 'empty' | 'closed' | 'approximate' | 'unknown'
let cycle: GrowCycleDetail
let tasks: AttentionItem[] = []
let drafts: ObservationDraft[] = []
let failRead = false, failWrite = false
const responses = new Map<string, unknown>()
const media = (number: number, landscape = false): PhotoEvidence => ({ id: `qa-photo-${number}${landscape ? '-landscape' : ''}`, storage_path: `qa-synthetic-${number}${landscape ? '-landscape' : ''}`, original_filename: `QA-sintetica-${number}.svg`, content_type: 'image/png', byte_size: 1, checksum_sha256: null, captured_at: null, captured_at_precision: 'unknown', upload_status: 'uploaded' })
const record = (number: number): CycleHistoryEvent => ({ id: `qa-event-${number}`, revision: 1, event_type: 'observation', occurred_at: `2026-09-${String(Math.max(1, 12 - number)).padStart(2, '0')}T12:00:00Z`, note: `Observación sintética ${number + 1}. Este texto no describe una planta real.`, photo: media(number) })
export function resetScenario(scenario: Scenario) {
  tasks = []; drafts = []; responses.clear(); failRead = false; failWrite = false
  cycle = { id: 'qa-plant', crop_name: scenario === 'dense' ? 'Un cultivo de nombre especialmente largo sin identidad botánica confirmada' : 'Genovese Basil', planted_on: scenario === 'unknown' ? null : '2026-08-01', planted_on_precision: scenario === 'unknown' ? 'unknown' : scenario === 'approximate' ? 'approximate' : 'exact', harvest_readiness: 'evaluate', state: scenario === 'closed' ? 'closed' : 'active', revision: 1, garden: { id: 'qa-garden', name: 'Jardín de prueba' }, position: { id: 'qa-position', position_number: 5 }, history: scenario === 'empty' ? [] : Array.from({ length: scenario === 'dense' ? 23 : 6 }, (_, i) => record(i)), corrections: [] }
  if (scenario === 'landscape') cycle.cover_photo = media(0, true)
  if (scenario !== 'empty') tasks.push({ id: 'qa-task', garden_id: 'qa-garden', grow_cycle_id: 'qa-plant', purpose: 'evaluate_pruning', title: 'Revisión de poda · simulada', origin: 'manual', subject_key: 'general', due_on: null, next_review_on: null, created_at: '2026-09-12T12:00:00Z' })
}
export function failNextRead() { failRead = true }
export function failNextWrite() { failWrite = true }
function read() { if (failRead) { failRead = false; throw new Error('Error de lectura simulado. Los datos de prueba siguen aquí.') } }
function write<T>(requestId: string, operation: () => T): T {
  if (responses.has(requestId)) return responses.get(requestId) as T
  if (failWrite) { failWrite = false; throw new Error('Error de guardado simulado. Reintenta sin perder los campos.') }
  const result = operation(); responses.set(requestId, result); return result
}
function addEvent(event_type: CycleHistoryEvent['event_type'], note: string | null, event_data?: Record<string, unknown>) {
  const event_id = `qa-${crypto.randomUUID()}`
  cycle.history.unshift({ id: event_id, event_type, revision: 1, occurred_at: new Date().toISOString(), note, event_data, photo: null })
  ++cycle.revision
  return { event_id }
}
export async function getCycle(id: string) { read(); return structuredClone({ ...cycle, id }) }
export async function getAttention() { read(); return structuredClone(tasks) }
export async function getGarden() { read(); return { positions: [{ id: 'qa-position', position_number: 5, current_cycle: cycle }, { id: 'qa-empty', position_number: 6, current_cycle: null }, { id: 'qa-occupied', position_number: 7, current_cycle: { ...cycle, id: 'qa-other', crop_name: 'Cultivo de prueba' } }] } }
export async function getSignedPhotoUrl(path: string) {
  const landscape = path.includes('landscape'), width = landscape ? 900 : 720, height = landscape ? 600 : 900
  // A labelled SVG is synthetic media, never a signed URL or an original from the account.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#b8c7a5"/><path d="M360 760 Q380 370 350 160" fill="none" stroke="#375a3d" stroke-width="12"/><ellipse cx="250" cy="420" rx="140" ry="66" fill="#618053" transform="rotate(25 250 420)"/><ellipse cx="455" cy="300" rx="145" ry="70" fill="#7e985c" transform="rotate(-30 455 300)"/><text x="35" y="${height - 70}" fill="#193a30" font-size="24">QA · IMAGEN SINTÉTICA</text><text x="35" y="${height - 35}" fill="#193a30" font-size="18">${path}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
export async function recordCycleFact(input: { requestId: string; factType: CycleFactType; factData: Record<string, unknown>; note: string; occurredOn: string }) { return write(input.requestId, () => { const result = addEvent(input.factType, input.note, input.factData); Object.assign(cycle.history[0], { occurred_on: input.occurredOn, occurred_at_precision: 'date' }); return result }) }
export async function createAttentionItem(input: { requestId: string; purpose: AttentionPurpose; dueOn: string | null }) { return write(input.requestId, () => { const task_id = crypto.randomUUID(); tasks.push({ id: task_id, purpose: input.purpose, garden_id: cycle.garden.id, grow_cycle_id: cycle.id, subject_key: 'general', title: `Seguimiento simulado · ${input.purpose}`, origin: 'manual', due_on: input.dueOn, next_review_on: null, created_at: new Date().toISOString() }); return { created: true, task_id } }) }
export async function completeAttentionItem(input: { requestId: string; taskId: string; reviewResult: string }) { return write(input.requestId, () => { tasks = tasks.filter(task => task.id !== input.taskId); return addEvent('development_review', 'Evaluación simulada.', { result: input.reviewResult }) }) }
export async function deferAttentionItem(input: { requestId: string; taskId: string; nextReviewOn: string }) { write(input.requestId, () => { const task = tasks.find(task => task.id === input.taskId); if (task) task.next_review_on = input.nextReviewOn }) }
export async function dismissAttentionItem(input: { requestId: string; taskId: string }) { write(input.requestId, () => { tasks = tasks.filter(task => task.id !== input.taskId) }) }
export async function recordHarvest(input: { requestId: string; note: string }) { return write(input.requestId, () => addEvent('harvest', input.note)) }
export async function moveCycle(input: { requestId: string; targetPositionId: string }) { return write(input.requestId, () => { cycle.position = { id: input.targetPositionId, position_number: input.targetPositionId === 'qa-empty' ? 6 : 7 }; return addEvent('cycle_moved', 'Traslado simulado.') }) }
export async function closeCycle(input: { requestId: string }) { write(input.requestId, () => { cycle.state = 'closed'; addEvent('cycle_ended', 'Cierre simulado.') }) }
export async function reopenCycle(input: { requestId: string }) { write(input.requestId, () => { cycle.state = 'active'; addEvent('cycle_started', 'Reapertura simulada.') }) }
export async function correctCyclePlanting(input: { requestId: string; plantedOn: string | null; plantedOnPrecision: GrowCycleDetail['planted_on_precision']; reason: string }) { write(input.requestId, () => { cycle.planted_on = input.plantedOn; cycle.planted_on_precision = input.plantedOnPrecision; cycle.corrections.unshift({ id: crypto.randomUUID(), operation: 'Corrección simulada', reason: input.reason, revision: ++cycle.revision, created_at: new Date().toISOString() }) }) }
export async function replaceCycle(input: { requestId: string; cropName: string }) { return write(input.requestId, () => { cycle = { ...cycle, id: 'qa-new', crop_name: input.cropName, history: [], corrections: [], cover_photo: undefined }; return { grow_cycle_id: 'qa-new' } }) }
export async function invalidateEvent(input: { requestId: string; eventId: string }) { write(input.requestId, () => { cycle.history = cycle.history.filter(event => event.id !== input.eventId) }) }
export async function setCycleCover(input: { requestId: string; photoId: string }) { write(input.requestId, () => { cycle.cover_photo = cycle.history.find(event => event.photo?.id === input.photoId)?.photo ?? undefined }) }
export async function setGardenCover(input: { requestId: string }) { write(input.requestId, () => undefined) }
export async function setHomeHero(input: { requestId: string }) { write(input.requestId, () => undefined) }
export async function retryPendingPhoto() { throw new Error('Recuperación de original real fuera de esta prueba.') }
export async function signOut() { throw new Error('Esta prueba no tiene sesión autenticada.') }
export async function getObservationDrafts() { return [...drafts] }
export async function saveObservationDraft(draft: ObservationDraft) { drafts = [...drafts.filter(item => item.id !== draft.id), draft]; return draft.id }
export async function clearObservationDrafts() { drafts = [] }
export async function syncObservationDraft(draft: ObservationDraft) { addEvent('observation', draft.note); if (draft.photo) cycle.history[0].photo = media(cycle.history.length); drafts = drafts.filter(item => item.id !== draft.id); return { result: 'synced' as const } }
const proposal: GardenAiCheckProposalV1 = { schema_version: 'garden_ai_check_v1', status: 'insufficient_evidence', summary: 'Propuesta sintética: revisar la densidad.', evidence_used: [], overall_visible_state: 'insufficient_evidence', development_recommendations: [{ kind: 'thinning', recommendation: 'evaluate', rationale: 'Ejemplo de QA.', confidence: 'low' }], observations: ['Esta propuesta no procede de un análisis real.'], uncertainty: ['Medios y resultados simulados.'], questions: [], suggested_next_actions: [], confidence: 'low' }
export async function requestAiCheck() { return structuredClone(proposal) }
export async function requestDraftAiCheck() { return structuredClone(proposal) }
