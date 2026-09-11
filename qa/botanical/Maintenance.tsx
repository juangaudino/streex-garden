import { useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Camera, Check, ChevronRight, CircleCheck, Leaf, Pause, Scissors, SkipForward, Sparkles } from 'lucide-react'
import { Button, Dialog, IconButton, Notice, Photo } from './ui'
import { RecordSheet } from './RecordSheet'
import { positions, type DemoRecord, type Moment, type RecordKind, type Scenario } from './model'

export function Maintenance({ moments, scenario, onExit }: { moments: Moment[]; scenario: Scenario; onExit: () => void }) {
  const [index, setIndex] = useState(0)
  const [saved, setSaved] = useState<Record<number, DemoRecord[]>>({})
  const [progress, setProgress] = useState<Record<number, 'visited' | 'skipped'>>({})
  const [kind, setKind] = useState<RecordKind | 'choose' | null>(null)
  const [dialog, setDialog] = useState<'pause' | 'okay' | 'ai' | null>(null)
  const [paused, setPaused] = useState(false)
  const [completed, setCompleted] = useState(false)
  const position = positions[index]
  const entries = saved[index] ?? []
  const touched = entries.length > 0
  const next = (status: 'visited' | 'skipped') => {
    setProgress(old => ({ ...old, [index]: status }))
    if (index < positions.length - 1) setIndex(index + 1)
    else setCompleted(true)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const record = (value: DemoRecord) => { setSaved(old => ({ ...old, [index]: [value, ...(old[index] ?? [])] })); setKind(null) }
  if (completed) return <main className="session-finished"><span className="completion-mark"><Check size={32} /></span><span className="eyebrow">GARDEN 1 · REVISIÓN DE DEMOSTRACIÓN</span><h1>Un momento de cuidado.<br /><em>Todo queda en su lugar.</em></h1><p>Terminaste el recorrido de estas tres posiciones.</p><div className="completion-stats"><div><strong>{Object.values(progress).filter(p => p === 'visited').length}</strong><span>revisadas</span></div><div><strong>{Object.values(progress).filter(p => p === 'skipped').length}</strong><span>omitidas</span></div><div><strong>{Object.values(saved).flat().length}</strong><span>registros de prueba</span></div></div><Button onClick={onExit}>Volver a la planta <ArrowRight size={17} /></Button><button className="text-button" onClick={() => { setCompleted(false); setIndex(0); setSaved({}); setProgress({}) }}>Repetir el recorrido</button></main>
  return <div className="maintenance-layout">
    <header className="session-context"><div className="session-context-top"><IconButton label="Pausar revisión" onClick={() => setDialog('pause')}><ArrowLeft size={21} /></IconButton><div><span className="eyebrow">GARDEN 1 · POSICIÓN {position.number}</span><strong>{position.name}</strong></div><span className="session-count">{index + 1}<span> / {positions.length}</span></span></div><div className="session-progress" aria-label={`Posición ${index + 1} de ${positions.length}`}>{positions.map((p, i) => <span className={i < index ? 'is-complete' : i === index ? 'is-current' : ''} key={p.number} />)}</div></header>
    {paused ? <div className="paused-session"><Pause size={32} /><h1>La revisión puede esperar.</h1><p>En esta sesión de prueba, tu posición y tus registros siguen aquí.</p><Button onClick={() => setPaused(false)}>Retomar revisión <ArrowRight size={18} /></Button><button className="text-button" onClick={onExit}>Salir del prototipo</button></div> : <>
    <main className="maintenance-main">
      <div className="maintenance-photo"><Photo src={moments[moments.length - 1].src} alt="Referencia visual para revisar el diseño del recorrido" scenario={scenario} /><div className="maintenance-photo-label"><Camera size={15} /><span>Fotografía de referencia</span></div><div className="maintenance-photo-copy"><span className="eyebrow">MIRAR TAMBIÉN ES CUIDAR</span><h2>Un momento<br /><em>para observar.</em></h2></div></div>
      <section className="inspection"><div className="inspection-intro"><span className="eyebrow">TU REVISIÓN</span><h1>¿Cómo la ves hoy?</h1><p>Observa sus hojas, sus tallos y lo que ha cambiado.</p></div>
        {touched && <div className="session-saved" role="status"><span><CircleCheck size={20} /></span><div><strong>{entries.length === 1 ? entries[0].title : `${entries.length} registros guardados`}</strong><small>Puedes seguir con esta planta.</small></div></div>}
        <div className="inspection-actions">
          <button onClick={() => setKind('observation')}><span className="inspection-action-icon"><Camera size={23} strokeWidth={1.6} /></span><span><strong>Añadir una observación</strong><small>Una fotografía o una nota.</small></span><ChevronRight size={18} /></button>
          <button onClick={() => setKind('action')}><span className="inspection-action-icon"><Scissors size={23} strokeWidth={1.6} /></span><span><strong>Registrar algo que hice</strong><small>Poda, soporte, raleo y otros cuidados.</small></span><ChevronRight size={18} /></button>
          <button onClick={() => setKind('followup')}><span className="inspection-action-icon"><CalendarDays size={23} strokeWidth={1.6} /></span><span><strong>Revisar más adelante</strong><small>Dejar un seguimiento para después.</small></span><ChevronRight size={18} /></button>
        </div>
        <button className="inspection-ai" onClick={() => setDialog('ai')}><Sparkles size={18} /><span>Pedir una segunda mirada a Garden AI</span><ArrowRight size={16} /></button>
        {entries.length > 0 && <details className="session-log"><summary>Lo que registraste aquí <span>{entries.length}</span></summary>{entries.map(entry => <div key={entry.id}><Check size={14} /><span><strong>{entry.title}</strong>{entry.note && <small>{entry.note}</small>}{entry.dueOn && <small>Para el {new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(new Date(`${entry.dueOn}T12:00:00`))}</small>}</span></div>)}</details>}
      </section>
    </main>
    <footer className="session-footer"><div className="session-footer-copy"><Leaf size={18} /><span>{touched ? 'Esta planta sigue abierta para ti.' : 'Ve a tu ritmo. Cada planta cuenta.'}</span></div><div className="session-navigation">{touched ? <Button secondary onClick={() => setKind('choose')}>Registrar algo más</Button> : <Button secondary onClick={() => next('skipped')}><SkipForward size={17} /> Omitir</Button>}<Button onClick={() => touched ? next('visited') : setDialog('okay')}>{touched ? index === positions.length - 1 ? 'Terminar recorrido' : 'Siguiente planta' : 'Se ve bien'}{touched ? <ArrowRight size={18} /> : <Check size={18} />}</Button></div></footer>
    </>}
    {kind && <RecordSheet initialKind={kind === 'choose' ? undefined : kind} plantName={position.name} position={position.number} onClose={() => setKind(null)} onSave={record} failSave={scenario === 'error'} />}
    {dialog === 'okay' && <Dialog title="¿Se ve bien?" eyebrow={`GARDEN 1 · POSICIÓN ${position.number}`} onClose={() => setDialog(null)}><p className="sheet-copy">Confirma tu observación visual de <strong>{position.name}</strong>. Se guardará «Se ve bien» y avanzarás a la siguiente posición.</p><p className="demo-hint">En el prototipo sólo se simula este registro.</p><div className="sheet-footer"><Button secondary onClick={() => setDialog(null)}>Volver</Button><Button onClick={() => { record({ id: crypto.randomUUID(), kind: 'observation', title: 'Se ve bien', note: 'Observación visual confirmada por ti.' }); setDialog(null); next('visited') }}>Confirmar y avanzar <Check size={17} /></Button></div></Dialog>}
    {dialog === 'pause' && <Dialog title="¿Hacemos una pausa?" eyebrow="TU REVISIÓN" onClose={() => setDialog(null)}><p className="sheet-copy">Puedes retomar esta posición mientras mantengas abierta la maqueta.</p><div className="sheet-footer"><Button secondary onClick={() => setDialog(null)}>Seguir revisando</Button><Button onClick={() => { setPaused(true); setDialog(null) }}><Pause size={17} /> Pausar</Button></div></Dialog>}
    {dialog === 'ai' && <Dialog title="Una segunda mirada" eyebrow={position.name} onClose={() => setDialog(null)}><p className="sheet-copy">El análisis aparecerá aquí, separado de tus registros. Podrás cerrarlo o abrir un formulario con una propuesta.</p><Notice>No se ejecuta AI ni se guarda información real.</Notice><div className="sheet-footer"><Button secondary onClick={() => setDialog(null)}>Cerrar</Button><Button onClick={() => { setDialog(null); setKind('followup') }}>Probar una propuesta <ArrowRight size={17} /></Button></div></Dialog>}
  </div>
}
