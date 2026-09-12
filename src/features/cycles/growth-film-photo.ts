import { getSignedPhotoUrl } from '../../lib/garden-api'
import type { FilmPhotoResolver } from './growth-film-export'

/** Resolve fresh private URLs at render time, without putting them in a composition. */
export const resolveFilmPhoto: FilmPhotoResolver = async (moment, signal) => {
  if (signal.aborted) throw new DOMException('Cancelado', 'AbortError')
  const url = await getSignedPhotoUrl(moment.storagePath, 'story')
  if (signal.aborted) throw new DOMException('Cancelado', 'AbortError')
  return url
}
