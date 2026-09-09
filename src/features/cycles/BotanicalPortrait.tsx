import { Camera } from 'lucide-react'
import type { GrowCycleDetail } from '../../domain/types'
import { PlaceIdentity } from '../../components/PlaceIdentity'
import { HarvestReadiness } from '../../components/HarvestReadiness'
import { DocumentaryPhoto } from './DocumentaryPhoto'
import type { PlaceContext } from '../../components/PlaceLink'

export function BotanicalPortrait({ cycle, place, review = false }: { cycle?: GrowCycleDetail | null; place: PlaceContext; review?: boolean }) {
  const photo = cycle?.cover_photo ?? cycle?.history.find((event) => event.photo?.upload_status === 'uploaded')?.photo
  const planting = !cycle?.planted_on || cycle.planted_on_precision === 'unknown' ? 'Siembra: fecha desconocida' : `${cycle.planted_on_precision === 'approximate' ? 'Siembra aproximada' : 'Siembra'}: ${new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${cycle.planted_on}T12:00:00`))}`
  const Title = review ? 'h2' : 'h1'
  return <section className={`botanical-portrait ${photo || !cycle ? 'botanical-portrait--photo' : 'botanical-portrait--bare'}${review ? ' botanical-portrait--review' : ''}`} aria-busy={!cycle} aria-label={review ? 'Planta de la posición actual' : 'Perfil del cultivo'}>
    <div className="botanical-portrait__scene">{photo && <DocumentaryPhoto photo={photo} eager />}<PlaceIdentity placeId={place.placeId} number={place.number} origin={review ? 'review' : 'profile'} /></div>
    <div className="botanical-portrait__surface"><p className="botanical-portrait__eyebrow">{cycle?.garden.name ?? 'Cargando jardín'} · Posición {place.number}</p><Title tabIndex={-1}>{cycle?.crop_name ?? place.cropName}</Title>
      {cycle ? <><div className="botanical-portrait__metadata"><span>{planting}</span><HarvestReadiness value={cycle.harvest_readiness} /></div>{!photo && <p className="botanical-portrait__absence">Todavía sin fotografía documental</p>}</> : <p className="botanical-portrait__absence" role="status">Cargando evidencia del ciclo…</p>}
      {!review && cycle?.state === 'active' && <button className="portrait-photo-action" onClick={() => {
        const composer = document.getElementById('cycle-observation')
        composer?.scrollIntoView({ block: 'start', behavior: 'instant' })
        composer?.querySelector<HTMLElement>('textarea,button,input')?.focus({ preventScroll: true })
      }}><Camera size={16} aria-hidden="true" />{photo ? 'Registrar fotografía' : 'Añadir primera fotografía'}</button>}
    </div>
  </section>
}
