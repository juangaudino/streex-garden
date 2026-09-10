export type AskGardenIntent = 'today_attention' | 'cycle_history' | 'missing_germination' | 'open_incidents' | 'harvest_candidates' | 'recent_changes'

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
  { intent: 'recent_changes', description: 'Cambios desde la última visita', maxRows: 100 },
]

const patterns: Array<[AskGardenIntent, RegExp]> = [
  ['today_attention', /hoy|pendiente|pendientes|tarea|atenci[oó]n|revisar/i],
  ['cycle_history', /qu[eé] pas[oó]|historia|historial|evolucion[oó]?|ciclo/i],
  ['missing_germination', /sin germinaci[oó]n|no tienen germinaci[oó]n|germinaci[oó]n confirmada/i],
  ['open_incidents', /incidencia|incidencias|problema abierto|abiertas/i],
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
