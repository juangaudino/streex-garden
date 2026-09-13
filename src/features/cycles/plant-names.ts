export interface PlantName { common: string; subtitle: string }

// Presentation only. The English/scientific pair is the user's approved example.
// Unknown cultivars retain their original identity; never guess by substring.
const names: Record<string, PlantName> = {
  'genovese basil': { common: 'Albahaca genovesa', subtitle: 'Genovese Basil · Ocimum basilicum' },
}

export function plantName(cropName: string): PlantName {
  return names[cropName.trim().replace(/\s+/g, ' ').toLowerCase()]
    ?? { common: cropName, subtitle: 'Nombre botánico sin confirmar' }
}
