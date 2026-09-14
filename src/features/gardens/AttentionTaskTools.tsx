import { useRef, useState, type FormEvent } from 'react'
import { CalendarClock, Check, CircleOff, Plus } from 'lucide-react'
import type { AttentionItem, AttentionPurpose } from '../../domain/types'
import { attentionPurposeLabel, cycleAttentionPurposes, gardenAttentionPurposes } from '../../domain/attention-purpose'
import { completeAttentionItem, createAttentionItem, deferAttentionItem, dismissAttentionItem } from '../../lib/garden-api'

function isVisualReview(task: AttentionItem): boolean { return task.purpose === 'evaluate_visual_review' }
function isDevelopmentReview(task: AttentionItem): boolean { return task.purpose.startsWith('evaluate_') && !isVisualReview(task) }

export function AttentionTaskForm({ gardenId, growCycleId, onCreated, compact = false, initialPurpose, initialOpen = false, embedded = false, onCancel, onBusyChange }: {
  gardenId: string
  growCycleId?: string | null
  onCreated: (result: { created: boolean; purpose: AttentionPurpose; dueOn: string | null }) => Promise<void> | void
  compact?: boolean
  initialPurpose?: AttentionPurpose
  initialOpen?: boolean
  embedded?: boolean
  onCancel?: () => void
  onBusyChange?: (busy: boolean) => void
}) {
  const choices = growCycleId ? cycleAttentionPurposes : gardenAttentionPurposes
  const [open, setOpen] = useState(initialOpen)
  const [purpose, setPurpose] = useState<AttentionPurpose>(initialPurpose ?? choices[0].value)
  const [dueOn, setDueOn] = useState('')
  const [distinct, setDistinct] = useState(false)
  const [subjectKey, setSubjectKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const saving = useRef(false)
  const request = useRef({ key: '', id: '' })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving.current) return
    if (!navigator.onLine) { setMessage('Crear atención requiere conexión. No se guardó ningún cambio.'); return }
    saving.current = true
    setBusy(true); onBusyChange?.(true); setMessage(null)
    try {
      const input = { gardenId, growCycleId: growCycleId ?? null, purpose, subjectKey: distinct ? subjectKey.trim() || 'general' : 'general', dueOn: dueOn || null }
      const key = JSON.stringify(input)
      if (request.current.key !== key) request.current = { key, id: crypto.randomUUID() }
      const result = await createAttentionItem({ requestId: request.current.id, ...input })
      setMessage(result.created ? 'Atención creada.' : 'Ya había una atención abierta con este mismo propósito y asunto.')
      await onCreated({ created: result.created, purpose, dueOn: dueOn || null })
      request.current = { key: '', id: '' }
      if (result.created) { setDueOn(''); setSubjectKey(''); setDistinct(false); setOpen(false) }
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'No se pudo crear la atención.') } finally { saving.current = false; setBusy(false); onBusyChange?.(false) }
  }

  if (!open) return <button className={compact ? 'secondary-button secondary-button--compact' : 'secondary-button'} type="button" onClick={() => setOpen(true)}><Plus size={17} aria-hidden="true" /> Añadir seguimiento</button>
  return <form className={`editor-card attention-editor${embedded ? ' bs-embedded-form' : ''}`} aria-busy={busy} onSubmit={(event) => void submit(event)}>
    {!embedded && <div className="section-heading"><h2>Nuevo seguimiento</h2><button className="text-button" type="button" disabled={busy} onClick={() => { setOpen(false); setMessage(null); onCancel?.() }}>Cancelar</button></div>}
    <label>Qué requiere seguimiento<select value={purpose} onChange={(event) => setPurpose(event.target.value as AttentionPurpose)}>{choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>
    <label><span className="bs-field-label">Fecha prevista <span className="field-optional">opcional</span></span><input type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} /></label>
    <label className="choice"><input type="checkbox" checked={distinct} onChange={(event) => setDistinct(event.target.checked)} />Crear por separado</label>
    {distinct && <label>Asunto que lo diferencia<input required value={subjectKey} maxLength={160} onChange={(event) => setSubjectKey(event.target.value)} placeholder="Por ejemplo: hojas externas" /></label>}
    {message && <p className={message === 'Atención creada.' ? 'inline-message' : 'inline-message inline-message--error'} role="status">{message}</p>}
    <div className={embedded ? 'bs-sheet-footer' : 'button-row'}>{embedded && <button className="secondary-button" type="button" disabled={busy} onClick={onCancel}>Cancelar</button>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Guardando…' : embedded ? 'Crear seguimiento' : 'Crear atención'}</button></div>
  </form>
}

export function AttentionTaskEditor({ task, onChanged, onBusyChange }: { task: AttentionItem; onChanged: () => Promise<void> | void; onBusyChange?: (busy: boolean) => void }) {
  const [action, setAction] = useState<'complete' | 'defer' | 'dismiss' | null>(null)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [result, setResult] = useState(isVisualReview(task) ? 'reassuring' : 'ready')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const saving = useRef(false)
  const request = useRef({ key: '', id: '' })
  const reset = () => { setAction(null); setMessage(null); setNote(''); setDate('') }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving.current || !action) return
    if (!navigator.onLine) { setMessage('Esta acción requiere conexión. No se guardó ningún cambio.'); return }
    saving.current = true
    setBusy(true); onBusyChange?.(true); setMessage(null)
    try {
      const key = JSON.stringify([task.id, action, date, note, result])
      if (request.current.key !== key) request.current = { key, id: crypto.randomUUID() }
      const requestId = request.current.id
      if (action === 'defer') await deferAttentionItem({ requestId, taskId: task.id, nextReviewOn: date, reason: note || undefined })
      if (action === 'dismiss') await dismissAttentionItem({ requestId, taskId: task.id, reason: note })
      if (action === 'complete') await completeAttentionItem({ requestId, taskId: task.id, note: note || undefined, reviewResult: task.purpose.startsWith('evaluate_') ? result : null })
      await onChanged()
      request.current = { key: '', id: '' }
      reset()
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'No se pudo actualizar la atención.') } finally { saving.current = false; setBusy(false); onBusyChange?.(false) }
  }

  if (action === null) return <div className="attention-item__actions">
    <button className="primary-button primary-button--compact" type="button" onClick={() => setAction('complete')}><Check size={16} aria-hidden="true" />{isVisualReview(task) ? 'Guardar revisión' : isDevelopmentReview(task) ? 'Guardar evaluación' : 'Registrar y completar'}</button>
    <button className="secondary-button secondary-button--compact" type="button" onClick={() => setAction('defer')}><CalendarClock size={16} aria-hidden="true" />Posponer</button>
    <button className="text-button" type="button" onClick={() => setAction('dismiss')}><CircleOff size={16} aria-hidden="true" />No hace falta</button>
  </div>

  const title = action === 'complete' ? (isVisualReview(task) ? 'Guardar mi observación visual' : isDevelopmentReview(task) ? 'Guardar evaluación' : `Registrar y completar: ${attentionPurposeLabel(task.purpose)}`) : action === 'defer' ? 'Posponer atención' : 'Descartar atención'
  return <form className="attention-resolution" aria-busy={busy} onSubmit={(event) => void submit(event)}>
    <div className="section-heading"><h3>{title}</h3><button className="text-button" type="button" disabled={busy} onClick={reset}>Cancelar</button></div>
    {action === 'defer' && <><label>Volver a destacar el<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Nota <span className="field-optional">opcional</span><input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></label></>}
    {action === 'dismiss' && <label>Por qué no hace falta<textarea required value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} /></label>}
    {action === 'complete' && <>
      {isVisualReview(task) && <fieldset><legend>Lo que observo personalmente</legend><label className="choice"><input type="radio" checked={result === 'reassuring'} onChange={() => setResult('reassuring')} />Se ve bien</label><label className="choice"><input type="radio" checked={result === 'watch'} onChange={() => setResult('watch')} />Vigilar</label><label className="choice"><input type="radio" checked={result === 'action_required'} onChange={() => setResult('action_required')} />Requiere acción</label><label className="choice"><input type="radio" checked={result === 'insufficient_evidence'} onChange={() => setResult('insufficient_evidence')} />Evidencia insuficiente</label></fieldset>}
      {isDevelopmentReview(task) && <fieldset><legend>Resultado de la evaluación</legend><label className="choice"><input type="radio" checked={result === 'ready'} onChange={() => setResult('ready')} />Listo</label><label className="choice"><input type="radio" checked={result === 'not_yet'} onChange={() => setResult('not_yet')} />Todavía no</label><label className="choice"><input type="radio" checked={result === 'not_required'} onChange={() => setResult('not_required')} />No requerido</label><label className="choice"><input type="radio" checked={result === 'undetermined'} onChange={() => setResult('undetermined')} />No determinado</label></fieldset>}
      <label>Nota <span className="field-optional">opcional</span><textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} /></label>
    </>}
    {message && <p className="inline-message inline-message--error" role="alert">{message}</p>}
    <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Confirmando…' : action === 'dismiss' ? 'Descartar atención' : action === 'defer' ? 'Posponer atención' : isVisualReview(task) ? 'Guardar mi observación visual' : 'Confirmar y completar'}</button>
  </form>
}
