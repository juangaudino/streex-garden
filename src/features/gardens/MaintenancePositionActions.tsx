import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { Camera, ClipboardPenLine, Plus, RefreshCw } from 'lucide-react'
import type { GrowCycleDetail, MaintenancePosition, ObservationDraft } from '../../domain/types'
import { photoContentType } from '../../domain/photo-integrity'
import { getObservationDrafts, saveObservationDraft } from '../../lib/offline-observation-store'
import { getCycle } from '../../lib/garden-api'
import { syncObservationDraft } from '../../lib/observation-sync'
import { ObservationComposer } from '../cycles/ObservationComposer'
import { CycleFactRecorder } from '../cycles/CycleFactRecorder'
import { AttentionTaskForm } from './AttentionTaskTools'

type InspectionSource = 'observation' | 'fact' | 'manual'

export function MaintenancePositionActions({
  position,
  disabled = false,
  onInspectionRecorded,
}: {
  position: MaintenancePosition
  disabled?: boolean
  onInspectionRecorded: (source: InspectionSource) => Promise<void>
}) {
  const [cycle, setCycle] = useState<GrowCycleDetail | null>(null)
  const [cycleError, setCycleError] = useState<string | null>(null)
  const [action, setAction] = useState<'observation' | 'fact' | 'attention' | null>(null)
  const [drafts, setDrafts] = useState<ObservationDraft[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const cycleId = position.current_grow_cycle_id === position.captured_grow_cycle_id
    ? position.captured_grow_cycle_id
    : null

  const loadDrafts = useCallback(async () => {
    if (!cycleId || !('indexedDB' in window)) return
    const all = await getObservationDrafts()
    setDrafts(all.filter((draft) => draft.growCycleId === cycleId && draft.status !== 'synced'))
  }, [cycleId])

  useEffect(() => {
    if (!cycleId) return
    let active = true
    void getCycle(cycleId).then((value) => { if (active) setCycle(value) }).catch((reason: unknown) => {
      if (active) setCycleError(reason instanceof Error ? reason.message : 'No se pudo abrir el ciclo.')
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- IndexedDB writes after the async read settles.
    void loadDrafts()
    return () => { active = false }
  }, [cycleId, loadDrafts])

  const syncDrafts = useCallback(async () => {
    const pending = drafts.filter((draft) => draft.status !== 'needs_review')
    if (syncing || pending.length === 0 || !navigator.onLine) return
    setSyncing(true)
    setSyncMessage('Sincronizando observación y fotografía…')
    try {
      let synced = 0
      for (const draft of pending) {
        const result = await syncObservationDraft(draft)
        if (result.result === 'synced') {
          synced += 1
          await onInspectionRecorded('observation')
        } else if (result.result === 'needs_review') {
          setSyncMessage(`Revisar conflicto: ${result.error}`)
        } else {
          setSyncMessage(`Pendiente de subir: ${result.error}`)
        }
      }
      if (synced > 0 && synced === pending.length) setSyncMessage('Observación guardada y posición inspeccionada.')
      await loadDrafts()
    } catch (reason) {
      setSyncMessage(reason instanceof Error ? reason.message : 'No se pudo actualizar la inspección.')
    } finally {
      setSyncing(false)
    }
  }, [drafts, loadDrafts, onInspectionRecorded, syncing])

  useEffect(() => {
    const retry = () => { void syncDrafts() }
    const visible = () => { if (document.visibilityState === 'visible') void syncDrafts() }
    window.addEventListener('online', retry)
    window.addEventListener('pageshow', retry)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('online', retry)
      window.removeEventListener('pageshow', retry)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [syncDrafts])

  const restoreDraftOriginal = async (draft: ObservationDraft, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !draft.photoMetadata) return
    if (photoContentType(file) !== draft.photoMetadata.contentType || file.size !== draft.photoMetadata.byteSize) {
      setSyncMessage('El archivo no coincide con el tipo o tamaño del original pendiente.')
      return
    }
    const repaired: ObservationDraft = { ...draft, photo: new Blob([file], { type: draft.photoMetadata.contentType }), status: 'queued', lastError: undefined }
    try {
      await saveObservationDraft(repaired)
      setSyncMessage('Original restaurado en este dispositivo. Sincronizando…')
      const result = await syncObservationDraft(repaired)
      if (result.result === 'synced') {
        await onInspectionRecorded('observation')
        setSyncMessage('Original recuperado y posición inspeccionada.')
      } else {
        setSyncMessage(`${result.result === 'needs_review' ? 'Revisar conflicto' : 'Pendiente de subir'}: ${result.error}`)
      }
      await loadDrafts()
    } catch (reason) {
      setSyncMessage(`Pendiente de subir: ${reason instanceof Error ? reason.message : 'No se pudo restaurar el original.'}`)
    }
  }

  const markManually = async () => {
    try {
      await onInspectionRecorded('manual')
    } catch (reason) {
      setSyncMessage(reason instanceof Error ? reason.message : 'No se pudo marcar la posición como inspeccionada.')
    }
  }

  const recordAndContinue = async (source: 'observation' | 'fact') => {
    try {
      await onInspectionRecorded(source)
    } catch (reason) {
      setSyncMessage(`La evidencia quedó guardada en el ciclo, pero no se actualizó el recorrido: ${reason instanceof Error ? reason.message : 'reintenta marcar la posición.'}`)
    }
  }

  if (!cycleId) return null
  if (!cycle) return <p className={cycleError ? 'inline-message inline-message--error' : 'quiet-copy'}>{cycleError ?? 'Consultando acciones del ciclo…'}</p>

  const retryableDrafts = drafts.filter((draft) => draft.status !== 'needs_review')
  return <section className="maintenance-actions" aria-label={`Acciones para ${position.garden_name} posición ${position.position_number}`}>
    <div className="maintenance-actions__buttons">
      <button className="secondary-button secondary-button--compact" type="button" disabled={disabled} onClick={() => setAction(action === 'observation' ? null : 'observation')}><Camera size={16} aria-hidden="true" /> Foto / observación</button>
      <button className="secondary-button secondary-button--compact" type="button" disabled={disabled} onClick={() => setAction(action === 'fact' ? null : 'fact')}><ClipboardPenLine size={16} aria-hidden="true" /> Registrar estado o acción</button>
      <button className="secondary-button secondary-button--compact" type="button" disabled={disabled} onClick={() => setAction(action === 'attention' ? null : 'attention')}><Plus size={16} aria-hidden="true" /> Seguimiento</button>
    </div>
    {action === 'observation' && <ObservationComposer growCycleId={cycle.id} onSaved={async () => { await recordAndContinue('observation'); await loadDrafts() }} onDraftQueued={async () => { await loadDrafts(); setSyncMessage('Pendiente de subir: se guardó en este dispositivo. Esta posición seguirá pendiente hasta confirmarse.') }} />}
    {action === 'fact' && <CycleFactRecorder cycle={cycle} onSaved={async () => { await recordAndContinue('fact') }} />}
    {action === 'attention' && <div className="maintenance-action-panel"><p className="quiet-copy">Crear una atención no declara por sí sola que la planta haya sido inspeccionada.</p><AttentionTaskForm gardenId={cycle.garden.id} growCycleId={cycle.id} onCreated={() => setSyncMessage('Seguimiento guardado. Marca la posición como inspeccionada cuando hayas terminado de observarla.')} compact /></div>}
    {drafts.length > 0 && <div className="maintenance-sync" aria-live="polite"><strong>{syncing ? 'Sincronizando observación pendiente' : `Pendiente de subir: ${retryableDrafts.length} observación${retryableDrafts.length === 1 ? '' : 'es'}.`}</strong>{drafts.some((draft) => draft.status === 'needs_review') && <span>Hay una observación que requiere revisión manual por cambio de ciclo.</span>}{syncMessage && <span>{syncMessage}</span>}{retryableDrafts.some((draft) => draft.photo && draft.photoMetadata) && <label className="file-button secondary-button--compact">Volver a elegir original<input type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" onChange={(event) => void restoreDraftOriginal(retryableDrafts.find((draft) => draft.photo && draft.photoMetadata)!, event)} /></label>}{retryableDrafts.length > 0 && <button className="secondary-button secondary-button--compact" type="button" disabled={syncing || !navigator.onLine} onClick={() => void syncDrafts()}><RefreshCw size={15} aria-hidden="true" />{syncing ? 'Sincronizando…' : 'Reintentar ahora'}</button>}</div>}
    <button className="text-button maintenance-actions__manual" type="button" disabled={disabled} onClick={() => void markManually()}>Marcar inspeccionada sin declarar salud</button>
  </section>
}
