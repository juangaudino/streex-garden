import { useRef, useState } from 'react'
import { ArrowRight, Camera, Check, ChevronRight, Clipboard, ImagePlus, Scissors, Sprout, CalendarDays } from 'lucide-react'
import { Button, Dialog, Notice } from './ui'
import { makeRecord, type DemoRecord, type RecordKind } from './model'

export function RecordSheet({ initialKind, plantName, position, onClose, onSave, failSave = false }: { initialKind?: RecordKind; plantName: string; position: number; onClose: () => void; onSave: (record: DemoRecord) => void; failSave?: boolean }) {
  const [kind, setKind] = useState<RecordKind | null>(initialKind ?? null)
  const [choice, setChoice] = useState(initialKind === 'followup' ? 'Soporte' : 'Soporte añadido')
  const [note, setNote] = useState('')
  const dateInput = useRef<HTMLInputElement>(null)
  const [attachment, setAttachment] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(false)
  const valid = kind === 'observation' ? note.trim().length > 0 || attachment !== null : confirmed
  const select = (value: RecordKind) => { setKind(value); setChoice(value === 'followup' ? 'Soporte' : 'Soporte añadido'); setConfirmed(false); setFailed(false) }
  const title = kind === 'observation' ? 'Una nueva observación' : kind === 'action' ? 'Registrar una acción' : kind === 'followup' ? 'Dejarlo planificado' : '¿Qué quieres registrar?'
  const save = () => {
    if (!valid || !kind) return
    if (failSave && !retry) { setFailed(true); setRetry(true); return }
    const dueOn = dateInput.current?.value
    onSave({ ...makeRecord(kind, choice, note || (attachment ? `Fotografía: ${attachment}` : '')), ...(kind === 'followup' && dueOn ? { dueOn } : {}) })
  }
  return <Dialog title={title} eyebrow={`GARDEN 1 · POSICIÓN ${position} · ${plantName}`} onClose={onClose}>
    {!kind ? <div className="record-choices">
      <button onClick={() => select('observation')}><span className="choice-icon"><ImagePlus /></span><span><strong>Una observación</strong><small>Una foto, una nota, una nueva mirada.</small></span><ChevronRight size={18} /></button>
      <button onClick={() => select('action')}><span className="choice-icon"><Scissors /></span><span><strong>Algo que hice</strong><small>Soporte, poda, raleo o cosecha.</small></span><ChevronRight size={18} /></button>
      <button onClick={() => select('followup')}><span className="choice-icon"><CalendarDays /></span><span><strong>Algo para revisar después</strong><small>Un seguimiento con o sin fecha.</small></span><ChevronRight size={18} /></button>
      <div className="register-footnote"><Clipboard size={16} /><span>Otros registros, como germinación o conteo, se integrarán en esta misma entrada.</span></div>
    </div> : <form onSubmit={e => { e.preventDefault(); save() }}>
      <div className="form-body">
        {!initialKind && <button className="text-button" type="button" onClick={() => setKind(null)}>← Cambiar tipo de registro</button>}
        {kind !== 'observation' && <label className="field"><span>{kind === 'action' ? 'Qué hice' : 'Qué quiero revisar'}</span><select value={choice} onChange={e => { setChoice(e.target.value); setConfirmed(false) }}>{(kind === 'action' ? ['Soporte añadido', 'Soporte ajustado', 'Poda', 'Raleo', 'Cosecha'] : ['Soporte', 'Poda', 'Raleo', 'Preparación para cosecha', 'Estado general']).map(value => <option key={value}>{value}</option>)}</select></label>}
        {kind === 'followup' && <label className="field"><span>Cuándo <small>Opcional</small></span><input ref={dateInput} type="date" /></label>}
        <label className="field"><span>{kind === 'observation' ? 'Qué observas' : 'Añadir una nota'}<small>{kind === 'observation' ? 'O añade una fotografía' : 'Opcional'}</small></span><textarea autoFocus placeholder={kind === 'observation' ? 'Hoy noto…' : 'Algo que quieras recordar…'} value={note} onChange={e => setNote(e.target.value)} rows={4} /></label>
        {kind === 'observation' && <label className="attachment-button"><input type="file" accept="image/*" onChange={e => setAttachment(e.target.files?.[0]?.name ?? null)} /><Camera size={20} /><span>{attachment || 'Añadir fotografía'}</span><ImagePlus size={18} /></label>}
        {kind !== 'observation' && <label className="confirmation"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>{kind === 'action' ? 'Confirmo que realicé esta acción.' : 'Quiero crear este seguimiento.'}</span></label>}
        {failed && <Notice error>No se pudo guardar. Tu información sigue aquí; puedes reintentar.</Notice>}
        <p className="demo-hint"><Sprout size={14} /> Prueba interactiva: este registro sólo vive en la maqueta.</p>
      </div>
      <div className="sheet-footer"><Button secondary onClick={onClose}>Cancelar</Button><Button type="submit" disabled={!valid}>{failed ? 'Reintentar' : kind === 'followup' ? 'Crear seguimiento' : 'Guardar'}{kind === 'followup' ? <ArrowRight size={17} /> : <Check size={17} />}</Button></div>
    </form>}
  </Dialog>
}
