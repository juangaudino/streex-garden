import type { AttentionItem, AttentionPurpose, CycleHistoryEvent, GrowCycleDetail } from '../../domain/types'
import { cycleAttentionPurposes } from '../../domain/attention-purpose'
import type { GardenAiCanonicalAction } from '../../domain/ai'
import type { FactChoice } from './CycleFactRecorder'

export type PlantSheetIntent =
  | { kind: 'choose' | 'observation' | 'operations' | 'review' | 'options' | 'ai' }
  | { kind: 'fact'; choice?: FactChoice }
  | { kind: 'attention'; purpose?: AttentionPurpose }
  | { kind: 'event' | 'invalidate'; event: CycleHistoryEvent }
  | { kind: 'task'; task: AttentionItem }

export function plantAiIntent(action: GardenAiCanonicalAction, cycle: GrowCycleDetail): PlantSheetIntent | null {
  if (action.context.growCycleId !== cycle.id || action.context.gardenId !== cycle.garden.id || action.context.positionId !== cycle.position.id) return null
  if (action.kind === 'confirm_plant_count') return { kind: 'fact', choice: 'count' }
  if (action.kind === 'record_incident') return { kind: 'fact', choice: 'incident' }
  if (action.kind === 'evaluate_harvest_readiness') return { kind: 'fact', choice: 'readiness' }
  if (action.kind === 'create_follow_up') return { kind: 'attention', purpose: action.label.toLowerCase().includes('poda') ? 'evaluate_pruning' : action.label.toLowerCase().includes('soporte') ? 'evaluate_support' : 'evaluate_thinning' }
  return null
}

// Links may select a real form; they cannot submit it. Unknown actions are ignored.
export function plantArrivalIntent(hash: string, aiAction: unknown, cycle: GrowCycleDetail): PlantSheetIntent | null {
  if (cycle.state !== 'active') return null
  if (typeof aiAction === 'string' && cycleAttentionPurposes.some(purpose => purpose.value === aiAction)) return { kind: 'attention', purpose: aiAction as AttentionPurpose }
  if (hash === '#cycle-attention') return { kind: 'attention' }
  if (hash === '#cycle-fact') return { kind: 'fact' }
  if (hash === '#cycle-observation') return { kind: 'observation' }
  return null
}
