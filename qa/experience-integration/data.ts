import type { AttentionItem, ControlPosition, ControlProjection, GardenDetail, GardenSummary, GrowCycleDetail, HomeDashboard, MaintenanceSession, ObservationDraft, PhotoEvidence } from '../../src/domain/types'

export const scenarios = ['normal', 'dense', 'empty', 'no-photo', 'read-error', 'slow', 'pending-drafts'] as const
export type Scenario = typeof scenarios[number]
export const ownerId = '44444444-4444-4444-8444-444444444404'
export const visitId = '44444444-4444-4444-8444-444444444405'
export const referenceDate = '2026-09-13'
const instant = `${referenceDate}T12:00:00Z`
const photo = (id: string, capturedAt: string): PhotoEvidence => ({ id, storage_path: `qa-synthetic/${id}`, original_filename: `${id}.png`, content_type: 'image/png', byte_size: 1, checksum_sha256: null, captured_at: capturedAt, captured_at_precision: 'exact', upload_status: 'uploaded' })

/** One relational fixture for all real routes. No account, original or signed URL. */
export function createDataset(scenario: Scenario = 'normal') {
  const cycle = (i: number, gardenId: string, position: number, closed = false): GrowCycleDetail => {
    const history: GrowCycleDetail['history'] = scenario === 'empty' ? [] : Array.from({ length: scenario === 'dense' ? 24 : 6 }, (_, n) => {
      const occurredAt = new Date(Date.parse(closed ? '2026-07-31T12:00:00Z' : '2026-09-12T12:00:00Z') - n * 86400000).toISOString()
      return { id: `qa-event-${i}-${n}`, event_type: n === 1 ? 'intervention' : 'observation', revision: 1, occurred_at: occurredAt, occurred_at_precision: 'timestamp', note: `Momento sintético ${n + 1}. Evidencia de prueba sin datos reales.`, event_data: n === 1 ? { intervention_type: 'thinning', qa_source: `fixture-cycle-${i}` } : { qa_source: `fixture-cycle-${i}` }, photo: scenario === 'no-photo' || n > 2 ? null : photo(`qa-photo-${i}-${n}`, occurredAt) }
    })
    return { id: `qa-cycle-${i}`, crop_name: i === 1 ? 'Genovese Basil' : i === 2 ? 'Chives' : i === 3 ? 'English Thyme' : 'Cilantro', planted_on: closed ? '2026-06-15' : '2026-08-01', planted_on_precision: 'exact', state: closed ? 'closed' : 'active', revision: 2, harvest_readiness: 'evaluate', garden: { id: gardenId, name: gardenId === 'qa-garden-1' ? 'Jardín de la ventana · QA' : 'Jardín del estudio · QA' }, position: { id: `${gardenId}-p${position}`, position_number: position }, history, corrections: [], cover_photo: history[0]?.photo }
  }
  const cycles = [cycle(1, 'qa-garden-1', 1), cycle(2, 'qa-garden-1', 2), cycle(3, 'qa-garden-2', 1), cycle(4, 'qa-garden-1', 1, true)]
  const gardens: GardenDetail[] = [1, 2].map(i => {
    const id = `qa-garden-${i}`
    return { id, name: i === 1 ? 'Jardín de la ventana · QA' : 'Jardín del estudio · QA', system_model: 'URUQ · fixture', position_capacity: 8, map_layout: 'uruq_8_v1', cover_photo: cycles.find(c => c.garden.id === id)?.cover_photo, positions: Array.from({ length: 8 }, (_, n) => ({ id: `${id}-p${n + 1}`, position_number: n + 1, current_cycle: cycles.find(c => c.state === 'active' && c.position.id === `${id}-p${n + 1}`) ?? null, previous_cycles: i === 1 && n === 0 ? [{ ...cycles[3], last_occupied_on: '2026-08-01' }] : [] })), layout_sites: Array.from({ length: 8 }, (_, n) => ({ id: `${id}-s${n + 1}`, position_id: `${id}-p${n + 1}`, position_number: n + 1, site_kind: 'grow', is_active: true, grid_x: (n % 4) * 2 + 1, grid_y: Math.floor(n / 4) + 1, label: null })) }
  })
  const summaries: GardenSummary[] = scenario === 'empty' ? [] : gardens.map(g => ({ id: g.id, name: g.name, system_model: g.system_model, position_capacity: g.position_capacity, map_layout: g.map_layout, cover_photo: g.cover_photo, active_positions: g.positions.filter(p => p.current_cycle).length }))
  const attention: AttentionItem[] = scenario === 'empty' ? [] : Array.from({ length: scenario === 'dense' ? 16 : 3 }, (_, i) => {
    const c = cycles[i % 3]
    return { id: `qa-task-${i + 1}`, garden_id: c.garden.id, garden_name: c.garden.name, grow_cycle_id: c.id, position_id: c.position.id, position_number: c.position.position_number, crop_name: c.crop_name, purpose: i % 2 ? 'perform_support' : 'evaluate_pruning', subject_key: `qa-subject-${i}`, title: i % 2 ? 'Añadir soporte' : 'Evaluar poda', origin: 'manual', due_on: i % 3 === 0 ? '2026-09-12' : i % 3 === 1 ? '2099-01-01' : null, next_review_on: null, created_at: instant }
  })
  const session: MaintenanceSession = { id: 'qa-session', state: 'in_progress', started_at: instant, cursor_position: 1, positions: cycles.filter(c => c.state === 'active').map((c, i) => ({ id: `qa-step-${i + 1}`, garden_id: c.garden.id, garden_name: c.garden.name, position_id: c.position.id, position_number: c.position.position_number, captured_grow_cycle_id: c.id, current_grow_cycle_id: c.id, crop_name: c.crop_name, progress: 'not_reviewed', health_confirmed: false, inspection_source: null, inspected_at: null, ordinal: i + 1 })) }
  const positions: ControlPosition[] = cycles.filter(c => c.state === 'active').map(c => ({ position: { id: c.position.id, number: c.position.position_number }, grow_cycle_id: c.id, plant: { name: c.crop_name }, planting: { date: c.planted_on, precision: c.planted_on_precision }, age: { days: 43, status: 'known', precision: 'exact' }, last_thinning: null, next_thinning_evaluation: { kind: 'not_scheduled', task: null, evidence: null }, harvest_readiness: { value: c.harvest_readiness, reason: null, evidence: null }, current_state: { kind: 'insufficient_evidence', reason: null, evidence: null }, germination: { status: 'no_observation', evidence: null }, plant_count: null, action: null }))
  const control: ControlProjection = { reference_date: referenceDate, interpretation: 'Proyección sintética. No describe plantas reales.', positions: scenario === 'empty' ? [] : positions, gardens: scenario === 'empty' ? [] : gardens.map(g => ({ garden_id: g.id, garden_name: g.name, summary: {}, germination_coverage: { occupied_positions: g.positions.filter(p => p.current_cycle).length, confirmed_positions: 0 }, shared_actions: [], relevant_facts: [], positions: positions.filter(p => cycles.find(c => c.id === p.grow_cycle_id)?.garden.id === g.id) })) }
  const dashboard: HomeDashboard = { visit: { id: visitId, base_cursor: 1, snapshot_cursor: 12, snapshot_at: instant, first_visit: false, visit_gap_minutes: 30 }, gardens: summaries, attention: { items: attention }, since_last_time: { changes: scenario === 'empty' ? [] : cycles.slice(0, 3).map((c, i) => ({ cursor: i + 2, kind: 'event', garden_id: c.garden.id, grow_cycle_id: c.id, occurred_at: instant, committed_at: instant, summary: `Un momento en ${c.crop_name} · QA sintética` })) } }
  const drafts: ObservationDraft[] = scenario === 'pending-drafts' ? [{ id: 'qa-draft', requestId: '44444444-4444-4444-8444-444444444406', growCycleId: cycles[0].id, note: 'Borrador sintético sin guardar', createdAt: instant, status: 'queued' }] : []
  return { cycles, gardens, attention, session, control, dashboard, drafts }
}

export function syntheticPhoto(path: string): string {
  if (!/^qa-synthetic\/qa-photo-\d+-\d+$/.test(path)) throw new Error('Only labelled synthetic media is allowed in 04.A.')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900"><rect width="720" height="900" fill="#b8c7a5"/><path d="M350 820 Q410 390 350 120" stroke="#375a3d" stroke-width="12" fill="none"/><ellipse cx="250" cy="420" rx="140" ry="66" fill="#618053" transform="rotate(25 250 420)"/><ellipse cx="455" cy="280" rx="145" ry="70" fill="#7e985c" transform="rotate(-30 455 280)"/><text x="30" y="850" fill="#193a30" font-size="22">QA · IMAGEN SINTÉTICA · SIN DATOS REALES</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
