import { createDataset, ownerId, scenarios, syntheticPhoto, type Scenario } from './data'

type Call = { name: string; kind: 'read' | 'visit' | 'blocked'; args: unknown[] }
let scenario: Scenario = 'normal'
let dataset = createDataset()
let delay = 0
let failingRead: string | null = null
const calls: Call[] = []

export function reset(s: Scenario = 'normal') {
  if (!scenarios.includes(s)) throw new Error('Unknown QA scenario')
  scenario = s; dataset = createDataset(s); delay = s === 'slow' ? 1500 : 0
  failingRead = s === 'read-error' ? 'getHomeDashboard' : null; calls.length = 0
}
export function snapshot() { return { scenario, calls: structuredClone(calls), dataset: structuredClone(dataset) } }
export function failRead(name: string) { failingRead = name }
export function setDelay(ms: number) { delay = Math.max(0, Math.min(ms, 5000)) }
export function blocked(name: string, args: unknown[] = []): never {
  calls.push({ name, kind: 'blocked', args: structuredClone(args) })
  throw new Error(`04.A: ${name} está bloqueado. El baseline no simula ni ejecuta esta escritura/servicio.`)
}
function find<T extends { id: string }>(values: T[], id: unknown): T {
  const item = values.find(v => v.id === id)
  if (!item) throw new Error(`No existe ese ID en el fixture 04.A: ${String(id)}`)
  return item
}

/** Missing ports fail closed. We do not implement a second canonical backend. */
export async function invoke(name: string, args: unknown[] = []): Promise<unknown> {
  if (name === 'acknowledgeHomeSnapshot') { calls.push({ name, kind: 'visit', args }); return }
  const reads: Record<string, () => unknown> = {
    getCurrentUser: () => ({ id: ownerId }),
    getHome: () => dataset.dashboard.gardens,
    getHomeDashboard: () => dataset.dashboard,
    getHomeMedia: () => ({ home_headline: 'Tu jardín, vivo. · QA', home_hero_photo: scenario === 'empty' ? null : dataset.cycles[0].cover_photo ?? null, home_hero_choices: [] }),
    getGarden: () => find(dataset.gardens, args[0]),
    getCycle: () => find(dataset.cycles, args[0]),
    getGardenCoverPhotos: () => dataset.cycles.filter(c => c.garden.id === find(dataset.gardens, args[0]).id).flatMap(c => c.history.filter(e => e.photo).map(e => ({ ...e.photo!, event_id: e.id, event_type: e.event_type, is_cover: e.photo?.id === dataset.gardens.find(g => g.id === c.garden.id)?.cover_photo?.id }))),
    getAttention: () => dataset.attention,
    getControlV2: () => dataset.control,
    getHarvestHistory: () => [],
    getMaintenanceSession: () => find([dataset.session], args[0]),
    getOpenMaintenanceSession: () => scenario === 'empty' ? null : ({ id: dataset.session.id, state: dataset.session.state, started_at: dataset.session.started_at }),
    getSignedPhotoUrl: () => syntheticPhoto(String(args[0])),
    getObservationDrafts: () => [],
    getGuestPlantStories: () => [],
    getGuestGardenStories: () => [],
  }
  if (!reads[name]) return blocked(name, args)
  calls.push({ name, kind: 'read', args: structuredClone(args) })
  if (delay && name !== 'getCurrentUser') await new Promise(resolve => setTimeout(resolve, delay))
  if (failingRead === name) { failingRead = null; throw new Error('Error de lectura simulado 04.A. No se contactó ningún servicio.') }
  return structuredClone(reads[name]())
}
