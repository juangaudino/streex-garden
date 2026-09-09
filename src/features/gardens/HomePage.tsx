import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, Clock3, Sprout } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { GrowthRings } from '../../components/GrowthRings'
import { StatePanel } from '../../components/StatePanel'
import type { HomeDashboard } from '../../domain/types'
import { getHome, getHomeDashboard } from '../../lib/garden-api'
import { GardenCoverImage } from './GardenCover'
import { AttentionList } from './GardensPage'

export function HomePage({ user }: { user: User }) {
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setError(null)
    try {
      const [next, summaries] = await Promise.all([getHomeDashboard(null), getHome()])
      const coverByGarden = new Map(summaries.map((garden) => [garden.id, garden.cover_photo ?? null]))
      next.gardens = next.gardens.map((garden) => ({ ...garden, cover_photo: coverByGarden.get(garden.id) ?? null }))
      setDashboard(next)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo abrir Home.') }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- only writes after the remote dashboard settles.
  useEffect(() => { void load() }, [load])
  const gardens = dashboard?.gardens ?? []
  return <AppShell>
    <section className="home-hero"><GrowthRings /><p>Garden X</p><h1>Tu jardín, vivo.</h1><span>{user.email ?? 'Tu espacio privado'}</span><Link className="primary-button" to="/gardens">Ver jardines <ArrowRight size={17} aria-hidden="true" /></Link></section>
    {!dashboard && !error && <StatePanel kind="loading" title="Preparando Home" />}
    {error && <StatePanel kind="error" title="No se pudo abrir Home" onRetry={() => void load()}>{error}</StatePanel>}
    {dashboard && <>
      <section className="home-scene" aria-labelledby="home-gardens"><div className="section-heading"><h2 id="home-gardens">Tus jardines</h2><Link className="text-link" to="/gardens">Ver todos <ArrowRight size={15} aria-hidden="true" /></Link></div><div className="home-scene__gardens">{gardens.map((garden, index) => <Link to={`/garden/${garden.id}`} key={garden.id} className="home-scene__garden">{garden.cover_photo && <GardenCoverImage photo={garden.cover_photo} alt="" />}<div><span>{String(index + 1).padStart(2, '0')}</span><strong>{garden.name}</strong><small>{garden.active_positions} activas · {garden.position_capacity} posiciones</small></div></Link>)}</div></section>
      <section className="home-summary-grid"><div><div className="section-heading"><h2>Desde la última vez</h2><Clock3 size={17} aria-hidden="true" /></div>{dashboard.since_last_time.changes.length > 0 ? <div className="home-change-list">{dashboard.since_last_time.changes.slice(0, 3).map((change) => <Link className="home-change" key={change.cursor} to={change.grow_cycle_id ? `/cycle/${change.grow_cycle_id}` : change.garden_id ? `/garden/${change.garden_id}` : '/gardens'}><strong>{change.summary}</strong><ArrowRight size={16} aria-hidden="true" /></Link>)}</div> : <p className="quiet-copy">No hay novedades confirmadas desde tu última visita.</p>}</div>
        <div><div className="section-heading"><h2>Para hoy</h2><Sprout size={17} aria-hidden="true" /></div><AttentionList compact items={dashboard.attention.items} />{dashboard.attention.items.length > 0 && <Link className="text-link" to="/today">Ver pendientes <ArrowRight size={15} aria-hidden="true" /></Link>}</div></section>
    </>}
  </AppShell>
}
