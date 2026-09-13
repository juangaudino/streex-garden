import { ArrowRight, Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { GardenSummary } from '../../domain/types'
import { GardenCoverImage } from './GardenCover'
import '../../components/botanical/botanical.css'

/** Presentation only: the selected cover, identity and occupancy remain canonical. */
export function BotanicalGardenCard({ garden, showSystem = false }: { garden: GardenSummary; showSystem?: boolean }) {
  return <Link className="bc-garden-card" to={`/garden/${garden.id}`}>
    <div className={`bc-garden-card__photo${garden.cover_photo ? '' : ' bc-garden-card__photo--empty'}`} aria-hidden="true">
      {garden.cover_photo ? <GardenCoverImage photo={garden.cover_photo} alt="" /> : <Leaf size={30} />}
    </div>
    <div className="bc-garden-card__copy">
      <h3>{garden.name}</h3>
      {showSystem && <p className="bc-garden-card__system">{garden.system_model ?? 'Sistema sin especificar'}</p>}
      <p className="bc-garden-card__occupancy">{garden.active_positions} activas · {garden.position_capacity} posiciones</p>
      <span className="bc-garden-card__link">Abrir jardín <ArrowRight size={16} aria-hidden="true" /></span>
    </div>
  </Link>
}
