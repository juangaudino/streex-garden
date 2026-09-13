import { useState } from 'react'
import { ChevronRight, ImagePlus, Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BotanicalButton } from '../../components/botanical/BotanicalControls'
import type { CycleHistoryEvent, GrowCycleDetail } from '../../domain/types'
import { eventDetail, eventLabel } from '../../domain/event-presentation'
import { DocumentaryPhoto } from './DocumentaryPhoto'
import { plantPhotos } from './plant-presentation'
import { recordLabel, captureLabel } from './photo-presentation'

export function PlantHistory({ cycle, onRecord, onEvent }: {
  cycle: GrowCycleDetail; onRecord: () => void; onEvent: (event: CycleHistoryEvent) => void
}) {
  const [limit, setLimit] = useState(10)
  const photos = plantPhotos(cycle)
  return <div className="journal">
    <div className="journal-heading"><div><span className="bs-eyebrow">EL DIARIO DE TU PLANTA</span><h2>Los momentos que quedan.</h2></div>{cycle.state === 'active' && <BotanicalButton secondary onClick={onRecord}><ImagePlus size={18} />Añadir</BotanicalButton>}</div>
    {photos.length > 0 && <div className="journal-photo-strip">{photos.slice(0, 4).map(photo => <DocumentaryPhoto key={photo.id} photo={photo} expandable rendition="thumbnail" />)}</div>}
    <Link className="bs-text-button" to={`/cycle/${cycle.id}/photos`} state={{ cycle }}>Abrir historia fotográfica y comparar <ChevronRight size={16} /></Link>
    {cycle.history.length === 0 && <p className="plant-empty">Su primer momento empieza contigo. Una foto o una nota puede comenzar este diario.</p>}
    <div className="timeline">{cycle.history.slice(0, limit).map(event => <button type="button" key={event.id} onClick={() => onEvent(event)}>
      <span className="timeline-marker"><Leaf size={16} /></span><div><small><time dateTime={event.occurred_at_precision === 'date' ? event.occurred_on ?? event.occurred_at : event.occurred_at}>{recordLabel(event)}</time></small><strong>{eventLabel(event)}</strong>{event.note && <p>{event.note}</p>}{eventDetail(event) && <p>{eventDetail(event)}</p>}{event.photo && <p>{captureLabel(event.photo)}{event.photo.upload_status !== 'uploaded' ? ' · Pendiente de subir' : ''}</p>}</div><ChevronRight size={17} />
    </button>)}</div>
    {cycle.history.length > 10 && <div className="history-more">{limit < cycle.history.length && <BotanicalButton secondary onClick={() => setLimit(current => Math.min(current + 10, cycle.history.length))}>Ver {Math.min(10, cycle.history.length - limit)} más</BotanicalButton>}{limit > 10 && <button className="bs-text-button" type="button" onClick={() => setLimit(10)}>Mostrar menos</button>}</div>}
    {cycle.corrections.length > 0 && <section className="plant-corrections"><h3>Correcciones conservadas</h3>{cycle.corrections.map(correction => <article key={correction.id}><strong>{correction.operation}</strong><p>{correction.reason}</p><time dateTime={correction.created_at}>{new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(correction.created_at))}</time></article>)}</section>}
  </div>
}
