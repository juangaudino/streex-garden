import { useCallback, useEffect, useState } from 'react'
import { ChartNoAxesColumnIncreasing, ChevronRight, Link2, MapPin, Plus, SlidersHorizontal, Wrench } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { HarvestReadiness } from '../../components/HarvestReadiness'
import { StatePanel } from '../../components/StatePanel'
import type { GardenDetail, Position } from '../../domain/types'
import { getGarden, getGardenCoverPhotos, getOpenMaintenanceSession, startMaintenanceSession } from '../../lib/garden-api'
import { StartCycleForm } from './StartCycleForm'
import { GrowthRings } from '../../components/GrowthRings'
import { activeGrowPositionIds } from '../../domain/layout-config'
import { PlaceLink } from '../../components/PlaceLink'
import { PlaceIdentity } from '../../components/PlaceIdentity'
import { PhysicalMap } from './PhysicalMap'
import type { GardenCoverPhoto } from '../../domain/types'
import { GardenCoverImage, GardenCoverPicker } from './GardenCover'

function PositionHistory({ position }: { position: Position }) {
  const previous = position.previous_cycles
  const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : 'Fecha no registrada'
  if (previous.length === 0) return <div className="position-history" aria-label={`Historial de la posición ${position.position_number}`}><strong>Historia de la posición</strong><span>Aún no hay ciclos anteriores</span></div>
  return <details className="position-history" open><summary>Historia de la posición · {previous.length} ciclo{previous.length === 1 ? '' : 's'} anterior{previous.length === 1 ? '' : 'es'}</summary><div className="previous-cycles">{previous.map((cycle) => <Link key={cycle.id} to={`/cycle/${cycle.id}`}><strong>{cycle.crop_name}</strong><span>{formatDate(cycle.planted_on)} → {cycle.state === 'closed' ? formatDate(cycle.last_occupied_on) : 'Actual'}</span></Link>)}</div></details>
}

function PositionRow({ position, gardenId, onStart }: { position: Position; gardenId: string; onStart: (position: Position) => void }) {
  const history = <PositionHistory position={position} />
  if (!position.current_cycle) {
    return <article className="position-row position-row--empty">
      <span className="position-number position-number--ring"><GrowthRings />{String(position.position_number).padStart(2, '0')}</span>
      <div><h3>Posición {position.position_number}</h3><p>Sin ciclo activo</p>{history}</div>
      <button className="secondary-button secondary-button--compact" type="button" onClick={() => onStart(position)}><Plus size={16} aria-hidden="true" /> Iniciar</button>
    </article>
  }
  return <article className="position-row">
    <PlaceIdentity number={position.position_number} placeId={position.id} origin="row" />
    <div><h3>{position.current_cycle.crop_name}</h3><p>Posición {position.position_number}</p><HarvestReadiness value={position.current_cycle.harvest_readiness} /></div>
    <PlaceLink origin="row" place={{ placeId: position.id, number: position.position_number, gardenId, cropName: position.current_cycle.crop_name }} className="icon-button" aria-label={`Abrir ciclo de ${position.current_cycle.crop_name}`} to={`/cycle/${position.current_cycle.id}`}><ChevronRight aria-hidden="true" /></PlaceLink>
    {history}
  </article>
}

export function GardenPage() {
  const { gardenId } = useParams()
  const [garden, setGarden] = useState<GardenDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [startingAt, setStartingAt] = useState<Position | null>(null)
  const [startingMaintenance, setStartingMaintenance] = useState(false)
  const [openMaintenanceId, setOpenMaintenanceId] = useState<string | null>(null)
  const [coverPhotos, setCoverPhotos] = useState<GardenCoverPhoto[]>([])
  const navigate = useNavigate()
  const load = useCallback(async () => {
    if (!gardenId) return
    setError(null)
    try {
      const [nextGarden, openSession, nextCoverPhotos] = await Promise.all([getGarden(gardenId), getOpenMaintenanceSession(), getGardenCoverPhotos(gardenId)])
      setGarden(nextGarden); setOpenMaintenanceId(openSession?.id ?? null); setCoverPhotos(nextCoverPhotos)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cargar el jardín.') }
  }, [gardenId])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load writes only after the RPC settles.
  useEffect(() => { void load() }, [load])

  const startMaintenance = async () => {
    if (!garden || !navigator.onLine) return
    if (openMaintenanceId) { navigate(`/maintenance/${openMaintenanceId}`); return }
    setStartingMaintenance(true)
    try { const result = await startMaintenanceSession(crypto.randomUUID(), [garden.id]); navigate(`/maintenance/${result.session_id}`) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar mantenimiento.') } finally { setStartingMaintenance(false) }
  }
  const actions = <div className="garden-heading-actions"><Link className="secondary-button secondary-button--compact" to="/control"><ChartNoAxesColumnIncreasing size={16} aria-hidden="true" /> Control</Link><Link className="secondary-button secondary-button--compact" to={gardenId ? `/garden/${gardenId}/share` : '/'}><Link2 size={16} aria-hidden="true" /> Compartir</Link><Link className="secondary-button secondary-button--compact" to={gardenId ? `/garden/${gardenId}/system` : '/'}><SlidersHorizontal size={16} aria-hidden="true" /> Editar sistema</Link>{openMaintenanceId ? <Link className="secondary-button secondary-button--compact" to={`/maintenance/${openMaintenanceId}`}><Wrench size={16} aria-hidden="true" /> Continuar</Link> : <button className="secondary-button secondary-button--compact" disabled={startingMaintenance} type="button" onClick={() => void startMaintenance()}><Wrench size={16} aria-hidden="true" />{startingMaintenance ? 'Iniciando…' : 'Iniciar mantenimiento'}</button>}</div>
  const visibleGrowIds = garden ? activeGrowPositionIds(garden.layout_sites) : new Set<string>()
  const visiblePositions = garden?.positions.filter((position) => visibleGrowIds.has(position.id)) ?? []
  const hasConfirmedMap = garden?.map_layout === 'uruq_8_v1' || garden?.map_layout === 'uruq_12_v1'
  const coverPhoto = coverPhotos.find((photo) => photo.is_cover) ?? null
  return <AppShell title={garden?.name ?? 'Jardín'} subtitle={garden?.system_model ?? 'Sistema'} backTo="/" actions={actions}>
    {garden === null && !error && <StatePanel kind="loading" title="Cargando el jardín" />}
    {error && <StatePanel kind="error" title="No se pudo abrir el jardín" onRetry={() => void load()}>{error}</StatePanel>}
    {garden && <>
      {!hasConfirmedMap && <section className="provisional-note"><MapPin size={18} aria-hidden="true" /><div><strong>Mapa configurable</strong><p>La distribución puede ajustarse desde Editar sistema. Las posiciones se mantienen identificadas por su número.</p></div></section>}
      {startingAt && <StartCycleForm positionId={startingAt.id} positionNumber={startingAt.position_number} onCancel={() => setStartingAt(null)} onCreated={(cycleId) => navigate(`/cycle/${cycleId}`)} />}
      <figure className={`garden-environment${coverPhoto ? ' garden-environment--cover' : ' garden-environment--fallback'}`}>
        {coverPhoto ? <GardenCoverImage photo={coverPhoto} alt={`Portada de ${garden.name}`} rendition="hero" /> : <><GrowthRings /><span>{String(garden.position_capacity).padStart(2, '0')}</span></>}
        <figcaption><span>{coverPhoto ? 'Portada del jardín' : 'Sistema físico'}</span><strong>{garden.system_model} · {garden.position_capacity} posiciones</strong><GardenCoverPicker gardenId={garden.id} onChanged={load} /></figcaption>
      </figure>
      <PhysicalMap garden={garden} onStart={setStartingAt} />
      <section aria-labelledby="positions-title">
        <div className="section-heading"><h2 id="positions-title">Detalle de posiciones</h2><span>{visiblePositions.length}</span></div>
        <div className="position-list">{visiblePositions.map((position) => <PositionRow gardenId={garden.id} key={position.id} position={position} onStart={setStartingAt} />)}</div>
      </section>
    </>}
  </AppShell>
}
