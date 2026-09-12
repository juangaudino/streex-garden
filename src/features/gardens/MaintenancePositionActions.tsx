import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowRight, CalendarDays, Camera, Check, ChevronRight, CircleCheck, Leaf, RefreshCw, Scissors, SkipForward, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BotanicalButton, BotanicalSheet } from '../../components/botanical/BotanicalControls'
import { MaintenancePortrait } from './MaintenancePortrait'
import type { AttentionPurpose, GrowCycleDetail, MaintenancePosition, ObservationDraft } from '../../domain/types'
import { attentionPurposeLabel } from '../../domain/attention-purpose'
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

export type InspectionSource = 'observation' | 'fact' | 'manual' | 'structural'

// This stores navigation affordance only; it never creates or implies a plant fact.
function savedSource(key: string): InspectionSource | null {
  try {
    const value = sessionStorage.getItem(key)
    return value === 'observation' || value === 'fact' || value === 'manual' || value === 'structural' ? value : null
  } catch { return null }
}

export function MaintenancePositionActions({
  position,
  disabled = false,
  onInspectionRecorded,
  onSkip,
  onConfirmHealthy,
}: {
  position: MaintenancePosition
  disabled?: boolean
  onInspectionRecorded: (source: InspectionSource) => Promise<void>
  onSkip: () => Promise<void>
  onConfirmHealthy: () => Promise<void>
}) {
  const progressKey = `garden:maintenance-ui:${position.id}:${position.captured_grow_cycle_id}`
  const [initialSource] = useState(() => savedSource(progressKey))
  const [returnToObservation, setReturnToObservation] = useState(false)
  const [records, setRecords] = useState<Array<{ label: string; detail?: string }>>([])
  const [cycle, setCycle] = useState<GrowCycleDetail | null>(null)
  const [cycleError, setCycleError] = useState<string | null>(null)
  const [action, setAction] = useState<'choose' | 'observation' | 'now' | 'fact' | 'healthy' | 'attention' | 'ai_check' | null>(null)
  const [factChoice, setFactChoice] = useState<FactChoice | undefined>()
  const [attentionPurpose, setAttentionPurpose] = useState<AttentionPurpose | undefined>()
  const [drafts, setDrafts] = useState<ObservationDraft[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [draftAiProposal, setDraftAiProposal] = useState<GardenAiCheckProposalV1 | null>(null)
  const [canContinue, setCanContinue] = useState(Boolean(initialSource))
  const [continuing, setContinuing] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [continuationKind, setContinuationKind] = useState<'action' | 'follow_up' | 'observation'>(initialSource === 'observation' ? 'observation' : initialSource === 'manual' ? 'follow_up' : 'action')
  const [formBusy, setFormBusy] = useState(false)
  const [structuralChange, setStructuralChange] = useState(initialSource === 'structural')
  const rememberSave = useCallback((source: InspectionSource) => {
    try { sessionStorage.setItem(progressKey, source) } catch { /* Navigation remains available without storage. */ }
  }, [progressKey])
  const navigationLock = useRef(false)
  const syncLock = useRef(false)

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
    if (syncLock.current || pending.length === 0 || !navigator.onLine || disabled || formBusy) return
    syncLock.current = true
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
      await loadDrafts()
      if (synced > 0) { setCanContinue(true); setContinuationKind('observation'); rememberSave('observation') }
      if (synced > 0 && synced === pending.length) setSyncMessage(null)
      if (synced > 0) setCycle(await getCycle(cycleId!))
    } catch (reason) {
      setSyncMessage(reason instanceof Error ? reason.message : 'No se pudo actualizar la inspección.')
    } finally {
      syncLock.current = false
      setSyncing(false)
    }
  }, [cycleId, disabled, drafts, formBusy, loadDrafts, rememberSave])

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
    if (!file || !draft.photoMetadata || syncLock.current || disabled || formBusy) return
    if (photoContentType(file) !== draft.photoMetadata.contentType || file.size !== draft.photoMetadata.byteSize) {
      setSyncMessage('El archivo no coincide con el tipo o tamaño del original pendiente.')
      return
    }
    syncLock.current = true; setSyncing(true)
    const repaired: ObservationDraft = { ...draft, photo: new Blob([file], { type: draft.photoMetadata.contentType }), status: 'queued', lastError: undefined }
    try {
      await saveObservationDraft(repaired)
      setSyncMessage('Original restaurado en este dispositivo. Sincronizando…')
      const result = await syncObservationDraft(repaired)
      if (result.result === 'synced') {
        setSyncMessage(null)
        setCanContinue(true); setContinuationKind('observation'); rememberSave('observation')
        await loadDrafts()
        setCycle(await getCycle(cycleId!))
      } else {
        setSyncMessage(`${result.result === 'needs_review' ? 'Revisar conflicto' : 'Pendiente de subir'}: ${result.error}`)
      }
      await loadDrafts()
    } catch (reason) {
      setSyncMessage(`Pendiente de subir: ${reason instanceof Error ? reason.message : 'No se pudo restaurar el original.'}`)
    } finally { syncLock.current = false; setSyncing(false) }
  }

  const finishAsOkay = async () => {
    if (navigationLock.current) return
    navigationLock.current = true
    setContinuing(true)
    try {
      await onConfirmHealthy()
      try { sessionStorage.removeItem(progressKey) } catch { /* Optional UI state. */ }
      setAction(null)
    } catch (reason) {
      setSyncMessage(reason instanceof Error ? reason.message : 'No se pudo guardar la revisión.')
    } finally { navigationLock.current = false; setContinuing(false) }
  }

  const refreshCycle = async () => {
    try { setCycle(await getCycle(cycleId!)) }
    catch { setSyncMessage('El registro quedó guardado. No se pudo actualizar la vista; abre el historial para comprobarlo.') }
  }
  const afterSaved = (kind: 'observation' | 'action' | 'follow_up', label: string, detail?: string) => {
    setCanContinue(true); setContinuationKind(kind); setSyncMessage(null)
    setRecords(previous => [...previous, { label, detail }])
    rememberSave(kind === 'observation' ? 'observation' : kind === 'action' ? 'fact' : 'manual')
    setAction(returnToObservation ? 'observation' : null)
    setReturnToObservation(false)
  }
  const refreshAfterObservation = async () => {
    afterSaved('observation', 'Observación guardada')
    await refreshCycle()
  }
  const recordFactAndContinue = async (label = 'Acción guardada') => {
    afterSaved('action', label)
    await refreshCycle()
  }
  const finishAfterStructuralChange = async (change: 'close' | 'move' | 'replace') => {
    afterSaved('action', { close: 'Ciclo cerrado', move: 'Traslado guardado', replace: 'Nuevo ciclo iniciado' }[change])
    setStructuralChange(true); rememberSave('structural')
    await refreshCycle()
  }
  const recordPlanAndContinue = async (result: { created: boolean; purpose: AttentionPurpose; dueOn: string | null }) => {
    // An existing task is displayed by the form. It is not a newly saved record.
    if (!result.created) return
    setAttentionPurpose(undefined)
    const date = result.dueOn ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long' }).format(new Date(result.dueOn + 'T12:00:00')) : 'Sin fecha prevista'
    afterSaved('follow_up', attentionPurposeLabel(result.purpose), date)
    await refreshCycle()
  }

  const continueInspection = async () => {
    if (navigationLock.current) return
    navigationLock.current = true
    setContinuing(true)
    try {
      await onInspectionRecorded(structuralChange || cycle?.state !== 'active' || cycle?.position.id !== position.position_id ? 'structural' : continuationKind === 'observation' ? 'observation' : continuationKind === 'action' ? 'fact' : 'manual')
      try { sessionStorage.removeItem(progressKey) } catch { /* Optional UI state. */ }
    } catch (reason) {
      setSyncMessage(reason instanceof Error ? reason.message : 'No se pudo continuar con la siguiente posición.')
    } finally {
      navigationLock.current = false
      setContinuing(false)
    }
  }

  const skipInspection = async () => {
    if (navigationLock.current) return
    navigationLock.current = true
    setSkipping(true)
    try { await onSkip(); try { sessionStorage.removeItem(progressKey) } catch { /* Optional UI state. */ } } catch (reason) { setSyncMessage(reason instanceof Error ? reason.message : 'No se pudo omitir esta posición.') }
    finally { navigationLock.current = false; setSkipping(false) }
  }

  const handleAiAction = (nextAction: GardenAiCanonicalAction) => {
    if (action === 'observation') setReturnToObservation(true)
    if (nextAction.kind === 'create_follow_up') {
      const label = nextAction.label.toLowerCase()
      setAttentionPurpose(label.includes('poda') ? 'evaluate_pruning' : label.includes('soporte') ? 'evaluate_support' : 'evaluate_thinning')
      setAction('attention')
      return
    }
    setFactChoice(nextAction.kind === 'record_incident' ? 'incident' : nextAction.kind === 'confirm_plant_count' ? 'count' : 'readiness')
    setAction('fact')
  }


  const closeAction = () => {
    if (formBusy || continuing) return
    if (returnToObservation) { setAction('observation'); setReturnToObservation(false); return }
    setAction(null); setDraftAiProposal(null)
  }
  if (!cycleId) return null
  if (!cycle) return <main className="bm-main bm-loading"><p role={cycleError ? 'alert' : 'status'}>{cycleError ?? 'Abriendo esta planta…'}</p>{cycleError && <BotanicalButton onClick={() => { setCycleError(null); void getCycle(cycleId).then(setCycle).catch(() => setCycleError('No se pudo abrir el ciclo.')) }}>Reintentar</BotanicalButton>}</main>

  const retryableDrafts = drafts.filter(draft => draft.status !== 'needs_review')
  const hasStoredPhoto = cycle.history.some(event => event.photo?.upload_status === 'uploaded')
  const draftActions = draftAiProposal ? buildCanonicalActions(draftAiProposal, { growCycleId: cycle.id, gardenId: cycle.garden.id, positionId: cycle.position.id, evidenceRef: { kind: 'photo', id: 'pending_observation' } }) : []
  const locked = disabled || formBusy || syncing || continuing || skipping
  const pending = drafts.length > 0
  const canRecord = !structuralChange && cycle.state === 'active' && cycle.position.id === position.position_id
  const context = `${position.garden_name} · Posición ${position.position_number} · ${position.crop_name}`
  const savedTitle = continuationKind === 'follow_up' ? 'Seguimiento guardado' : continuationKind === 'observation' ? 'Observación guardada' : 'Acción guardada'
  const titles = { choose: '¿Qué quieres registrar?', observation: 'Una nueva observación', now: 'Registrar algo que hice', fact: 'Registrar estado o acción', healthy: '¿Se ve bien?', attention: 'Dejarlo planificado', ai_check: 'Una segunda mirada' }
  const choices = <div className="bm-actions">
    <button disabled={locked || !canRecord} onClick={() => setAction('observation')}><span className="bm-action-icon"><Camera size={23} strokeWidth={1.6} /></span><span><strong>Añadir una observación</strong><small>Una fotografía o una nota.</small></span><ChevronRight size={18} /></button>
    <button disabled={locked || !canRecord} onClick={() => setAction('now')}><span className="bm-action-icon"><Scissors size={23} strokeWidth={1.6} /></span><span><strong>Registrar algo que hice</strong><small>Poda, soporte, raleo y otros cuidados.</small></span><ChevronRight size={18} /></button>
    <button disabled={locked || !canRecord} onClick={() => { setAttentionPurpose(undefined); setAction('attention') }}><span className="bm-action-icon"><CalendarDays size={23} strokeWidth={1.6} /></span><span><strong>Revisar más adelante</strong><small>Dejar un seguimiento para después.</small></span><ChevronRight size={18} /></button>
  </div>
  return <>
    <main className="bm-main">
      <MaintenancePortrait position={position} cycle={cycle} />
      <section className="bm-inspection" aria-label={`Revisión de ${context}`}>
        <div className="bm-intro"><span className="bs-eyebrow">TU REVISIÓN</span><h1>¿Cómo la ves hoy?</h1><p>Observa sus hojas, sus tallos y lo que ha cambiado.</p></div>
        {canContinue && <div className="bm-saved" role="status"><span><CircleCheck size={20} aria-hidden="true" /></span><div><strong>{savedTitle}</strong><small>{canRecord ? 'Puedes seguir con esta planta.' : 'El historial permanece en su ciclo.'}</small></div></div>}
        {!canRecord && <p className="bs-notice">La ocupación cambió. Continúa el recorrido; no se aplicará una revisión al nuevo ocupante.</p>}
        {canRecord && <>{choices}<button className="bm-ai" disabled={locked} onClick={() => setAction(hasStoredPhoto ? 'ai_check' : 'observation')}><Sparkles size={18} /><span>Pedir una segunda mirada a Garden AI</span><ArrowRight size={16} /></button></>}
        {canContinue && <details className="bm-log"><summary>Lo que registraste aquí</summary><ul>{records.map((record, index) => <li key={index}><strong>{record.label}</strong>{record.detail && <small>{record.detail}</small>}</li>)}</ul><Link className="bs-text-button" to={`/cycle/${cycle.id}`}>Ver historial de la planta <ArrowRight size={15} /></Link></details>}
        {pending && <div className="bs-notice" aria-live="polite"><div><strong>{syncing ? 'Sincronizando…' : `${drafts.length} observación${drafts.length === 1 ? '' : 'es'} pendiente${drafts.length === 1 ? '' : 's'}`}</strong><span>Conservada en este dispositivo. Sincronízala antes de avanzar.</span>{drafts.some(draft => draft.status === 'needs_review') && <span>Una observación requiere revisión por cambio de ciclo. Abre su historial para resolverla.</span>}{retryableDrafts.filter(draft => draft.photoMetadata).map(draft => <label className="file-button" key={draft.id}>Volver a elegir original<input type="file" disabled={locked} accept="image/jpeg,image/png,image/heic,image/heif,image/webp" onChange={event => void restoreDraftOriginal(draft, event)} /></label>)}<button className="bs-text-button" disabled={locked || !navigator.onLine} onClick={() => void syncDrafts()}><RefreshCw size={15} />Reintentar ahora</button><Link className="bs-text-button" to={`/cycle/${cycle.id}`}>Abrir historial</Link></div></div>}
        {syncMessage && action !== 'healthy' && <p className="bs-notice" role="status">{syncMessage}</p>}
      </section>
    </main>
    <footer className="bm-footer"><div className="bm-footer-copy"><Leaf size={18} /><span>{canContinue ? 'Esta planta sigue abierta para ti.' : 'Ve a tu ritmo. Cada planta cuenta.'}</span></div><div className="bm-navigation">
      {canContinue && canRecord ? <BotanicalButton secondary disabled={locked} onClick={() => setAction('choose')}>Registrar algo más</BotanicalButton> : <BotanicalButton secondary disabled={locked || pending} onClick={() => void skipInspection()}><SkipForward size={17} />Omitir</BotanicalButton>}
      <BotanicalButton disabled={locked || pending} onClick={() => canContinue || !canRecord ? void continueInspection() : setAction('healthy')}>{continuing ? 'Continuando…' : canContinue || !canRecord ? 'Siguiente planta' : 'Se ve bien'}{canContinue || !canRecord ? <ArrowRight size={18} /> : <Check size={18} />}</BotanicalButton>
    </div></footer>
    {action && <BotanicalSheet title={titles[action]} context={context} onClose={closeAction} busy={formBusy || continuing}>
      {action === 'choose' && <div className="bs-sheet-body">{choices}<button className="bs-text-button" disabled={pending} onClick={() => setAction('healthy')}><Check size={17} />Confirmar que se ve bien</button></div>}
      {action === 'healthy' && <><p className="bs-sheet-copy">Confirma tu observación visual de <strong>{position.crop_name}</strong>. Se guardará «Se ve bien» y avanzarás a la siguiente posición.</p>{syncMessage && <p className="bs-notice" role="alert">{syncMessage}</p>}<div className="bs-sheet-footer"><BotanicalButton secondary disabled={continuing} onClick={closeAction}>Volver</BotanicalButton><BotanicalButton disabled={locked || pending} onClick={() => void finishAsOkay()}>Confirmar y avanzar <Check size={17} /></BotanicalButton></div></>}
      {(action === 'observation' || returnToObservation) && <div hidden={action !== 'observation'}><ObservationComposer compact embedded growCycleId={cycle.id} onCancel={closeAction} onBusyChange={setFormBusy} onSaved={async () => { await refreshAfterObservation(); await loadDrafts(); setDraftAiProposal(null) }} onDraftQueued={async () => { await loadDrafts(); setSyncMessage('Observación guardada en este dispositivo. Se sincronizará antes de continuar.') }} onPhotoChange={() => setDraftAiProposal(null)} onDraftAiProposal={setDraftAiProposal}>{draftAiProposal && <div className="bs-ai-result" aria-live="polite"><h3>{draftAiProposal.summary}</h3>{draftAiProposal.observations.slice(0, 3).map(observation => <p key={observation}>{observation}</p>)}{draftAiProposal.uncertainty.length > 0 && <p>{draftAiProposal.uncertainty[0]}</p>}<p>La foto aún no se ha guardado.</p>{draftActions.slice(0, 1).map(nextAction => <BotanicalButton secondary key={nextAction.kind} onClick={() => handleAiAction(nextAction)}>{nextAction.label}</BotanicalButton>)}<button type="button" className="bs-text-button" onClick={() => setDraftAiProposal(null)}>Cerrar análisis</button></div>}</ObservationComposer></div>}
      {action === 'now' && <CycleActions cycle={cycle} maintenanceMode embedded onCancel={closeAction} onBusyChange={setFormBusy} onChanged={recordFactAndContinue} onMaintenanceStructuralChange={finishAfterStructuralChange} onReplaced={() => undefined} onOpenCare={() => { setFactChoice('intervention'); setAction('fact') }} onOpenFact={() => { setFactChoice(undefined); setAction('fact') }} onOpenObservation={() => setAction('observation')} />}
      {returnToObservation && <p className="bs-sheet-copy">La foto y la nota siguen en tu observación. Volverás a ellas al cerrar este formulario.</p>}
      {action === 'fact' && <CycleFactRecorder cycle={cycle} initialChoice={factChoice} initialOpen embedded onCancel={closeAction} onBusyChange={setFormBusy} heading="Registrar estado o acción" description="Guarda lo que observaste o hiciste en esta planta." onSaved={recordFactAndContinue} />}
      {action === 'attention' && <AttentionTaskForm gardenId={cycle.garden.id} growCycleId={cycle.id} initialPurpose={attentionPurpose} initialOpen embedded compact onCancel={closeAction} onBusyChange={setFormBusy} onCreated={recordPlanAndContinue} />}
      {action === 'ai_check' && <AiCheckPanel cycle={cycle} onCanonicalAction={handleAiAction} onContinue={closeAction} title="Analizar una foto guardada" />}
    </BotanicalSheet>}
  </>
}
