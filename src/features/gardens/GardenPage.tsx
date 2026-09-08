import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, MapPin, Plus, SlidersHorizontal, Wrench } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { HarvestReadiness } from '../../components/HarvestReadiness'
import { StatePanel } from '../../components/StatePanel'
import type { GardenDetail, Position } from '../../domain/types'
import { getGarden, getOpenMaintenanceSession, startMaintenanceSession } from '../../lib/garden-api'
import { StartCycleForm } from './StartCycleForm'
import { GrowthRings } from '../../components/GrowthRings'
import { activeGrowPositionIds } from '../../domain/layout-config'
import { PhysicalMap } from './PhysicalMap'

function PositionRow({ position, onStart }: { position: Position; onStart: (position: Position) => void }) {
  const history = <div className="position-history" aria-label={`Historial de la posición ${position.position_number}`}><strong>Historial de esta posición</strong>{position.previous_cycles.length > 0 ? <div className="previous-cycles">{position.previous_cycles.map((cycle) => <Link key={cycle.id} to={`/cycle/${cycle.id}`}>Ver {cycle.crop_name}</Link>)}</div> : <span>Aún no hay ciclos anteriores</span>}</div>
  if (!position.current_cycle) {
    return <article className="position-row position-row--empty">
      <span className="position-number position-number--ring"><GrowthRings />{String(position.position_number).padStart(2, '0')}</span>
      <div><h3>Posición {position.position_number}</h3><p>Sin ciclo activo</p>{history}</div>
      <button className="secondary-button secondary-button--compact" type="button" onClick={() => onStart(position)}><Plus size={16} aria-hidden="true" /> Iniciar</button>
    </article>
  }
  return <article className="position-row">
    <span className="position-number position-number--ring"><GrowthRings />{String(position.position_number).padStart(2, '0')}</span>
    <div><h3>{position.current_cycle.crop_name}</h3><p>Posición {position.position_number}</p><HarvestReadiness value={position.current_cycle.harvest_readiness} /></div>
    <Link className="icon-button" aria-label={`Abrir ciclo de ${position.current_cycle.crop_name}`} to={`/cycle/${position.current_cycle.id}`}><ChevronRight aria-hidden="true" /></Link>
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
  const navigate = useNavigate()
  const load = useCallback(async () => {
    if (!gardenId) return
    setError(null)
    try {
      const [nextGarden, openSession] = await Promise.all([getGarden(gardenId), getOpenMaintenanceSession()])
      setGarden(nextGarden); setOpenMaintenanceId(openSession?.id ?? null)
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
  const actions = <div className="garden-heading-actions"><Link className="secondary-button secondary-button--compact" to={gardenId ? `/garden/${gardenId}/system` : '/'}><SlidersHorizontal size={16} aria-hidden="true" /> Editar sistema</Link>{openMaintenanceId ? <Link className="secondary-button secondary-button--compact" to={`/maintenance/${openMaintenanceId}`}><Wrench size={16} aria-hidden="true" /> Reanudar</Link> : <button className="secondary-button secondary-button--compact" disabled={startingMaintenance} type="button" onClick={() => void startMaintenance()}><Wrench size={16} aria-hidden="true" />{startingMaintenance ? 'Iniciando…' : 'Mantenimiento'}</button>}</div>
  const visibleGrowIds = garden ? activeGrowPositionIds(garden.layout_sites) : new Set<string>()
  const visiblePositions = garden?.positions.filter((position) => visibleGrowIds.has(position.id)) ?? []
  const hasConfirmedMap = garden?.map_layout === 'uruq_8_v1' || garden?.map_layout === 'uruq_12_v1'
  return <AppShell title={garden?.name ?? 'Jardín'} subtitle={garden?.system_model ?? 'Sistema'} backTo="/" actions={actions}>
    {garden === null && !error && <StatePanel kind="loading" title="Cargando el jardín" />}
    {error && <StatePanel kind="error" title="No se pudo abrir el jardín" onRetry={() => void load()}>{error}</StatePanel>}
    {garden && <>
      <section className="garden-editorial-hero" aria-label={`${garden.name}, ${garden.position_capacity} posiciones`}><GrowthRings /><p className="garden-editorial-hero__eyebrow">Sistema hidroponico</p><span>{String(garden.position_capacity).padStart(2, '0')}</span><div><h2>{garden.name}</h2><p>{garden.system_model ?? 'Sistema sin especificar'} · {hasConfirmedMap ? 'Mapa físico confirmado' : 'Mapa configurable'}</p></div></section>
      {!hasConfirmedMap && <section className="provisional-note"><MapPin size={18} aria-hidden="true" /><div><strong>Mapa configurable</strong><p>La distribución puede ajustarse desde Editar sistema. Las posiciones se mantienen identificadas por su número.</p></div></section>}
      {startingAt && <StartCycleForm positionId={startingAt.id} positionNumber={startingAt.position_number} onCancel={() => setStartingAt(null)} onCreated={(cycleId) => navigate(`/cycle/${cycleId}`)} />}
      <PhysicalMap garden={garden} onStart={setStartingAt} />
      <section aria-labelledby="positions-title">
        <div className="section-heading"><h2 id="positions-title">Detalle de posiciones</h2><span>{visiblePositions.length}</span></div>
        <div className="position-list">{visiblePositions.map((position) => <PositionRow key={position.id} position={position} onStart={setStartingAt} />)}</div>
      </section>
    </>}
  </AppShell>
}
