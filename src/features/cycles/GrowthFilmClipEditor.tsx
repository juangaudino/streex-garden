import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Check, Download, Music2, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { BotanicalButton, BotanicalSheet } from '../../components/botanical/BotanicalControls'
import { composeGrowthFilm, FILM_MAX_CLIP_MOMENTS, FILM_TRACKS, type FilmCatalogue, type FilmTrackId } from './growth-film-composition'
import { downloadFilmArtifact } from './growth-film-export'
import { FilmRenderSession } from './growth-film-session'
import { GrowthFilmPhoto } from './GrowthFilmPhoto'
import { GrowthFilmVideo } from './GrowthFilmVideo'

export function GrowthFilmClipEditor({ catalogue, reducedMotion, onClose, purpose = 'clip' }: {
  catalogue: FilmCatalogue; reducedMotion: boolean; onClose: () => void; purpose?: 'clip' | 'playback'
}) {
  const [step, setStep] = useState(purpose === 'playback' ? 2 : 0)
  const [selected, setSelected] = useState(() => catalogue.moments.slice(0, purpose === 'playback' ? undefined : 6).map(moment => moment.id))
  const [track, setTrack] = useState<FilmTrackId | null>(purpose === 'playback' ? null : 'growing-light')
  const [titles, setTitles] = useState(true)
  const [volume, setVolume] = useState(30)
  const [listening, setListening] = useState<FilmTrackId | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [duration, setDuration] = useState<{ url: string; ms: number } | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const preview = useRef<HTMLDivElement>(null)
  const audioGeneration = useRef(0)
  const [session] = useState(() => new FilmRenderSession())
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const plan = useMemo(() => selected.length >= (purpose === 'clip' ? 2 : 1) ? composeGrowthFilm(catalogue, {
    purpose, selectedIds: selected, titles, reducedMotion, trackId: track, volume: volume / 100,
  }) : null, [catalogue, purpose, selected, titles, reducedMotion, track, volume])
  // Also invalidate when the OS changes motion preference while an editor is open.
  useEffect(() => () => session.clear(), [session, plan?.key])
  useEffect(() => () => { audioGeneration.current += 1; audio.current?.pause() }, [])
  const stopAudio = () => { audioGeneration.current += 1; audio.current?.pause(); audio.current = null; setListening(null) }
  const clearVideo = () => {
    const video = preview.current?.querySelector('video')
    if (video) { video.pause(); video.removeAttribute('src'); video.load() }
    session.clear()
  }
  const change = (update: () => void) => { clearVideo(); stopAudio(); update() }
  const close = () => { clearVideo(); stopAudio(); onClose() }
  const listen = (id: FilmTrackId) => {
    const wasListening = listening === id
    stopAudio(); setAudioError(null)
    if (wasListening) return
    const node = new Audio(FILM_TRACKS.find(item => item.id === id)!.url)
    node.volume = volume / 100
    audio.current = node
    const generation = audioGeneration.current
    const fail = () => { if (generation === audioGeneration.current) { node.pause(); setListening(null); setAudioError('No se pudo escuchar esta pista. Puedes intentarlo de nuevo.') } }
    node.onended = () => { if (generation === audioGeneration.current) setListening(null) }
    node.onerror = fail
    void node.play().then(() => { if (generation === audioGeneration.current) setListening(id); else node.pause() }).catch(fail)
  }
  const artifact = plan ? session.artifactFor(plan.key) : null
  const actualDuration = artifact && duration?.url === artifact.url ? duration.ms : null
  const busy = state.status === 'preparing'
  const count = selected.length
  return <BotanicalSheet className="film-sheet film-sheet--wide" title={purpose === 'playback' ? 'Tu diario en pantalla completa.' : ['Elige tus momentos.', 'Encuentra su sonido.', 'Así se verá tu historia.'][step]} context={purpose === 'playback' ? 'GROWTH FILM' : 'CREAR CLIP'} onClose={close}>
    {purpose === 'clip' && <ol className="editor-steps" aria-label="Pasos para crear clip">{['Momentos', 'Música', 'Vista previa'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className={index === step ? 'is-active' : index < step ? 'is-done' : ''}><span>{index < step ? <Check size={13} aria-hidden="true" /> : index + 1}</span>{label}</li>)}</ol>}
    {step === 0 && <div className="editor-body">
      <div className="editor-intro"><p>Las imágenes que quieres volver a mirar.</p><strong>{count}<span> / {FILM_MAX_CLIP_MOMENTS}</span></strong></div>
      <div className="moment-grid">{catalogue.moments.map((moment, index) => {
        const checked = selected.includes(moment.id)
        return <button type="button" key={moment.id} className={`moment-tile${checked ? ' is-selected' : ''}`} aria-label={`${checked ? 'Quitar' : 'Añadir'} momento ${index + 1}: ${moment.cropName}`} aria-pressed={checked} disabled={!checked && count >= FILM_MAX_CLIP_MOMENTS} onClick={() => change(() => setSelected(old => checked ? old.filter(id => id !== moment.id) : [...old, moment.id]))}>
          <GrowthFilmPhoto moment={moment} /><span className="moment-check">{checked && <Check size={14} aria-hidden="true" />}</span><span className="moment-info"><strong>{catalogue.scope.kind === 'garden' ? moment.cropName : `Momento ${String(index + 1).padStart(2, '0')}`}</strong><small>{moment.dateLabel} · {moment.cycleLabel}</small></span>
        </button>
      })}</div>
      <div className="selection-tools"><button type="button" className="bs-text-button" onClick={() => change(() => setSelected(count ? [] : catalogue.moments.slice(0, FILM_MAX_CLIP_MOMENTS).map(moment => moment.id)))}>{count ? 'Quitar selección' : 'Seleccionar hasta 12'}</button></div>
      <p className="film-hint">Elige entre 2 y 12 fotografías. Siempre conservan el orden del diario.</p>
    </div>}
    {step === 1 && <div className="editor-body">
      <p className="editor-description">Una banda sonora sutil, hecha para Garden X.</p>
      <div className="track-list" role="radiogroup" aria-label="Música del clip">
        <label className={`track-option${track === null ? ' is-selected' : ''}`}><input type="radio" name="film-music" checked={track === null} onChange={() => change(() => setTrack(null))} /><span className="track-art track-art--silent"><VolumeX aria-hidden="true" /></span><span className="track-name"><strong>El sonido del silencio</strong><small>Sin música</small></span><span className="radio-visual">{track === null && <Check size={14} aria-hidden="true" />}</span></label>
        {FILM_TRACKS.map((music, index) => <div key={music.id} className={`track-option${track === music.id ? ' is-selected' : ''}`}><label><input type="radio" name="film-music" checked={track === music.id} onChange={() => change(() => setTrack(music.id))} /><span className={`track-art track-art--${index}`}><Music2 aria-hidden="true" /></span><span className="track-name"><strong>{music.name}</strong><small>Instrumental · Garden X</small></span><span className="radio-visual">{track === music.id && <Check size={14} aria-hidden="true" />}</span></label><button type="button" className="bs-icon-button" aria-label={`${listening === music.id ? 'Pausar' : 'Escuchar'} ${music.name}`} onClick={() => listen(music.id)}>{listening === music.id ? <Pause size={18} /> : <Play size={18} />}</button></div>)}
      </div>
      <label className="volume-control"><span><Volume2 size={17} aria-hidden="true" />Volumen de la música</span><input type="range" min={0} max={100} value={volume} disabled={track === null} onChange={event => change(() => setVolume(Number(event.target.value)))} /><output>{volume}%</output></label>
      {audioError && <p role="alert">{audioError}</p>}
    </div>}
    {step === 2 && plan && <div ref={preview} className="editor-preview">
      <GrowthFilmVideo plan={plan} session={session} onDuration={(url, ms) => setDuration({ url, ms })} />
      <div className="export-summary"><span className="bs-eyebrow">TU HISTORIA</span><h3>{catalogue.scope.title}</h3><dl>
        <div><dt>Momentos</dt><dd>{count}</dd></div><div><dt>Duración {actualDuration === null ? 'estimada' : 'del video'}</dt><dd>{((actualDuration ?? plan.durationMs) / 1000).toLocaleString('es', { maximumFractionDigits: 1 })} s</dd></div><div><dt>Música</dt><dd>{FILM_TRACKS.find(item => item.id === track)?.name ?? 'Sin música'}</dd></div><div><dt>Encuadre</dt><dd>Fotografía completa · 4:5</dd></div>
      </dl><label className="title-toggle"><span>Incluir títulos y relato</span><input type="checkbox" checked={titles} disabled={busy} onChange={event => change(() => setTitles(event.target.checked))} /><span className="switch-visual" aria-hidden="true" /></label>
        {reducedMotion && <p className="film-hint">Movimiento reducido: sin fundidos ni desplazamientos.</p>}
        <p className="film-hint">El video que ves es el archivo final. No se crean fotografías ni registros nuevos.</p>
      </div>
    </div>}
    <div className="bs-sheet-footer editor-footer">
      <BotanicalButton secondary onClick={step > 0 && purpose === 'clip' ? () => change(() => setStep(step - 1)) : close}>{purpose === 'playback' ? 'Volver al diario' : step > 0 ? 'Volver' : 'Cancelar'}</BotanicalButton>
      <span className="editor-selection-summary" role="status">{count} momentos</span>
      {purpose === 'clip' && (step < 2 ? <BotanicalButton disabled={count < 2} onClick={() => change(() => setStep(step + 1))}>Continuar</BotanicalButton> : <BotanicalButton disabled={!artifact} onClick={() => {
        const current = plan && session.artifactFor(plan.key)
        if (current) downloadFilmArtifact(current, `garden-x-${catalogue.scope.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)
      }}><Download size={18} aria-hidden="true" />Descargar clip</BotanicalButton>)}
    </div>
  </BotanicalSheet>
}
