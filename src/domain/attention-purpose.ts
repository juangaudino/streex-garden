import type { AttentionPurpose } from './types'

export const cycleAttentionPurposes: Array<{ value: AttentionPurpose; label: string }> = [
  { value: 'evaluate_visual_review', label: 'Revisión visual' },
  { value: 'evaluate_thinning', label: 'Evaluar aclareo' },
  { value: 'evaluate_pruning', label: 'Evaluar poda' },
  { value: 'evaluate_support', label: 'Evaluar soporte' },
  { value: 'perform_thinning', label: 'Realizar aclareo' },
  { value: 'perform_pruning', label: 'Realizar poda' },
  { value: 'perform_support', label: 'Instalar soporte' },
  { value: 'perform_harvest', label: 'Realizar cosecha' },
]

export const gardenAttentionPurposes: Array<{ value: AttentionPurpose; label: string }> = [
  { value: 'perform_water_change', label: 'Cambiar toda el agua' },
  { value: 'perform_refill', label: 'Rellenar agua' },
  { value: 'perform_nutrients', label: 'Añadir nutrientes' },
  { value: 'perform_cleaning', label: 'Limpiar el sistema' },
]

export function attentionPurposeLabel(purpose: AttentionPurpose): string {
  return [...cycleAttentionPurposes, ...gardenAttentionPurposes].find((option) => option.value === purpose)?.label ?? 'Atención manual'
}
