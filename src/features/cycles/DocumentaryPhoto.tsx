import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Maximize2, X } from 'lucide-react'
import type { PhotoEvidence } from '../../domain/types'
import { getSignedPhotoUrl } from '../../lib/garden-api'
import { captureLabel } from './photo-presentation'

export function DocumentaryPhoto({ photo, eager = false, expandable = false, caption = true, actions }: { photo: PhotoEvidence; eager?: boolean; expandable?: boolean; caption?: boolean; actions?: ReactNode }) {
  // Keying the loader by evidence ID + path prevents one frame of a previous photo.
  return <PhotoLoader key={`${photo.id}:${photo.storage_path}`} photo={photo} eager={eager} expandable={expandable} caption={caption} actions={actions} />
}
function PhotoLoader({ photo, eager, expandable, caption, actions }: { photo: PhotoEvidence; eager: boolean; expandable: boolean; caption: boolean; actions?: ReactNode }) {
  const root = useRef<HTMLElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [near, setNear] = useState(eager)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (near) return
    if (!('IntersectionObserver' in window)) { const frame = requestAnimationFrame(() => setNear(true)); return () => cancelAnimationFrame(frame) }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setNear(true); observer.disconnect() } }, { rootMargin: '250px' })
    if (root.current) observer.observe(root.current)
    return () => observer.disconnect()
  }, [near])
  useEffect(() => {
    if (!near || photo.upload_status !== 'uploaded') return
    let active = true
    void getSignedPhotoUrl(photo.storage_path).then((value) => { if (active) setUrl(value) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [near, photo.storage_path, photo.upload_status])
  const media = url && !failed ? <img src={url} alt={`Fotografía documental: ${photo.original_filename}`} onError={() => setFailed(true)} loading={eager ? 'eager' : 'lazy'} /> : <span className="documentary-photo__status">{failed ? 'Fotografía no disponible' : 'Cargando fotografía…'}</span>
  const close = () => { dialog.current?.close(); trigger.current?.focus() }
  return <figure className="documentary-photo" ref={root}>
    {expandable ? <button className="documentary-photo__open" ref={trigger} type="button" aria-label={`Abrir fotografía ${photo.original_filename}`} disabled={!url || failed} onClick={() => dialog.current?.showModal()}>{media}<Maximize2 size={14} aria-hidden="true" /></button> : media}
    {caption && <figcaption>{captureLabel(photo)}</figcaption>}
    {expandable && <dialog className="evidence-viewer" ref={dialog} onClose={() => trigger.current?.focus()} aria-label="Fotografía documental"><header><div><strong>{captureLabel(photo)}</strong><span>{photo.original_filename} · {photo.content_type.replace('image/', '').toUpperCase()}</span></div><button autoFocus type="button" className="icon-button" aria-label="Cerrar fotografía" onClick={close}><X /></button></header>{url && !failed && <img src={url} alt={`Original: ${photo.original_filename}`} />}{actions && <div className="documentary-photo__actions">{actions}</div>}</dialog>}
  </figure>
}
