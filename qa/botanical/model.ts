// Explicit demonstration data, unrelated to account or canonical records.
export type View = 'plant' | 'maintenance' | 'film'
export type Scenario = 'normal' | 'empty' | 'loading' | 'error' | 'dense'
export type RecordKind = 'observation' | 'action' | 'followup'
export type DemoRecord = { id: string; kind: RecordKind; title: string; note: string; dueOn?: string }
export type Moment = { id: string; src: string; title: string; date: string; note: string; provenance: string }

export const viewNames: Record<View, string> = { plant: 'Planta', maintenance: 'Maintenance', film: 'Growth Film' }
export const fixtureMoments: Moment[] = Array.from({ length: 6 }, (_, i) => ({
  id: `reference-${i}`, src: '/botanical-reference.jpg',
  title: ['El comienzo', 'Una mirada más cerca', 'El paso de los días', 'Pequeños detalles', 'Una nueva mirada', 'Este momento'][i],
  date: 'Fecha de captura sin confirmar',
  note: 'Una fotografía de referencia. Los momentos de esta maqueta repiten la misma imagen para explorar la secuencia.',
  provenance: 'Referencia local · original.jpg',
}))

export const tracks = [
  { id: 'light', name: 'Growing Light', subtitle: 'Original de Garden X', url: '/audio/garden-growing-light-v1-loop.wav' },
  { id: 'four', name: 'Garden · Track 4', subtitle: 'Original de Garden X', url: '/audio/garden-track-4-v1-loop.wav' },
] as const

export const positions = [
  { name: 'Cilantro', botanical: 'Coriandrum sativum', number: 5 },
  { name: 'Genovese Basil', botanical: 'Ocimum basilicum', number: 1 },
  { name: 'Black Seeded Simpson Lettuce', botanical: 'Lactuca sativa', number: 11 },
]

export const initialRecords: DemoRecord[] = [
  { id: 'demo-1', kind: 'observation', title: 'Una mirada al crecimiento', note: 'Se ven hojas nuevas en el centro de la planta.' },
  { id: 'demo-2', kind: 'action', title: 'Soporte añadido', note: 'Se añadió un soporte junto al tallo.' },
]

// Prototype invariant: navigation never adds a record; only explicit form save does.
export function makeRecord(kind: RecordKind, choice: string, note: string): DemoRecord {
  return { id: crypto.randomUUID(), kind, title: kind === 'observation' ? 'Observación guardada' : kind === 'followup' ? `Revisar ${choice.toLowerCase()}` : choice, note }
}
