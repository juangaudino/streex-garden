import { useCallback, useEffect, useState } from 'react'
import { Check, ImagePlus, Upload, UserRound, X } from 'lucide-react'
import { AppShell } from '../../components/AppShell'
import { StatePanel } from '../../components/StatePanel'
import type { PhotoEvidence } from '../../domain/types'
import { getCurrentUser, getGardenCoverPhotos, getHome, getHomeMedia, setHomeHeadline, setHomeHero, uploadScopedPhoto } from '../../lib/garden-api'
import { PhotoLibraryDialog } from './PhotoLibraryDialog'

export function SettingsPage() {
  const [email, setEmail] = useState('')
  const [headline, setHeadline] = useState('Tu jardín, vivo.')
  const [heroPhoto, setHeroPhoto] = useState<PhotoEvidence | null>(null)
  const [photos, setPhotos] = useState<PhotoEvidence[]>([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setError(null)
    try {
      const [user, media, gardens] = await Promise.all([getCurrentUser(), getHomeMedia(), getHome()])
      const choices = (await Promise.all(gardens.map((garden) => getGardenCoverPhotos(garden.id)))).flat()
      setEmail(user?.email ?? '')
      setHeadline(media.home_headline ?? 'Tu jardín, vivo.')
      setHeroPhoto(media.home_hero_photo)
      setPhotos(choices.filter((photo, index, list) => list.findIndex((candidate) => candidate.id === photo.id) === index))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron cargar los ajustes.') }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- settings load updates after authenticated reads settle.
  useEffect(() => { void load() }, [load])
  const saveHeadline = async () => {
    const value = headline.trim(); if (!value) return
    setBusy(true); setMessage(null)
    try { await setHomeHeadline({ requestId: crypto.randomUUID(), headline: value }); setMessage('Título de Home guardado.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar el título.') }
    finally { setBusy(false) }
  }
  const chooseHero = async (photoId: string | null) => {
    setBusy(true); setMessage(null)
    try { await setHomeHero({ requestId: crypto.randomUUID(), photoId }); await load(); setLibraryOpen(false); setMessage('Portada de Home actualizada.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la portada.') }
    finally { setBusy(false) }
  }
  const uploadHero = async (file: File | null) => {
    if (!file) return
    setBusy(true); setMessage(null)
    try { const photo = await uploadScopedPhoto({ requestId: crypto.randomUUID(), scope: 'home_hero', gardenId: null, file }); await setHomeHero({ requestId: crypto.randomUUID(), photoId: photo.id }); await load(); setLibraryOpen(false); setMessage('Portada de Home actualizada.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo subir la portada.') }
    finally { setBusy(false) }
  }
  return <AppShell title="Ajustes" subtitle="Tu espacio Garden X" backTo="/">
    {error && <StatePanel kind="error" title="No se pudieron abrir los ajustes" onRetry={() => void load()}>{error}</StatePanel>}
    {!error && <>
      <section className="settings-card"><UserRound size={20} aria-hidden="true" /><div><h2>Cuenta</h2><p>{email || 'Cuenta privada de Garden X'}</p></div></section>
      <section className="editor-card"><div><h2>Home</h2><p>Personaliza la frase y la portada que representan tu jardín completo.</p></div><label>Frase de Home<input value={headline} maxLength={120} onChange={(event) => setHeadline(event.target.value)} /></label><button className="primary-button secondary-button--compact" type="button" disabled={busy} onClick={() => void saveHeadline()}><Check size={16} aria-hidden="true" /> Guardar frase</button><div className="settings-cover"><span>{heroPhoto ? 'Portada actual seleccionada' : 'Aún no hay portada seleccionada'}</span><button className="secondary-button" type="button" onClick={() => setLibraryOpen(true)}><ImagePlus size={16} aria-hidden="true" /> Elegir fotografía</button></div></section>
      {message && <p className="inline-message" role="status">{message}</p>}
      <PhotoLibraryDialog open={libraryOpen} photos={photos} selectedId={heroPhoto?.id} title="Elegir portada de Home" actions={<><label className="file-button secondary-button--compact"><Upload size={15} aria-hidden="true" /> Subir fotografía<input type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" disabled={busy} onChange={(event) => void uploadHero(event.target.files?.[0] ?? null)} /></label>{heroPhoto && <button className="text-button" type="button" disabled={busy} onClick={() => void chooseHero(null)}><X size={15} aria-hidden="true" /> Quitar portada</button>}</>} onSelect={(id) => void chooseHero(id)} onClose={() => setLibraryOpen(false)} />
    </>}
  </AppShell>
}
