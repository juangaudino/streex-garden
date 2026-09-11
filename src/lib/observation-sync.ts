import type { ObservationDraft } from '../domain/types'
import { createObservation, getCycle } from './garden-api'
import { deleteObservationDraft, saveObservationDraft } from './offline-observation-store'

export type DraftSyncResult = 'synced' | 'retryable_error' | 'needs_review'

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'No se pudo sincronizar.'
}

function isTransient(reason: unknown): boolean {
  const message = errorMessage(reason).toLowerCase()
  return message.includes('network') || message.includes('fetch') || message.includes('timeout') || message.includes('tardó') || message.includes('storage devolvió http 5') || message.includes('jwt')
}

async function createWithRetry(draft: ObservationDraft) {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await createObservation(draft) }
    catch (reason) {
      lastError = reason
      if (!isTransient(reason) || attempt === 2) throw reason
      await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No se pudo sincronizar.')
}

export function requiresManualReview(reason: unknown): boolean {
  const message = errorMessage(reason).toLowerCase()
  return message.includes('current grow cycle not found')
    || message.includes('cycle is closed')
    || message.includes('conflict')
    || message.includes('revision')
}

export async function syncObservationDraft(draft: ObservationDraft): Promise<{ result: DraftSyncResult; error?: string }> {
  const queuedDraft: ObservationDraft = { ...draft, status: 'queued', lastError: undefined }
  await saveObservationDraft(queuedDraft)

  try {
    await saveObservationDraft({ ...queuedDraft, status: 'syncing' })
    const created = await createWithRetry(queuedDraft)
    const cycle = await getCycle(queuedDraft.growCycleId)
    const confirmed = cycle.history.find((event) => event.id === created.eventId)
    if (!confirmed) throw new Error('El servidor todavía no confirmó esta observación en el historial. Se conservará para reintento.')
    if (queuedDraft.photo && confirmed.photo?.upload_status !== 'uploaded') {
      throw new Error('La observación existe, pero el original aún no fue confirmado. Se conservará para reintento.')
    }
    await deleteObservationDraft(queuedDraft.id)
    return { result: 'synced' }
  } catch (reason) {
    const error = errorMessage(reason)
    const result: DraftSyncResult = requiresManualReview(reason) ? 'needs_review' : 'retryable_error'
    await saveObservationDraft({ ...queuedDraft, status: result, lastError: error })
    return { result, error }
  }
}
