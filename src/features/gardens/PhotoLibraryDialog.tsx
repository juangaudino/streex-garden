import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import type { PhotoEvidence } from '../../domain/types'
import { getSignedPhotoUrl } from '../../lib/garden-api'

export function PhotoLibraryDialog({ open, photos, selectedId, onSelect, onClose, title, actions }: { open: boolean; photos: PhotoEvidence[]; selectedId?: string | null; onSelect: (id: string) => void; onClose: () => void; title: string; actions?: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [filter, setFilter] = useState('all')
  useEffect(() => { if (open) dialog.current?.showModal(); else if (dialog.current?.open) dialog.current.close() }, [open])
  const visible = useMemo(() => filter === 'general' ? photos.filter((photo) => 'event_id' in photo && (photo as { event_type?: string }).event_type === 'observation') : photos, [filter, photos])
  return <dialog ref={dialog} className="photo-library" onClose={onClose} aria-labelledby="photo-library-title"><header><div><span className="eyebrow">Garden X</span><h2 id="photo-library-title">{title}</h2></div><button className="icon-button" type="button" aria-label="Cerrar galería" onClick={onClose}><X size={18} /></button></header>{actions && <div className="photo-library__actions">{actions}</div>}<nav className="photo-library__filters" aria-label="Filtrar fotografías"><button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Todas</button><button type="button" className={filter === 'general' ? 'is-active' : ''} onClick={() => setFilter('general')}>General</button></nav><div className="photo-library__grid">{visible.map((photo) => <button type="button" className={`photo-library__item${photo.id === selectedId ? ' is-selected' : ''}`} key={photo.id} onClick={() => onSelect(photo.id)}><PhotoThumbnail photo={photo} /><span className="photo-library__label">{photo.id === selectedId ? <><Check size={14} /> Seleccionada</> : 'Usar esta foto'}</span></button>)}</div>{visible.length === 0 && <p className="empty-copy">No hay fotografías en este filtro.</p>}</dialog>
}

function PhotoThumbnail({ photo }: { photo: PhotoEvidence }) {
  const root = useRef<HTMLElement>(null)
  const [near, setNear] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [servingOriginal, setServingOriginal] = useState(false)
  useEffect(() => {
    if (near) return
    if (!('IntersectionObserver' in window)) {
      const frame = requestAnimationFrame(() => setNear(true))
      return () => cancelAnimationFrame(frame)
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNear(true)
        observer.disconnect()
      }
    }, { rootMargin: '350px' })
    if (root.current) observer.observe(root.current)
    return () => observer.disconnect()
  }, [near])
  useEffect(() => {
    if (!near || photo.upload_status !== 'uploaded') return
    let active = true
    void getSignedPhotoUrl(photo.storage_path, servingOriginal ? 'original' : 'thumbnail')
      .then((next) => { if (active) setUrl(next) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [near, photo.storage_path, photo.upload_status, servingOriginal])
  const recoverOriginal = () => {
    if (!servingOriginal) setServingOriginal(true)
    else setFailed(true)
  }
  return <span ref={root} className="photo-library__media">{url && !failed ? <img src={url} alt="" loading="lazy" decoding="async" onError={recoverOriginal} /> : <span className="photo-library__loading">{failed ? 'No disponible' : 'Abriendo…'}</span>}</span>
}
