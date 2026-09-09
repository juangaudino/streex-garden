import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Link2, RotateCcw, Share2, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import type { GrowCycleDetail, GuestPlantStorySummary } from '../../domain/types'
import { getCycle, getGuestPlantStories, createGuestPlantStory, revokeGuestPlantStory } from '../../lib/garden-api'
import { recordLabel } from './photo-presentation'

export function GuestPlantStoryManager() {
  const { cycleId } = useParams()
  return <GuestPlantStoryManagerScreen key={cycleId} />
}

function GuestPlantStoryManagerScreen() {
  const { cycleId } = useParams()
  const [cycle, setCycle] = useState<GrowCycleDetail | null>(null)
  const [stories, setStories] = useState<GuestPlantStorySummary[]>([])
  const [selectedNotes, setSelectedNotes] = useState<Record<string, boolean>>({})
  const [selectedPhotos, setSelectedPhotos] = useState<Record<string, boolean>>({})
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!cycleId) return
    setError(null)
    try {
      const [nextCycle, nextStories] = await Promise.all([getCycle(cycleId), getGuestPlantStories(cycleId)])
      setCycle(nextCycle)
      setStories(nextStories)
      setSelectedPhotos(Object.fromEntries(nextCycle.history.filter((event) => event.event_type === 'photo_evidence' && event.photo).map((event) => [event.photo!.id, true])))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo preparar la historia compartida.')
    }
  }, [cycleId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- the async loader writes after the RPC settles.
  useEffect(() => { void load() }, [load])

  const noteEvents = useMemo(() => cycle?.history.filter((event) => event.note?.trim() && event.event_type !== 'photo_evidence') ?? [], [cycle])
  const historicalPhotos = useMemo(() => cycle?.history.filter((event) => event.event_type === 'photo_evidence' && event.photo) ?? [], [cycle])

  const create = async () => {
    if (!cycle) return
    setBusy(true); setError(null); setMessage(null); setCopied(false)
    try {
      const itemSelection = [
        ...Object.entries(selectedNotes).filter(([, include]) => include).map(([event_id]) => ({ event_id, include_note: true })),
        ...Object.entries(selectedPhotos).filter(([, include]) => include).map(([photo_id]) => ({ photo_id })),
      ]
      const result = await createGuestPlantStory({ requestId: crypto.randomUUID(), growCycleId: cycle.id, itemSelection })
      setLink(result.url)
      setMessage('Enlace creado. Se muestra una sola vez; puedes revocarlo desde aquí.')
      setStories(await getGuestPlantStories(cycle.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo crear el enlace.')
    } finally { setBusy(false) }
  }

  const revoke = async (storyId: string) => {
    setBusy(true); setError(null); setMessage(null)
    try {
      await revokeGuestPlantStory(crypto.randomUUID(), storyId)
      setMessage('Enlace revocado. Las nuevas visitas ya no podrán abrirlo.')
      if (cycle) setStories(await getGuestPlantStories(cycle.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo revocar el enlace.')
    } finally { setBusy(false) }
  }

  const copy = async () => {
    if (!link) return
    try { await navigator.clipboard.writeText(link); setCopied(true); setMessage('Enlace copiado.') }
    catch { setMessage('No se pudo copiar automáticamente. Selecciona el enlace y cópialo manualmente.') }
  }

  return <AppShell presentation="story" title="Compartir historia" subtitle={cycle ? `${cycle.crop_name} · ${cycle.garden.name} · Posición ${cycle.position.position_number}` : 'Preparando enlace'} backTo={cycle ? `/cycle/${cycle.id}` : '/'}>
    {!cycle && !error && <StatePanel kind="loading" title="Preparando Guest Plant Story" />}
    {error && <StatePanel kind="error" title="No se pudo preparar el enlace" onRetry={() => void load()}>{error}</StatePanel>}
    {cycle && <>
      <section className="guest-share-intro"><Share2 size={22} aria-hidden="true" /><div><h2>Una historia puntual, fuera de tu cuenta</h2><p>La persona invitada verá este ciclo en modo lectura. No tendrá acceso a tus jardines, controles ni datos de propietario.</p></div></section>
      {message && <p className="inline-message" role="status">{message}</p>}
      {link && <section className="guest-share-link" aria-labelledby="guest-link-title"><div><span className="eyebrow">Nuevo enlace</span><h2 id="guest-link-title">Listo para compartir</h2><p>El acceso se revoca desde esta pantalla. Las fotos se entregan temporalmente al abrir la historia.</p></div><div className="guest-share-link__field"><input aria-label="Enlace de Guest Plant Story" readOnly value={link} /><button className="secondary-button secondary-button--compact" type="button" onClick={() => void copy()}><Copy size={16} aria-hidden="true" />{copied ? 'Copiado' : 'Copiar'}</button></div></section>}
      <section className="guest-share-selection" aria-labelledby="guest-selection-title"><div className="section-heading"><h2 id="guest-selection-title">Elegir notas</h2><span>{noteEvents.length}</span></div><p className="quiet-copy">La historia incluye fechas, tipos de evento y fotografías confirmadas. Aquí decides qué notas escritas acompañan esos registros.</p>{noteEvents.length === 0 ? <p className="empty-copy">Este ciclo todavía no tiene notas escritas para seleccionar.</p> : <div className="guest-share-list">{noteEvents.map((event) => <label className="guest-share-item" key={event.id}><input aria-label={`Incluir nota: ${event.note}`} type="checkbox" checked={selectedNotes[event.id] ?? false} onChange={(change) => setSelectedNotes((current) => ({ ...current, [event.id]: change.target.checked }))} /><span><strong>{event.event_type}</strong><small>{recordLabel(event)}</small><em>{event.note}</em></span></label>)}</div>}</section>
      {historicalPhotos.length > 0 && <section className="guest-share-selection" aria-labelledby="guest-photos-title"><div className="section-heading"><h2 id="guest-photos-title">Fotografías históricas</h2><span>{historicalPhotos.length}</span></div><p className="quiet-copy">Estas fotografías no tienen un evento sintético. Marca cuáles forman parte de la historia compartida.</p><div className="guest-share-list">{historicalPhotos.map((event) => <label className="guest-share-item" key={event.photo!.id}><input type="checkbox" checked={selectedPhotos[event.photo!.id] ?? false} onChange={(change) => setSelectedPhotos((current) => ({ ...current, [event.photo!.id]: change.target.checked }))} /><span><strong>{event.photo!.original_filename}</strong><small>{recordLabel(event)}</small></span></label>)}</div></section>}
      <div className="button-row"><button className="primary-button" type="button" disabled={busy} onClick={() => void create()}><Link2 size={16} aria-hidden="true" />{busy ? 'Creando…' : 'Crear nuevo enlace'}</button><Link className="secondary-button" to={`/cycle/${cycle.id}`}><X size={16} aria-hidden="true" />Cancelar</Link></div>
      <section className="guest-share-existing" aria-labelledby="guest-existing-title"><div className="section-heading"><h2 id="guest-existing-title">Enlaces de este ciclo</h2><span>{stories.length}</span></div>{stories.length === 0 && <p className="empty-copy">Todavía no has creado un enlace para este ciclo.</p>}{stories.map((story) => <article className="guest-share-existing__row" key={story.id}><div><strong>{story.active ? 'Activo' : 'Revocado'}</strong><span>{new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(story.created_at))}</span></div>{story.active && <button className="secondary-button secondary-button--compact" type="button" disabled={busy} onClick={() => void revoke(story.id)}><RotateCcw size={16} aria-hidden="true" /> Revocar</button>}{!story.active && <Check size={17} aria-label="Revocado" />}</article>)}</section>
    </>}
  </AppShell>
}
