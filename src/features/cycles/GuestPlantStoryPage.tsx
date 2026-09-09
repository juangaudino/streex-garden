import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, ImageOff, Leaf, RefreshCw } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { StatePanel } from '../../components/StatePanel'
import type { GuestPlantStory, GuestPlantStoryEvent } from '../../domain/types'
import { getGuestPlantStory } from '../../lib/garden-api'

function eventDate(event: GuestPlantStoryEvent): string {
  if (event.occurred_at_precision === 'date' && event.occurred_on) return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${event.occurred_on}T12:00:00`))
  return event.occurred_at ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.occurred_at)) : 'Fecha no registrada'
}

function eventLabel(eventType: string): string {
  return ({
    observation: 'Observación',
    planting: 'Siembra',
    harvest: 'Cosecha',
    cycle_started: 'Ciclo iniciado',
    cycle_ended: 'Ciclo cerrado',
    cycle_moved: 'Ciclo trasladado',
    seeds_added: 'Siembra adicional',
    germination_observed: 'Germinación observada',
    germination_confirmed: 'Germinación confirmada',
    plant_count_observed: 'Cantidad de plantas observada',
    visual_review: 'Revisión visual',
    development_review: 'Revisión de desarrollo',
    intervention: 'Intervención',
    incident_opened: 'Incidencia abierta',
    incident_resolved: 'Incidencia resuelta',
    system_maintenance: 'Mantenimiento',
    measurement: 'Medición',
    readiness_review: 'Evaluación de cosecha',
    photo_evidence: 'Fotografía documental',
  } as Record<string, string>)[eventType] ?? eventType
}

function GuestPhoto({ event }: { event: GuestPlantStoryEvent }) {
  const [failed, setFailed] = useState(false)
  if (!event.photo || failed) return <div className="guest-story-photo guest-story-photo--unavailable"><ImageOff size={20} aria-hidden="true" />Fotografía no disponible</div>
  return <figure className="guest-story-photo"><img src={event.photo.url} alt={`Fotografía documental: ${event.photo.original_filename}`} onError={() => setFailed(true)} /><figcaption>{event.photo.original_filename}</figcaption></figure>
}

export function GuestPlantStoryPage() {
  const { token } = useParams()
  const [story, setStory] = useState<GuestPlantStory | null>(null)
  const [expiresIn, setExpiresIn] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!token) return
    setLoading(true); setError(null)
    try { const result = await getGuestPlantStory(token); setStory(result.story); setExpiresIn(result.expires_in) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'La historia compartida no está disponible.') }
    finally { setLoading(false) }
  }, [token])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the async loader writes after the public endpoint settles.
  useEffect(() => { void load() }, [load])
  const history = useMemo(() => [...(story?.history ?? [])].sort((a, b) => (b.occurred_at ? Date.parse(b.occurred_at) : 0) - (a.occurred_at ? Date.parse(a.occurred_at) : 0)), [story])

  return <main className="guest-story-page"><header className="guest-story-page__header"><div className="guest-story-page__brand"><Leaf size={19} aria-hidden="true" /><span>Garden X</span></div><span className="guest-story-page__badge"><Eye size={15} aria-hidden="true" /> Solo lectura</span></header>
    {loading && <StatePanel kind="loading" title="Abriendo historia compartida" />}
    {!loading && error && <section className="guest-story-page__state"><StatePanel kind="error" title="Historia no disponible" onRetry={() => void load()}>{error}</StatePanel></section>}
    {!loading && story && <>
      <section className="guest-story-hero"><span className="eyebrow">Historia de una planta</span><h1>La historia de tu {story.crop_name}</h1><p>{story.garden.name} · Posición {story.position.position_number}</p>{story.planted_on && <small>Plantada: {new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${story.planted_on}T12:00:00`))}</small>}</section>
      {expiresIn && <p className="guest-story-expiry" role="status">Las fotografías se muestran con acceso temporal. Si alguna no carga, actualiza esta página.</p>}
      <section className="guest-story-timeline" aria-label="Historia del ciclo">{history.length === 0 && <p className="empty-copy">Todavía no hay registros compartidos para este ciclo.</p>}{history.map((event) => <article className="guest-story-event" key={event.id}><div className="guest-story-event__date"><strong>{eventLabel(event.event_type)}</strong><time>{eventDate(event)}</time></div><div className="guest-story-event__body">{event.photo && <GuestPhoto event={event} />}{event.note && <p>{event.note}</p>}</div></article>)}</section>
      <footer className="guest-story-page__footer"><RefreshCw size={15} aria-hidden="true" /> Vista compartida de solo lectura · <button type="button" onClick={() => void load()}>Actualizar</button></footer>
    </>}
  </main>
}
