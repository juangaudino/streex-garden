import type { AttentionItem, ControlRow, GardenDetail, GrowCycleDetail, HomeDashboard, MaintenanceSession } from '../src/domain/types'

const options = new URLSearchParams(location.search)
const delay = () => new Promise((resolve) => setTimeout(resolve, options.has('slow') ? 900 : 100))
const history: GrowCycleDetail['history'] = Array.from({ length: options.has('one') ? 1 : 36 }, (_, index) => ({ id: `event-${index}`, event_type: 'observation', occurred_at: new Date(Date.UTC(2026, 8, 7 - index * 3, 12)).toISOString(), note: index === 0 ? 'Registro de prueba para verificar la composición y la lectura del historial. Esta nota permanece completa.' : index % 4 === 0 ? 'Nota de prueba conservada íntegramente.' : null, revision: 1,
  photo: { id: `photo-${index}`, storage_path: `fixture-${index}`, original_filename: 'fotografia-documental-qa.jpeg', content_type: 'image/jpeg', byte_size: 1, checksum_sha256: null, upload_status: index === 5 ? 'pending' : 'uploaded', captured_at: index % 3 === 0 ? null : new Date(Date.UTC(2026, 8, 7 - index * 3, 10)).toISOString(), captured_at_precision: index % 3 === 0 ? 'unknown' : index % 3 === 1 ? 'exact' : 'approximate' },
}))
const baseCycle: GrowCycleDetail = { id: 'plant', crop_name: 'Cultivo de prueba', planted_on: null, planted_on_precision: 'unknown', harvest_readiness: 'not_yet', state: 'active', revision: 1, position: { id: 'p7', position_number: 7 }, garden: { id: 'qa', name: 'Jardín de prueba' }, history, corrections: [] }
const garden: GardenDetail = { id: 'qa', name: 'Jardín de prueba', system_model: 'Sistema QA', position_capacity: 8, map_layout: 'uruq_8_v1', positions: Array.from({ length: 8 }, (_, index) => ({ id: `p${index + 1}`, position_number: index + 1, current_cycle: index === 6 ? baseCycle : null, previous_cycles: [] })), layout_sites: [[2,1],[6,1],[1,2],[4,2],[7,2],[1,3],[4,3],[7,3]].map(([x,y], index) => ({ id: `site${index}`, position_id: `p${index + 1}`, position_number: index + 1, site_kind: 'grow', is_active: true, grid_x: x, grid_y: y, label: null })) }
const dashboard: HomeDashboard = { visit: { id: 'qa-visit', base_cursor: 1, snapshot_cursor: 3, snapshot_at: '2026-09-08T12:00:00Z', first_visit: false, visit_gap_minutes: 180 }, gardens: [
  { id: 'qa', name: 'Jardín de prueba', system_model: 'URUQ', position_capacity: 8, map_layout: 'uruq_8_v1', active_positions: 1 },
  { id: 'qa-2', name: 'Jardín de hoja', system_model: 'URUQ', position_capacity: 12, map_layout: 'uruq_12_v1', active_positions: 4 },
], since_last_time: { changes: [{ cursor: 3, kind: 'event', garden_id: 'qa', grow_cycle_id: 'plant', occurred_at: '2026-09-08T10:00:00Z', committed_at: '2026-09-08T10:00:00Z', summary: 'Nueva observación registrada' }] }, attention: { items: [] } }
const attention: AttentionItem[] = [{ id: 'attention-qa', garden_id: 'qa', grow_cycle_id: 'plant', purpose: 'evaluate_visual_review', subject_key: 'qa', title: 'Revisar cultivo de prueba', origin: 'visual_review', due_on: '2026-09-09', next_review_on: null, created_at: '2026-09-08T10:00:00Z' }]
const controlRows: ControlRow[] = [
  { garden_id: 'qa', garden_name: 'Jardín de prueba', position_id: 'p7', position_number: 7, grow_cycle_id: 'plant', crop_name: 'Cultivo de prueba', planted_on: null, harvest_readiness: 'not_yet', attention_count: 1 },
  { garden_id: 'qa', garden_name: 'Jardín de prueba', position_id: 'p8', position_number: 8, grow_cycle_id: null, crop_name: null, planted_on: null, harvest_readiness: null, attention_count: 0 },
]
let session: MaintenanceSession = { id: 'qa', state: 'in_progress', started_at: '2026-09-07T12:00:00Z', cursor_position: 1, positions: [7,8,6].map((number, index) => ({ id: `step${index}`, garden_id: 'qa', garden_name: 'Jardín de prueba', position_id: `p${number}`, position_number: number, captured_grow_cycle_id: number === 6 ? null : number === 8 ? 'plant8' : 'plant', current_grow_cycle_id: options.has('changed') && index === 0 ? 'successor' : number === 6 ? null : number === 8 ? 'plant8' : 'plant', crop_name: number === 6 ? null : 'Cultivo de prueba', progress: 'not_reviewed', ordinal: index + 1 })) }
export async function getCycle(id: string) { await delay(); return { ...baseCycle, id, position: { id: id === 'plant8' ? 'p8' : 'p7', position_number: id === 'plant8' ? 8 : 7 }, history: options.has('bare') ? [] : history } }
export async function getHomeDashboard() { await delay(); return dashboard }
export async function acknowledgeHomeSnapshot() {}
export async function getHome() { await delay(); return dashboard.gardens }
export async function getAttention() { await delay(); return attention }
export async function getControlV2() { await delay(); return controlRows }
export async function getGarden() { await delay(); return garden }
export async function getSignedPhotoUrl() { await delay(); if (options.has('photo-error')) throw new Error('Foto no disponible · QA'); return '/qa-photo' }
export async function getOpenMaintenanceSession() { return null }
export async function getMaintenanceSession() { await delay(); return structuredClone(session) }
export async function progressMaintenancePosition(_request: string, id: string, progress: 'reviewed' | 'skipped') { await delay(); if (options.has('save-error')) throw new Error('Error simulado: no se guardó el progreso'); session = { ...session, positions: session.positions.map((position) => position.id === id ? { ...position, progress } : position) } }
export async function setMaintenanceSessionState(_request: string, _id: string, state: MaintenanceSession['state']) { session.state = state }
