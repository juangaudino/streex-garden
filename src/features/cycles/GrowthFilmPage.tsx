import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Download, Maximize2, Minimize2, Pause, Play, Sparkles, X } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import type { CycleHistoryEvent, GrowCycleDetail, PhotoEvidence } from '../../domain/types'
import { getCycle, getSignedPhotoUrl } from '../../lib/garden-api'
import { captureLabel } from './photo-presentation'
import { createPrivateGrowthFilm, downloadPrivateGrowthFilm, nearbyFilmIndexes, selectFilmFrameIndexes, GROWTH_FILM_MAX_EXPORT_FRAMES } from './growth-film-media'
import { groupedGrowthFilmNarratives, growthFilmNarrative } from './growth-film-narrative'

type PhotoEvent = CycleHistoryEvent & { photo: PhotoEvidence }
type SafariFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}
type SafariFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}
const frameDurationMs = 5_600

export function GrowthFilmPage() {
  const { cycleId } = useParams()
  const [cycle, setCycle] = useState<GrowCycleDetail | null>(null)
  const [index, setIndex] = useState(0)
  const [previousIndex, setPreviousIndex] = useState<number | null>(null)
  const [queuedIndex, setQueuedIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [immersive, setImmersive] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [sources, setSources] = useState<Record<string, string>>({})
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ completed: number; total: number } | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const playerRef = useRef<HTMLElement>(null)
  const exportAbort = useRef<AbortController | null>(null)
  const load = useCallback(async () => { if (!cycleId) return; try { setCycle(await getCycle(cycleId)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo abrir Growth Film.') } }, [cycleId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async loader updates after remote cycle data settles.
  useEffect(() => { void load() }, [load])
  const photos = useMemo<PhotoEvent[]>(() => [...(cycle?.history ?? [])].filter((event): event is PhotoEvent => Boolean(event.photo?.upload_status === 'uploaded')).sort((a, b) => (a.photo.captured_at ?? a.occurred_at).localeCompare(b.photo.captured_at ?? b.occurred_at)), [cycle])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a newly resolved cycle must reset its local film queue.
  useEffect(() => { setSources({}); setIndex(0); setPreviousIndex(null); setQueuedIndex(null) }, [photos])
  const warm = useCallback((targetIndex: number) => {
    const event = photos[targetIndex]
    if (!event || sources[event.photo.id]) return
    void getSignedPhotoUrl(event.photo.storage_path, 'story').then((url) => {
      const image = new Image()
      image.decoding = 'async'
      image.src = url
      void image.decode?.().catch(() => undefined)
      setSources((current) => current[event.photo.id] ? current : { ...current, [event.photo.id]: url })
    }).catch(() => undefined)
  }, [photos, sources])
  useEffect(() => { nearbyFilmIndexes(photos.length, index).forEach(warm) }, [photos.length, index, warm])
  const show = useCallback((targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= photos.length || targetIndex === index) return
    const target = photos[targetIndex]
    if (!sources[target.photo.id]) { setQueuedIndex(targetIndex); warm(targetIndex); return }
    setPreviousIndex(index)
    setIndex(targetIndex)
  }, [index, photos, sources, warm])
  useEffect(() => {
    if (queuedIndex === null || !photos[queuedIndex] || !sources[photos[queuedIndex].photo.id] || queuedIndex === index) return
    const frame = window.requestAnimationFrame(() => {
      setPreviousIndex(index)
      setIndex(queuedIndex)
      setQueuedIndex(null)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [index, photos, queuedIndex, sources])
  const advance = useCallback(() => show(index >= photos.length - 1 ? 0 : index + 1), [index, photos.length, show])
  useEffect(() => { if (!playing || photos.length < 2) return undefined; const timer = window.setTimeout(advance, frameDurationMs); return () => window.clearTimeout(timer) }, [playing, index, advance, photos.length])
  const toggleImmersive = async () => {
    const player = playerRef.current
    if (!player) return
    const fullscreenDocument = document as SafariFullscreenDocument
    if (immersive) {
      try {
        if (fullscreenDocument.fullscreenElement) await fullscreenDocument.exitFullscreen?.()
        else if (fullscreenDocument.webkitFullscreenElement) await fullscreenDocument.webkitExitFullscreen?.()
      } catch {
        // The fixed immersive layout remains the reliable fallback when Safari rejects exit.
      }
      setImmersive(false)
      return
    }

    // Activate the viewport layout first. This keeps the control usable on Safari/iOS,
    // where arbitrary elements may not expose the standard Fullscreen API.
    setImmersive(true)
    const requestFullscreen = player.requestFullscreen ?? (player as SafariFullscreenElement).webkitRequestFullscreen
    if (!requestFullscreen) return
    try { await requestFullscreen.call(player) } catch {
      // Native fullscreen is optional; the CSS immersive view is already active.
    }
  }
  useEffect(() => {
    const sync = () => {
      const fullscreenDocument = document as SafariFullscreenDocument
      setImmersive(Boolean(fullscreenDocument.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement))
    }
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync(); media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])
  useEffect(() => {
    document.body.classList.toggle('growth-film-immersive-open', immersive)
    return () => { document.body.classList.remove('growth-film-immersive-open') }
  }, [immersive])
  useEffect(() => () => exportAbort.current?.abort(), [])
  const exportClip = async () => {
    if (exporting) return
    const frameEvents = selectFilmFrameIndexes(photos.length).map((frameIndex) => photos[frameIndex])
    setExporting(true); setExportError(null); setExportProgress({ completed: 0, total: frameEvents.length })
    const controller = new AbortController(); exportAbort.current = controller
    try {
      const urls = await Promise.all(frameEvents.map(async (event) => sources[event.photo.id] ?? getSignedPhotoUrl(event.photo.storage_path, 'story')))
      const video = await createPrivateGrowthFilm({ urls, signal: controller.signal, onProgress: (completed, total) => setExportProgress({ completed, total }) })
      downloadPrivateGrowthFilm(video.blob, video.mimeType, `garden-x-${cycle?.crop_name.toLowerCase().replace(/[^a-z0-9]+/gi, '-') ?? 'growth-film'}`)
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setExportError(reason instanceof Error ? reason.message : 'No se pudo crear el clip.')
    } finally { exportAbort.current = null; setExporting(false); setExportProgress(null) }
  }
  const current = photos[index]
  const prior = previousIndex === null ? null : photos[previousIndex]
  const currentUrl = current ? sources[current.photo.id] : null
  const priorUrl = prior ? sources[prior.photo.id] : null
  const currentNarrative = current ? growthFilmNarrative(current) : null
  const filmMilestones = useMemo(() => groupedGrowthFilmNarratives([...(cycle?.history.filter((event) => ['germination_observed', 'germination_confirmed', 'incident_opened', 'incident_resolved', 'intervention', 'harvest', 'cycle_ended', 'development_review', 'readiness_review', 'plant_count_observed', 'photo_evidence'].includes(event.event_type)) ?? [])].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))), [cycle])
  return <AppShell presentation="story" title={cycle ? `Growth Film · ${cycle.crop_name}` : 'Growth Film'} subtitle={cycle ? `${cycle.garden.name} · Pod ${cycle.position.position_number}` : 'Cargando evidencia'} backTo={cycle ? `/cycle/${cycle.id}` : '/'}>
    {!cycle && !error && <StatePanel kind="loading" title="Preparando Growth Film" />}{error && <StatePanel kind="error" title="No se pudo abrir Growth Film" onRetry={() => void load()}>{error}</StatePanel>}
    {cycle && <>
      <section className="growth-film-intro"><Sparkles size={20} aria-hidden="true" /><div><h2>El diario visual de tu {cycle.crop_name}</h2><p>Una secuencia de fotografías reales para recorrer su crecimiento, momento a momento.</p>{reducedMotion && <span className="growth-film-reduced-motion" role="status">Movimiento reducido activo</span>}</div></section>
      {photos.length === 0 ? <StatePanel kind="empty" title="Aún no hay fotografías confirmadas">Growth Film aparecerá cuando este ciclo tenga evidencia fotográfica.</StatePanel> : <section ref={playerRef} className={`growth-film-player${immersive ? ' growth-film-player--immersive' : ''}`} aria-label="Reproductor de Growth Film">
        <div className="growth-film-frame" aria-live="polite">
          {prior && priorUrl && <img className="growth-film-frame__layer growth-film-frame__layer--previous" src={priorUrl} alt="" aria-hidden="true" />}
          {currentUrl ? <img key={`current-${current.photo.id}`} className="growth-film-frame__layer growth-film-frame__layer--current" src={currentUrl} alt={`Fotografía documental: ${current.photo.original_filename}`} /> : <div className="growth-film-frame__loading">Preparando el siguiente momento…</div>}
          <div className="growth-film-frame__caption"><strong>{currentNarrative?.title ?? 'Un momento más en su historia.'}</strong><span>{currentNarrative?.detail ?? 'Fotografía real de este ciclo.'}</span><small>{captureLabel(current.photo)} · {String(index + 1).padStart(2, '0')} de {photos.length}</small></div>
        </div>
        <div className="growth-film-controls"><button className="icon-button" type="button" aria-label={immersive ? 'Salir de la vista inmersiva' : 'Abrir vista inmersiva'} title={immersive ? 'Salir de la vista inmersiva' : 'Abrir vista inmersiva'} onClick={() => void toggleImmersive()}>{immersive ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>{immersive && <button className="growth-film-close-immersive" type="button" onClick={() => void toggleImmersive()}><X size={16} aria-hidden="true" /> Salir</button>}<button className="secondary-button secondary-button--compact" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{playing ? 'Pausar' : 'Reproducir'}</button><input aria-label="Posición en Growth Film" type="range" min="0" max={photos.length - 1} value={index} onChange={(event) => { setPlaying(false); show(Number(event.target.value)) }} /><span>{index + 1}/{photos.length}</span></div>
        <ol className="growth-film-timeline">{photos.map((photo, photoIndex) => <li key={photo.id}><button type="button" className={photoIndex === index ? 'growth-film-timeline__point growth-film-timeline__point--active' : 'growth-film-timeline__point'} onClick={() => { setPlaying(false); show(photoIndex) }}><span>{String(photoIndex + 1).padStart(2, '0')}</span><small>{growthFilmNarrative(photo).title}</small></button></li>)}</ol>
      </section>}
      {photos.length >= 2 && <><div className="growth-film-actions"><button className="secondary-button secondary-button--compact" type="button" onClick={() => { setPlaying(false); show(index - 1) }}>Anterior</button><button className="secondary-button secondary-button--compact" type="button" onClick={() => { setPlaying(false); show(index + 1) }}>Siguiente</button><Link className="secondary-button secondary-button--compact" to={`/cycle/${cycle.id}/photos`} state={{ cycle, preselectedIds: [current.photo.id, photos[Math.min(index + 1, photos.length - 1)].photo.id] }}>Comparar estas fotos</Link></div><section className="growth-film-export"><div><span className="eyebrow">Clip privado</span><h2>Crear video de recuerdos</h2><p>Genera y descarga en este dispositivo un clip de hasta {GROWTH_FILM_MAX_EXPORT_FRAMES} momentos reales. No se sube ni se guarda en Garden X.</p></div><div className="growth-film-export__actions">{exporting ? <button className="secondary-button" type="button" onClick={() => exportAbort.current?.abort()}><X size={16} aria-hidden="true" /> Cancelar</button> : <button className="primary-button" type="button" onClick={() => void exportClip()}><Download size={16} aria-hidden="true" /> Crear clip</button>}{exportProgress && <span aria-live="polite">Preparando {exportProgress.completed}/{exportProgress.total}</span>}</div>{exportError && <p className="inline-message inline-message--error" role="alert">{exportError}</p>}</section></>}
      <section className="growth-film-milestones"><div className="section-heading"><h2>Momentos confirmados</h2><span>{filmMilestones.length + (cycle.planted_on ? 1 : 0)}</span></div><ul>{cycle.planted_on && <li><strong>Aquí comienza su historia.</strong><span>{cycle.crop_name} fue plantado.</span></li>}{filmMilestones.map((milestone) => <li key={milestone.id}><strong>{milestone.title}</strong>{milestone.count > 1 ? <span>{milestone.detail ?? 'Varios registros de seguimiento confirmados en este momento.'}</span> : milestone.detail && <span>{milestone.detail}</span>}</li>)}</ul></section>
      <Link className="text-link" to={`/cycle/${cycle.id}`}><ArrowLeft size={14} aria-hidden="true" /> Volver al historial</Link>
    </>}
  </AppShell>
}
