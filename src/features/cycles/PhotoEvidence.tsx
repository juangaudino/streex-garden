import { useEffect, useState, type ChangeEvent } from 'react'
import { ImageOff } from 'lucide-react'
import type { PhotoEvidence as PhotoEvidenceType } from '../../domain/types'
import { getSignedPhotoUrl, retryPendingPhoto } from '../../lib/garden-api'

function capturedDate(photo: PhotoEvidenceType): string {
  if (!photo.captured_at) return 'Fecha de captura desconocida'
  const date = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(photo.captured_at))
  return photo.captured_at_precision === 'approximate' ? `Captura aproximada: ${date}` : `Capturada: ${date}`
}

function originalFormat(contentType: PhotoEvidenceType['content_type']): string {
  return contentType.replace('image/', '').toUpperCase()
}

export function PhotoEvidence({ photo, onRecovered }: { photo: PhotoEvidenceType; onRecovered?: () => Promise<void> }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (photo.upload_status !== 'uploaded') return undefined
    let active = true
    void getSignedPhotoUrl(photo.storage_path).then((signedUrl) => { if (active) setUrl(signedUrl) }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'No se pudo abrir el original.')
    })
    return () => { active = false }
  }, [photo.storage_path, photo.upload_status])
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)
  const [recovering, setRecovering] = useState(false)
  const recover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    setRecovering(true)
    setRecoveryMessage(null)
    try {
      await retryPendingPhoto(photo, file)
      setRecoveryMessage('Original recuperado. Actualizando el historial…')
      await onRecovered?.()
    } catch (reason) {
      setRecoveryMessage(`Error: ${reason instanceof Error ? reason.message : 'No se pudo recuperar el original.'}`)
    } finally {
      setRecovering(false)
    }
  }
  if (photo.upload_status !== 'uploaded') {
    const canRecover = Boolean(photo.checksum_sha256)
    return <div className="photo-unavailable"><ImageOff size={20} aria-hidden="true" /><div><span>Foto pendiente de subir</span><small>{capturedDate(photo)}</small>{!canRecover && <small className="photo-unavailable__error">Esta evidencia se creó antes de la verificación de integridad. Para no asociar una imagen equivocada, registra el original nuevamente.</small>}</div>{canRecover && <label className="file-button secondary-button--compact">{recovering ? 'Recuperando…' : 'Seleccionar el original'}<input type="file" accept={photo.content_type} disabled={recovering} onChange={(event) => void recover(event)} /></label>}{recoveryMessage && <small className={recoveryMessage.startsWith('Error:') ? 'photo-unavailable__error' : undefined}>{recoveryMessage}</small>}</div>
  }
  if (error) return <div className="photo-unavailable"><ImageOff size={20} aria-hidden="true" /><span>Original no disponible</span><small>{error}</small></div>
  if (!url) return <div className="photo-unavailable" aria-live="polite">Abriendo fotografía original…</div>
  return <figure className="history-photo"><img src={url} alt={`Fotografía guardada: ${photo.original_filename}`} /><figcaption>{capturedDate(photo)} · Archivo guardado · {originalFormat(photo.content_type)}</figcaption></figure>
}
