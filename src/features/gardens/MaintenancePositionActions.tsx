import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { CalendarClock, Check, Hammer, RefreshCw, Sparkles } from 'lucide-react'
import type { AttentionPurpose, GrowCycleDetail, MaintenancePosition, ObservationDraft } from '../../domain/types'
import { photoContentType } from '../../domain/photo-integrity'
import { getObservationDrafts, saveObservationDraft } from '../../lib/offline-observation-store'
import { getCycle } from '../../lib/garden-api'
import { syncObservationDraft } from '../../lib/observation-sync'
import { ObservationComposer } from '../cycles/ObservationComposer'
import { CycleFactRecorder, type FactChoice } from '../cycles/CycleFactRecorder'
import { CycleActions } from '../cycles/CycleActions'
import { AttentionTaskForm } from './AttentionTaskTools'
import { AiCheckPanel } from '../cycles/AiCheckPanel'
import { buildCanonicalActions, type GardenAiCanonicalAction, type GardenAiCheckProposalV1 } from '../../domain/ai'

type InspectionSource = 'observation' | 'fact' | 'manual' | 'structural'

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
  const [action, setAction] = useState<'now' | 'attention' | 'ai_check' | null>(null)
  const [factChoice, setFactChoice] = useState<FactChoice | undefined>()
  const [attentionPurpose, setAttentionPurpose] = useState<AttentionPurpose | undefined>()
  const [drafts, setDrafts] = useState<ObservationDraft[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [draftAiProposal, setDraftAiProposal] = useState<GardenAiCheckProposalV1 | null>(null)
  const [canContinue, setCanContinue] = useState(false)
  const [continuing, setContinuing] = useState(false)
  const actionPanelRef = useRef<HTMLDivElement>(null)

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
        } else if (result.result === 'needs_review') {
          setSyncMessage(`Revisar conflicto: ${result.error}`)
        } else {
          setSyncMessage(`Pendiente de subir: ${result.error}`)
        }
      }
      if (synced > 0 && synced === pending.length) setSyncMessage('Observación guardada. Elige cómo continuar con esta posición.')
      if (synced > 0) setCanContinue(true)
      if (synced > 0) setCycle(await getCycle(cycleId!))
      await loadDrafts()
    } catch (reason) {
      setSyncMessage(reason instanceof Error ? reason.message : 'No se pudo actualizar la inspección.')
    } finally {
      setSyncing(false)
    }
  }, [cycleId, drafts, loadDrafts, syncing])

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

  useEffect(() => {
    if (!action) return
    const frame = window.requestAnimationFrame(() => {
      const node = actionPanelRef.current
      if (node && typeof node.scrollIntoView === 'function') node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [action])

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
        setSyncMessage('Original recuperado. Elige cómo continuar con esta posición.')
        setCanContinue(true)
        setCycle(await getCycle(cycleId!))
      } else {
        setSyncMessage(`${result.result === 'needs_review' ? 'Revisar conflicto' : 'Pendiente de subir'}: ${result.error}`)
      }
      await loadDrafts()
    } catch (reason) {
      setSyncMessage(`Pendiente de subir: ${reason instanceof Error ? reason.message : 'No se pudo restaurar el original.'}`)
    }
  }

  const finishAsOkay = async () => {
    setCanContinue(false)
    try {
      await onInspectionRecorded('manual')
    } catch (reason) {
      setSyncMessage(reason instanceof Error ? reason.message : 'No se pudo marcar la posición como inspeccionada.')
    }
  }

  const refreshAfterObservation = async () => {
    try {
      setCycle(await getCycle(cycleId!))
      setCanContinue(true)
      setSyncMessage('Observación guardada. Elige cómo continuar con esta posición.')
    } catch (reason) {
      setSyncMessage(`La observación quedó guardada, pero no se pudo actualizar la vista: ${reason instanceof Error ? reason.message : 'vuelve a intentarlo.'}`)
    }
  }

  const recordFactAndContinue = async () => {
    // Saving an action is separate from completing the maintenance visit. Keep
    // the current position visible so the user can review any remaining work
    // and explicitly choose Está bien, Omitir, or another action.
    try {
      setCycle(await getCycle(cycleId!))
      setAction(null)
      setCanContinue(true)
      setSyncMessage('Acción guardada. Esta posición sigue abierta para continuar revisándola.')
    } catch (reason) { setSyncMessage(reason instanceof Error ? reason.message : 'La acción se guardó, pero no se pudo actualizar la vista.') }
  }

  const finishAfterStructuralChange = async () => {
    try {
      await onInspectionRecorded('structural')
    } catch (reason) {
      setSyncMessage(reason instanceof Error ? reason.message : 'El cambio se guardó, pero no se pudo avanzar el recorrido.')
    }
  }

  const recordPlanAndContinue = async () => {
    setAttentionPurpose(undefined)
    try {
      setCycle(await getCycle(cycleId!))
      setAction(null)
      setCanContinue(true)
      setSyncMessage('Seguimiento guardado. Esta posición sigue abierta para continuar revisándola.')
    } catch (reason) { setSyncMessage(reason instanceof Error ? reason.message : 'El plan se guardó, pero no se pudo actualizar la vista.') }
  }

  const continueInspection = async () => {
    setCanContinue(false)
    setContinuing(true)
    try {
      await onInspectionRecorded('manual')
    } catch (reason) {
      setSyncMessage(reason instanceof Error ? reason.message : 'No se pudo continuar con la siguiente posición.')
    } finally {
      setContinuing(false)
    }
  }

  const handleAiAction = (nextAction: GardenAiCanonicalAction) => {
    if (nextAction.kind === 'create_follow_up') {
      const label = nextAction.label.toLowerCase()
      setAttentionPurpose(label.includes('poda') ? 'evaluate_pruning' : label.includes('soporte') ? 'evaluate_support' : 'evaluate_thinning')
      setAction('attention')
      return
    }
    setFactChoice(nextAction.kind === 'record_incident' ? 'incident' : nextAction.kind === 'confirm_plant_count' ? 'count' : 'readiness')
    setAction('now')
  }

  if (!cycleId) return null
  if (!cycle) return <p className={cycleError ? 'inline-message inline-message--error' : 'quiet-copy'}>{cycleError ?? 'Consultando acciones del ciclo…'}</p>

  const retryableDrafts = drafts.filter((draft) => draft.status !== 'needs_review')
  const hasStoredPhoto = cycle.history.some((event) => event.photo?.upload_status === 'uploaded' && event.photo)
  const draftActions = draftAiProposal ? buildCanonicalActions(draftAiProposal, { growCycleId: cycle.id, gardenId: cycle.garden.id, positionId: cycle.position.id, evidenceRef: { kind: 'photo', id: 'pending_observation' } }) : []
  return <section className="maintenance-actions" aria-label={`Recorrido de ${position.garden_name} posición ${position.position_number}`}>
    <section className="maintenance-observation" aria-labelledby="maintenance-observation-title">
      <div className="section-heading"><div><h2 id="maintenance-observation-title">Observación actual</h2><p className="quiet-copy">Describe lo que estás viendo ahora. La foto es opcional.</p></div></div>
      <ObservationComposer compact growCycleId={cycle.id} onSaved={async () => { await refreshAfterObservation(); await loadDrafts(); setDraftAiProposal(null) }} onDraftQueued={async () => { await loadDrafts(); setSyncMessage('Observación guardada en este dispositivo. Se sincronizará antes de continuar.') }} onDraftAiProposal={setDraftAiProposal} />
      {draftAiProposal && <div className="ai-check-result maintenance-draft-ai-result" aria-live="polite"><p className="ai-check-result__context">Análisis temporal · la foto todavía no se guardó</p><h3>{draftAiProposal.summary}</h3>{draftAiProposal.observations.slice(0, 3).map((observation) => <p key={observation}>{observation}</p>)}{draftAiProposal.uncertainty.length > 0 && <p className="quiet-copy">{draftAiProposal.uncertainty[0]}</p>}{draftActions.slice(0, 1).map((nextAction) => <button className="secondary-button secondary-button--compact" key={nextAction.kind} type="button" onClick={() => handleAiAction(nextAction)}><Sparkles size={15} aria-hidden="true" />{nextAction.label}</button>)}<button className="text-button" type="button" onClick={() => setDraftAiProposal(null)}>Cerrar análisis</button></div>}
      {hasStoredPhoto && <div className="maintenance-photo-ai"><span>Hay una fotografía guardada en este ciclo.</span><button className="secondary-button secondary-button--compact" type="button" disabled={disabled} onClick={() => setAction(action === 'ai_check' ? null : 'ai_check')}><Sparkles size={16} aria-hidden="true" /> Analizar con Garden AI</button></div>}
    </section>
    <section className="maintenance-decision" aria-labelledby="maintenance-decision-title"><div className="section-heading"><div><h2 id="maintenance-decision-title">¿Qué sigue?</h2><p className="quiet-copy">Termina esta posición, actúa ahora o déjalo planificado.</p></div></div><div className="maintenance-decision__buttons"><button className="primary-button" type="button" disabled={disabled} onClick={() => void finishAsOkay()}><Check size={17} aria-hidden="true" /> Está bien</button><button className="secondary-button" type="button" disabled={disabled} onClick={() => { setCanContinue(false); setFactChoice('intervention'); setAction(action === 'now' ? null : 'now') }}><Hammer size={17} aria-hidden="true" /> Hacer algo ahora</button><button className="secondary-button" type="button" disabled={disabled} onClick={() => { setCanContinue(false); setAttentionPurpose(undefined); setAction(action === 'attention' ? null : 'attention') }}><CalendarClock size={17} aria-hidden="true" /> Planificar algo</button></div></section>
    {action === 'now' && <div className="maintenance-action-panel" ref={actionPanelRef}><CycleActions cycle={cycle} maintenanceMode onChanged={recordFactAndContinue} onMaintenanceStructuralChange={finishAfterStructuralChange} onReplaced={() => undefined} onOpenFact={() => { setFactChoice(undefined); setAction('now') }} onOpenObservation={() => document.getElementById('maintenance-observation-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} /><CycleFactRecorder cycle={cycle} initialChoice={factChoice} initialOpen heading="Hacer algo ahora" description="Confirma la acción que estás realizando en esta posición." submitLabel="Guardar acción" onSaved={recordFactAndContinue} /></div>}
    {action === 'attention' && <div className="maintenance-action-panel" ref={actionPanelRef}><AttentionTaskForm gardenId={cycle.garden.id} growCycleId={cycle.id} initialPurpose={attentionPurpose} initialOpen onCreated={recordPlanAndContinue} compact /></div>}
    {action === 'ai_check' && <div ref={actionPanelRef}><AiCheckPanel cycle={cycle} onCanonicalAction={handleAiAction} onContinue={() => setAction(null)} title="Analizar una foto guardada" /></div>}
    {canContinue && <div className="maintenance-continue" role="status"><p>La acción quedó guardada. Puedes continuar con la siguiente posición cuando quieras.</p><button className="primary-button" type="button" disabled={disabled || continuing} onClick={() => void continueInspection()}><Check size={17} aria-hidden="true" />{continuing ? 'Continuando…' : 'Continuar'}</button></div>}
    {(drafts.length > 0 || syncMessage) && <div className="maintenance-sync" aria-live="polite">{drafts.length > 0 && <strong>{syncing ? 'Sincronizando observación pendiente' : `Pendiente de subir: ${retryableDrafts.length} observación${retryableDrafts.length === 1 ? '' : 'es'}.`}</strong>}{drafts.some((draft) => draft.status === 'needs_review') && <span>Hay una observación que requiere revisión manual por cambio de ciclo.</span>}{syncMessage && <span>{syncMessage}</span>}{retryableDrafts.some((draft) => draft.photo && draft.photoMetadata) && <label className="file-button secondary-button--compact">Volver a elegir original<input type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" onChange={(event) => void restoreDraftOriginal(retryableDrafts.find((draft) => draft.photo && draft.photoMetadata)!, event)} /></label>}{retryableDrafts.length > 0 && <button className="secondary-button secondary-button--compact" type="button" disabled={syncing || !navigator.onLine} onClick={() => void syncDrafts()}><RefreshCw size={15} aria-hidden="true" />{syncing ? 'Sincronizando…' : 'Reintentar ahora'}</button>}</div>}
  </section>
}
