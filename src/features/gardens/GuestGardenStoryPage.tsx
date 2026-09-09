import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, ImageOff, Leaf, RefreshCw } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { StatePanel } from '../../components/StatePanel'
import type { GuestGardenStory } from '../../domain/types'
import { getGuestGardenStory } from '../../lib/garden-api'
import { GuestPhotoStoryRail } from '../cycles/GuestPhotoStoryRail'

function label(eventType: string, data: Record<string, unknown> = {}) {
  if (eventType === 'intervention') {
    if (data.class === 'thinning') return 'Aclareo realizado'
    if (data.class === 'pruning') return 'Poda realizada'
    if (data.class === 'support') return ({ installed: 'Soporte instalado', adjusted: 'Soporte ajustado', removed: 'Soporte retirado' } as Record<string, string>)[String(data.operation)] ?? 'Intervención de soporte'
  }
  return ({ observation: 'Observación', planting: 'Siembra', harvest: 'Cosecha', cycle_started: 'Ciclo iniciado', cycle_ended: 'Ciclo cerrado', seeds_added: 'Siembra adicional', germination_observed: 'Germinación observada', germination_confirmed: 'Germinación confirmada', plant_count_observed: 'Cantidad de plantas observada', visual_review: 'Revisión visual', development_review: 'Revisión de desarrollo', incident_opened: 'Incidencia abierta', incident_resolved: 'Incidencia resuelta', system_maintenance: 'Mantenimiento', readiness_review: 'Preparación para cosecha', photo_evidence: 'Fotografía documental' } as Record<string, string>)[eventType] ?? eventType
}

export function GuestGardenStoryPage() {
  const { token, cycleId } = useParams()
  const [story, setStory] = useState<GuestGardenStory | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { if (!token) return; setLoading(true); setError(null); try { setStory((await getGuestGardenStory(token)).story) } catch (reason) { setError(reason instanceof Error ? reason.message : 'El jardín compartido no está disponible.') } finally { setLoading(false) } }, [token])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the async loader writes after the public endpoint settles.
  useEffect(() => { void load() }, [load])
  const selectedCycle = useMemo(() => story?.cycles.find((cycle) => cycle.grow_cycle_id === cycleId) ?? null, [story, cycleId])
  const history = useMemo(() => [...(story?.history ?? [])].filter((event) => !cycleId || event.grow_cycle_id === cycleId).sort((a, b) => Date.parse(b.occurred_at ?? '') - Date.parse(a.occurred_at ?? '')), [story, cycleId])
  return <main className="guest-story-page"><header className="guest-story-page__header"><div className="guest-story-page__brand"><Leaf size={19} aria-hidden="true" /><span>Garden X</span></div><span className="guest-story-page__badge"><Eye size={15} aria-hidden="true" /> Solo lectura</span></header>
    {loading && <StatePanel kind="loading" title="Abriendo jardín compartido" />}{!loading && error && <section className="guest-story-page__state"><StatePanel kind="error" title="Jardín no disponible" onRetry={() => void load()}>{error}</StatePanel></section>}{!loading && story && <>
      <section className="guest-story-hero"><span className="eyebrow">{selectedCycle ? 'Historia de una planta' : 'Historia de un jardín'}</span><h1>{selectedCycle ? `La historia de tu ${selectedCycle.crop_name}` : story.garden.name}</h1><p>{selectedCycle ? `${story.garden.name} · Posición ${selectedCycle.position_number}` : `${story.garden.system_model ?? 'Jardín hidropónico'} · ${story.cycles.length} ciclos registrados`}</p>{selectedCycle?.planted_on && <small>Plantada: {new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${selectedCycle.planted_on}T12:00:00`))}</small>}{!selectedCycle && <small>Vista compartida de solo lectura</small>}</section>
      {!cycleId && <section className="guest-garden-cycles" aria-label="Ciclos del jardín"><h2>Sus plantas</h2><div className="guest-garden-cycle-grid">{story.cycles.map((cycle) => <Link className="guest-garden-cycle-card" key={cycle.grow_cycle_id} to={`/guest/garden/${token}/cycle/${cycle.grow_cycle_id}`}><span>{String(cycle.position_number).padStart(2, '0')}</span><div><strong>{cycle.crop_name}</strong><small>Posición {cycle.position_number}{cycle.planted_on ? ` · ${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${cycle.planted_on}T12:00:00`))}` : ''}</small></div></Link>)}</div></section>}
      {cycleId && !selectedCycle && <section className="guest-story-page__state"><StatePanel kind="error" title="Planta no disponible">Esta planta no forma parte de este enlace compartido.</StatePanel></section>}
      {selectedCycle && <Link className="text-link" to={`/guest/garden/${token}`}>← Volver al jardín completo</Link>}
      {selectedCycle && <GuestPhotoStoryRail events={history} />}
      <section className="guest-story-timeline" aria-label={selectedCycle ? `Historia de ${selectedCycle.crop_name}` : 'Historia del jardín'}>{history.length === 0 && <p className="empty-copy">Todavía no hay registros compartidos para este jardín.</p>}{history.map((event) => <article className="guest-story-event" key={event.id}><div className="guest-story-event__date"><strong>{label(event.event_type, event.event_data)}</strong><time>{event.occurred_at ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.occurred_at)) : 'Fecha no registrada'}</time><small>{event.crop_name ?? 'Jardín'}{event.position_number ? ` · Posición ${event.position_number}` : ''}</small></div><div className="guest-story-event__body">{(!selectedCycle && event.photo) ? <figure className="guest-story-photo"><img src={event.photo.url} alt={`Fotografía documental: ${event.photo.original_filename}`} /><figcaption>{event.photo.original_filename}</figcaption></figure> : (!selectedCycle && <ImageOff size={18} aria-label="Sin fotografía" />)}{event.note && <p>{event.note}</p>}</div></article>)}</section>
      <footer className="guest-story-page__footer"><RefreshCw size={15} aria-hidden="true" /><button type="button" onClick={() => void load()}>Actualizar</button></footer>
    </>}</main>
}
