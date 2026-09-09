import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { PhotoEvidence } from '../../domain/types'
import { getSignedPhotoUrl } from '../../lib/garden-api'

export function PhotoLibraryDialog({ open, photos, selectedId, onSelect, onClose, title }: { open: boolean; photos: PhotoEvidence[]; selectedId?: string | null; onSelect: (id: string) => void; onClose: () => void; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [filter, setFilter] = useState('all')
  useEffect(() => { if (open) dialog.current?.showModal(); else if (dialog.current?.open) dialog.current.close() }, [open])
  const visible = useMemo(() => filter === 'general' ? photos.filter((photo) => 'event_id' in photo && (photo as { event_type?: string }).event_type === 'observation') : photos, [filter, photos])
  return <dialog ref={dialog} className="photo-library" onClose={onClose} aria-labelledby="photo-library-title"><header><div><span className="eyebrow">Garden X</span><h2 id="photo-library-title">{title}</h2></div><button className="icon-button" type="button" aria-label="Cerrar galería" onClick={onClose}><X size={18} /></button></header><nav className="photo-library__filters" aria-label="Filtrar fotografías"><button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>Todas</button><button type="button" className={filter === 'general' ? 'is-active' : ''} onClick={() => setFilter('general')}>General</button></nav><div className="photo-library__grid">{visible.map((photo) => <button type="button" className={`photo-library__item${photo.id === selectedId ? ' is-selected' : ''}`} key={photo.id} onClick={() => onSelect(photo.id)}><PhotoThumbnail photo={photo} /><span>{photo.id === selectedId ? <><Check size={14} /> Seleccionada</> : 'Usar esta foto'}</span></button>)}</div>{visible.length === 0 && <p className="empty-copy">No hay fotografías en este filtro.</p>}</dialog>
}

function PhotoThumbnail({ photo }: { photo: PhotoEvidence }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { let active = true; void getSignedPhotoUrl(photo.storage_path).then((next) => { if (active) setUrl(next) }).catch(() => undefined); return () => { active = false } }, [photo.storage_path])
  return url ? <img src={url} alt="" loading="lazy" /> : <span className="photo-library__loading">Abriendo…</span>
}
