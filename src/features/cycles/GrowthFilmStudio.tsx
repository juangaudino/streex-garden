import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Film, Maximize2, Pause, Play, SlidersHorizontal, VolumeX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BotanicalButton, BotanicalSheet } from '../../components/botanical/BotanicalControls'
import { FILM_MOMENT_MS, type FilmCatalogue, type FilmSource } from './growth-film-composition'
import { GrowthFilmClipEditor } from './GrowthFilmClipEditor'
import { GrowthFilmPhoto } from './GrowthFilmPhoto'
import { resolveFilmPhoto } from './growth-film-photo'
import './growth-film.css'

export function GrowthFilmStudio({ catalogue, backTo }: { catalogue: FilmCatalogue; backTo: string }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [pending, setPending] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [source, setSource] = useState<readonly FilmSource[] | null>(null)
  const [editor, setEditor] = useState<'clip' | 'playback' | null>(null)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const controller = useRef<AbortController | null>(null)
  const requests = useRef(new Map<string, Promise<string>>())
  const generation = useRef(0)
  const { moments, scope } = catalogue
  const current = moments[index]
  useEffect(() => {
    const abort = new AbortController()
    controller.current = abort
    const cache = requests.current
    return () => { abort.abort(); generation.current += 1; cache.clear() }
  }, [])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  const warm = useCallback((target: number) => {
    const moment = moments[target]
    const signal = controller.current?.signal
    if (!moment || !signal) return Promise.reject(new Error('No se encontró esta fotografía.'))
    const existing = requests.current.get(moment.id)
    if (existing) return existing
    const request = resolveFilmPhoto(moment, signal).then(async url => {
      const image = new Image()
      image.src = url
      await image.decode()
      if (signal.aborted) throw new DOMException('Cancelado', 'AbortError')
      setUrls(old => ({ ...old, [moment.id]: url }))
      return url
    }).catch(reason => { if (requests.current.get(moment.id) === request) requests.current.delete(moment.id); throw reason })
    requests.current.set(moment.id, request)
    return request
  }, [moments])
  useEffect(() => {
    if (!current) return
    let active = true
    void warm(index).catch(() => { if (active && !controller.current?.signal.aborted) { setPlaying(false); setPhotoError('No se pudo abrir esta fotografía. Vuelve a intentarlo.') } })
    if (moments.length > 1) void warm((index + 1) % moments.length).catch(() => undefined)
    return () => { active = false }
  }, [current, index, moments.length, warm])
  const show = useCallback((target: number) => {
    const next = (target + moments.length) % moments.length
    const request = ++generation.current
    setPending(true); setPhotoError(null)
    void warm(next).then(() => {
      if (request === generation.current && !controller.current?.signal.aborted) { setIndex(next); setPending(false) }
    }).catch(() => {
      if (request === generation.current && !controller.current?.signal.aborted) { setPending(false); setPlaying(false); setPhotoError('No se pudo abrir el siguiente momento. La fotografía actual sigue disponible.') }
    })
  }, [moments.length, warm])
  useEffect(() => {
    if (!playing || pending || moments.length < 2) return
    const timer = window.setTimeout(() => show(index + 1), FILM_MOMENT_MS)
    return () => window.clearTimeout(timer)
  }, [playing, pending, index, moments.length, show])
  const navigate = (target: number) => { setPlaying(false); show(target) }
  const openEditor = (purpose: 'clip' | 'playback') => {
    generation.current += 1; setPending(false); setPlaying(false); setEditor(purpose)
  }
  return <div className={`botanical-surface film-page${reducedMotion ? ' film-page--reduced' : ''}`}>
    <header className="film-header"><Link className="bs-text-button" to={backTo}><ArrowLeft size={18} aria-hidden="true" />{scope.kind === 'garden' ? 'Tu jardín' : 'Tu planta'}</Link><span className="film-wordmark">GROWTH FILM<span>BY GARDEN X</span></span><button type="button" className="bs-icon-button" aria-label="Información de esta película" disabled={!current} onClick={() => { setPlaying(false); setSource(current ? [current.source] : null) }}><SlidersHorizontal size={19} /></button></header>
    <main className="film-main"><div className="film-title"><div><span className="bs-eyebrow">{scope.kind === 'garden' ? 'EL DIARIO DEL JARDÍN' : current?.currentLocation ?? 'HISTORIA DE LA PLANTA'}</span><h1>El diario de <em>{scope.title}.</em></h1></div><p>Pequeños momentos.<br />Una historia que sigue creciendo.</p></div>
      {current ? <>
        <section className="cinema" aria-label="Reproductor de Growth Film"><div className="cinema-frame" aria-busy={pending || !urls[current.id]}>
          {urls[current.id] ? <><div className="cinema-ambient" aria-hidden="true" style={{ backgroundImage: `url("${urls[current.id]}")` }} /><img className="cinema-photo" src={urls[current.id]} alt={`Fotografía real de ${current.cropName}, ${current.dateLabel}`} onError={() => {
            requests.current.delete(current.id); setPlaying(false); setPhotoError('La fotografía dejó de estar disponible. Vuelve a cargar este momento.')
          }} /></> : <p className="film-photo-placeholder" role="status">Abriendo la fotografía…</p>}
          <span className="cinema-watermark">GARDEN X</span><span className="cinema-moment">{String(index + 1).padStart(2, '0')}<i> / {String(moments.length).padStart(2, '0')}</i></span><button type="button" className="bs-icon-button cinema-expand" aria-label="Preparar película para pantalla completa" onClick={() => openEditor('playback')}><Maximize2 size={18} /></button>
        </div><div className="cinema-story"><span className="bs-eyebrow">EN SU DIARIO{scope.kind === 'garden' ? ` · ${current.cropName}` : ''}</span><h2>{current.title}</h2>{current.detail && <p>{current.detail}</p>}<div className="cinema-rule" /><span className="cinema-source">{current.dateLabel} · {current.cycleLabel}</span><button type="button" className="bs-text-button" onClick={() => { setPlaying(false); setSource([current.source]) }}>Ver origen del momento <ArrowRight size={15} aria-hidden="true" /></button></div></section>
        <div className="cinema-controls"><div className="transport"><button type="button" className="bs-icon-button" aria-label="Momento anterior" onClick={() => navigate(index - 1)} disabled={moments.length < 2}><ChevronLeft size={23} /></button><button type="button" className="bs-icon-button play-button" aria-label={playing ? 'Pausar película' : 'Reproducir película'} disabled={!urls[current.id] || moments.length < 2 || Boolean(photoError)} onClick={() => setPlaying(old => !old)}>{playing ? <Pause size={22} /> : <Play size={22} />}</button><button type="button" className="bs-icon-button" aria-label="Momento siguiente" onClick={() => navigate(index + 1)} disabled={moments.length < 2}><ChevronRight size={23} /></button></div><label className="film-scrub"><span className="sr-only">Elegir momento</span><input type="range" min={0} max={moments.length - 1} value={index} onChange={event => navigate(Number(event.target.value))} /><span>{index + 1} de {moments.length}</span></label><span className="film-sound-label"><VolumeX size={16} aria-hidden="true" />Sin música</span></div>
        {pending && <p role="status">Abriendo el siguiente momento…</p>}
        {photoError && <div role="alert"><p>{photoError}</p><BotanicalButton secondary onClick={() => { requests.current.delete(current.id); show(index) }}>Reintentar fotografía</BotanicalButton></div>}
        <div className="film-bottom"><div className="filmstrip" aria-label="Todos los momentos del diario">{moments.map((moment, momentIndex) => <button type="button" key={moment.id} aria-label={`Ver momento ${momentIndex + 1}: ${moment.cropName}`} aria-pressed={momentIndex === index} className={momentIndex === index ? 'is-active' : ''} onClick={() => navigate(momentIndex)}><GrowthFilmPhoto moment={moment} /><span>{String(momentIndex + 1).padStart(2, '0')}</span></button>)}</div><button type="button" className="create-clip" disabled={moments.length < 2} onClick={() => openEditor('clip')}><span><Film size={21} aria-hidden="true" /><span><strong>Tu historia, para llevar.</strong><small>{moments.length < 2 ? 'Añade otra fotografía desde tu planta.' : 'Elige momentos y música.'}</small></span></span><span>Crear clip <ArrowRight size={18} aria-hidden="true" /></span></button></div>
        {scope.kind === 'cycle' && <Link className="bs-text-button" to={`/cycle/${scope.id}/photos`}>Ver y comparar fotografías <ArrowRight size={15} aria-hidden="true" /></Link>}
      </> : <section className="film-empty"><h2>Su historia empieza con una fotografía.</h2><p>Todavía no hay fotografías guardadas en este diario.</p><Link className="bs-text-button" to={backTo}>Volver para añadir una fotografía</Link></section>}
      {catalogue.milestones.length > 0 && <section className="film-milestones"><h2>Momentos que marcaron su historia.</h2><ol>{catalogue.milestones.map(milestone => <li key={milestone.id}><h3>{milestone.title}</h3>{milestone.detail && <p>{milestone.detail}</p>}<button type="button" className="bs-text-button" onClick={() => { setPlaying(false); setSource(milestone.sources) }}>Ver {milestone.sources.length === 1 ? 'registro' : `${milestone.sources.length} registros`} <ArrowRight size={15} aria-hidden="true" /></button></li>)}</ol></section>}
      {catalogue.excludedCycleIds.length > 0 && <details className="film-history-note"><summary>Historias trasladadas a otro jardín</summary><p>Estos ciclos se consultan por separado: su ubicación actual no permite confirmar en qué jardín se tomó cada fotografía.</p>{catalogue.excludedCycleIds.map(id => <Link className="bs-text-button" key={id} to={`/cycle/${id}/film`}>Abrir diario del ciclo trasladado <ArrowRight size={15} aria-hidden="true" /></Link>)}</details>}
    </main><footer className="film-colophon"><span>CRECE A SU PROPIO RITMO.</span><span>GARDEN X</span></footer>
    {editor && <GrowthFilmClipEditor catalogue={catalogue} reducedMotion={reducedMotion} purpose={editor} onClose={() => setEditor(null)} />}
    {source && <BotanicalSheet className="film-sheet" title="El origen de este momento" context="FOTOGRAFÍA Y CONTEXTO" onClose={() => setSource(null)}><div className="record-detail"><p>El relato presenta los registros reales del ciclo. Una fotografía no confirma por sí sola cómo está la planta hoy.</p>{source.map(item => <section key={item.historyId}><dl><div><dt>Tipo de registro</dt><dd>{item.eventId ? item.eventType : 'Evidencia fotográfica'}</dd></div><div><dt>Registro original</dt><dd>{item.note ?? 'Sin nota adicional'}</dd></div><div><dt>Fecha del registro</dt><dd>{item.recordedOn ?? item.recordedAt ?? 'Sin fecha confirmada'}</dd></div></dl><Link className="bs-text-button" to={`/cycle/${item.cycleId}`}>Abrir historial del ciclo <ArrowRight size={15} aria-hidden="true" /></Link><details><summary>Detalles del registro</summary><dl><div><dt>Identificador</dt><dd>{item.eventId ?? item.historyId}</dd></div><div><dt>Revisión</dt><dd>{item.eventRevision} · Ciclo {item.cycleRevision}</dd></div></dl><pre>{JSON.stringify(item.provenance, null, 2)}</pre></details></section>)}</div><div className="bs-sheet-footer"><BotanicalButton onClick={() => setSource(null)}>Volver a la película</BotanicalButton></div></BotanicalSheet>}
  </div>
}
