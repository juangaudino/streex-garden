import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { CalendarDays, Images, MapPin, RefreshCw } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { HarvestReadiness } from '../../components/HarvestReadiness'
import { StatePanel } from '../../components/StatePanel'
import { photoContentType } from '../../domain/photo-integrity'
import type { GrowCycleDetail, ObservationDraft } from '../../domain/types'
import { getCycle, getSignedPhotoUrl } from '../../lib/garden-api'
import { getObservationDrafts, saveObservationDraft } from '../../lib/offline-observation-store'
import { syncObservationDraft } from '../../lib/observation-sync'
import { ObservationComposer } from './ObservationComposer'
import { PhotoEvidence } from './PhotoEvidence'
import { CycleActions } from './CycleActions'
import { AttentionTaskForm } from '../gardens/AttentionTaskTools'
import { GrowthRings } from '../../components/GrowthRings'

function plantedDate(cycle: GrowCycleDetail): string {
  if (!cycle.planted_on) return 'Fecha de siembra desconocida'
  const value = new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(new Date(`${cycle.planted_on}T12:00:00`))
  return cycle.planted_on_precision === 'approximate' ? `Siembra aproximada: ${value}` : `Sembrada: ${value}`
}

function eventDate(event: GrowCycleDetail['history'][number]): string {
  if (event.occurred_at_precision === 'date' && event.occurred_on) {
    return `Fecha del hecho: ${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${event.occurred_on}T12:00:00`))} · Hora no registrada`
  }
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.occurred_at))
}

export function CyclePage() {
  const { cycleId } = useParams()
  const [cycle, setCycle] = useState<GrowCycleDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<ObservationDraft[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [eventToInvalidate, setEventToInvalidate] = useState<GrowCycleDetail['history'][number] | null>(null)
  const [heroUrl, setHeroUrl] = useState<string | null>(null)
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

  useEffect(() => {
    const photo = cycle?.history.find((event) => event.photo?.upload_status === 'uploaded')?.photo
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing a URL owned by a previously signed private original avoids showing it for another cycle.
    if (!photo) { setHeroUrl(null); return undefined }
    let active = true
    void getSignedPhotoUrl(photo.storage_path).then((url) => { if (active) setHeroUrl(url) }).catch(() => { if (active) setHeroUrl(null) })
    return () => { active = false }
  }, [cycle?.history])

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

  return <AppShell title={cycle?.crop_name ?? 'Ciclo'} subtitle={cycle ? `${cycle.garden.name} · Posición ${cycle.position.position_number}` : 'Cargando contexto'} backTo={cycle ? `/garden/${cycle.garden.id}` : '/'} actions={<button className="secondary-button secondary-button--compact" type="button" onClick={() => void refreshCycle()} disabled={refreshing}><RefreshCw size={16} aria-hidden="true" /> {refreshing ? 'Actualizando…' : 'Actualizar'}</button>}>
    {cycle === null && !error && <StatePanel kind="loading" title="Cargando el ciclo" />}
    {error && <StatePanel kind="error" title="No se pudo abrir el ciclo" onRetry={() => void load()}>{error}</StatePanel>}
    {cycle && <>
      <section className={`cycle-hero${heroUrl ? ' cycle-hero--photo' : ' cycle-hero--no-photo'}`}>
        <div className={`cycle-hero__image${heroUrl ? ' cycle-hero__image--photo' : ''}`}>{heroUrl ? <img src={heroUrl} alt={`Fotografía más reciente de ${cycle.crop_name}`} /> : <div className="cycle-no-photo" aria-label="Sin fotografía principal"><GrowthRings /><span>{String(cycle.position.position_number).padStart(2, '0')}</span><small>Sin fotografía principal</small></div>}</div>
        <div className="cycle-hero__content"><h2>{cycle.crop_name}</h2><p><MapPin size={16} aria-hidden="true" /> {cycle.garden.name} · Posición {cycle.position.position_number}</p><p><CalendarDays size={16} aria-hidden="true" /> {plantedDate(cycle)}</p><HarvestReadiness value={cycle.harvest_readiness} /></div>
      </section>
      {drafts.length > 0 && <section className="sync-notice" aria-live="polite"><strong>{syncing ? 'Sincronizando observación pendiente' : `Pendiente de subir: ${retryableDrafts.length} observación${retryableDrafts.length === 1 ? '' : 'es'}.`}</strong><p>{syncMessage ?? 'Se guardaron en este dispositivo. Se validarán antes de confirmar el registro remoto.'}</p>{reviewDrafts.length > 0 && <p className="sync-notice__error" role="alert">Revisar conflicto: {reviewDrafts.length} observación{reviewDrafts.length === 1 ? '' : 'es'} no se volverá{reviewDrafts.length === 1 ? '' : 'n'} a enviar automáticamente.</p>}{drafts.some((draft) => draft.lastError) && <p className="sync-notice__error" role="alert">Detalle: {drafts.find((draft) => draft.lastError)?.lastError}</p>}{retryableDrafts.some((draft) => draft.photo && draft.photoMetadata) && <label className="file-button secondary-button--compact">Volver a elegir el original<input type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" onChange={(event) => void restoreDraftOriginal(retryableDrafts.find((draft) => draft.photo && draft.photoMetadata)!, event)} /></label>}{retryableDrafts.length > 0 && <button className="secondary-button" type="button" disabled={syncing || !navigator.onLine} onClick={() => void syncDrafts()}>{syncing ? 'Sincronizando…' : navigator.onLine ? 'Reintentar ahora' : 'Sin conexión'}</button>}</section>}
      <CycleActions key={eventToInvalidate?.id ?? 'actions'} cycle={cycle} selectedEvent={eventToInvalidate} onChanged={async () => { setEventToInvalidate(null); await load() }} onReplaced={(nextCycleId) => navigate(`/cycle/${nextCycleId}`)} />
      {cycle.state === 'active' && <section className="cycle-attention"><div className="section-heading"><h2>Seguimiento</h2><span>Manual</span></div><p className="quiet-copy">Crea una atención solo si este ciclo necesita una revisión o acción posterior. Una observación corriente no abre una tarea.</p><AttentionTaskForm gardenId={cycle.garden.id} growCycleId={cycle.id} onCreated={load} compact /></section>}
      {cycle.state === 'active' && <ObservationComposer growCycleId={cycle.id} onSaved={async () => { await load(); await loadDrafts() }} onDraftQueued={loadDrafts} />}
      <section className="history-section" aria-labelledby="history-title"><div className="section-heading"><h2 id="history-title">Historial</h2><span>{cycle.history.length}</span></div>{cycle.history.filter((event) => event.photo?.upload_status === 'uploaded').length >= 2 && <Link className="history-compare-link" to={`/cycle/${cycle.id}/photos`}><Images size={17} aria-hidden="true" /> Comparar fotos</Link>}
        {cycle.history.length === 0 && <StatePanel kind="empty" title="Aún no hay observaciones">La primera nota o fotografía aparecerá aquí inmediatamente después de guardarse.</StatePanel>}
        <div className="history-list">{cycle.history.map((event) => <article className="history-event" key={event.id}><div className="history-event__meta"><time dateTime={event.occurred_at}>{eventDate(event)}</time><span>{eventLabel(event.event_type)}</span></div>{event.note && <p>{event.note}</p>}{event.photo && <PhotoEvidence photo={event.photo} onRecovered={async () => { await load(); await loadDrafts() }} />}<button className="text-button history-event__invalidate" type="button" onClick={() => setEventToInvalidate(event)}>Invalidar registro</button></article>)}</div>
      </section>
      {cycle.corrections.length > 0 && <section className="history-section"><div className="section-heading"><h2>Correcciones</h2><span>{cycle.corrections.length}</span></div><div className="correction-list">{cycle.corrections.map((correction) => <article key={correction.id}><strong>{correction.operation}</strong><p>{correction.reason}</p><time dateTime={correction.created_at}>{new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(correction.created_at))}</time></article>)}</div></section>}
      <Link className="text-link" to={`/garden/${cycle.garden.id}`}>Volver a las posiciones de {cycle.garden.name}</Link>
    </>}
  </AppShell>
}

function eventLabel(type: GrowCycleDetail['history'][number]['event_type']): string {
  return ({ observation: 'Observación', planting: 'Siembra', harvest: 'Cosecha', action: 'Acción', cycle_started: 'Ciclo iniciado', cycle_ended: 'Ciclo cerrado', cycle_moved: 'Ciclo trasladado', visual_review: 'Revisión visual', development_review: 'Revisión de desarrollo', intervention: 'Intervención', incident_opened: 'Incidente abierto', incident_resolved: 'Incidente resuelto', system_maintenance: 'Mantenimiento', measurement: 'Medición', readiness_review: 'Preparación para cosecha' })[type]
}
