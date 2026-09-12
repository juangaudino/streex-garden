import type { GardenDetail, GrowCycleDetail } from '../../domain/types'
import { buildFilmCatalogue, type FilmCatalogue } from './growth-film-composition'

/** Only read ports. Pass the existing authenticated garden-api functions at the route. */
export interface FilmReader {
  getCycle: (id: string) => Promise<GrowCycleDetail>
  getGarden: (id: string) => Promise<GardenDetail>
}

function check(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('La carga de la película fue cancelada.', 'AbortError')
}

/** Current and previous cycles stay separate; a failed read never yields a partial film. */
export async function loadFilmCatalogue(scope: { kind: 'cycle' | 'garden'; id: string }, reader: FilmReader, signal: AbortSignal): Promise<FilmCatalogue> {
  check(signal)
  if (scope.kind === 'cycle') {
    const cycle = await reader.getCycle(scope.id)
    check(signal)
    return buildFilmCatalogue({ ...scope, title: cycle.crop_name }, [cycle])
  }
  const garden = await reader.getGarden(scope.id)
  check(signal)
  if (garden.id !== scope.id) throw new Error('No se pudo confirmar el jardín de esta película.')
  const ids = [...new Set(garden.positions.flatMap(position => [position.current_cycle?.id, ...position.previous_cycles.map(cycle => cycle.id)]).filter((id): id is string => Boolean(id)))]
  const cycles: GrowCycleDetail[] = []
  const excludedCycleIds: string[] = []
  // Keep requests bounded on gardens with many historical cycles.
  for (let offset = 0; offset < ids.length; offset += 3) {
    check(signal)
    const results = await Promise.all(ids.slice(offset, offset + 3).map(async id => {
      const cycle = await reader.getCycle(id)
      if (cycle.id !== id) throw new Error('Un ciclo cambió durante la carga. Vuelve a abrir la película.')
      return cycle
    }))
    check(signal)
    // garden_get_garden includes previous occupants which can now belong to another
    // garden. Do not attribute their later photos to this garden using latest-location data.
    cycles.push(...results.filter(cycle => cycle.garden.id === garden.id))
    excludedCycleIds.push(...results.filter(cycle => cycle.garden.id !== garden.id).map(cycle => cycle.id))
  }
  return { ...buildFilmCatalogue({ ...scope, title: garden.name }, cycles), excludedCycleIds }
}
