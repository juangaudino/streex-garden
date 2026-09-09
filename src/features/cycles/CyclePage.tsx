import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Images, MoreHorizontal, RefreshCw, Share2 } from 'lucide-react'
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import { photoContentType } from '../../domain/photo-integrity'
import type { GrowCycleDetail, ObservationDraft } from '../../domain/types'
import { getCycle } from '../../lib/garden-api'
import { getObservationDrafts, saveObservationDraft } from '../../lib/offline-observation-store'
import { syncObservationDraft } from '../../lib/observation-sync'
import { ObservationComposer } from './ObservationComposer'
import { PhotoEvidence } from './PhotoEvidence'
import { CycleActions } from './CycleActions'
import { AttentionTaskForm } from '../gardens/AttentionTaskTools'
import { BotanicalPortrait } from './BotanicalPortrait'
import { PlaceBackLink, type PlaceContext } from '../../components/PlaceLink'
import { isToday } from './photo-presentation'
import { CycleFactRecorder } from './CycleFactRecorder'
import { PhotoCoverActions } from './PhotoCoverActions'

function eventDate(event: GrowCycleDetail['history'][number]): string {
  if (event.occurred_at_precision === 'date' && event.occurred_on) {
    return `Fecha del hecho: ${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${event.occurred_on}T12:00:00`))} · Hora no registrada`
  }
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.occurred_at))
}

export function CyclePage() {
  const { cycleId } = useParams()
  return <CycleScreen key={cycleId} />
}

function CycleScreen() {
  const { cycleId } = useParams()
  const [cycle, setCycle] = useState<GrowCycleDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<ObservationDraft[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [coverMessage, setCoverMessage] = useState<string | null>(null)
  const [eventToInvalidate, setEventToInvalidate] = useState<GrowCycleDetail['history'][number] | null>(null)
  const location = useLocation()
  const arrival = (location.state as { place?: PlaceContext } | null)?.place
  const syncingRef = useRef(false)
  const initialSyncAttemptedFor = useRef<string | null>(null)
  const navigate = useNavigate()
  const load = useCallback(async () => {
    if (!cycleId) return
    setError(null)
    try { setCycle(await getCycle(cycleId)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cargar el ciclo.') }
  }, [cycleId])
  const loadDrafts = useCallback(async () => {
    if (!cycleId) return
    const all = await getObservationDrafts()
    setDrafts(all.filter((draft) => draft.growCycleId === cycleId && draft.status !== 'synced'))
  }, [cycleId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- both loaders write after independent async sources settle.
  useEffect(() => { void load(); void loadDrafts() }, [load, loadDrafts])


  const syncDrafts = useCallback(async () => {
    const pendingDrafts = drafts.filter((draft) => draft.status !== 'needs_review')
    if (syncingRef.current || pendingDrafts.length === 0 || !navigator.onLine) return
    syncingRef.current = true
    setSyncing(true)
    setSyncMessage('Sincronizando la observación y su fotografía…')
    try {
      const results = []
      for (const draft of pendingDrafts) {
        results.push(await syncObservationDraft(draft))
      }
      const resolved = results.filter((result) => result.result === 'synced').length
      const needsReview = results.filter((result) => result.result === 'needs_review').length
      if (needsReview > 0) {
        setSyncMessage(`${needsReview} observación${needsReview === 1 ? '' : 'es'} requiere${needsReview === 1 ? '' : 'n'} revisión antes de volver a intentarlo.`)
      } else if (resolved === pendingDrafts.length) {
        setSyncMessage('Las observaciones pendientes quedaron guardadas en tu cuenta.')
      } else {
        setSyncMessage('Algunas observaciones siguen pendientes. Puedes reintentarlas cuando haya conexión estable.')
      }
      await loadDrafts()
      await load()
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [drafts, load, loadDrafts])

  useEffect(() => {
    const retryWhenOnline = () => { void syncDrafts() }
    const retryWhenVisible = () => {
      if (document.visibilityState === 'visible') void syncDrafts()
    }
    window.addEventListener('online', retryWhenOnline)
    window.addEventListener('pageshow', retryWhenOnline)
    document.addEventListener('visibilitychange', retryWhenVisible)
    return () => {
      window.removeEventListener('online', retryWhenOnline)
      window.removeEventListener('pageshow', retryWhenOnline)
      document.removeEventListener('visibilitychange', retryWhenVisible)
    }
  }, [syncDrafts])

  useEffect(() => {
    if (!cycleId || initialSyncAttemptedFor.current === cycleId || !navigator.onLine || !drafts.some((draft) => draft.status !== 'needs_review')) return
    initialSyncAttemptedFor.current = cycleId
    void syncDrafts()
  }, [cycleId, drafts, syncDrafts])

  const retryableDrafts = drafts.filter((draft) => draft.status !== 'needs_review')
  const reviewDrafts = drafts.filter((draft) => draft.status === 'needs_review')
  const restoreDraftOriginal = async (draft: ObservationDraft, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !draft.photoMetadata) return
    if (photoContentType(file) !== draft.photoMetadata.contentType || file.size !== draft.photoMetadata.byteSize) {
      setSyncMessage('El archivo no coincide con el tipo o tamaño del original pendiente.')
      return
    }
    const repairedDraft: ObservationDraft = {
      ...draft,
      photo: new Blob([file], { type: draft.photoMetadata.contentType }),
      status: 'queued',
      lastError: undefined,
    }
    try {
      await saveObservationDraft(repairedDraft)
      setSyncMessage('Original restaurado en este dispositivo. Sincronizando…')
      const result = await syncObservationDraft(repairedDraft)
      if (result.result !== 'synced') setSyncMessage(`${result.result === 'needs_review' ? 'Revisar conflicto' : 'Pendiente de subir'}: ${result.error}`)
      await loadDrafts()
      await load()
    } catch (reason) {
      setSyncMessage(`Pendiente de subir: ${reason instanceof Error ? reason.message : 'No se pudo restaurar el original.'}`)
    }
  }

  const refreshCycle = async () => {
    setRefreshing(true)
    try {
      await Promise.all([load(), loadDrafts()])
    } finally {
      setRefreshing(false)
    }
  }

  return <AppShell presentation="cycle" backTo={cycle ? `/garden/${cycle.garden.id}` : '/'} actions={<button className="secondary-button secondary-button--compact" type="button" onClick={() => void refreshCycle()} disabled={refreshing}><RefreshCw size={16} aria-hidden="true" /> {refreshing ? 'Actualizando…' : 'Actualizar'}</button>}>
      {cycle === null && !error && (arrival ? <BotanicalPortrait place={arrival} /> : <StatePanel kind="loading" title="Cargando el ciclo" />)}
    {error && <StatePanel kind="error" title="No se pudo abrir el ciclo" onRetry={() => void load()}>{error}</StatePanel>}
    {cycle && <>
      <BotanicalPortrait cycle={cycle} place={{ placeId: cycle.position.id, number: cycle.position.position_number, gardenId: cycle.garden.id, cropName: cycle.crop_name }} />
      <section className="cycle-story-entry"><div><span>Historia de la planta</span><h2>La historia de tu {cycle.crop_name}</h2><p>{cycle.history.filter((event) => event.photo?.upload_status === 'uploaded').length === 0 ? 'Comienza aquí con la primera fotografía documental.' : cycle.history.filter((event) => event.photo?.upload_status === 'uploaded').length === 1 ? 'Ya hay un momento registrado. Recorre su evidencia.' : 'Recorre sus momentos y compara dos fotografías cuando quieras.'}</p></div><div className="cycle-story-entry__actions"><Link className="primary-button" to={`/cycle/${cycle.id}/photos`}><Images size={17} aria-hidden="true" /> Ver historia</Link><Link className="secondary-button secondary-button--compact" to={`/cycle/${cycle.id}/share`}><Share2 size={16} aria-hidden="true" /> Compartir</Link></div></section>
      {drafts.length > 0 && <section className="sync-notice" aria-live="polite"><strong>{syncing ? 'Sincronizando observación pendiente' : `Pendiente de subir: ${retryableDrafts.length} observación${retryableDrafts.length === 1 ? '' : 'es'}.`}</strong><p>{syncMessage ?? 'Se guardaron en este dispositivo. Se validarán antes de confirmar el registro remoto.'}</p>{reviewDrafts.length > 0 && <p className="sync-notice__error" role="alert">Revisar conflicto: {reviewDrafts.length} observación{reviewDrafts.length === 1 ? '' : 'es'} no se volverá{reviewDrafts.length === 1 ? '' : 'n'} a enviar automáticamente.</p>}{drafts.some((draft) => draft.lastError) && <p className="sync-notice__error" role="alert">Detalle: {drafts.find((draft) => draft.lastError)?.lastError}</p>}{retryableDrafts.some((draft) => draft.photo && draft.photoMetadata) && <label className="file-button secondary-button--compact">Volver a elegir el original<input type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" onChange={(event) => void restoreDraftOriginal(retryableDrafts.find((draft) => draft.photo && draft.photoMetadata)!, event)} /></label>}{retryableDrafts.length > 0 && <button className="secondary-button" type="button" disabled={syncing || !navigator.onLine} onClick={() => void syncDrafts()}>{syncing ? 'Sincronizando…' : navigator.onLine ? 'Reintentar ahora' : 'Sin conexión'}</button>}</section>}
      <CycleActions key={eventToInvalidate?.id ?? 'actions'} cycle={cycle} selectedEvent={eventToInvalidate} onChanged={async () => { setEventToInvalidate(null); await load() }} onReplaced={(nextCycleId) => navigate(`/cycle/${nextCycleId}`)} />
      {cycle.state === 'active' && <CycleFactRecorder cycle={cycle} onSaved={load} />}
      {cycle.state === 'active' && <section className="cycle-attention"><div className="section-heading"><h2>Seguimiento</h2><span>Manual</span></div><p className="quiet-copy">Crea una atención solo si este ciclo necesita una revisión o acción posterior. Una observación corriente no abre una tarea.</p><AttentionTaskForm gardenId={cycle.garden.id} growCycleId={cycle.id} onCreated={load} compact /></section>}
      {cycle.state === 'active' && <div id="cycle-observation"><ObservationComposer growCycleId={cycle.id} onSaved={async () => { await load(); await loadDrafts() }} onDraftQueued={loadDrafts} /></div>}
      <section className="history-section" aria-labelledby="history-title"><div className="section-heading"><h2 id="history-title">Historial</h2><span>{cycle.history.length}</span></div>
        {cycle.history.length === 0 && <StatePanel kind="empty" title="Aún no hay observaciones">La primera nota o fotografía aparecerá aquí inmediatamente después de guardarse.</StatePanel>}
        <div className="history-list">{cycle.history.map((event) => <article className={`history-event${isToday(event) ? ' history-event--today' : ''}`} key={event.id}><div className="history-event__meta"><time dateTime={event.occurred_at_precision === 'date' ? event.occurred_on ?? event.occurred_at : event.occurred_at}>{isToday(event) && <b className="history-today">Hoy · </b>}{eventDate(event)}</time><span>{eventLabel(event)}</span></div>{event.note && <p>{event.note}</p>}{event.event_data && eventDetail(event) && <p className="history-event__detail">{eventDetail(event)}</p>}{event.photo && <PhotoEvidence photo={event.photo} actions={<PhotoCoverActions gardenId={cycle.garden.id} photoId={event.photo.id} onMessage={setCoverMessage} />} onRecovered={async () => { await load(); await loadDrafts() }} />}<details className="history-event__menu"><summary aria-label="Más acciones"><MoreHorizontal size={17} aria-hidden="true" /></summary><button className="text-button" type="button" onClick={() => setEventToInvalidate(event)}>Invalidar registro</button></details></article>)}</div>
        {coverMessage && <p className="inline-message" role="status">{coverMessage}</p>}
      </section>
      {cycle.corrections.length > 0 && <section className="history-section"><div className="section-heading"><h2>Correcciones</h2><span>{cycle.corrections.length}</span></div><div className="correction-list">{cycle.corrections.map((correction) => <article key={correction.id}><strong>{correction.operation}</strong><p>{correction.reason}</p><time dateTime={correction.created_at}>{new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(correction.created_at))}</time></article>)}</div></section>}
      <PlaceBackLink className="text-link" to={`/garden/${cycle.garden.id}`}>Volver a las posiciones de {cycle.garden.name}</PlaceBackLink>
    </>}
  </AppShell>
}

// eslint-disable-next-line react-refresh/only-export-components
export function eventLabel(event: GrowCycleDetail['history'][number]): string {
  const data = event.event_data ?? {}
  if (event.event_type === 'intervention') {
    if (data.class === 'thinning') return 'Aclareo realizado'
    if (data.class === 'pruning') return 'Poda realizada'
    if (data.class === 'support') return ({ installed: 'Soporte instalado', adjusted: 'Soporte ajustado', removed: 'Soporte retirado' } as Record<string, string>)[String(data.operation)] ?? 'Intervención de soporte'
  }
  return ({ observation: 'Observación', planting: 'Siembra', harvest: 'Cosecha', action: 'Acción', cycle_started: 'Ciclo iniciado', cycle_ended: 'Ciclo cerrado', cycle_moved: 'Ciclo trasladado', seeds_added: 'Siembra adicional', germination_observed: 'Germinación observada', germination_confirmed: 'Germinación confirmada hasta una fecha', plant_count_observed: 'Cantidad de plantas observada', visual_review: 'Revisión visual', development_review: 'Revisión de desarrollo', intervention: 'Intervención', incident_opened: 'Incidencia abierta', incident_resolved: 'Incidencia resuelta', system_maintenance: 'Mantenimiento', measurement: 'Medición', readiness_review: 'Preparación para cosecha', photo_evidence: 'Fotografía documental' })[event.event_type]
}

// eslint-disable-next-line react-refresh/only-export-components
export function eventDetail(event: GrowCycleDetail['history'][number]): string {
  const data = event.event_data ?? {}
  if (event.event_type === 'plant_count_observed' && data.count !== undefined) return `Cantidad: ${data.count} ${data.count_kind === 'plants_kept' ? 'conservadas' : 'visibles'}`
  if (event.event_type === 'germination_observed' && data.count !== undefined) return `Plántulas observadas: ${data.count}`
  if (event.event_type === 'development_review' && data.purpose) return `Evaluación: ${String(data.purpose).replace('evaluate_', '')}`
  if (event.event_type === 'incident_opened' && data.severity) return `Severidad: ${data.severity === 'action_required' ? 'requiere acción' : 'vigilar'}`
  return ''
}
