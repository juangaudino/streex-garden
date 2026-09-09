import { useMemo, useState, type FormEvent } from 'react'
import { ClipboardPenLine, Sprout } from 'lucide-react'
import type { CycleFactType, GrowCycleDetail, HarvestReadiness } from '../../domain/types'
import { recordCycleFact } from '../../lib/garden-api'

const today = () => new Date().toISOString().slice(0, 10)

type FactChoice = 'germination' | 'count' | 'state' | 'development' | 'readiness' | 'intervention' | 'incident' | 'resolve_incident'

const choiceLabels: Record<FactChoice, string> = {
  germination: 'Germinación confirmada',
  count: 'Cantidad de plantas',
  state: 'Estado observado',
  development: 'Evaluación de desarrollo',
  readiness: 'Preparación para cosecha',
  intervention: 'Intervención realizada',
  incident: 'Incidencia',
  resolve_incident: 'Resolver incidencia',
}

export function CycleFactRecorder({ cycle, onSaved }: { cycle: GrowCycleDetail; onSaved: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<FactChoice>('germination')
  const [occurredOn, setOccurredOn] = useState(today())
  const [note, setNote] = useState('')
  const [count, setCount] = useState('')
  const [countKind, setCountKind] = useState<'seedlings_visible' | 'plants_kept'>('seedlings_visible')
  const [visualResult, setVisualResult] = useState('reassuring')
  const [developmentPurpose, setDevelopmentPurpose] = useState('evaluate_thinning')
  const [developmentResult, setDevelopmentResult] = useState('ready')
  const [readiness, setReadiness] = useState<HarvestReadiness>('not_yet')
  const [interventionClass, setInterventionClass] = useState('thinning')
  const [supportOperation, setSupportOperation] = useState<'installed' | 'adjusted' | 'removed'>('installed')
  const [severity, setSeverity] = useState('watch')
  const [incidentId, setIncidentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const incidents = useMemo(() => {
    const resolved = new Set(cycle.history.filter((event) => event.event_type === 'incident_resolved').map((event) => String(event.event_data?.incident_event_id ?? '')))
    return cycle.history.filter((event) => event.event_type === 'incident_opened' && !resolved.has(event.id))
  }, [cycle.history])

  const reset = () => {
    setOpen(false); setMessage(null); setNote(''); setCount(''); setOccurredOn(today()); setIncidentId('')
  }
  const fact = (): { type: CycleFactType; data: Record<string, unknown> } => {
    if (choice === 'germination') return { type: 'germination_observed', data: count ? { count: Number(count) } : {} }
    if (choice === 'count') return { type: 'plant_count_observed', data: { count: Number(count), count_kind: countKind } }
    if (choice === 'state') return { type: 'visual_review', data: { result: visualResult } }
    if (choice === 'development') return { type: 'development_review', data: { purpose: developmentPurpose, result: developmentResult } }
    if (choice === 'readiness') return { type: 'readiness_review', data: { readiness } }
    if (choice === 'intervention') return { type: 'intervention', data: { class: interventionClass, ...(interventionClass === 'support' ? { operation: supportOperation } : {}) } }
    if (choice === 'incident') return { type: 'incident_opened', data: { severity } }
    return { type: 'incident_resolved', data: { incident_event_id: incidentId } }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!navigator.onLine) { setMessage('Este registro estructurado requiere conexión. No se guardó ningún cambio.'); return }
    if ((choice === 'count' && !count) || (choice === 'resolve_incident' && !incidentId)) { setMessage('Completa el dato requerido antes de guardar.'); return }
    setBusy(true); setMessage(null)
    try {
      const next = fact()
      await recordCycleFact({ requestId: crypto.randomUUID(), growCycleId: cycle.id, factType: next.type, occurredOn, note, factData: next.data })
      await onSaved()
      reset()
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'No se pudo registrar este hecho.') }
    finally { setBusy(false) }
  }

  if (!open) return <section className="cycle-fact-entry"><button className="secondary-button secondary-button--compact" type="button" onClick={() => setOpen(true)}><ClipboardPenLine size={17} aria-hidden="true" /> Registrar estado o acción</button><p className="quiet-copy">Germinación, conteos, evaluaciones e intervenciones confirmadas. Las recomendaciones no se registran aquí.</p></section>

  return <form className="editor-card action-editor" onSubmit={(event) => void submit(event)}>
    <div className="section-heading"><h2><Sprout size={19} aria-hidden="true" /> Registrar estado o acción</h2><button className="text-button" type="button" onClick={reset}>Cancelar</button></div>
    <p className="quiet-copy">Guardarás evidencia fechada del ciclo. Esto no crea una tarea salvo una revisión que requiera seguimiento.</p>
    <label>Qué confirmé<select value={choice} onChange={(event) => { setChoice(event.target.value as FactChoice); setMessage(null) }}>{(Object.keys(choiceLabels) as FactChoice[]).filter((value) => value !== 'resolve_incident' || incidents.length > 0).map((value) => <option value={value} key={value}>{choiceLabels[value]}</option>)}</select></label>
    <label>Fecha del hecho<input type="date" required value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} /></label>
    {choice === 'germination' && <label>Plántulas germinadas <span className="field-optional">opcional</span><input min="0" step="1" inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value)} placeholder="Cantidad observada" /></label>}
    {choice === 'count' && <><label>Cantidad observada<input required min="0" step="1" inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value)} /></label><label>Representa<select value={countKind} onChange={(event) => setCountKind(event.target.value as typeof countKind)}><option value="seedlings_visible">Plántulas visibles</option><option value="plants_kept">Plantas conservadas</option></select></label></>}
    {choice === 'state' && <fieldset><legend>Estado que observé personalmente</legend><label className="choice"><input type="radio" checked={visualResult === 'reassuring'} onChange={() => setVisualResult('reassuring')} />Desarrollo estable</label><label className="choice"><input type="radio" checked={visualResult === 'watch'} onChange={() => setVisualResult('watch')} />Vigilar</label><label className="choice"><input type="radio" checked={visualResult === 'action_required'} onChange={() => setVisualResult('action_required')} />Requiere acción</label><label className="choice"><input type="radio" checked={visualResult === 'insufficient_evidence'} onChange={() => setVisualResult('insufficient_evidence')} />Evidencia insuficiente</label></fieldset>}
    {choice === 'development' && <fieldset><legend>Evaluación</legend><label>Qué evalué<select value={developmentPurpose} onChange={(event) => setDevelopmentPurpose(event.target.value)}><option value="evaluate_thinning">Aclareo</option><option value="evaluate_pruning">Poda</option><option value="evaluate_support">Soporte</option></select></label><label>Resultado<select value={developmentResult} onChange={(event) => setDevelopmentResult(event.target.value)}><option value="ready">Listo</option><option value="not_yet">Todavía no</option><option value="not_required">No requerido</option><option value="undetermined">No determinado</option></select></label></fieldset>}
    {choice === 'readiness' && <fieldset><legend>Preparación para cosecha</legend><label className="choice"><input type="radio" checked={readiness === 'not_yet'} onChange={() => setReadiness('not_yet')} />Todavía no</label><label className="choice"><input type="radio" checked={readiness === 'evaluate'} onChange={() => setReadiness('evaluate')} />Evaluar</label><label className="choice"><input type="radio" checked={readiness === 'ready'} onChange={() => setReadiness('ready')} />Lista</label><label className="choice"><input type="radio" checked={readiness === 'not_applicable'} onChange={() => setReadiness('not_applicable')} />No aplica</label></fieldset>}
    {choice === 'intervention' && <><label>Intervención realizada<select value={interventionClass} onChange={(event) => setInterventionClass(event.target.value)}><option value="thinning">Aclareo</option><option value="pruning">Poda</option><option value="support">Soporte</option><option value="other">Otra</option></select></label>{interventionClass === 'support' && <label>Operación del soporte<select value={supportOperation} onChange={(event) => setSupportOperation(event.target.value as typeof supportOperation)}><option value="installed">Soporte instalado</option><option value="adjusted">Soporte ajustado</option><option value="removed">Soporte retirado</option></select></label>}</>}
    {choice === 'incident' && <fieldset><legend>Impacto confirmado</legend><label className="choice"><input type="radio" checked={severity === 'watch'} onChange={() => setSeverity('watch')} />Vigilar</label><label className="choice"><input type="radio" checked={severity === 'action_required'} onChange={() => setSeverity('action_required')} />Requiere acción</label></fieldset>}
    {choice === 'resolve_incident' && <label>Incidencia resuelta<select required value={incidentId} onChange={(event) => setIncidentId(event.target.value)}><option value="">Selecciona una incidencia</option>{incidents.map((incident) => <option key={incident.id} value={incident.id}>{incident.note ?? 'Incidencia registrada'}</option>)}</select></label>}
    <label>Nota {choice === 'incident' || (choice === 'state' && visualResult === 'action_required') || (choice === 'intervention' && interventionClass === 'other') ? 'requerida' : 'opcional'}<textarea required={choice === 'incident' || (choice === 'state' && visualResult === 'action_required') || (choice === 'intervention' && interventionClass === 'other')} value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder={choice === 'count' ? 'Por ejemplo: se distinguen dos plántulas.' : choice === 'incident' ? 'Describe brevemente qué ocurrió.' : choice === 'readiness' ? 'Por ejemplo: hojas con buen tamaño para evaluar cosecha.' : choice === 'intervention' && interventionClass === 'support' ? 'Por ejemplo: ajusté el soporte al tallo.' : choice === 'intervention' ? 'Por ejemplo: retiré la plántula más pequeña.' : 'Describe lo que observaste.'} /></label>
    {message && <p className="inline-message inline-message--error" role="alert">{message}</p>}
    <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar registro'}</button>
  </form>
}
