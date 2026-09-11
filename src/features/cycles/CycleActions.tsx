import { useEffect, useState, type FormEvent } from 'react'
import { Archive, ArrowRightLeft, Calendar, ClipboardPenLine, ImagePlus, RotateCcw, Sprout, Wheat } from 'lucide-react'
import type { CycleHistoryEvent, GrowCycleDetail, GardenDetail } from '../../domain/types'
import { closeCycle, correctCyclePlanting, getGarden, invalidateEvent, moveCycle, recordHarvest, reopenCycle, replaceCycle } from '../../lib/garden-api'

const today = () => new Date().toISOString().slice(0, 10)
type Action = 'harvest' | 'close' | 'replace' | 'move' | 'correct' | 'reopen' | 'invalidate' | null

export function CycleActions({ cycle, onChanged, onReplaced, onMaintenanceStructuralChange, selectedEvent, onOpenFact, onOpenObservation, maintenanceMode = false }: {
  cycle: GrowCycleDetail
  onChanged: () => Promise<void>
  onReplaced: (cycleId: string) => void
  onMaintenanceStructuralChange?: (action: 'close' | 'move' | 'replace') => Promise<void>
  selectedEvent?: CycleHistoryEvent | null
  onOpenFact?: () => void
  onOpenObservation?: () => void
  maintenanceMode?: boolean
}) {
  const [action, setAction] = useState<Action>(selectedEvent ? 'invalidate' : null)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(cycle.planted_on ?? '')
  const [precision, setPrecision] = useState<'exact' | 'approximate' | 'unknown'>(cycle.planted_on_precision)
  const [cropName, setCropName] = useState('')
  const [targetPositionId, setTargetPositionId] = useState('')
  const [garden, setGarden] = useState<GardenDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (action !== 'move' || garden) return
    void getGarden(cycle.garden.id).then(setGarden).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudieron cargar las posiciones.'))
  }, [action, cycle.garden.id, garden])

  const reset = () => { setAction(null); setMessage(null); setNote(''); setReason(''); setCropName(''); setTargetPositionId('') }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!navigator.onLine) { setMessage('Esta acción estructural requiere conexión. No se guardó ningún cambio.'); return }
    if ((action === 'correct' || action === 'replace') && ((precision === 'unknown' && date) || (precision !== 'unknown' && !date))) { setMessage('La precisión y fecha de siembra no coinciden.'); return }
    setBusy(true); setMessage(null)
    try {
      const requestId = crypto.randomUUID()
      if (action === 'harvest') await recordHarvest({ requestId, growCycleId: cycle.id, expectedRevision: cycle.revision, note })
      if (action === 'close') await closeCycle({ requestId, growCycleId: cycle.id, expectedRevision: cycle.revision, endedOn: date || today(), reason, note })
      if (action === 'replace') {
        const result = await replaceCycle({ requestId, growCycleId: cycle.id, expectedRevision: cycle.revision, cropName, plantedOn: precision === 'unknown' ? null : date, plantedOnPrecision: precision })
        if (onMaintenanceStructuralChange) await onMaintenanceStructuralChange('replace')
        else onReplaced(result.grow_cycle_id)
        return
      }
      if (action === 'move') await moveCycle({ requestId, growCycleId: cycle.id, expectedRevision: cycle.revision, targetPositionId, movedOn: date || today() })
      if (action === 'correct') await correctCyclePlanting({ requestId, growCycleId: cycle.id, expectedRevision: cycle.revision, plantedOn: precision === 'unknown' ? null : date, plantedOnPrecision: precision, reason })
      if (action === 'reopen') await reopenCycle({ requestId, growCycleId: cycle.id, expectedRevision: cycle.revision, reason })
      if (action === 'invalidate' && selectedEvent) await invalidateEvent({ requestId, eventId: selectedEvent.id, expectedRevision: selectedEvent.revision, reason })
      if (onMaintenanceStructuralChange && (action === 'close' || action === 'move')) await onMaintenanceStructuralChange(action)
      else await onChanged()
      reset()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo confirmar el cambio.') } finally { setBusy(false) }
  }

  if (action === null) return <section className={`quick-actions${maintenanceMode ? ' quick-actions--maintenance' : ''}`} aria-labelledby="actions-title"><div className="section-heading"><h2 id="actions-title">{maintenanceMode ? 'Acciones disponibles' : 'Acciones'}</h2></div>
    {cycle.state === 'active' ? <div className="quick-actions__grid">
      <button type="button" onClick={() => setAction('harvest')}><Wheat size={18} />Cosechar</button>
      <button type="button" onClick={() => { setDate(cycle.planted_on ?? ''); setPrecision(cycle.planted_on_precision); setAction('correct') }}><Calendar size={18} />Corregir siembra</button>
      <button type="button" onClick={() => { setDate(today()); setAction('move') }}><ArrowRightLeft size={18} />Trasladar</button>
      <button type="button" onClick={() => { setDate(today()); setReason('productive_end'); setAction('close') }}><Archive size={18} />Cerrar ciclo</button>
      <button className="quick-actions__replace" type="button" onClick={() => { setDate(today()); setPrecision('exact'); setAction('replace') }}><Sprout size={18} />Reemplazar / resembrar</button><button type="button" onClick={onOpenFact}><ClipboardPenLine size={18} />Registrar estado o acción</button><button type="button" onClick={onOpenObservation}><ImagePlus size={18} />Añadir observación</button>
    </div> : <div className="closed-actions"><p>Este ciclo está cerrado. Su historial permanece disponible.</p><button className="secondary-button" type="button" onClick={() => setAction('reopen')}><RotateCcw size={17} />Solicitar reapertura</button></div>}
  </section>

  const title: Record<Exclude<Action, null>, string> = { harvest: 'Registrar cosecha', close: 'Cerrar ciclo', replace: 'Reemplazar ciclo', move: 'Trasladar ciclo', correct: 'Corregir fecha de siembra', reopen: 'Reabrir ciclo', invalidate: 'Invalidar registro' }
  return <form className="editor-card action-editor" onSubmit={(event) => void submit(event)}><div className="section-heading"><h2>{title[action]}</h2><button className="text-button" type="button" onClick={reset}>Cancelar</button></div>
    {(action === 'harvest') && <><p>Registrarás una cosecha realizada hoy en {cycle.crop_name}. La cantidad es opcional y se añadirá en una etapa posterior.</p><label>Nota opcional<textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="Por ejemplo: cosecha ligera" /></label></>}
    {(action === 'close') && <><p>Finalizarás la ocupación de esta posición. El historial y las fotos se conservarán.</p><label>Fecha de cierre<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Motivo<select value={reason} onChange={(event) => setReason(event.target.value)}><option value="productive_end">Fin productivo</option><option value="failure">Fallo</option><option value="removal">Retirada</option><option value="other">Otro</option></select></label><label>Nota {reason === 'other' ? 'requerida' : 'opcional'}<textarea required={reason === 'other'} value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></label></>}
    {(action === 'replace') && <><p>Cerrarás {cycle.crop_name} e iniciarás un ciclo nuevo en la misma posición. Las fotos anteriores permanecerán en este ciclo.</p><label>Nuevo cultivo<input required value={cropName} maxLength={100} onChange={(event) => setCropName(event.target.value)} /></label><DatePrecision precision={precision} setPrecision={setPrecision} date={date} setDate={setDate} /></>}
    {(action === 'move') && <><p>Puedes trasladar el ciclo a otra posición de {cycle.garden.name}. Si la posición ya está ocupada, se intercambiarán ambos ciclos y quedará un hecho de traslado en cada historial.</p><label>Nueva posición<select required value={targetPositionId} onChange={(event) => setTargetPositionId(event.target.value)}><option value="">Selecciona una posición</option>{garden?.positions.filter((position) => position.id !== cycle.position.id).map((position) => <option key={position.id} value={position.id}>Posición {position.position_number}{position.current_cycle ? ` · Ocupada · ${position.current_cycle.crop_name}` : ' · Vacía'}</option>)}</select></label><label>Fecha del traslado<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label></>}
    {(action === 'correct') && <><p>La corrección conserva la fecha anterior y el motivo en el historial.</p><DatePrecision precision={precision} setPrecision={setPrecision} date={date} setDate={setDate} /><label>Motivo de la corrección<textarea required value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label></>}
    {(action === 'reopen') && <><p>Solo se reabrirá si la última posición sigue vacía. No eliminará ningún ciclo sucesor.</p><label>Motivo<textarea required value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label></>}
    {(action === 'invalidate' && selectedEvent) && <><p>Este registro dejará de contar como hecho vigente. No se borrará su auditoría.</p><label>Motivo de la invalidación<textarea required value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label></>}
    {message && <p className="inline-message inline-message--error" role="alert">{message}</p>}<button className="primary-button" disabled={busy} type="submit">{busy ? 'Confirmando…' : action === 'invalidate' ? 'Invalidar registro' : 'Confirmar cambio'}</button>
  </form>
}

function DatePrecision({ precision, setPrecision, date, setDate }: { precision: 'exact' | 'approximate' | 'unknown'; setPrecision: (value: 'exact' | 'approximate' | 'unknown') => void; date: string; setDate: (value: string) => void }) {
  return <fieldset><legend>Fecha de siembra</legend><label className="choice"><input type="radio" checked={precision === 'exact'} onChange={() => setPrecision('exact')} />Exacta</label><label className="choice"><input type="radio" checked={precision === 'approximate'} onChange={() => setPrecision('approximate')} />Aproximada</label><label className="choice"><input type="radio" checked={precision === 'unknown'} onChange={() => { setPrecision('unknown'); setDate('') }} />Desconocida</label>{precision !== 'unknown' && <label>Fecha<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label>}</fieldset>
}
