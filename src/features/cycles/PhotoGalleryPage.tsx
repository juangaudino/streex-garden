import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ImageOff, Film } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import { canCompare, toggleComparedPhoto } from '../../domain/photo-comparison'
import type { CycleHistoryEvent, GrowCycleDetail, PhotoEvidence } from '../../domain/types'
import { DocumentaryPhoto } from './DocumentaryPhoto'
import { captureLabel, recordLabel, storyInterval } from './photo-presentation'
import { getCycle, getSignedPhotoUrl } from '../../lib/garden-api'
import { PhotoCoverActions } from './PhotoCoverActions'
import { buildPlantStoryMilestones } from './plant-story'
import { AiCheckPanel } from './AiCheckPanel'

type PhotoEvent = CycleHistoryEvent & { photo: PhotoEvidence }

const evidenceDate = captureLabel
const recordedDate = recordLabel

function PhotoTile({ event, selected, disabled, onToggle }: { event: PhotoEvent; selected: boolean; disabled: boolean; onToggle: () => void }) {
  return <article className={`gallery-tile${selected ? ' gallery-tile--selected' : ''}`}>
    <button type="button" className="gallery-tile__button" aria-label={`Seleccionar ${event.photo.original_filename}, registro ${recordedDate(event)}, para comparar`} aria-pressed={selected} disabled={disabled} onClick={onToggle}>
      <DocumentaryPhoto photo={event.photo} caption={false} rendition="thumbnail" />
      {selected && <span className="gallery-tile__selected"><Check size={16} aria-hidden="true" /> Seleccionada</span>}
    </button>
    <div className="gallery-tile__meta"><strong>{evidenceDate(event.photo)}</strong><span>Registrada: {recordedDate(event)}</span><span>{event.photo.original_filename} · {event.photo.content_type.replace('image/', '').toUpperCase()}</span></div>
  </article>
}

function ComparisonPhoto({ event }: { event: PhotoEvent }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void getSignedPhotoUrl(event.photo.storage_path).then((nextUrl) => { if (active) setUrl(nextUrl) }).catch(() => { if (active) setError('Original no disponible.') })
    return () => { active = false }
  }, [event.photo.storage_path])

  return <figure className="comparison-photo"><figcaption><strong>{evidenceDate(event.photo)}</strong><span>Registrada: {recordedDate(event)}</span><span>{event.photo.original_filename}</span></figcaption>{url && <img src={url} alt={`Comparación: ${event.photo.original_filename}`} />}{!url && <div className="comparison-photo__unavailable"><ImageOff size={22} aria-hidden="true" />{error ?? 'Abriendo original…'}</div>}</figure>
}

export function PhotoGalleryPage() {
  const { cycleId } = useParams()
  const location = useLocation()
  const locationState = location.state as { cycle?: GrowCycleDetail; preselectedIds?: string[] } | null
  const initialCycle = locationState?.cycle
  return <PhotoGalleryScreen key={cycleId} initialCycle={initialCycle && initialCycle.id === cycleId ? initialCycle : null} preselectedIds={locationState?.preselectedIds} />
}

function PhotoGalleryScreen({ initialCycle, preselectedIds = [] }: { initialCycle: GrowCycleDetail | null; preselectedIds?: string[] }) {
  const { cycleId } = useParams()
  const [cycle, setCycle] = useState<GrowCycleDetail | null>(initialCycle)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>(preselectedIds.slice(0, 2))
  const [showComparison, setShowComparison] = useState(false)
  const [coverMessage, setCoverMessage] = useState<string | null>(null)
  const comparison = useRef<HTMLElement>(null)
  useEffect(() => {
    if (showComparison) {
      comparison.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
      comparison.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    }
  }, [showComparison])
  const load = useCallback(async () => {
    if (!cycleId) return
    setError(null)
    try { setCycle(await getCycle(cycleId)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo abrir la galería.') }
  }, [cycleId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the async loader writes after the remote RPC settles.
  useEffect(() => { void load() }, [load])

  const photos = (cycle?.history ?? []).filter((event): event is PhotoEvent => event.photo?.upload_status === 'uploaded')
  const selected = photos.filter((event) => selectedIds.includes(event.photo.id))
  const toggle = (photoId: string) => {
    setSelectedIds((current) => toggleComparedPhoto(current, photoId))
    setShowComparison(false)
  }

  return <AppShell presentation="story" title={cycle ? `La historia de tu ${cycle.crop_name}` : 'Historia fotográfica'} subtitle={cycle ? `${cycle.crop_name} · ${cycle.garden.name} · Posición ${cycle.position.position_number}` : 'Cargando evidencia'} backTo={cycle ? `/cycle/${cycle.id}` : '/'}>
    {!cycle && !error && <StatePanel kind="loading" title="Abriendo galería" />}
    {error && <StatePanel kind="error" title="No se pudo abrir la galería" onRetry={() => void load()}>{error}</StatePanel>}
    {cycle && <>
      <section className="plant-story-milestones" aria-labelledby="plant-story-milestones-title"><div className="section-heading"><div><span className="eyebrow">Historia de la planta</span><h2 id="plant-story-milestones-title">Momentos importantes</h2></div><span>{buildPlantStoryMilestones(cycle).length}</span></div><ol>{buildPlantStoryMilestones(cycle).map((milestone) => <li key={milestone.id}><time>{milestone.date ? new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${milestone.date.slice(0, 10)}T12:00:00`)) : 'Fecha no registrada'}</time><strong>{milestone.label}</strong>{milestone.note && <p>{milestone.note}</p>}</li>)}</ol></section>
      <section className="photo-story" aria-label="Recorrido fotográfico"><div className="story-toolbar"><div><p className="story-interval">{storyInterval(photos)}</p><p className="quiet-copy">Un mismo ciclo, a través de tus fotografías.</p></div><Link className="secondary-button secondary-button--compact" to={`/cycle/${cycle.id}/film`}><Film size={15} aria-hidden="true" /> Growth Film</Link></div>{coverMessage && <p className="inline-message" role="status">{coverMessage}</p>}
        {photos.length > 0 && <ol className="photo-story__rail">{[...photos].reverse().map((event, index) => <li key={event.id}><div className="photo-story__date"><span>{String(index + 1).padStart(2, '0')}</span><time dateTime={event.occurred_at_precision === 'date' ? event.occurred_on ?? event.occurred_at : event.occurred_at}>{recordedDate(event)}</time></div><DocumentaryPhoto photo={event.photo} eager={index === 0} expandable rendition="story" actions={<PhotoCoverActions gardenId={cycle.garden.id} cycleId={cycle.id} photoId={event.photo.id} onMessage={setCoverMessage} />} />{event.note && <p>{event.note}</p>}</li>)}</ol>}
      </section>
      <section className="photo-comparison" aria-label="Comparar dos momentos"><div className="story-comparison-intro"><h2>Comparar dos momentos</h2><p>Selecciona exactamente dos originales confirmados del recorrido.</p></div>
      {photos.length < 2 && <StatePanel kind="empty" title={photos.length === 1 ? 'Una fotografía, el comienzo de su historia' : 'Todavía sin fotografías confirmadas'}>La comparación estará disponible cuando haya dos originales confirmados. Las fotos pendientes de subir no se usan para comparar.</StatePanel>}
      {photos.length >= 2 && <><div className="comparison-actions"><span>{selectedIds.length}/2 seleccionadas</span><button className="primary-button" type="button" disabled={!canCompare(selectedIds)} onClick={() => setShowComparison(true)}>Comparar fotos</button></div><div className="gallery-grid">{photos.map((event) => <PhotoTile key={event.photo.id} event={event} selected={selectedIds.includes(event.photo.id)} disabled={!selectedIds.includes(event.photo.id) && selectedIds.length >= 2} onToggle={() => toggle(event.photo.id)} />)}</div></>}
      {showComparison && selected.length === 2 && <section className="comparison-section" ref={comparison} aria-labelledby="comparison-title"><div className="section-heading"><h2 id="comparison-title" tabIndex={-1}>Comparación</h2><span>Mismo ciclo · {cycle.crop_name}</span></div><p className="quiet-copy">Las fotos pertenecen al mismo ciclo. Esta vista no infiere crecimiento ni modifica los originales.</p><div className="comparison-grid"><ComparisonPhoto key={selected[0].photo.id} event={selected[0]} /><ComparisonPhoto key={selected[1].photo.id} event={selected[1]} /></div></section>}
      {selected.length === 2 && <AiCheckPanel key={selected.map((event) => event.photo.id).join(':')} cycle={cycle} photoId={selected[0].photo.id} comparePhotoId={selected[1].photo.id} title="Analizar esta comparación" />}
      </section>
      <Link className="text-link" to={`/cycle/${cycle.id}`}>Volver al historial de {cycle.crop_name}</Link>
    </>}
  </AppShell>
}
