import type { GardenSummary } from '../../domain/types'

export interface GardenVisual {
  referenceImage: string | null
  referenceLabel: string | null
}

/** Environmental reference images are presentation-only, never cycle evidence. */
export function gardenVisual(garden: Pick<GardenSummary, 'system_model' | 'position_capacity' | 'map_layout'>): GardenVisual {
  if (garden.system_model?.toUpperCase() !== 'URUQ') return { referenceImage: null, referenceLabel: null }
  if (garden.position_capacity === 8 && garden.map_layout === 'uruq_8_v1') return { referenceImage: '/gardens/uruq-8-reference.png', referenceLabel: 'Vista de referencia del sistema URUQ de 8 posiciones' }
  if (garden.position_capacity === 12 && garden.map_layout === 'uruq_12_v1') return { referenceImage: '/gardens/uruq-12-reference.jpeg', referenceLabel: 'Vista de referencia del sistema URUQ de 12 posiciones' }
  return { referenceImage: null, referenceLabel: null }
}
