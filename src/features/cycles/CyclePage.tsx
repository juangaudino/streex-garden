import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import { photoContentType } from '../../domain/photo-integrity'
import type { GrowCycleDetail, ObservationDraft } from '../../domain/types'
import { getCycle } from '../../lib/garden-api'
import { getObservationDrafts, saveObservationDraft } from '../../lib/offline-observation-store'
import { syncObservationDraft } from '../../lib/observation-sync'
import { eventDetail as formatEventDetail, eventLabel as formatEventLabel } from '../../domain/event-presentation'
import { PlantStudio } from './PlantStudio'
import { PlantRecordSheet } from './PlantRecordSheet'
import { plantArrivalIntent, type PlantSheetIntent } from './plant-intents'

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
  const [message, setMessage] = useState<string | null>(null)
  const [sheet, setSheet] = useState<{ key: string; intent: PlantSheetIntent } | null>(null)
  const [formBusy, setFormBusy] = useState(false)
  const formBusyRef = useRef(false)
  const setWorking = useCallback((busy: boolean) => { formBusyRef.current = busy; setFormBusy(busy) }, [])
  const location = useLocation()
  const consumedArrival = useRef<string | null>(null)
  const alive = useRef(true)
  const loadVersion = useRef(0)
  const draftVersion = useRef(0)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const syncingRef = useRef(false)
  const initialSyncAttemptedFor = useRef<string | null>(null)
  const navigate = useNavigate()
  const load = useCallback(async () => {
    if (!cycleId || !alive.current) return
    const version = ++loadVersion.current
    try {
      const next = await getCycle(cycleId)
      if (alive.current && version === loadVersion.current) { setCycle(next); setError(null) }
    } catch (reason) {
      if (alive.current && version === loadVersion.current) setError(reason instanceof Error ? reason.message : 'No se pudo cargar el ciclo.')
    }
  }, [cycleId])
  const loadDrafts = useCallback(async () => {
    if (!cycleId || !alive.current) return
    const version = ++draftVersion.current
    try {
      const all = await getObservationDrafts()
      if (alive.current && version === draftVersion.current) setDrafts(all.filter(draft => draft.growCycleId === cycleId && draft.status !== 'synced'))
    } catch {
      if (alive.current && version === draftVersion.current) setSyncMessage('No se pudieron consultar los borradores de este dispositivo. Vuelve a intentarlo antes de registrar otra observación.')
    }
  }, [cycleId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- both loaders write after independent async sources settle.
  useEffect(() => { void load(); void loadDrafts() }, [load, loadDrafts])


  const syncDrafts = useCallback(async () => {
    const pendingDrafts = drafts.filter((draft) => draft.status !== 'needs_review')
    if (!alive.current || formBusyRef.current || syncingRef.current || pendingDrafts.length === 0 || !navigator.onLine) return
    syncingRef.current = true
    setSyncing(true)
    setSyncMessage('Sincronizando la observación y su fotografía…')
    try {
      const results = []
      for (const draft of pendingDrafts) {
        if (!alive.current) return
        results.push(await syncObservationDraft(draft))
      }
      if (!alive.current) return
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
    } catch (reason) {
      if (alive.current) setSyncMessage(`No se pudo sincronizar: ${reason instanceof Error ? reason.message : 'Reintenta cuando haya conexión.'}`)
    } finally {
      syncingRef.current = false
      if (alive.current) setSyncing(false)
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
    if (!cycleId || formBusy || initialSyncAttemptedFor.current === cycleId || !navigator.onLine || !drafts.some((draft) => draft.status !== 'needs_review')) return
    initialSyncAttemptedFor.current = cycleId
    void syncDrafts()
  }, [cycleId, drafts, syncDrafts, formBusy])

  useEffect(() => {
    if (!cycle || consumedArrival.current === location.key || formBusy) return
    consumedArrival.current = location.key
    const state = location.state as { aiAction?: unknown; [key: string]: unknown } | null
    const intent = plantArrivalIntent(location.hash, state?.aiAction, cycle)
    if (!intent) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consume an explicit router arrival, never a saved fact.
    setSheet({ key: crypto.randomUUID(), intent })
    const nextState = { ...state }
    delete nextState.aiAction
    navigate({ pathname: location.pathname, search: location.search, hash: '' }, { replace: true, state: nextState })
  }, [cycle, location.key, location.hash, location.pathname, location.search, location.state, navigate, formBusy])

  const retryableDrafts = drafts.filter((draft) => draft.status !== 'needs_review')
  const reviewDrafts = drafts.filter((draft) => draft.status === 'needs_review')
  const restoreDraftOriginal = async (draft: ObservationDraft, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !draft.photoMetadata || syncingRef.current || formBusyRef.current) return
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
    syncingRef.current = true
    setSyncing(true)
    try {
      await saveObservationDraft(repairedDraft)
      setSyncMessage('Original restaurado en este dispositivo. Sincronizando…')
      const result = await syncObservationDraft(repairedDraft)
      if (result.result !== 'synced') setSyncMessage(`${result.result === 'needs_review' ? 'Revisar conflicto' : 'Pendiente de subir'}: ${result.error}`)
      await loadDrafts()
      await load()
    } catch (reason) {
      if (alive.current) setSyncMessage(`Pendiente de subir: ${reason instanceof Error ? reason.message : 'No se pudo restaurar el original.'}`)
    } finally { syncingRef.current = false; if (alive.current) setSyncing(false) }
  }

  const afterSaved = async (notice: string) => {
    if (!alive.current) return
    setMessage(notice)
    // Read failures are handled by their loaders, never thrown back into a successful form write.
    await Promise.all([load(), loadDrafts()])
  }
  const open = (intent: PlantSheetIntent) => {
    if (!formBusyRef.current) setSheet({ key: crypto.randomUUID(), intent })
  }
  return <AppShell presentation="plant" onRegister={() => open({ kind: 'choose' })} registerDisabled={!cycle || cycle.state !== 'active' || formBusy}>
    {cycle === null && !error && <StatePanel kind="loading" title="Abriendo su historia…" />}
    {error && <StatePanel kind="error" title={cycle ? 'La vista necesita actualizarse' : 'No se pudo abrir el ciclo'} onRetry={() => void load()}>{cycle ? `Los registros confirmados siguen guardados. ${error}` : error}</StatePanel>}
    {message && <p className="bs-notice" role="status">{message}</p>}
    {syncMessage && drafts.length === 0 && <p className="bs-notice" role="status">{syncMessage}</p>}
    {cycle && <>
      <PlantStudio cycle={cycle} onOpen={open} onCoverChanged={load} onMessage={setMessage} />
      {drafts.length > 0 && <section className="sync-notice" aria-live="polite"><strong>{syncing ? 'Sincronizando observación pendiente' : `Pendiente de subir: ${retryableDrafts.length} observación${retryableDrafts.length === 1 ? '' : 'es'}.`}</strong><p>{syncMessage ?? 'Se guardaron en este dispositivo. Se validarán antes de confirmar el registro remoto.'}</p>{reviewDrafts.length > 0 && <p className="sync-notice__error" role="alert">Revisar conflicto: {reviewDrafts.length} observación{reviewDrafts.length === 1 ? '' : 'es'} no se volverá{reviewDrafts.length === 1 ? '' : 'n'} a enviar automáticamente.</p>}{drafts.some(draft => draft.lastError) && <p className="sync-notice__error" role="alert">Detalle: {drafts.find(draft => draft.lastError)?.lastError}</p>}{retryableDrafts.filter(draft => draft.photoMetadata).map(draft => <label className="file-button secondary-button--compact" key={draft.id}>Volver a elegir el original<input type="file" disabled={syncing || formBusy} accept="image/jpeg,image/png,image/heic,image/heif,image/webp" onChange={event => void restoreDraftOriginal(draft, event)} /></label>)}{retryableDrafts.length > 0 && <button className="secondary-button" type="button" disabled={syncing || formBusy || !navigator.onLine} onClick={() => void syncDrafts()}>{syncing ? 'Sincronizando…' : navigator.onLine ? 'Reintentar ahora' : 'Sin conexión'}</button>}</section>}
      {sheet && <PlantRecordSheet key={sheet.key} initial={sheet.intent} cycle={cycle} onClose={() => setSheet(null)} onSaved={afterSaved} onDraftQueued={loadDrafts} onBusyChange={setWorking} onReplaced={id => { if (alive.current) navigate(`/cycle/${id}`) }} onCoverChanged={load} onMessage={setMessage} />}
    </>}
  </AppShell>
}

// eslint-disable-next-line react-refresh/only-export-components
export function eventLabel(event: GrowCycleDetail['history'][number]): string {
  return formatEventLabel(event)
}

// eslint-disable-next-line react-refresh/only-export-components
export function eventDetail(event: GrowCycleDetail['history'][number]): string {
  return formatEventDetail(event)
}
