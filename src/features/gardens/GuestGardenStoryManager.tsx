import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, RotateCcw, Share2, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import type { GardenDetail, GuestGardenStorySummary } from '../../domain/types'
import { createGuestGardenStory, getGarden, getGuestGardenStories, revokeGuestGardenStory } from '../../lib/garden-api'

export function GuestGardenStoryManager() {
  const { gardenId } = useParams()
  const [garden, setGarden] = useState<GardenDetail | null>(null)
  const [stories, setStories] = useState<GuestGardenStorySummary[]>([])
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!gardenId) return
    try { const [nextGarden, nextStories] = await Promise.all([getGarden(gardenId), getGuestGardenStories(gardenId)]); setGarden(nextGarden); setStories(nextStories) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo preparar el enlace del jardín.') }
  }, [gardenId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the async loader writes after the RPC settles.
  useEffect(() => { void load() }, [load])
  const create = async () => {
    if (!garden) return
    setBusy(true); setError(null); setMessage(null); setCopied(false)
    try { const result = await createGuestGardenStory(crypto.randomUUID(), garden.id); setLink(result.url); setMessage('Enlace creado. Puedes revocarlo cuando quieras.'); setStories(await getGuestGardenStories(garden.id)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo crear el enlace.') }
    finally { setBusy(false) }
  }
  const revoke = async (storyId: string) => {
    setBusy(true); setError(null)
    try { await revokeGuestGardenStory(crypto.randomUUID(), storyId); setMessage('Enlace revocado.'); if (garden) setStories(await getGuestGardenStories(garden.id)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo revocar el enlace.') }
    finally { setBusy(false) }
  }
  const copy = async () => { if (!link) return; try { await navigator.clipboard.writeText(link); setCopied(true); setMessage('Enlace copiado.') } catch { setMessage('Selecciona el enlace y cópialo manualmente.') } }
  return <AppShell presentation="story" title="Compartir jardín" subtitle={garden?.name ?? 'Preparando enlace'} backTo={garden ? `/garden/${garden.id}` : '/'}>
    {!garden && !error && <StatePanel kind="loading" title="Preparando historia del jardín" />}
    {error && <StatePanel kind="error" title="No se pudo preparar el enlace" onRetry={() => void load()}>{error}</StatePanel>}
    {garden && <>
      <section className="guest-share-intro"><Share2 size={22} aria-hidden="true" /><div><h2>Un jardín completo, fuera de tu cuenta</h2><p>La persona invitada verá sus plantas, ciclos, hechos y fotografías en modo lectura. No tendrá acceso a tus controles ni a otros jardines.</p></div></section>
      {message && <p className="inline-message" role="status">{message}</p>}
      {link && <section className="guest-share-link"><div><span className="eyebrow">Nuevo enlace</span><h2>Listo para compartir</h2><p>Las fotografías privadas se entregan temporalmente al abrir la historia.</p></div><div className="guest-share-link__field"><input aria-label="Enlace del jardín compartido" readOnly value={link} /><button className="secondary-button secondary-button--compact" type="button" onClick={() => void copy()}><Copy size={16} aria-hidden="true" />{copied ? 'Copiado' : 'Copiar'}</button></div></section>}
      <div className="button-row"><button className="primary-button" type="button" disabled={busy} onClick={() => void create()}><Share2 size={16} aria-hidden="true" />{busy ? 'Creando…' : 'Crear nuevo enlace'}</button><Link className="secondary-button" to={`/garden/${garden.id}`}><X size={16} aria-hidden="true" />Cancelar</Link></div>
      <section className="guest-share-existing"><div className="section-heading"><h2>Enlaces de este jardín</h2><span>{stories.length}</span></div>{stories.length === 0 && <p className="empty-copy">Todavía no has creado un enlace para este jardín.</p>}{stories.map((story) => <article className="guest-share-existing__row" key={story.id}><div><strong>{story.active ? 'Activo' : 'Revocado'}</strong><span>{new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(story.created_at))}</span></div>{story.active ? <button className="secondary-button secondary-button--compact" type="button" disabled={busy} onClick={() => void revoke(story.id)}><RotateCcw size={16} aria-hidden="true" /> Revocar</button> : <Check size={17} aria-label="Revocado" />}</article>)}</section>
    </>}
  </AppShell>
}
