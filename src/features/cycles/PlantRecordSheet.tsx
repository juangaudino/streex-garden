import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, ChevronRight, ClipboardPenLine, ImagePlus, Scissors } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AttentionItem, GrowCycleDetail } from '../../domain/types'
import { eventDetail, eventLabel } from '../../domain/event-presentation'
import { harvestReadinessLabel } from '../../domain/invariants'
import { buildCanonicalActions, type GardenAiCanonicalAction, type GardenAiCheckProposalV1 } from '../../domain/ai'
import { getAttention } from '../../lib/garden-api'
import { BotanicalButton, BotanicalSheet } from '../../components/botanical/BotanicalControls'
import { AttentionTaskEditor, AttentionTaskForm } from '../gardens/AttentionTaskTools'
import { ObservationComposer } from './ObservationComposer'
import { CycleFactRecorder } from './CycleFactRecorder'
import { CycleActions } from './CycleActions'
import { AiCheckPanel } from './AiCheckPanel'
import { DocumentaryPhoto } from './DocumentaryPhoto'
import { PhotoEvidence } from './PhotoEvidence'
import { PhotoCoverActions } from './PhotoCoverActions'
import { canInvalidatePlantEvent } from './plant-presentation'
import { captureLabel, recordLabel } from './photo-presentation'
import { plantAiIntent, type PlantSheetIntent } from './plant-intents'

export function PlantRecordSheet({ cycle, initial, onClose, onSaved, onDraftQueued, onReplaced, onCoverChanged, onMessage, onBusyChange }: {
  cycle: GrowCycleDetail; initial: PlantSheetIntent; onClose: () => void;
  onSaved: (message: string) => Promise<void>; onDraftQueued: () => Promise<void>;
  onReplaced: (id: string) => void; onCoverChanged: () => Promise<void>; onMessage: (message: string) => void;
  onBusyChange: (busy: boolean) => void
}) {
  const [intent, setIntent] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [returnToObservation, setReturnToObservation] = useState(false)
  const [draftProposal, setDraftProposal] = useState<GardenAiCheckProposalV1 | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; onBusyChange(false) } }, [onBusyChange])
  const setWorking = (working: boolean) => { if (alive.current) { setBusy(working); onBusyChange(working) } }
  const close = () => {
    if (returnToObservation) { setIntent({ kind: 'observation' }); setReturnToObservation(false) }
    else onClose()
  }
  const applyAiAction = (action: GardenAiCanonicalAction) => {
    if (cycle.state !== 'active') return
    const next = plantAiIntent(action, cycle)
    if (!next) return
    if (intent.kind === 'observation') setReturnToObservation(true)
    setIntent(next)
  }
  const title = intent.kind === 'event' ? eventLabel(intent.event) : intent.kind === 'invalidate' ? 'Invalidar registro' : intent.kind === 'fact' ? 'Registrar estado o acción' : intent.kind === 'attention' ? 'Dejarlo planificado' : intent.kind === 'observation' ? 'Una nueva observación' : intent.kind === 'operations' ? 'Operaciones de la planta' : intent.kind === 'review' ? 'Preparación para cosecha' : intent.kind === 'options' ? 'Tu planta y su historia' : intent.kind === 'ai' ? 'Una segunda mirada' : intent.kind === 'task' ? intent.task.title : '¿Qué quieres registrar?'
  const context = `${cycle.garden.name} · Posición ${cycle.position.position_number} · ${cycle.crop_name}`
  const canRecord = cycle.state === 'active'
  const draftActions = draftProposal ? buildCanonicalActions(draftProposal, { growCycleId: cycle.id, gardenId: cycle.garden.id, positionId: cycle.position.id, evidenceRef: { kind: 'photo', id: 'draft' } }) : []
  const options = [
    { kind: 'observation' as const, title: 'Una observación', description: 'Una foto, una nota, una nueva mirada.', Icon: ImagePlus },
    { kind: 'fact' as const, title: 'Registrar estado o acción', description: 'Germinación, conteo, evaluación, intervención o incidencia.', Icon: ClipboardPenLine },
    { kind: 'operations' as const, title: 'Algo que hice', description: 'Cosechar, trasladar o gestionar el ciclo.', Icon: Scissors },
    { kind: 'attention' as const, title: 'Algo para revisar después', description: 'Un seguimiento con o sin fecha.', Icon: CalendarDays },
  ]
  const refreshed = async (message: string) => { await onSaved(message) }
  return <BotanicalSheet title={title} context={context} busy={busy} className="plant-sheet" onClose={close}>
    {intent.kind === 'choose' && <div className="bs-sheet-body record-choices">{canRecord ? options.map(({ kind, title: label, description, Icon }) => <button key={kind} type="button" onClick={() => setIntent({ kind })}><span className="choice-icon"><Icon size={22} /></span><span><strong>{label}</strong><small>{description}</small></span><ChevronRight size={18} /></button>) : <p>Este ciclo está cerrado. Su historia sigue disponible.</p>}</div>}
    {(intent.kind === 'observation' || returnToObservation) && canRecord && <div hidden={intent.kind !== 'observation'}><ObservationComposer compact embedded growCycleId={cycle.id} onCancel={close} onBusyChange={setWorking} onSaved={async () => { await refreshed('Observación guardada en tu cuenta.'); onClose() }} onDraftQueued={onDraftQueued} onPhotoChange={() => setDraftProposal(null)} onDraftAiProposal={proposal => { if (alive.current) setDraftProposal(proposal) }}>
      {draftProposal && <div className="bs-ai-result" aria-live="polite"><h3>{draftProposal.summary}</h3>{draftProposal.observations.slice(0, 3).map(observation => <p key={observation}>{observation}</p>)}{draftProposal.uncertainty.slice(0, 3).map(uncertainty => <p key={uncertainty}>{uncertainty}</p>)}<p>La foto aún no se ha guardado.</p>{draftActions.slice(0, 1).map(action => <BotanicalButton key={action.kind} secondary onClick={() => applyAiAction(action)}>{action.label}</BotanicalButton>)}<button className="bs-text-button" type="button" onClick={() => setDraftProposal(null)}>Cerrar análisis</button></div>}
    </ObservationComposer></div>}
    {intent.kind === 'fact' && canRecord && <CycleFactRecorder key={`fact:${intent.choice ?? ''}`} cycle={cycle} initialOpen initialChoice={intent.choice} embedded onCancel={close} onBusyChange={setWorking} description="Guarda lo que confirmaste personalmente. Germinación, conteos, estado, intervenciones e incidencias forman parte de la historia del ciclo." onSaved={async label => refreshed(`${label ?? 'Registro'} guardado.`)} />}
    {intent.kind === 'attention' && canRecord && <AttentionTaskForm gardenId={cycle.garden.id} growCycleId={cycle.id} initialOpen initialPurpose={intent.purpose} compact embedded onCancel={close} onBusyChange={setWorking} onCreated={async result => { await refreshed(result.created ? 'Seguimiento creado.' : 'Ya existe un seguimiento abierto con este propósito y asunto.'); close() }} />}
    {(intent.kind === 'operations' || intent.kind === 'invalidate') && <CycleActions key={intent.kind === 'invalidate' ? intent.event.id : 'operations'} cycle={cycle} selectedEvent={intent.kind === 'invalidate' ? intent.event : null} embedded onCancel={close} onBusyChange={setWorking} onChanged={() => refreshed('Cambio confirmado en la historia de la planta.')} onReplaced={onReplaced} onOpenFact={() => setIntent({ kind: 'fact' })} onOpenCare={() => setIntent({ kind: 'fact', choice: 'intervention' })} onOpenObservation={() => setIntent({ kind: 'observation' })} />}
    {intent.kind === 'options' && <div className="bs-sheet-body plant-options"><Link className="bs-text-button" to={`/cycle/${cycle.id}/photos`} state={{ cycle }}>Historia fotográfica y comparación<ArrowRight size={16} /></Link><Link className="bs-text-button" to={`/cycle/${cycle.id}/share`}>Compartir su historia<ArrowRight size={16} /></Link><Link className="bs-text-button" to={`/cycle/${cycle.id}/film`}>Growth Film<ArrowRight size={16} /></Link><BotanicalButton secondary onClick={() => setIntent({ kind: 'operations' })}>Operaciones de la planta</BotanicalButton><BotanicalButton secondary onClick={() => void refreshed('Vista actualizada.')}>Actualizar la vista</BotanicalButton>{canRecord && <BotanicalButton secondary onClick={() => setIntent({ kind: 'choose' })}>Registrar un momento</BotanicalButton>}<BotanicalButton secondary onClick={() => setIntent({ kind: 'review' })}>Consultar seguimientos</BotanicalButton></div>}
    {intent.kind === 'review' && <div className="bs-sheet-body"><p className="bs-sheet-copy">Preparación registrada: <strong>{harvestReadinessLabel[cycle.harvest_readiness]}</strong>. Abrir este detalle no cambia la evaluación.</p>{canRecord && <div className="plant-review-actions"><BotanicalButton secondary onClick={() => setIntent({ kind: 'fact', choice: 'readiness' })}>Guardar mi evaluación</BotanicalButton><BotanicalButton secondary onClick={() => setIntent({ kind: 'attention', purpose: 'evaluate_visual_review' })}>Planificar revisión</BotanicalButton></div>}<PlantFollowUps cycleId={cycle.id} onSelect={task => setIntent({ kind: 'task', task })} /></div>}
    {intent.kind === 'task' && <div className="bs-sheet-body"><AttentionTaskEditor key={intent.task.id} task={intent.task} onBusyChange={setWorking} onChanged={async () => { await refreshed('Seguimiento actualizado.'); setIntent({ kind: 'review' }) }} /></div>}
    {intent.kind === 'ai' && <div className="bs-sheet-body"><AiCheckPanel cycle={cycle} onCanonicalAction={canRecord ? applyAiAction : () => undefined} title="Analizar una foto guardada" /><button className="bs-text-button" type="button" onClick={close}>Cerrar análisis</button></div>}
    {intent.kind === 'event' && <div className="bs-sheet-body record-detail"><span className="record-badge">{eventLabel(intent.event)}</span><p>{intent.event.note ?? 'Sin nota adicional.'}</p>{eventDetail(intent.event) && <p>{eventDetail(intent.event)}</p>}<time dateTime={intent.event.occurred_at}>{recordLabel(intent.event)}</time>{intent.event.photo && <>{intent.event.photo.upload_status === 'uploaded' ? <><DocumentaryPhoto photo={intent.event.photo} eager rendition="original" /><PhotoCoverActions gardenId={cycle.garden.id} cycleId={cycle.id} photoId={intent.event.photo.id} onMessage={onMessage} onChanged={onCoverChanged} /></> : <PhotoEvidence photo={intent.event.photo} onRecovered={() => refreshed('Original recuperado.')} />}<p>{captureLabel(intent.event.photo)}</p></>}<dl><div><dt>Origen</dt><dd>{intent.event.event_type === 'photo_evidence' ? 'Evidencia fotográfica histórica' : 'Registro confirmado del ciclo'}</dd></div><div><dt>Referencia del registro</dt><dd>{intent.event.id}</dd></div><div><dt>Revisión</dt><dd>{intent.event.revision}</dd></div>{intent.event.photo && <div><dt>Archivo original</dt><dd>{intent.event.photo.original_filename}</dd></div>}</dl>{intent.event.event_data && <details><summary>Datos y procedencia del registro</summary><pre>{JSON.stringify(intent.event.event_data, null, 2)}</pre></details>}{canInvalidatePlantEvent(intent.event) && <button className="bs-text-button" type="button" onClick={() => setIntent({ kind: 'invalidate', event: intent.event })}>Invalidar registro</button>}</div>}
    {returnToObservation && <p className="bs-sheet-copy">La foto y la nota siguen en tu observación. Volverás a ellas al cerrar este formulario.</p>}
  </BotanicalSheet>
}

function PlantFollowUps({ cycleId, onSelect }: { cycleId: string; onSelect: (task: AttentionItem) => void }) {
  const [items, setItems] = useState<AttentionItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void getAttention().then(result => { if (active) setItems(result.filter(task => task.grow_cycle_id === cycleId)) }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los seguimientos.') })
    return () => { active = false }
  }, [cycleId, attempt])
  return <section className="plant-follow-ups"><h3>Lo que dejaste para revisar</h3>{error ? <><p role="alert">No se pudieron cargar los seguimientos. {error}</p><BotanicalButton secondary onClick={() => { setError(null); setAttempt(value => value + 1) }}>Reintentar</BotanicalButton></> : items === null ? <p role="status">Consultando seguimientos…</p> : items.length === 0 ? <p>Esta planta no tiene seguimientos abiertos.</p> : items.map(task => <button className="bs-text-button" key={task.id} type="button" onClick={() => onSelect(task)}><span>{task.title}<small>{task.next_review_on ?? task.due_on ?? 'Sin fecha prevista'}</small></span><ChevronRight size={17} /></button>)}</section>
}
