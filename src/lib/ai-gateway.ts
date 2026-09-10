import type { GardenAiCheckProposalV1, AskGardenAnswerV1 } from '../domain/ai'
import { validateGardenAiCheckProposal } from '../domain/ai'
import { getSupabaseClient } from './supabase'

export type AiGatewayStatus = 'disabled' | 'ready'

export function aiGatewayStatus(): AiGatewayStatus {
  return import.meta.env.VITE_GARDEN_AI_ENABLED === 'true' ? 'ready' : 'disabled'
}

async function throwGatewayError(error: unknown): Promise<never> {
  const response = error && typeof error === 'object' && 'context' in error ? (error as { context?: unknown }).context : null
  if (response instanceof Response) {
    const payload = await response.clone().json().catch(() => null) as { error?: unknown } | null
    if (typeof payload?.error === 'string') throw new Error(payload.error)
  }
  throw new Error(error instanceof Error ? error.message : 'Garden AI no está disponible ahora.')
}

export async function requestAiCheck(input: { growCycleId: string; photoId: string; requestKey: string; comparePhotoId?: string }): Promise<GardenAiCheckProposalV1> {
  if (aiGatewayStatus() === 'disabled') throw new Error('AI está desactivada para este entorno.')
  const { data, error } = await getSupabaseClient().functions.invoke('garden-ai', {
    body: { operation: 'ai_check', grow_cycle_id: input.growCycleId, photo_id: input.photoId, compare_photo_id: input.comparePhotoId ?? null, request_key: input.requestKey },
  })
  if (error) await throwGatewayError(error)
  const proposal = validateGardenAiCheckProposal((data as { proposal?: unknown } | null)?.proposal)
  if (!proposal) throw new Error('La respuesta AI no cumplió el contrato esperado.')
  return proposal
}

export async function askGarden(input: { question: string; requestKey: string; conversation?: Array<{ question: string; answer: string }> }): Promise<AskGardenAnswerV1> {
  if (aiGatewayStatus() === 'disabled') throw new Error('AI está desactivada para este entorno.')
  const { data, error } = await getSupabaseClient().functions.invoke('garden-ai', {
    body: { operation: 'ask_garden', question: input.question, request_key: input.requestKey, conversation: input.conversation ?? [] },
  })
  if (error) await throwGatewayError(error)
  const answer = (data as { answer?: unknown } | null)?.answer
  if (!answer || typeof answer !== 'object' || (answer as { schema_version?: unknown }).schema_version !== 'garden_ai_ask_v1') throw new Error('La respuesta Ask Garden no cumplió el contrato esperado.')
  return answer as AskGardenAnswerV1
}

export async function requestDraftAiCheck(input: { growCycleId: string; file: File; requestKey: string }): Promise<GardenAiCheckProposalV1> {
  if (aiGatewayStatus() === 'disabled') throw new Error('AI está desactivada para este entorno.')
  const { createPhotoRenditions } = await import('./photo-renditions')
  const contentType = input.file.type || 'image/jpeg'
  let display: ArrayBuffer
  try {
    const renditions = await createPhotoRenditions(await input.file.arrayBuffer(), contentType)
    display = renditions.find((item) => item.rendition === 'display')?.bytes ?? new ArrayBuffer(0)
  } catch { throw new Error('No se pudo preparar una vista segura de esta foto. Guárdala primero y luego analízala.') }
  if (display.byteLength === 0 || display.byteLength > 5 * 1024 * 1024) throw new Error('No se pudo preparar una vista segura de esta foto. Guárdala primero y luego analízala.')
  const bytes = new Uint8Array(display); let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  const { data, error } = await getSupabaseClient().functions.invoke('garden-ai', { body: { operation: 'ai_check_draft', grow_cycle_id: input.growCycleId, request_key: input.requestKey, draft_image_data_url: `data:image/jpeg;base64,${btoa(binary)}` } })
  if (error) await throwGatewayError(error)
  const proposal = validateGardenAiCheckProposal((data as { proposal?: unknown } | null)?.proposal)
  if (!proposal) throw new Error('La respuesta AI no cumplió el contrato esperado.')
  return proposal
}
