import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Film as FilmIcon, Headphones, Maximize2, Music2, Pause, Play, Plus, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react'
import { Button, Dialog, EmptyState, IconButton, Notice, Photo } from './ui'
import { tracks, type Moment, type Scenario } from './model'

function usePlayback(count: number, reduced: boolean) {
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!playing || count < 2) return
    const timer = window.setInterval(() => setIndex(old => (old + 1) % count), 3400)
    return () => window.clearInterval(timer)
  }, [playing, count])
  return { playing, setPlaying, index: Math.min(index, Math.max(0, count - 1)), setIndex, transition: reduced ? '' : 'with-transition' }
}

export function Film({ moments, scenario, reduced, onBack, onUpload }: { moments: Moment[]; scenario: Scenario; reduced: boolean; onBack: () => void; onUpload: () => void }) {
  const [editor, setEditor] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const playback = usePlayback(moments.length, reduced)
  const current = moments[playback.index]
  const change = (offset: number) => { playback.setPlaying(false); playback.setIndex((playback.index + offset + moments.length) % moments.length) }
  if (scenario === 'empty' || scenario === 'error') return <div className="film-page"><header className="film-header"><button className="text-button" onClick={onBack}><ArrowLeft size={18} /> Volver a la planta</button><span className="film-wordmark">GROWTH FILM</span></header><EmptyState error={scenario === 'error'} title={scenario === 'empty' ? 'Una película empieza con dos momentos.' : 'No pudimos abrir las fotografías.'} description={scenario === 'empty' ? 'Elige al menos dos fotografías locales para explorar esta experiencia.' : 'Puedes cargar fotografías locales para seguir revisando el prototipo.'} action="Elegir fotografías" onAction={onUpload} /></div>
  return <div className="film-page">
    <header className="film-header"><button className="text-button" onClick={onBack}><ArrowLeft size={18} /><span>Tu planta</span></button><span className="film-wordmark">GROWTH FILM<span>BY GARDEN X</span></span><IconButton label="Información de esta película" onClick={() => setShowInfo(true)}><SlidersHorizontal size={19} /></IconButton></header>
    <main className="film-main"><div className="film-title"><div><span className="eyebrow">GARDEN 1 · POSICIÓN 5</span><h1>El diario del <em>cilantro.</em></h1></div><p>Pequeños momentos.<br />Una historia que sigue creciendo.</p></div>
      <section className="cinema" aria-label="Reproductor de Growth Film"><div className={`cinema-frame ${playback.transition}`}><div className="cinema-ambient" style={{ backgroundImage: `url("${current.src}")` }} /><Photo key={current.id} className="cinema-photo" src={current.src} alt={`Referencia fotográfica, momento ${playback.index + 1}`} scenario={scenario} /><span className="cinema-watermark">GARDEN X</span><span className="cinema-moment">{String(playback.index + 1).padStart(2, '0')}<i> / {String(moments.length).padStart(2, '0')}</i></span><IconButton className="cinema-expand" label="Ampliar película" onClick={() => { playback.setPlaying(false); setExpanded(true) }}><Maximize2 size={18} /></IconButton></div>
      <div className="cinema-story"><span className="eyebrow">EN SU DIARIO</span><h2>{current.title}</h2><p>Un instante para volver a mirar.</p><div className="cinema-rule" /><span className="cinema-source">{current.date}</span><button className="text-button" onClick={() => setShowInfo(true)}>Ver origen del momento <ArrowRight size={15} /></button></div></section>
      <div className="cinema-controls"><div className="transport"><IconButton label="Momento anterior" onClick={() => change(-1)}><ChevronLeft size={23} /></IconButton><IconButton className="play-button" label={playback.playing ? 'Pausar película' : 'Reproducir película'} disabled={scenario === 'loading'} onClick={() => playback.setPlaying(!playback.playing)}>{playback.playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}</IconButton><IconButton label="Momento siguiente" onClick={() => change(1)}><ChevronRight size={23} /></IconButton></div><label className="film-scrub"><span className="sr-only">Elegir momento</span><input type="range" min={0} max={moments.length - 1} value={playback.index} onChange={e => { playback.setPlaying(false); playback.setIndex(Number(e.target.value)) }} /><span>{playback.index + 1} de {moments.length}</span></label><span className="film-sound-label"><VolumeX size={16} /> Sin música</span></div>
      <div className="film-bottom"><div className="filmstrip">{moments.slice(0, 12).map((moment, i) => <button key={moment.id} className={i === playback.index ? 'is-active' : ''} aria-label={`Ver momento ${i + 1}`} aria-pressed={i === playback.index} onClick={() => { playback.setPlaying(false); playback.setIndex(i) }}><Photo src={moment.src} alt="" /><span>{String(i + 1).padStart(2, '0')}</span></button>)}</div><button className="create-clip" onClick={() => { playback.setPlaying(false); setEditor(true) }}><span><FilmIcon size={21} /><span><strong>Tu historia, para llevar.</strong><small>Elige momentos y música.</small></span></span><span>Crear clip <ArrowRight size={18} /></span></button></div>
    </main><footer className="film-colophon"><span>CRECE A SU PROPIO RITMO.</span><span>GARDEN X</span></footer>
    {editor && <ClipEditor key={moments.map(moment => moment.id).join('|')} moments={moments} reduced={reduced} onClose={() => setEditor(false)} onUpload={onUpload} />}
    {expanded && <Dialog title={current.title} eyebrow="VISTA AMPLIADA" dark wide onClose={() => setExpanded(false)}><img className="original-view" src={current.src} alt="Fotografía completa del momento seleccionado" /><p className="photo-provenance">{current.date} · {current.provenance}</p></Dialog>}
    {showInfo && <Dialog title="El origen de este momento" eyebrow="FOTOGRAFÍA Y CONTEXTO" dark onClose={() => setShowInfo(false)}><div className="record-detail"><p>{current.note}</p><dl><div><dt>Fotografía</dt><dd>{current.provenance}</dd></div><div><dt>Captura</dt><dd>{current.date}</dd></div></dl><p className="demo-hint">Los títulos son ejemplos editoriales de la maqueta. No describen hechos confirmados de tu jardín.</p></div><div className="sheet-footer"><Button onClick={() => setShowInfo(false)}>Volver a la película</Button></div></Dialog>}
  </div>
}

function ClipEditor({ moments, reduced, onClose, onUpload }: { moments: Moment[]; reduced: boolean; onClose: () => void; onUpload: () => void }) {
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState(moments.slice(0, 6).map(moment => moment.id))
  const [track, setTrack] = useState<string>('light')
  const [previewTrack, setPreviewTrack] = useState<string | null>(null)
  const [audioError, setAudioError] = useState(false)
  const [saved, setSaved] = useState(false)
  const [titles, setTitles] = useState(true)
  const [volume, setVolume] = useState(30)
  const audio = useRef<HTMLAudioElement | null>(null)
  const filtered = moments.filter(moment => selected.includes(moment.id))
  const playback = usePlayback(filtered.length, reduced)
  const current = filtered[playback.index] ?? moments[0]
  const audioGeneration = useRef(0)
  const stopAudio = () => { audioGeneration.current += 1; audio.current?.pause(); audio.current = null; setPreviewTrack(null) }
  useEffect(() => () => { audioGeneration.current += 1; audio.current?.pause() }, [])
  useEffect(() => { if (audio.current) audio.current.volume = volume / 100 }, [volume])
  const listen = (id: string) => {
    stopAudio(); setAudioError(false)
    if (previewTrack === id) return
    const music = tracks.find(item => item.id === id)
    if (!music) return
    const node = new Audio(music.url)
    node.volume = volume / 100
    audio.current = node
    const generation = audioGeneration.current
    node.onended = () => { if (generation === audioGeneration.current) setPreviewTrack(null) }
    node.onerror = () => { if (generation === audioGeneration.current) { setAudioError(true); setPreviewTrack(null) } }
    void node.play().then(() => { if (generation === audioGeneration.current) setPreviewTrack(id); else node.pause() }).catch(() => { if (generation === audioGeneration.current) { setAudioError(true); setPreviewTrack(null) } })
  }
  const toggle = (id: string) => { setSelected(old => old.includes(id) ? old.filter(value => value !== id) : old.length < 12 ? [...old, id] : old); setSaved(false) }
  const advance = (next: number) => { stopAudio(); playback.setPlaying(false); setStep(next) }
  return <Dialog title={['Elige tus momentos.', 'Encuentra su sonido.', 'Así se verá tu historia.'][step]} eyebrow="CREAR CLIP" onClose={() => { stopAudio(); onClose() }} wide dark>
    <ol className="editor-steps" aria-label="Pasos para crear clip">{['Momentos', 'Música', 'Vista previa'].map((name, i) => <li className={i === step ? 'is-active' : i < step ? 'is-done' : ''} key={name}><span>{i < step ? <Check size={13} /> : i + 1}</span>{name}</li>)}</ol>
    {step === 0 && <div className="editor-body"><div className="editor-intro"><p>Las imágenes que quieres volver a mirar.</p><strong>{selected.length}<span> / 12</span></strong></div><div className="moment-grid">{moments.map((moment, i) => { const checked = selected.includes(moment.id); return <button key={moment.id} className={`moment-tile ${checked ? 'is-selected' : ''}`} aria-label={`${checked ? 'Quitar' : 'Añadir'} momento ${i + 1}`} aria-pressed={checked} disabled={!checked && selected.length >= 12} onClick={() => toggle(moment.id)}><Photo src={moment.src} alt={`Fotografía ${i + 1}`} /><span className="moment-check">{checked && <Check size={14} />}</span><span className="moment-info"><strong>Momento {String(i + 1).padStart(2, '0')}</strong><small>{moment.date === 'Fecha de captura sin confirmar' ? 'Captura sin confirmar' : moment.date}</small></span></button> })}</div><div className="selection-tools"><button className="text-button" onClick={() => setSelected(selected.length ? [] : moments.slice(0, 12).map(moment => moment.id))}>{selected.length ? 'Quitar selección' : 'Seleccionar hasta 12'}</button><button className="text-button" onClick={onUpload}><Plus size={16} /> Usar mis fotos</button></div><p className="demo-hint">Se mantiene el orden de la selección de archivos. Las referencias iniciales repiten una misma foto; no representan un crecimiento real.</p></div>}
    {step === 1 && <div className="editor-body"><p className="editor-description">Una banda sonora sutil, hecha para Garden X.</p><div className="track-list" role="radiogroup" aria-label="Música del clip"><label className={`track-option ${track === 'none' ? 'is-selected' : ''}`}><input type="radio" name="music" value="none" checked={track === 'none'} onChange={() => { setTrack('none'); stopAudio() }} /><span className="track-art track-art--silent"><VolumeX size={23} /></span><span className="track-name"><strong>El sonido del silencio</strong><small>Sin música</small></span><span className="radio-visual">{track === 'none' && <Check size={14} />}</span></label>{tracks.map((music, i) => <div key={music.id} className={`track-option ${track === music.id ? 'is-selected' : ''}`}><label><input type="radio" name="music" value={music.id} checked={track === music.id} onChange={() => { setTrack(music.id); stopAudio() }} /><span className={`track-art track-art--${i}`}><Music2 size={23} /></span><span className="track-name"><strong>{music.name}</strong><small>{music.subtitle}</small></span><span className="radio-visual">{track === music.id && <Check size={14} />}</span></label><IconButton label={previewTrack === music.id ? `Pausar ${music.name}` : `Escuchar ${music.name}`} onClick={() => listen(music.id)}>{previewTrack === music.id ? <Pause size={17} /> : <Play size={17} />}</IconButton></div>)}</div>{audioError && <Notice error>No se pudo reproducir la pista. Puedes volver a intentarlo o elegir otra.</Notice>}{track !== 'none' && <label className="volume-control"><span><Volume2 size={18} /> Volumen de la música</span><input type="range" min={0} max={100} value={volume} onChange={e => setVolume(Number(e.target.value))} /><output>{volume}%</output></label>}<div className="listening-note"><Headphones size={17} /><span>Pulsa reproducir para escuchar cada pista.</span></div></div>}
    {step === 2 && <div className="editor-preview"><div className="export-preview-film"><Photo src={current.src} alt="Vista previa del encuadre completo" className={playback.transition} />{titles && <div className="export-preview-title"><span>GARDEN X</span><h3>{current.title}</h3></div>}<IconButton label={playback.playing ? 'Pausar vista previa' : 'Reproducir vista previa'} onClick={() => { playback.setPlaying(!playback.playing); if (!playback.playing && track !== 'none') listen(track); else stopAudio() }}>{playback.playing ? <Pause size={20} /> : <Play size={20} />}</IconButton></div><div className="export-summary"><span className="eyebrow">TU CLIP</span><h3>Un pequeño diario<br />para conservar.</h3><dl><div><dt>Momentos</dt><dd>{filtered.length}</dd></div><div><dt>Duración aproximada</dt><dd>{Math.round(filtered.length * 3.4)} segundos</dd></div><div><dt>Música</dt><dd>{tracks.find(music => music.id === track)?.name ?? 'Sin música'}</dd></div><div><dt>Encuadre</dt><dd>Fotografía completa</dd></div></dl><label className="title-toggle"><span>Incluir títulos</span><input role="switch" type="checkbox" checked={titles} onChange={e => setTitles(e.target.checked)} /><span className="switch-visual" /></label><p className="demo-hint">La vista previa es interactiva. La exportación del archivo se conectará en la fase de implementación.</p>{saved && <Notice>Composición lista para revisar. Esta maqueta no descarga un video.</Notice>}</div></div>}
    <div className="sheet-footer editor-footer"><Button secondary onClick={() => step === 0 ? onClose() : advance(step - 1)}>{step === 0 ? 'Cancelar' : <><ArrowLeft size={16} /> Volver</>}</Button><span className="editor-selection-summary">{selected.length} momentos · {Math.round(selected.length * 3.4)} s</span><Button disabled={selected.length < 2} onClick={() => step < 2 ? advance(step + 1) : setSaved(true)}>{step < 2 ? 'Continuar' : 'Finalizar prueba'}{step === 2 ? <Check size={17} /> : <ArrowRight size={17} />}</Button></div>
  </Dialog>
}
