import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Maximize2, X } from 'lucide-react'
import type { PhotoEvidence } from '../../domain/types'
import type { PhotoRendition } from '../../domain/photo-renditions'
import { getSignedPhotoUrl } from '../../lib/garden-api'
import { captureLabel } from './photo-presentation'

export function DocumentaryPhoto({ photo, eager = false, expandable = false, caption = true, actions, rendition = 'history' }: { photo: PhotoEvidence; eager?: boolean; expandable?: boolean; caption?: boolean; actions?: ReactNode; rendition?: PhotoRendition }) {
  // Keying the loader by evidence ID + path prevents one frame of a previous photo.
  return <PhotoLoader key={`${photo.id}:${photo.storage_path}:${rendition}`} photo={photo} eager={eager} expandable={expandable} caption={caption} actions={actions} rendition={rendition} />
}
function PhotoLoader({ photo, eager, expandable, caption, actions, rendition }: { photo: PhotoEvidence; eager: boolean; expandable: boolean; caption: boolean; actions?: ReactNode; rendition: PhotoRendition }) {
  const root = useRef<HTMLElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [near, setNear] = useState(eager)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [servingOriginal, setServingOriginal] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [originalFailed, setOriginalFailed] = useState(false)
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
    void getSignedPhotoUrl(photo.storage_path, servingOriginal ? 'original' : rendition).then((value) => { if (active) setUrl(value) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [near, photo.storage_path, photo.upload_status, rendition, servingOriginal])
  useEffect(() => {
    if (!viewerOpen || rendition === 'original' || originalUrl || originalFailed) return
    let active = true
    void getSignedPhotoUrl(photo.storage_path, 'original').then((value) => { if (active) setOriginalUrl(value) }).catch(() => { if (active) setOriginalFailed(true) })
    return () => { active = false }
  }, [viewerOpen, rendition, originalUrl, originalFailed, photo.storage_path])
  const media = url && !failed ? <img src={url} alt={`Fotografía documental: ${photo.original_filename}`} onError={() => setFailed(true)} loading={eager ? 'eager' : 'lazy'} decoding="async" /> : <span className="documentary-photo__status">{failed ? 'Fotografía no disponible' : 'Cargando fotografía…'}</span>
  const recoverOriginal = () => {
    if (!servingOriginal && rendition !== 'original') setServingOriginal(true)
    else setFailed(true)
  }
  const close = () => { dialog.current?.close() }
  const afterClose = () => { setViewerOpen(false); trigger.current?.focus() }
  const open = () => { dialog.current?.showModal(); setViewerOpen(true) }
  const viewerUrl = rendition === 'original' ? url : originalUrl
  return <figure className="documentary-photo" ref={root}>
    {expandable ? <button className="documentary-photo__open" ref={trigger} type="button" aria-label={`Abrir fotografía ${photo.original_filename}`} disabled={!url || failed} onClick={open}>{url && !failed ? <img src={url} alt={`Fotografía documental: ${photo.original_filename}`} onError={recoverOriginal} loading={eager ? 'eager' : 'lazy'} decoding="async" /> : media}<Maximize2 size={14} aria-hidden="true" /></button> : url && !failed ? <img src={url} alt={`Fotografía documental: ${photo.original_filename}`} onError={recoverOriginal} loading={eager ? 'eager' : 'lazy'} decoding="async" /> : media}
    {caption && <figcaption>{captureLabel(photo)}</figcaption>}
    {expandable && <dialog className="evidence-viewer" ref={dialog} onClose={afterClose} aria-label="Fotografía documental"><header><div><strong>{captureLabel(photo)}</strong><span>{photo.original_filename} · {photo.content_type.replace('image/', '').toUpperCase()}</span></div><button autoFocus type="button" className="icon-button" aria-label="Cerrar fotografía" onClick={close}><X /></button></header>{viewerUrl && !originalFailed ? <img src={viewerUrl} alt={`Original: ${photo.original_filename}`} onError={() => setOriginalFailed(true)} /> : <span className="documentary-photo__status">{originalFailed ? 'Original no disponible' : 'Abriendo original…'}</span>}{actions && <div className="documentary-photo__actions">{actions}</div>}</dialog>}
  </figure>
}
