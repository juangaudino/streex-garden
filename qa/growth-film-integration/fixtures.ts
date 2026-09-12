import type { FilmCatalogue, FilmMoment, FilmSource } from '../../src/features/cycles/growth-film-composition'

const palettes = [
  ['#1a3626', '#a8c977', '#f3db91'],
  ['#213f2d', '#81aa6a', '#bfd89b'],
  ['#193b32', '#6e9e7e', '#e4d895'],
  ['#31502d', '#a1c46f', '#d7b86d'],
  ['#1d3827', '#93bd7a', '#e6e3b0'],
  ['#203e31', '#80a96b', '#d9c982'],
] as const

const names = ['Al comienzo', 'Sus primeras hojas', 'Más espacio para crecer', 'Un gesto de cuidado', 'Una forma más firme', 'El jardín sigue'] as const

const encodedPhoto = (index: number) => {
  const [deep, leaf, light] = palettes[index]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${deep}"/><stop offset="1" stop-color="#0c1710"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="26"/></filter></defs><rect width="900" height="1200" fill="url(#g)"/><circle cx="720" cy="190" r="190" fill="${light}" opacity=".16" filter="url(#b)"/><path d="M450 1030C430 720 454 475 560 210" stroke="#d5d7a8" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M503 525C292 515 205 373 240 250c179 12 256 106 263 275Z" fill="${leaf}"/><path d="M516 708c181-130 288-70 333 45-152 92-273 86-333-45Z" fill="${light}" opacity=".88"/><path d="M469 850c-179-108-267-50-310 61 131 87 248 80 310-61Z" fill="${leaf}" opacity=".9"/><text x="70" y="1120" fill="#f2f2d9" opacity=".78" font-family="Georgia,serif" font-size="38" letter-spacing="6">MOMENTO ${String(index + 1).padStart(2, '0')}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const sourceFor = (index: number): FilmSource => ({
  cycleId: 'qa-cycle', cycleRevision: 1, historyId: `qa-history-${index + 1}`,
  eventId: index === 0 ? null : `qa-event-${index + 1}`,
  eventType: index === 0 ? 'photo_evidence' : 'observation', eventRevision: 1,
  recordedAt: `2026-09-${String(index + 2).padStart(2, '0')}T16:00:00Z`,
  recordedOn: `2026-09-${String(index + 2).padStart(2, '0')}`,
  note: index === 3 ? 'Se añadió un pequeño soporte.' : 'Fotografía sintética para la revisión visual local.',
  provenance: { source: 'qa-growth-film-integration', synthetic: true },
})

export const catalogue: FilmCatalogue = {
  scope: { kind: 'cycle', id: 'qa-cycle', title: 'Genovese Basil' },
  moments: names.map((title, index): FilmMoment => ({
    id: `qa-moment-${index + 1}`, cycleLabel: 'Ciclo actual', cropName: 'Genovese Basil',
    currentLocation: 'Jardín de prueba · Posición 3', photoId: `qa-photo-${index + 1}`,
    storagePath: `synthetic-${index + 1}`, capturedAt: `2026-09-${String(index + 2).padStart(2, '0')}T16:00:00Z`,
    capturePrecision: 'exact', dateLabel: `${index + 2} sept 2026`, title,
    detail: index === 3 ? 'Recibió un pequeño soporte para seguir creciendo con más firmeza.' : 'Una fotografía real del recorrido, presentada aquí con evidencia de prueba.',
    source: sourceFor(index),
  })),
  milestones: [{
    id: 'qa-milestone', cycleId: 'qa-cycle', title: 'Una revisión de su crecimiento.',
    detail: 'Dos registros de seguimiento reunidos para este diario.', sources: [sourceFor(2), sourceFor(3)],
  }],
  excludedCycleIds: [],
}

export async function getSignedPhotoUrl(path: string) {
  const index = Math.max(0, Number(path.replace('synthetic-', '')) - 1)
  return encodedPhoto(index)
}
