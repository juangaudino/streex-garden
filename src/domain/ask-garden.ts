export type AskGardenIntent = 'today_attention' | 'cycle_history' | 'missing_germination' | 'open_incidents' | 'harvest_candidates' | 'last_harvest' | 'recent_changes'

export interface AskGardenToolDefinition {
  intent: AskGardenIntent
  description: string
  maxRows: number
}

export const ASK_GARDEN_TOOLS: readonly AskGardenToolDefinition[] = [
  { intent: 'today_attention', description: 'Seguimientos activos y pendientes actuales', maxRows: 50 },
  { intent: 'cycle_history', description: 'Historia cronológica de un Grow Cycle', maxRows: 100 },
  { intent: 'missing_germination', description: 'Posiciones ocupadas sin germinación confirmada', maxRows: 100 },
  { intent: 'open_incidents', description: 'Incidencias abiertas por Garden/Cycle', maxRows: 100 },
  { intent: 'harvest_candidates', description: 'Ciclos con readiness que requiere evaluación o está listo', maxRows: 100 },
  { intent: 'last_harvest', description: 'Última cosecha registrada, opcionalmente filtrada por planta', maxRows: 200 },
  { intent: 'recent_changes', description: 'Cambios desde la última visita', maxRows: 100 },
]

const patterns: Array<[AskGardenIntent, RegExp]> = [
  ['today_attention', /hoy|pendiente|pendientes|tarea|atenci[oó]n|revisar/i],
  ['cycle_history', /qu[eé] pas[oó]|historia|historial|evolucion[oó]?|ciclo/i],
  ['missing_germination', /sin germinaci[oó]n|no tienen germinaci[oó]n|germinaci[oó]n confirmada/i],
  ['open_incidents', /incidencia|incidencias|problema abierto|abiertas/i],
  ['last_harvest', /(?:[uú]ltim[ao].*cosech|cu[aá]ndo.*cosech|cosech.*[uú]ltim)/i],
  ['harvest_candidates', /cosech|harvest|lista.*cosech|evaluar.*cosech/i],
  ['recent_changes', /cambi[oó]|desde.*[úu]ltima|[úu]ltima revisi[oó]n|since last/i],
]

/** Maps a bounded set of user intents; it never produces SQL or table names. */
export function resolveAskGardenIntent(question: string): AskGardenIntent | 'needs_clarification' {
  const normalized = question.trim()
  if (normalized.length < 2) return 'needs_clarification'
  return patterns.find(([, pattern]) => pattern.test(normalized))?.[0] ?? 'needs_clarification'
}

export function toolForAskGardenIntent(intent: AskGardenIntent): AskGardenToolDefinition {
  return ASK_GARDEN_TOOLS.find((tool) => tool.intent === intent) as AskGardenToolDefinition
}

export interface AskGardenSuggestionInput {
  positions: Array<{
    position: { number: number }
    plant: { name: string | null } | null
    germination: { status: 'confirmed' | 'no_observation' } | null
    harvest_readiness: { value: 'not_yet' | 'evaluate' | 'ready' | 'not_applicable' } | null
    current_state: { kind: 'reassuring' | 'watch' | 'action_required' | 'insufficient_evidence' } | null
  }>
  activeAttentionCount: number
}

/**
 * Produces concise, non-duplicated opening questions from canonical status.
 * `rotation` is client session state only; it never changes Garden data.
 */
export function buildAskGardenSuggestions(input: AskGardenSuggestionInput, rotation = 0): string[] {
  const missingGermination = input.positions.filter((position) => position.germination?.status === 'no_observation')
  const harvestCandidates = input.positions.filter((position) => ['evaluate', 'ready'].includes(position.harvest_readiness?.value ?? ''))
  const actionRequired = input.positions.find((position) => position.current_state?.kind === 'action_required')
  const watch = input.positions.find((position) => position.current_state?.kind === 'watch')
  const activePlant = input.positions.find((position) => position.plant?.name)
  const candidates = [
    input.activeAttentionCount > 0 ? '¿Qué debería atender hoy?' : null,
    missingGermination.length > 0 ? '¿Qué posiciones siguen sin germinación confirmada?' : null,
    harvestCandidates.length > 0 ? '¿Hay algo que valga la pena evaluar para cosecha?' : null,
    actionRequired?.plant?.name ? `¿Qué requiere atención en ${actionRequired.plant.name}, Posición ${actionRequired.position.number}?` : null,
    watch?.plant?.name ? `¿Qué debería vigilar en ${watch.plant.name}, Posición ${watch.position.number}?` : null,
    activePlant?.plant?.name ? `¿Cómo va ${activePlant.plant.name} en la Posición ${activePlant.position.number}?` : null,
    '¿Qué cambió desde mi última revisión?',
    '¿Hay incidencias abiertas que debería revisar?',
  ].filter((candidate): candidate is string => Boolean(candidate))
  const unique = [...new Set(candidates)]
  if (unique.length <= 3) return unique
  const start = ((rotation % unique.length) + unique.length) % unique.length
  return Array.from({ length: 3 }, (_, index) => unique[(start + index) % unique.length])
}
