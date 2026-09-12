import type { CycleHistoryEvent, DatePrecision, GrowCycleDetail } from '../../domain/types'
import { growthFilmNarrative, isMinorGrowthFilmEvent } from './growth-film-narrative'

export const FILM_MOMENT_MS = 3_400
export const FILM_MAX_CLIP_MOMENTS = 12
export const FILM_TRACKS = [
  { id: 'growing-light', name: 'Growing Light', url: '/audio/garden-growing-light-v1-loop.wav' },
  { id: 'track-4', name: 'Garden · Track 4', url: '/audio/garden-track-4-v1-loop.wav' },
] as const
export type FilmTrackId = typeof FILM_TRACKS[number]['id']
export type FilmScope = Readonly<{ kind: 'cycle' | 'garden'; id: string; title: string }>

export interface FilmSource {
  readonly cycleId: string
  readonly cycleRevision: number
  readonly historyId: string
  /** A photo-only history row is evidence, not a manufactured canonical event. */
  readonly eventId: string | null
  readonly eventType: CycleHistoryEvent['event_type']
  readonly eventRevision: number
  readonly recordedAt: string | null
  readonly recordedOn: string | null
  readonly note: string | null
  readonly provenance: Readonly<Record<string, unknown>>
}

export interface FilmMoment {
  readonly id: string
  readonly cycleLabel: string
  readonly cropName: string
  /** The cycle endpoint returns its latest position, not the position at capture. */
  readonly currentLocation: string
  readonly photoId: string
  readonly storagePath: string
  readonly capturedAt: string | null
  readonly capturePrecision: DatePrecision
  readonly dateLabel: string
  readonly title: string
  readonly detail: string | null
  readonly source: FilmSource
}

export interface FilmMilestone {
  readonly id: string
  readonly cycleId: string
  readonly title: string
  readonly detail: string | null
  readonly sources: readonly FilmSource[]
}

export interface FilmCatalogue {
  readonly scope: FilmScope
  readonly moments: readonly FilmMoment[]
  readonly milestones: readonly FilmMilestone[]
  /** These histories need occupancy-at-capture data before inclusion in a garden film. */
  readonly excludedCycleIds: readonly string[]
}

export interface FilmComposition {
  readonly version: 1
  readonly purpose: 'clip' | 'playback'
  /** Identity of the entire rendered selection; never contains a signed URL. */
  readonly key: string
  readonly scope: FilmScope
  readonly width: 720
  readonly height: 900
  readonly fps: 30
  readonly fit: 'contain'
  readonly momentDurationMs: number
  readonly durationMs: number
  readonly titles: boolean
  readonly reducedMotion: boolean
  readonly music: Readonly<{ id: FilmTrackId; url: string; volume: number }> | null
  readonly moments: readonly FilmMoment[]
}

function dateValue(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function sourceFor(cycle: GrowCycleDetail, event: CycleHistoryEvent): FilmSource {
  return {
    cycleId: cycle.id, cycleRevision: cycle.revision, historyId: event.id,
    eventId: event.event_type === 'photo_evidence' ? null : event.id,
    eventType: event.event_type, eventRevision: event.revision,
    recordedAt: dateValue(event.occurred_at) === null ? null : event.occurred_at,
    recordedOn: event.occurred_on ?? null,
    note: event.note,
    provenance: structuredClone(event.event_data ?? {}),
  }
}

/** Pure projection of authorized getCycle responses. No writes, AI or cross-photo inference. */
export function buildFilmCatalogue(scope: FilmScope, cycles: readonly GrowCycleDetail[]): FilmCatalogue {
  const seenCycles = new Set<string>()
  for (const cycle of cycles) {
    if (seenCycles.has(cycle.id)) throw new Error('El ciclo aparece más de una vez en la película.')
    seenCycles.add(cycle.id)
    if (scope.kind === 'cycle' ? cycle.id !== scope.id : cycle.garden.id !== scope.id) {
      throw new Error('Hay un ciclo que no pertenece a esta película. Vuelve a cargarla.')
    }
  }
  const orderedCycles = [...cycles].sort((a, b) => (dateValue(a.planted_on) ?? Infinity) - (dateValue(b.planted_on) ?? Infinity) || a.id.localeCompare(b.id))
  const moments: FilmMoment[] = []
  const milestones: FilmMilestone[] = []
  orderedCycles.forEach((cycle, cycleIndex) => {
    const seenPhotos = new Set<string>()
    const history = [...cycle.history].sort((a, b) => (dateValue(a.occurred_at) ?? Infinity) - (dateValue(b.occurred_at) ?? Infinity) || a.id.localeCompare(b.id))
    let previousMinorDay: string | null = null
    for (const event of history) {
      const source = sourceFor(cycle, event)
      const narrative = growthFilmNarrative(event)
      const photo = event.photo
      if (photo?.upload_status === 'uploaded' && !seenPhotos.has(photo.id)) {
        seenPhotos.add(photo.id)
        const capturedAt = photo.captured_at_precision === 'unknown' || dateValue(photo.captured_at) === null ? null : photo.captured_at
        moments.push({
          id: `${cycle.id}:${photo.id}`, cycleLabel: `Ciclo ${cycleIndex + 1}`, cropName: cycle.crop_name,
          currentLocation: `${cycle.garden.name} · Posición ${cycle.position.position_number}`,
          photoId: photo.id, storagePath: photo.storage_path,
          capturedAt, capturePrecision: capturedAt ? photo.captured_at_precision : 'unknown',
          dateLabel: capturedAt ? `${photo.captured_at_precision === 'approximate' ? 'Hacia el ' : ''}${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(capturedAt))}` : 'Captura sin fecha',
          title: narrative.title, detail: narrative.detail, source,
        })
      }
      if (event.event_type === 'photo_evidence' || event.event_type === 'observation') { previousMinorDay = null; continue }
      const day = event.occurred_on ?? source.recordedAt?.slice(0, 10) ?? null
      const minor = isMinorGrowthFilmEvent(event)
      const previous = milestones.at(-1)
      if (minor && day && previousMinorDay === day && previous?.cycleId === cycle.id) {
        // Group the presentation only. Preserve every underlying source, including notes.
        milestones[milestones.length - 1] = { ...previous, title: 'Una revisión de su crecimiento.', detail: `${previous.sources.length + 1} registros de seguimiento.`, sources: [...previous.sources, source] }
      } else {
        milestones.push({ id: `${cycle.id}:${event.id}`, cycleId: cycle.id, title: narrative.title, detail: narrative.detail, sources: [source] })
      }
      previousMinorDay = minor ? day : null
    }
  })
  moments.sort((a, b) => (dateValue(a.capturedAt) ?? dateValue(a.source.recordedAt) ?? Infinity) - (dateValue(b.capturedAt) ?? dateValue(b.source.recordedAt) ?? Infinity) || a.id.localeCompare(b.id))
  return { scope: { ...scope }, moments, milestones, excludedCycleIds: [] }
}

/** Selection order is chronology, never the order in which checkboxes were tapped. */
export function composeGrowthFilm(catalogue: FilmCatalogue, input: {
  purpose?: 'clip' | 'playback'
  selectedIds: readonly string[]
  titles: boolean
  reducedMotion: boolean
  trackId: FilmTrackId | null
  volume: number
}): FilmComposition {
  const selected = new Set(input.selectedIds)
  const purpose = input.purpose ?? 'clip'
  if (selected.size !== input.selectedIds.length || selected.size < (purpose === 'clip' ? 2 : 1) || (purpose === 'clip' && selected.size > FILM_MAX_CLIP_MOMENTS)) {
    throw new Error(purpose === 'clip' ? `Elige entre 2 y ${FILM_MAX_CLIP_MOMENTS} momentos distintos.` : 'Selecciona fotografías distintas para la película.')
  }
  const moments = catalogue.moments.filter(moment => selected.has(moment.id))
  if (moments.length !== selected.size) throw new Error('Una fotografía ya no está disponible. Revisa la selección.')
  const track = FILM_TRACKS.find(candidate => candidate.id === input.trackId)
  if (input.trackId !== null && !track) throw new Error('Elige una de las pistas disponibles.')
  if (!Number.isFinite(input.volume) || input.volume < 0 || input.volume > 1) throw new Error('El volumen debe estar entre 0 y 100 %.')
  const value = {
    version: 1 as const, purpose, scope: { ...catalogue.scope }, width: 720 as const, height: 900 as const,
    fps: 30 as const, fit: 'contain' as const, momentDurationMs: FILM_MOMENT_MS,
    durationMs: moments.length * FILM_MOMENT_MS, titles: input.titles, reducedMotion: input.reducedMotion,
    music: track ? { id: track.id, url: track.url, volume: input.volume } : null,
    moments: structuredClone(moments),
  }
  return { ...value, key: JSON.stringify(value) }
}

export function filmFrameAt(plan: FilmComposition, timeMs: number): { index: number; nextIndex: number | null; blend: number } {
  const time = Math.max(0, Math.min(Number.isFinite(timeMs) ? timeMs : 0, plan.durationMs - 1))
  const index = Math.floor(time / plan.momentDurationMs)
  const next = plan.moments[index + 1]
  // A dissolve across cycles implies continuity between different plants. Always cut there.
  const canBlend = !plan.reducedMotion && next?.source.cycleId === plan.moments[index].source.cycleId
  const blend = canBlend ? Math.max(0, (time % plan.momentDurationMs - (plan.momentDurationMs - 400)) / 400) : 0
  return { index, nextIndex: blend > 0 ? index + 1 : null, blend }
}
