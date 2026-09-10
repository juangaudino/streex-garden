import type { GardenAiCheckProposalV1, AskGardenAnswerV1 } from '../domain/ai'
import { validateGardenAiCheckProposal } from '../domain/ai'
import { getSupabaseClient } from './supabase'

export type AiGatewayStatus = 'disabled' | 'ready'

export function aiGatewayStatus(): AiGatewayStatus {
  return import.meta.env.VITE_GARDEN_AI_ENABLED === 'true' ? 'ready' : 'disabled'
}

export async function requestAiCheck(input: { growCycleId: string; photoId: string; requestKey: string; comparePhotoId?: string }): Promise<GardenAiCheckProposalV1> {
  if (aiGatewayStatus() === 'disabled') throw new Error('AI está desactivada para este entorno.')
  const { data, error } = await getSupabaseClient().functions.invoke('garden-ai', {
    body: { operation: 'ai_check', grow_cycle_id: input.growCycleId, photo_id: input.photoId, compare_photo_id: input.comparePhotoId ?? null, request_key: input.requestKey },
  })
  if (error) throw new Error(error.message)
  const proposal = validateGardenAiCheckProposal((data as { proposal?: unknown } | null)?.proposal)
  if (!proposal) throw new Error('La respuesta AI no cumplió el contrato esperado.')
  return proposal
}

export async function askGarden(input: { question: string; requestKey: string }): Promise<AskGardenAnswerV1> {
  if (aiGatewayStatus() === 'disabled') throw new Error('AI está desactivada para este entorno.')
  const { data, error } = await getSupabaseClient().functions.invoke('garden-ai', {
    body: { operation: 'ask_garden', question: input.question, request_key: input.requestKey },
  })
  if (error) throw new Error(error.message)
  const answer = (data as { answer?: unknown } | null)?.answer
  if (!answer || typeof answer !== 'object' || (answer as { schema_version?: unknown }).schema_version !== 'garden_ai_ask_v1') throw new Error('La respuesta Ask Garden no cumplió el contrato esperado.')
  return answer as AskGardenAnswerV1
}
