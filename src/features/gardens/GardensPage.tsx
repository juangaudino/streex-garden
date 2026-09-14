import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, ChartNoAxesColumnIncreasing, Clock3, Plus, Wrench } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import { homeVisitStorageKey, validVisitId } from '../../domain/home-visit'
import type { HomeChange, HomeDashboard } from '../../domain/types'
import { acknowledgeHomeSnapshot, getHome, getHomeDashboard, getOpenMaintenanceSession, setMaintenanceSessionState, startMaintenanceSession } from '../../lib/garden-api'
import { CreateGardenForm } from './CreateGardenForm'
import { AttentionList } from './AttentionList'
import { BotanicalGardenCard } from './BotanicalGardenCard'

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function ChangeRow({ change }: { change: HomeChange }) {
  const body = <><strong>{change.summary}</strong><span>{dateLabel(change.occurred_at)}</span></>
  const target = change.grow_cycle_id ? `/cycle/${change.grow_cycle_id}` : change.garden_id ? `/garden/${change.garden_id}` : null
  return target ? <Link className="home-change" to={target}>{body}<ArrowRight size={16} aria-hidden="true" /></Link> : <article className="home-change">{body}</article>
}

function readCachedDashboard(userId: string): HomeDashboard | null {
  try {
    const saved = window.localStorage.getItem(`${homeVisitStorageKey(userId)}:snapshot`)
    return saved ? JSON.parse(saved) as HomeDashboard : null
  } catch { return null }
}

export function GardensPage({ user }: { user: User }) {
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cached, setCached] = useState(false)
  const [creating, setCreating] = useState(false)
  const [selectingMaintenance, setSelectingMaintenance] = useState(false)
  const [maintenanceGardenIds, setMaintenanceGardenIds] = useState<string[]>([])
  const [startingMaintenance, setStartingMaintenance] = useState(false)
  const [abandoningMaintenance, setAbandoningMaintenance] = useState(false)
  const [confirmAbandonMaintenance, setConfirmAbandonMaintenance] = useState(false)
  const [openMaintenanceId, setOpenMaintenanceId] = useState<string | null>(null)
  const acknowledged = useRef<string | null>(null)
  const navigate = useNavigate()
  const storageKey = homeVisitStorageKey(user.id)

  const load = useCallback(async () => {
    setError(null)
    setCached(false)
    try {
      const visitId = validVisitId(window.localStorage.getItem(storageKey))
      const [next, gardenCards] = await Promise.all([getHomeDashboard(visitId), getHome()])
      const coverByGarden = new Map(gardenCards.map((garden) => [garden.id, garden.cover_photo ?? null]))
      next.gardens = next.gardens.map((garden) => ({ ...garden, cover_photo: coverByGarden.get(garden.id) ?? null }))
      window.localStorage.setItem(storageKey, next.visit.id)
      window.localStorage.setItem(`${storageKey}:snapshot`, JSON.stringify(next))
      setDashboard(next)
      const openSession = await getOpenMaintenanceSession()
      setOpenMaintenanceId(openSession?.id ?? null)
    } catch (reason) {
      const fallback = readCachedDashboard(user.id)
      if (fallback) {
        setDashboard(fallback)
        setCached(true)
        setError(null)
        return
      }
      setError(reason instanceof Error ? reason.message : 'No se pudo cargar el inicio.')
    }
  }, [storageKey, user.id])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the async loader writes only after the server settles.
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!dashboard || cached || acknowledged.current === `${dashboard.visit.id}:${dashboard.visit.snapshot_cursor}`) return undefined
    const key = `${dashboard.visit.id}:${dashboard.visit.snapshot_cursor}`
    const frame = window.requestAnimationFrame(() => {
      void acknowledgeHomeSnapshot(dashboard.visit.id, dashboard.visit.snapshot_cursor).then(() => { acknowledged.current = key }).catch(() => undefined)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [cached, dashboard])

  const gardens = dashboard?.gardens ?? null
  const changes = dashboard?.since_last_time.changes ?? []
  const attention = dashboard?.attention.items ?? []
  const startMaintenance = async () => {
    if (maintenanceGardenIds.length === 0 || !navigator.onLine) return
    if (openMaintenanceId) { navigate(`/maintenance/${openMaintenanceId}`); return }
    setStartingMaintenance(true)
    try { const result = await startMaintenanceSession(crypto.randomUUID(), maintenanceGardenIds); navigate(`/maintenance/${result.session_id}`) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar mantenimiento.') } finally { setStartingMaintenance(false) }
  }
  const abandonMaintenance = async () => {
    if (!openMaintenanceId) return
    setAbandoningMaintenance(true); setError(null)
    try {
      await setMaintenanceSessionState(crypto.randomUUID(), openMaintenanceId, 'abandoned')
      setOpenMaintenanceId(null); setConfirmAbandonMaintenance(false); setSelectingMaintenance(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cancelar el recorrido.') }
    finally { setAbandoningMaintenance(false) }
  }

  return (
    <AppShell presentation="collection-gardens" title="Tus jardines" actions={<div className="heading-actions__row"><Link className="secondary-button secondary-button--compact" to="/control"><ChartNoAxesColumnIncreasing size={16} aria-hidden="true" /> Control</Link><button className="primary-button primary-button--compact" type="button" onClick={() => setCreating(true)}><Plus size={17} aria-hidden="true" /> Añadir jardín</button></div>}>
      {creating && <div className="bc-create"><CreateGardenForm onCancel={() => setCreating(false)} onCreated={(gardenId) => navigate(`/garden/${gardenId}`)} /></div>}
      <section className="bc-maintenance" aria-labelledby="maintenance-access"><div className="section-heading"><h2 id="maintenance-access">Recorrido de mantenimiento</h2>{!openMaintenanceId && <button className="secondary-button" type="button" onClick={() => { setMaintenanceGardenIds(gardens?.map((garden) => garden.id) ?? []); setSelectingMaintenance(true) }}><Wrench size={16} aria-hidden="true" /> Mantenimiento</button>}</div>
      {openMaintenanceId && <section className="home-cache-notice home-maintenance-notice"><Wrench size={18} aria-hidden="true" /><div><strong>Tienes un recorrido de mantenimiento abierto.</strong><span>Reanúdalo para continuar donde quedaste o cancélalo. Lo ya registrado se conserva.</span><div className="button-row"><Link className="primary-button primary-button--compact" to={`/maintenance/${openMaintenanceId}`}>Reanudar recorrido</Link><button className="secondary-button secondary-button--compact" type="button" disabled={abandoningMaintenance} onClick={() => setConfirmAbandonMaintenance(true)}>Cancelar recorrido</button></div></div></section>}
      {confirmAbandonMaintenance && <section className="editor-card maintenance-start"><div className="section-heading"><h2>¿Cancelar este recorrido?</h2><button className="text-button" type="button" disabled={abandoningMaintenance} onClick={() => setConfirmAbandonMaintenance(false)}>Volver</button></div><p>Se cerrará este recorrido sin marcar las posiciones pendientes. Las revisiones u omisiones que ya guardaste se conservan.</p><button className="secondary-button" type="button" disabled={abandoningMaintenance} onClick={() => void abandonMaintenance()}>{abandoningMaintenance ? 'Cancelando…' : 'Sí, cancelar recorrido'}</button></section>}
      {selectingMaintenance && <section className="editor-card maintenance-start"><div className="section-heading"><h2>Iniciar mantenimiento</h2><button className="text-button" type="button" onClick={() => setSelectingMaintenance(false)}>Cancelar</button></div><p>Selecciona los jardines que quieres recorrer. Las posiciones y ocupantes actuales quedarán capturados al iniciar.</p>{gardens?.map((garden) => <label className="choice" key={garden.id}><input type="checkbox" checked={maintenanceGardenIds.includes(garden.id)} onChange={(event) => setMaintenanceGardenIds((current) => event.target.checked ? [...current, garden.id] : current.filter((id) => id !== garden.id))} />{garden.name}</label>)}<button className="primary-button" type="button" disabled={startingMaintenance || maintenanceGardenIds.length === 0 || !navigator.onLine} onClick={() => void startMaintenance()}>{startingMaintenance ? 'Iniciando…' : 'Iniciar recorrido'}</button></section>}
      </section>
      {cached && dashboard && <div className="home-cache-notice"><Clock3 size={18} aria-hidden="true" /><span>Mostrando la última instantánea guardada: {dateLabel(dashboard.visit.snapshot_at)}. Al reconectar se recuperará el intervalo real.</span></div>}
      <section className="bc-section bc-catalog" aria-labelledby="garden-list">
        <div className="section-heading"><h2 id="garden-list">Jardines</h2>{gardens && <span>{gardens.length}</span>}</div>
        {gardens === null && !error && <StatePanel kind="loading" title="Cargando tus jardines" />}
        {gardens?.length === 0 && !creating && <div className="bc-catalog-empty"><StatePanel kind="empty" title="Empieza con tu primer jardín">Crea el sistema y sus posiciones para registrar su historia.</StatePanel><button className="secondary-button" type="button" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" /> Crear primer jardín</button></div>}
        {gardens && gardens.length > 0 && <div className="bc-garden-grid">{gardens.map(garden => <BotanicalGardenCard key={garden.id} garden={garden} showSystem />)}</div>}
      </section>
      <div className="bc-summary-grid"><section className="bc-section" aria-labelledby="since-last-time">
        <div className="section-heading"><h2 id="since-last-time">Desde la última vez</h2>{dashboard && <span>{dashboard.visit.first_visit ? 'Tu primera vista' : `${changes.length} novedades`}</span>}</div>
        {!dashboard && !error && <StatePanel kind="loading" title="Preparando tu resumen" />}
        {error && <StatePanel kind="error" title="No se pudo cargar el inicio" onRetry={() => void load()}>{error}</StatePanel>}
        {dashboard?.visit.first_visit && <StatePanel kind="empty" title="Tu primera vista">Aquí aparecerán los cambios confirmados entre tus visitas a Jardines.</StatePanel>}
        {dashboard && !dashboard.visit.first_visit && changes.length === 0 && <StatePanel kind="empty" title="No hay cambios registrados">No se registraron novedades desde tu última visita a Jardines.</StatePanel>}
        {dashboard && !dashboard.visit.first_visit && changes.length > 0 && <div className="home-change-list">{changes.map((change) => <ChangeRow key={change.cursor} change={change} />)}</div>}
      </section>
      <section className="bc-section" aria-labelledby="attention">
        <div className="section-heading"><h2 id="attention">Atención</h2>{dashboard && <span>{attention.length === 0 ? 'Sin pendientes' : `${attention.length} pendientes`}</span>}</div>
        {!dashboard && !error && <StatePanel kind="loading" title="Consultando atención" />}
        {dashboard && <AttentionList items={attention} compact />}
        {dashboard && attention.length > 0 && <Link className="text-link" to="/today">Ver toda la atención <ArrowRight size={16} aria-hidden="true" /></Link>}
      </section></div>
    </AppShell>
  )
}
