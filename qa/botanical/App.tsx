import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, ImagePlus, Leaf, Monitor, Smartphone, Tablet } from 'lucide-react'
import { Film } from './Film'
import { Maintenance } from './Maintenance'
import { Plant } from './Plant'
import { RecordSheet } from './RecordSheet'
import { Button, Dialog, Notice } from './ui'
import { fixtureMoments, initialRecords, viewNames, type DemoRecord, type Moment, type RecordKind, type Scenario, type View } from './model'
import './studio.css'
import './design.css'

const options = new URLSearchParams(location.search)
const validView = (value: string | null): View => value === 'maintenance' || value === 'film' ? value : 'plant'
const validScenario = (value: string | null): Scenario => ['empty', 'loading', 'error', 'dense'].includes(value ?? '') ? value as Scenario : 'normal'

export function App() {
  const [view, setView] = useState<View>(validView(options.get('view')))
  const [moments, setMoments] = useState<Moment[]>(fixtureMoments)
  const [records, setRecords] = useState<DemoRecord[]>(initialRecords)
  const [recordSheet, setRecordSheet] = useState<{ kind?: RecordKind } | null>(null)
  const [settings, setSettings] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [reduced, setReduced] = useState(options.has('reduced') || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [scenario, setScenario] = useState<Scenario>(validScenario(options.get('state')))
  const input = useRef<HTMLInputElement>(null)
  const objectUrls = useRef<string[]>([])
  useEffect(() => () => objectUrls.current.forEach(url => URL.revokeObjectURL(url)), [])
  useEffect(() => {
    const update = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'botanical-control') return
      setView(validView(event.data.view)); setScenario(validScenario(event.data.scenario)); setToast(null)
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('message', update)
    window.parent.postMessage({ type: 'botanical-ready' }, location.origin)
    return () => window.removeEventListener('message', update)
  }, [])
  useEffect(() => { document.documentElement.dataset.motion = reduced ? 'reduced' : 'full' }, [reduced])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])
  const navigate = (next: View) => {
    setView(next); setToast(null)
    const url = new URL(location.href); url.searchParams.set('view', next); history.replaceState(null, '', url)
    window.parent.postMessage({ type: 'botanical-view', view: next }, location.origin)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const changeScenario = (next: Scenario) => {
    setScenario(next)
    window.parent.postMessage({ type: 'botanical-scenario', scenario: next }, location.origin)
  }
  const loadPhotos = (files: FileList | null) => {
    if (!files?.length) return
    const images = Array.from(files).filter(file => ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type))
    if (!images.length) { setUploadError('Elige fotografías JPG, PNG, WebP o AVIF para esta maqueta.'); setSettings(true); return }
    objectUrls.current.forEach(url => URL.revokeObjectURL(url))
    const values = images.slice(0, 24).map((file, i) => {
      const src = URL.createObjectURL(file)
      return { id: `local-${i}-${crypto.randomUUID()}`, src, title: 'Un momento para recordar.', date: 'Fecha de captura sin confirmar', note: 'Fotografía elegida desde este dispositivo. No se ha subido ni vinculado a ningún ciclo.', provenance: file.name }
    })
    objectUrls.current = values.map(value => value.src)
    setMoments(values); changeScenario('normal'); setSettings(false); setUploadError(null)
    setToast(`${values.length} fotografías locales listas para explorar.`)
  }
  const save = (record: DemoRecord) => { setRecords(old => [record, ...old]); setRecordSheet(null); changeScenario('normal'); setToast(`${record.title}. Guardado sólo en la maqueta.`) }
  return <div className={`garden-prototype garden-prototype--${view}`}>
    {view === 'plant' && <header className="app-header"><button className="garden-brand" onClick={() => setSettings(true)} aria-label="Garden X · información del prototipo"><span>Garden</span><img src="/brand/garden-x-mark.png" alt="X" /></button><nav aria-label="Jardín actual"><button className="app-nav-active" onClick={() => setSettings(true)}>Mi jardín <ChevronDown size={14} /></button></nav><button className="review-garden-button" onClick={() => navigate('maintenance')}>Revisar jardín <ArrowRight size={16} /></button></header>}
    {view === 'plant' && <Plant key={scenario} scenario={scenario} moments={moments} records={records} onNavigate={navigate} onRecord={kind => setRecordSheet({ kind })} onSettings={() => setSettings(true)} />}
    {view === 'maintenance' && <Maintenance scenario={scenario} moments={moments} onExit={() => navigate('plant')} />}
    {view === 'film' && <Film moments={moments} scenario={moments.length < 2 ? 'empty' : scenario} reduced={reduced} onBack={() => navigate('plant')} onUpload={() => input.current?.click()} />}
    <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple tabIndex={-1} aria-label="Cargar fotografías locales para el prototipo" onChange={e => { loadPhotos(e.target.files); e.target.value = '' }} />
    {recordSheet && <RecordSheet initialKind={recordSheet.kind} plantName="Cilantro" position={5} onClose={() => setRecordSheet(null)} onSave={save} failSave={scenario === 'error'} />}
    {toast && <div className="app-toast" role="status"><Check size={17} />{toast}</div>}
    <button className="demo-badge" onClick={() => setSettings(true)} aria-label="Opciones y datos del prototipo">DEMO</button>
    {settings && <Dialog title="Botanical Studio" eyebrow="GARDEN X · FASE 01" onClose={() => setSettings(false)}><div className="studio-info"><p>Una propuesta interactiva de Planta, Maintenance y Growth Film. Todos los datos son de demostración.</p><Notice>Las acciones no se conectan a tu cuenta ni modifican registros reales.</Notice><div className="settings-nav">{(Object.keys(viewNames) as View[]).map(value => <Button key={value} secondary onClick={() => { setSettings(false); navigate(value) }}>{viewNames[value]}<ArrowRight size={16} /></Button>)}</div><h3>Prueba con tus fotografías</h3><p>Se abren sólo en este navegador. La foto inicial se repite como referencia visual; no representa una secuencia de crecimiento.</p><Button secondary onClick={() => input.current?.click()}><ImagePlus size={18} /> Elegir fotos de este dispositivo</Button>{uploadError && <Notice error>{uploadError}</Notice>}<label className="confirmation"><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} /><span>Reducir movimiento</span></label><label className="field"><span>Estado a explorar</span><select value={scenario} onChange={e => changeScenario(e.target.value as Scenario)}><option value="normal">Contenido habitual</option><option value="dense">Texto largo y más registros</option><option value="empty">Sin fotografías o registros</option><option value="loading">Cargando</option><option value="error">Error de carga / guardado</option></select></label></div><div className="sheet-footer"><Button onClick={() => setSettings(false)}>Volver al prototipo</Button></div></Dialog>}
  </div>
}

export function Studio() {
  const [view, setView] = useState<View>('plant')
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'phone'>('phone')
  const [scenario, setScenario] = useState('normal')
  const [notes, setNotes] = useState(true)
  const frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    const update = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return
      if (event.data?.type === 'botanical-view') setView(validView(event.data.view))
      if (event.data?.type === 'botanical-scenario') setScenario(validScenario(event.data.scenario))
      if (event.data?.type === 'botanical-ready') frame.current?.contentWindow?.postMessage({ type: 'botanical-control', view, scenario }, location.origin)
    }
    window.addEventListener('message', update)
    return () => window.removeEventListener('message', update)
  }, [view, scenario])
  const syncFrame = () => frame.current?.contentWindow?.postMessage({ type: 'botanical-control', view, scenario }, location.origin)
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: 'botanical-control', view, scenario }, location.origin)
  }, [view, scenario])
  return <div className="studio">
    <header className="studio-toolbar"><a className="studio-identity" href="./index.html"><Leaf size={22} strokeWidth={1.5} /><span>Garden X <small>BOTANICAL STUDIO · 01</small></span></a><nav className="studio-views" aria-label="Prototipos">{(Object.keys(viewNames) as View[]).map(value => <button key={value} className={view === value ? 'is-active' : ''} aria-pressed={view === value} onClick={() => setView(value)}>{viewNames[value]}</button>)}</nav><div className="studio-devices" aria-label="Tamaño de la vista">{([{ id: 'phone', icon: Smartphone, label: 'Móvil' }, { id: 'tablet', icon: Tablet, label: 'Tablet' }, { id: 'desktop', icon: Monitor, label: 'Escritorio' }] as const).map(item => <button className={device === item.id ? 'is-active' : ''} aria-label={item.label} title={item.label} aria-pressed={device === item.id} key={item.id} onClick={() => setDevice(item.id)}><item.icon size={19} /></button>)}</div><button className="studio-notes-button" onClick={() => setNotes(!notes)} aria-expanded={notes}>Dirección visual</button></header>
    <div className="studio-subbar"><span><i /> PROTOTIPO INTERACTIVO · DATOS DE DEMOSTRACIÓN</span><label>Estado <select aria-label="Estado del prototipo" value={scenario} onChange={e => setScenario(e.target.value)}><option value="normal">Habitual</option><option value="dense">Contenido abundante</option><option value="empty">Vacío</option><option value="loading">Cargando</option><option value="error">Error</option></select></label><a href={`?standalone=1&view=${view}&state=${scenario}`} target="_blank" rel="noreferrer">Abrir sin marco ↗</a></div>
    <div className={`studio-canvas ${notes ? 'has-notes' : ''}`}><div className={`studio-device studio-device--${device}`}><iframe ref={frame} title={`Garden X · ${viewNames[view]}`} src="?standalone=1" onLoad={syncFrame} /></div>{notes && <aside className="direction-notes"><span>LA DIRECCIÓN</span><h1>Living<br />Botanical<br /><em>Cinema.</em></h1><p>Fotografía generosa.<br />Controles contenidos.<br />Profundidad selectiva.</p><div className="palette"><i /><i /><i /><i /></div><h2>{viewNames[view]}</h2><p>{view === 'plant' ? 'Un retrato de la planta que conecta su presente con su historia. Una entrada para registrar; las herramientas aparecen cuando hacen falta.' : view === 'maintenance' ? 'Un recorrido que se queda contigo. Guardar no avanza. Cancelar no borra. La acción para continuar conserva su lugar.' : 'La película y la creación del clip tienen su propio espacio. Momentos visibles, música que puedes escuchar y una vista previa del conjunto.'}</p><small>La referencia inicial es una fotografía local repetida. Puedes reemplazarla por tus imágenes desde DEMO. Ninguna acción modifica tu jardín.</small></aside>}</div>
    <footer className="studio-footer"><span>01 / DIRECCIÓN VISUAL, UX Y PROTOTIPOS</span><span>Planta · Revisión · Película</span></footer>
  </div>
}
