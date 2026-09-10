import type { GuestPlantStoryEvent } from '../../domain/types'

type GuestPhotoEvent = Pick<GuestPlantStoryEvent, 'id' | 'occurred_at' | 'occurred_at_precision' | 'occurred_on' | 'note' | 'photo'>

function eventTime(event: GuestPhotoEvent): number {
  if (event.occurred_at_precision === 'date' && event.occurred_on) return Date.parse(`${event.occurred_on}T12:00:00`)
  return event.occurred_at ? Date.parse(event.occurred_at) : Number.NaN
}

function eventDate(event: GuestPhotoEvent): string {
  const value = eventTime(event)
  if (!Number.isFinite(value)) return 'Fecha no registrada'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', ...(event.occurred_at_precision === 'timestamp' ? { timeStyle: 'short' } : {}) }).format(new Date(value))
}

export function GuestPhotoStoryRail({ events }: { events: GuestPhotoEvent[] }) {
  const photos = events.filter((event): event is GuestPhotoEvent & { photo: NonNullable<GuestPhotoEvent['photo']> } => Boolean(event.photo)).sort((a, b) => eventTime(a) - eventTime(b))
  if (photos.length === 0) return null
  const first = eventDate(photos[0]).replace(/,?\s+\d{1,2}:\d{2}$/, '')
  const last = eventDate(photos[photos.length - 1]).replace(/,?\s+\d{1,2}:\d{2}$/, '')
  return <section className="photo-story guest-photo-story" aria-label="Recorrido fotográfico"><p className="story-interval">Fechas de los registros: {first}{photos.length > 1 ? ` → ${last}` : ''}</p><p className="quiet-copy">Un mismo ciclo, a través de tus fotografías.</p><ol className="photo-story__rail">{photos.map((event, index) => <li key={event.id}><div className="photo-story__date"><span>{String(index + 1).padStart(2, '0')}</span><time dateTime={event.occurred_at_precision === 'date' ? event.occurred_on ?? undefined : event.occurred_at ?? undefined}>{eventDate(event)}</time></div><figure className="documentary-photo"><div className="documentary-photo__open guest-photo-story__media"><img src={event.photo.url} alt={`Fotografía documental: ${event.photo.original_filename}`} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" onError={(failure) => { const original = event.photo?.original_url; if (original && failure.currentTarget.src !== original) failure.currentTarget.src = original }} /><span className="documentary-photo__expand-hint" aria-hidden="true">↗</span></div><figcaption>{event.photo.original_filename}</figcaption></figure>{event.note && <p>{event.note}</p>}</li>)}</ol></section>
}
