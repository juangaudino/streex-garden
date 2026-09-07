import type { DatePrecision, DraftStatus, HarvestReadiness, ObservationInput } from './types'
import { photoContentType } from './photo-integrity'

export const harvestReadinessLabel: Record<HarvestReadiness, string> = {
  not_yet: 'Todavía no',
  evaluate: 'Evaluar',
  ready: 'Lista',
  not_applicable: 'No aplica',
}

export function isValidPlantingDate(date: string, precision: DatePrecision): boolean {
  return (date === '' && precision === 'unknown') || (date !== '' && precision !== 'unknown')
}

export function validatesObservation(input: ObservationInput): string | null {
  if (input.note.trim() === '' && !input.photo) return 'Añade una observación o una fotografía.'
  if (input.photo && !input.photoMetadata) return 'Falta la metadata de la fotografía.'
  if (input.photo && !photoContentType(input.photo as File)) {
    return 'El formato de la fotografía no está permitido.'
  }
  if (input.photoMetadata && input.photoMetadata.byteSize > 31_457_280) {
    return 'La fotografía supera el límite de 30 MB.'
  }
  return null
}

const validTransitions: Record<DraftStatus, DraftStatus[]> = {
  draft: ['queued'],
  queued: ['syncing'],
  syncing: ['synced', 'retryable_error', 'needs_review'],
  synced: [],
  retryable_error: ['queued'],
  needs_review: [],
}

export function canTransitionDraft(from: DraftStatus, to: DraftStatus): boolean {
  return validTransitions[from].includes(to)
}
