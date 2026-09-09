import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, Clock3, ImagePlus, Sprout, Upload, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { GrowthRings } from '../../components/GrowthRings'
import { StatePanel } from '../../components/StatePanel'
import type { HomeDashboard, PhotoEvidence } from '../../domain/types'
import { getGardenCoverPhotos, getHome, getHomeDashboard, getHomeMedia, setHomeHero, uploadScopedPhoto } from '../../lib/garden-api'
import { GardenCoverImage } from './GardenCover'
import { AttentionList } from './GardensPage'
import { PhotoLibraryDialog } from './PhotoLibraryDialog'

export function HomePage({ user }: { user: User }) {
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [heroPhoto, setHeroPhoto] = useState<PhotoEvidence | null>(null)
  const [heroChoices, setHeroChoices] = useState<PhotoEvidence[]>([])
  const [heroBusy, setHeroBusy] = useState(false)
  const [libraryPhotos, setLibraryPhotos] = useState<PhotoEvidence[]>([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const load = useCallback(async () => {
    setError(null)
    try {
      const [next, summaries, media] = await Promise.all([getHomeDashboard(null), getHome(), getHomeMedia()])
      const coverByGarden = new Map(summaries.map((garden) => [garden.id, garden.cover_photo ?? null]))
      next.gardens = next.gardens.map((garden) => ({ ...garden, cover_photo: coverByGarden.get(garden.id) ?? null }))
      const coverLists = await Promise.all(summaries.map((garden) => getGardenCoverPhotos(garden.id)))
      setLibraryPhotos(coverLists.flat().filter((photo, index, list) => list.findIndex((candidate) => candidate.id === photo.id) === index))
      setDashboard(next)
      setHeroPhoto(media.home_hero_photo); setHeroChoices(media.home_hero_choices)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo abrir Home.') }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- only writes after the remote dashboard settles.
  useEffect(() => { void load() }, [load])
  const gardens = dashboard?.gardens ?? []
  const chooseHero = async (photoId: string | null) => { setHeroBusy(true); try { await setHomeHero({ requestId: crypto.randomUUID(), photoId }); await load(); setLibraryOpen(false) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo cambiar la portada de Home.') } finally { setHeroBusy(false) } }
  const uploadHero = async (file: File | null) => { if (!file) return; setHeroBusy(true); try { const photo = await uploadScopedPhoto({ requestId: crypto.randomUUID(), scope: 'home_hero', gardenId: null, file }); await setHomeHero({ requestId: crypto.randomUUID(), photoId: photo.id }); await load(); setLibraryOpen(false) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo subir la portada de Home.') } finally { setHeroBusy(false) } }
  return <AppShell>
    <section className={`home-hero${heroPhoto ? ' home-hero--photo' : ''}`}>{heroPhoto && <GardenCoverImage photo={heroPhoto} alt="" className="home-hero__photo" />}<GrowthRings /><p>Garden X</p><h1>Tu jardín, vivo.</h1><span>{user.email ?? 'Tu espacio privado'}</span><Link className="primary-button" to="/gardens">Ver jardines <ArrowRight size={17} aria-hidden="true" /></Link><button className="home-hero__configure" type="button" onClick={() => setLibraryOpen(true)} aria-label="Cambiar fotografía de Home"><ImagePlus size={16} aria-hidden="true" /></button><PhotoLibraryDialog open={libraryOpen} photos={libraryPhotos.length > 0 ? libraryPhotos : heroChoices} selectedId={heroPhoto?.id} title="Elegir portada de Home" actions={<><label className="file-button secondary-button--compact"><Upload size={15} aria-hidden="true" /> Subir fotografía<input type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" disabled={heroBusy} onChange={(event) => void uploadHero(event.target.files?.[0] ?? null)} /></label>{heroPhoto && <button className="text-button" type="button" disabled={heroBusy} onClick={() => void chooseHero(null)}><X size={15} aria-hidden="true" /> Quitar portada</button>}</>} onSelect={(id) => void chooseHero(id)} onClose={() => setLibraryOpen(false)} /></section>
    {!dashboard && !error && <StatePanel kind="loading" title="Preparando Home" />}
    {error && <StatePanel kind="error" title="No se pudo abrir Home" onRetry={() => void load()}>{error}</StatePanel>}
    {dashboard && <>
      <section className="home-scene" aria-labelledby="home-gardens"><div className="section-heading"><h2 id="home-gardens">Tus jardines</h2><Link className="text-link" to="/gardens">Ver todos <ArrowRight size={15} aria-hidden="true" /></Link></div><div className="home-scene__gardens">{gardens.map((garden, index) => <Link to={`/garden/${garden.id}`} key={garden.id} className="home-scene__garden">{garden.cover_photo && <GardenCoverImage photo={garden.cover_photo} alt="" />}<div><span>{String(index + 1).padStart(2, '0')}</span><strong>{garden.name}</strong><small>{garden.active_positions} activas · {garden.position_capacity} posiciones</small></div></Link>)}</div></section>
      <section className="home-summary-grid"><div><div className="section-heading"><h2>Desde la última vez</h2><Clock3 size={17} aria-hidden="true" /></div>{dashboard.since_last_time.changes.length > 0 ? <div className="home-change-list">{dashboard.since_last_time.changes.slice(0, 3).map((change) => <Link className="home-change" key={change.cursor} to={change.grow_cycle_id ? `/cycle/${change.grow_cycle_id}` : change.garden_id ? `/garden/${change.garden_id}` : '/gardens'}><strong>{change.summary}</strong><ArrowRight size={16} aria-hidden="true" /></Link>)}</div> : <p className="quiet-copy">No hay novedades confirmadas desde tu última visita.</p>}</div>
        <div><div className="section-heading"><h2>Para hoy</h2><Sprout size={17} aria-hidden="true" /></div><AttentionList compact items={dashboard.attention.items} />{dashboard.attention.items.length > 0 && <Link className="text-link" to="/today">Ver pendientes <ArrowRight size={15} aria-hidden="true" /></Link>}</div></section>
    </>}
  </AppShell>
}
