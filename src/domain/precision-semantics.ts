export interface GerminationEvidenceInput {
  event_id: string
  event_type: 'germination_observed' | 'germination_confirmed'
  occurred_on?: string | null
  confirmed_by?: string | null
}

export function germinationEvidence(input: GerminationEvidenceInput): { occurred_on: string | null; confirmed_by: string | null } {
  return {
    occurred_on: input.event_type === 'germination_observed' ? input.occurred_on ?? null : null,
    confirmed_by: input.event_type === 'germination_confirmed' ? input.confirmed_by ?? null : null,
  }
}

export function seedCountLabel(input: { count: number | null; count_min: number | null; count_precision: 'exact' | 'minimum' | 'unknown' } | null | undefined): string {
  if (!input) return 'Sin registro exacto'
  if (input.count_precision === 'minimum' && input.count_min !== null) return `Al menos ${input.count_min}`
  if (input.count_precision === 'exact' && input.count !== null) return String(input.count)
  return 'Sin registro exacto'
}
