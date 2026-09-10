import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Pause, Play, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import type { CycleHistoryEvent, GrowCycleDetail, PhotoEvidence } from '../../domain/types'
import { getCycle } from '../../lib/garden-api'
import { DocumentaryPhoto } from './DocumentaryPhoto'
import { buildPlantStoryMilestones } from './plant-story'
import { captureLabel } from './photo-presentation'

type PhotoEvent = CycleHistoryEvent & { photo: PhotoEvidence }

export function GrowthFilmPage() {
  const { cycleId } = useParams()
  const [cycle, setCycle] = useState<GrowCycleDetail | null>(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { if (!cycleId) return; try { setCycle(await getCycle(cycleId)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo abrir Growth Film.') } }, [cycleId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the async loader writes after the cycle RPC settles.
  useEffect(() => { void load() }, [load])
  const photos = useMemo<PhotoEvent[]>(() => [...(cycle?.history ?? [])].filter((event): event is PhotoEvent => Boolean(event.photo?.upload_status === 'uploaded')).sort((a, b) => (a.photo.captured_at ?? a.occurred_at).localeCompare(b.photo.captured_at ?? b.occurred_at)), [cycle])
  useEffect(() => { if (!playing || photos.length < 2) return undefined; const timer = window.setInterval(() => setIndex((current) => current >= photos.length - 1 ? 0 : current + 1), 3200); return () => window.clearInterval(timer) }, [playing, photos.length])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp follows an external cycle/photo list change.
  useEffect(() => { setIndex((current) => Math.min(current, Math.max(photos.length - 1, 0))) }, [photos.length])
  return <AppShell presentation="story" title={cycle ? `Growth Film · ${cycle.crop_name}` : 'Growth Film'} subtitle={cycle ? `${cycle.garden.name} · Pod ${cycle.position.position_number}` : 'Cargando evidencia'} backTo={cycle ? `/cycle/${cycle.id}` : '/'}>
    {!cycle && !error && <StatePanel kind="loading" title="Preparando Growth Film" />}{error && <StatePanel kind="error" title="No se pudo abrir Growth Film" onRetry={() => void load()}>{error}</StatePanel>}
    {cycle && <>
      <section className="growth-film-intro"><Sparkles size={20} aria-hidden="true" /><div><h2>La evolución real de este ciclo</h2><p>Fotos y hitos confirmados, ordenados por su fecha de captura cuando existe. No se generan imágenes ni etapas intermedias.</p></div></section>
      {photos.length === 0 ? <StatePanel kind="empty" title="Aún no hay fotografías confirmadas">Growth Film aparecerá cuando este ciclo tenga evidencia fotográfica.</StatePanel> : <section className="growth-film-player" aria-label="Reproductor de Growth Film"><div className="growth-film-frame"><DocumentaryPhoto photo={photos[index].photo} eager expandable caption={false} rendition="story" /><div className="growth-film-frame__caption"><strong>{String(index + 1).padStart(2, '0')} · {captureLabel(photos[index].photo)}</strong><span>{photos[index].note ?? 'Evidencia fotográfica del ciclo.'}</span></div></div><div className="growth-film-controls"><button className="secondary-button secondary-button--compact" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{playing ? 'Pausar' : 'Auto Play'}</button><input aria-label="Posición en Growth Film" type="range" min="0" max={photos.length - 1} value={index} onChange={(event) => { setPlaying(false); setIndex(Number(event.target.value)) }} /><span>{index + 1}/{photos.length}</span></div><ol className="growth-film-timeline">{photos.map((photo, photoIndex) => <li key={photo.id}><button type="button" className={photoIndex === index ? 'growth-film-timeline__point growth-film-timeline__point--active' : 'growth-film-timeline__point'} onClick={() => { setPlaying(false); setIndex(photoIndex) }}><span>{String(photoIndex + 1).padStart(2, '0')}</span><small>{captureLabel(photo.photo)}</small></button></li>)}</ol></section>}
      {photos.length >= 2 && <div className="growth-film-actions"><Link className="secondary-button secondary-button--compact" to={`/cycle/${cycle.id}/photos`} state={{ cycle, preselectedIds: [photos[index].photo.id, photos[photos.length - 1].photo.id] }}>Comparar con la foto más reciente</Link></div>}
      <section className="growth-film-milestones"><div className="section-heading"><h2>Hitos confirmados</h2><span>{buildPlantStoryMilestones(cycle).length}</span></div><ul>{buildPlantStoryMilestones(cycle).map((milestone) => <li key={milestone.id}><strong>{milestone.label}</strong>{milestone.note && <span>{milestone.note}</span>}</li>)}</ul></section>
      <Link className="text-link" to={`/cycle/${cycle.id}`}><ArrowLeft size={14} aria-hidden="true" /> Volver al historial</Link>
    </>}
  </AppShell>
}
