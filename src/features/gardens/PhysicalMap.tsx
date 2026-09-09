import { ChevronRight, Droplets, Plus } from 'lucide-react'
import { PlaceLink } from '../../components/PlaceLink'
import { PlaceIdentity } from '../../components/PlaceIdentity'
import type { CSSProperties } from 'react'
import type { GardenDetail, PhysicalSite, Position } from '../../domain/types'
import { activeGrowPositionIds, MAP_GRID_COLUMNS, siteLabel } from '../../domain/layout-config'
import { GrowthRings } from '../../components/GrowthRings'
import { GardenCoverImage } from './GardenCover'

function sitePosition(site: PhysicalSite, positions: Position[]): Position | null {
  return positions.find((position) => position.id === site.position_id) ?? null
}

function positionStyle(site: PhysicalSite): CSSProperties {
  return { gridColumn: `${site.grid_x} / span 2`, gridRow: site.grid_y }
}

export function PhysicalMap({ garden, onStart, editable = false, onSelectSite }: {
  garden: GardenDetail
  onStart?: (position: Position) => void
  editable?: boolean
  onSelectSite?: (site: PhysicalSite) => void
}) {
  const activeSites = garden.layout_sites.filter((site) => site.is_active)
  const positionsBySite = new Map(activeSites.map((site) => [site.id, sitePosition(site, garden.positions)]))
  const growIds = activeGrowPositionIds(garden.layout_sites)
  const mapRows = Math.max(1, ...activeSites.map((site) => site.grid_y))

  return <section className="physical-map-section" aria-labelledby="physical-map-title">
    <div className="section-heading"><div><h2 id="physical-map-title">Mapa del sistema</h2><p className="quiet-copy">Parte trasera arriba · frente abajo</p></div><span>{growIds.size} cultivos</span></div>
    <div className="physical-map" style={{ '--map-columns': MAP_GRID_COLUMNS, '--map-rows': mapRows } as CSSProperties} aria-label={`Mapa físico de ${garden.name}`}>
      <GrowthRings className="physical-map__rings" />
      <span className="physical-map__edge physical-map__edge--back">Parte trasera</span>
      <span className="physical-map__edge physical-map__edge--front">Frente</span>
      {activeSites.map((site) => {
        const position = positionsBySite.get(site.id) ?? null
        const label = siteLabel(site)
        if (site.site_kind === 'utility') {
          const utilityContent = <><Droplets size={17} aria-hidden="true" /><span>{label}</span></>
          if (!onSelectSite) return <article className="map-site map-site--utility" key={site.id} style={positionStyle(site)} aria-label={`${label}, elemento técnico`}>
            {utilityContent}
          </article>
          return <button className="map-site map-site--utility" type="button" key={site.id} style={positionStyle(site)} onClick={() => onSelectSite(site)} aria-label={`${label}, elemento técnico`}>
            <Droplets size={17} aria-hidden="true" /><span>{label}</span>
          </button>
        }
        if (!position) return null
        if (position.current_cycle) {
          return <PlaceLink place={{ placeId: position.id, number: position.position_number, gardenId: garden.id, cropName: position.current_cycle.crop_name }} className="map-site map-site--occupied" key={site.id} style={positionStyle(site)} to={`/cycle/${position.current_cycle.id}`} aria-label={`Abrir ${position.current_cycle.crop_name}, posición ${position.position_number}`}>
            {position.current_cycle.photo && <GardenCoverImage photo={position.current_cycle.photo} alt="" className="map-site__photo" />}
            <PlaceIdentity number={position.position_number} placeId={position.id} origin="map" /><strong>{position.current_cycle.crop_name}</strong><ChevronRight size={16} aria-hidden="true" />
          </PlaceLink>
        }
        return <button className="map-site map-site--empty" type="button" key={site.id} style={positionStyle(site)} onClick={() => onStart?.(position)} aria-label={`Iniciar cultivo en posición ${position.position_number}`}>
          <span className="map-site__number">{String(position.position_number).padStart(2, '0')}</span><span>Vacía</span><Plus size={15} aria-hidden="true" />
        </button>
      })}
    </div>
    {editable && <p className="quiet-copy physical-map__edit-hint">Toca un elemento técnico para editarlo. El editor permite mover puntos y añadir espacios nuevos.</p>}
  </section>
}
