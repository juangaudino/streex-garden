import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, Clock3, Sprout } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import type { HomeDashboard, PhotoEvidence } from '../../domain/types'
import { getGardenCoverPhotos, getHome, getHomeDashboard, getHomeMedia } from '../../lib/garden-api'
import { GardenCoverImage } from './GardenCover'
import { AttentionList } from './AttentionList'
import { BotanicalGardenCard } from './BotanicalGardenCard'

export function HomePage({ user }: { user: User }) {
  void user
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [heroPhoto, setHeroPhoto] = useState<PhotoEvidence | null>(null)
  const [headline, setHeadline] = useState('Tu jardín, vivo.')
  const load = useCallback(async () => {
    setError(null)
    try {
      const [next, summaries, media] = await Promise.all([getHomeDashboard(null), getHome(), getHomeMedia()])
      const coverByGarden = new Map(summaries.map((garden) => [garden.id, garden.cover_photo ?? null]))
      next.gardens = next.gardens.map((garden) => ({ ...garden, cover_photo: coverByGarden.get(garden.id) ?? null }))
      await Promise.all(summaries.map((garden) => getGardenCoverPhotos(garden.id)))
      setDashboard(next)
      setHeroPhoto(media.home_hero_photo); setHeadline(media.home_headline ?? 'Tu jardín, vivo.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo abrir Home.') }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- only writes after the remote dashboard settles.
  useEffect(() => { void load() }, [load])
  const gardens = dashboard?.gardens ?? []
  return <AppShell presentation="collection-home">
    <section className={`home-hero bc-home-hero${heroPhoto ? ' home-hero--photo' : ''}`} aria-labelledby="home-title">
      {heroPhoto && <GardenCoverImage photo={heroPhoto} alt="" className="home-hero__photo" rendition="hero" />}
      <div className="bc-home-hero__copy"><p className="bs-eyebrow">Garden X</p><h1 id="home-title">{headline}</h1><Link className="primary-button" to="/gardens">Ver jardines <ArrowRight size={17} aria-hidden="true" /></Link></div>
    </section>
    {!dashboard && !error && <StatePanel kind="loading" title="Preparando Home" />}
    {error && <StatePanel kind="error" title="No se pudo abrir Home" onRetry={() => void load()}>{error}</StatePanel>}
    {dashboard && <>
      <section className="bc-section" aria-labelledby="home-gardens"><div className="section-heading"><h2 id="home-gardens">Tus jardines</h2><Link className="text-link" to="/gardens">Ver todos <ArrowRight size={15} aria-hidden="true" /></Link></div>
        {gardens.length > 0 ? <div className="bc-garden-grid">{gardens.map(garden => <BotanicalGardenCard key={garden.id} garden={garden} />)}</div> : <div className="bc-catalog-empty"><StatePanel kind="empty" title="Tu jardín empieza aquí">Configura tu primer sistema para empezar a registrar su historia.</StatePanel><Link className="secondary-button" to="/gardens">Ver jardines <ArrowRight size={16} aria-hidden="true" /></Link></div>}
      </section>
      <div className="bc-summary-grid"><section className="bc-section" aria-labelledby="home-changes"><div className="section-heading"><h2 id="home-changes">Desde la última vez</h2><Clock3 size={17} aria-hidden="true" /></div>{dashboard.since_last_time.changes.length > 0 ? <div className="home-change-list">{dashboard.since_last_time.changes.slice(0, 3).map((change) => <Link className="home-change" key={change.cursor} to={change.grow_cycle_id ? `/cycle/${change.grow_cycle_id}` : change.garden_id ? `/garden/${change.garden_id}` : '/gardens'}><strong>{change.summary}</strong><ArrowRight size={16} aria-hidden="true" /></Link>)}</div> : <p className="quiet-copy">No hay novedades confirmadas desde tu última visita.</p>}</section>
        <section className="bc-section" aria-labelledby="home-attention"><div className="section-heading"><h2 id="home-attention">Atención</h2><Sprout size={17} aria-hidden="true" /></div><AttentionList compact items={dashboard.attention.items} />{dashboard.attention.items.length > 0 && <Link className="text-link" to="/today">Ver pendientes <ArrowRight size={15} aria-hidden="true" /></Link>}</section></div>
    </>}
  </AppShell>
}
