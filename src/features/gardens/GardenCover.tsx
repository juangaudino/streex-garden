import { useEffect, useState } from 'react'
import { ImagePlus, Upload, X } from 'lucide-react'
import type { GardenCoverPhoto, PhotoEvidence } from '../../domain/types'
import { getGardenCoverPhotos, getSignedPhotoUrl, setGardenCover, uploadScopedPhoto } from '../../lib/garden-api'
import { PhotoLibraryDialog } from './PhotoLibraryDialog'

export function GardenCoverImage({ photo, alt, className }: { photo: PhotoEvidence; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { let active = true; void getSignedPhotoUrl(photo.storage_path).then((next) => { if (active) setUrl(next) }).catch(() => { if (active) setUrl(null) }); return () => { active = false } }, [photo.storage_path])
  return url ? <img className={className} src={url} alt={alt} /> : null
}

export function GardenCoverPicker({ gardenId, onChanged }: { gardenId: string; onChanged: () => Promise<void> }) {
  const [photos, setPhotos] = useState<GardenCoverPhoto[] | null>(null)
  const [open, setOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = async () => { setError(null); try { setPhotos(await getGardenCoverPhotos(gardenId)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudieron cargar las fotografías disponibles.') } }
  const choose = async (photoId: string | null) => {
    setBusy(true); setError(null)
    try { await setGardenCover({ requestId: crypto.randomUUID(), gardenId, photoId }); await onChanged(); await load(); setOpen(false) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo actualizar la portada.') }
    finally { setBusy(false) }
  }
  const upload = async (file: File | null) => { if (!file) return; setBusy(true); setError(null); try { const photo = await uploadScopedPhoto({ requestId: crypto.randomUUID(), scope: 'garden_cover', gardenId, file }); await choose(photo.id) } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo subir la fotografía.') } finally { setBusy(false) } }
  const toggle = () => { setOpen((value) => !value); if (!photos) void load() }
  return <section className="garden-cover-picker" aria-label="Fotografía de portada del jardín">
    <button type="button" className="secondary-button secondary-button--compact" onClick={toggle}><ImagePlus size={16} aria-hidden="true" /> Cambiar portada</button>
    {open && <div className="garden-cover-picker__panel"><div><strong>Portada del jardín</strong><p>La eliges explícitamente. No se sustituye por la foto más reciente.</p></div>{error && <p className="inline-message inline-message--error" role="alert">{error}</p>}
      {photos === null && !error && <p className="quiet-copy">Cargando fotografías…</p>}
      <label className="file-button secondary-button--compact"><Upload size={15} aria-hidden="true" /> Subir fotografía del jardín<input type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp" disabled={busy} onChange={(event) => void upload(event.target.files?.[0] ?? null)} /></label>
      {photos?.length === 0 && <p className="quiet-copy">Puedes subir una fotografía ambiental del jardín o elegir una evidencia existente.</p>}
      {photos && photos.length > 0 && <button className="secondary-button secondary-button--compact" type="button" disabled={busy} onClick={() => setLibraryOpen(true)}>Elegir de Garden X</button>}
      {photos?.some((photo) => photo.is_cover) && <button className="text-button" type="button" disabled={busy} onClick={() => void choose(null)}><X size={15} aria-hidden="true" /> Quitar portada</button>}
    </div>}
    <PhotoLibraryDialog open={libraryOpen} photos={photos ?? []} selectedId={photos?.find((photo) => photo.is_cover)?.id} title="Elegir portada del jardín" onSelect={(id) => { setLibraryOpen(false); void choose(id) }} onClose={() => setLibraryOpen(false)} />
  </section>
}
