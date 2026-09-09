import { useState, type ChangeEvent, type ReactNode } from 'react'
import { ImageOff } from 'lucide-react'
import type { PhotoEvidence as PhotoEvidenceType } from '../../domain/types'
import { retryPendingPhoto } from '../../lib/garden-api'
import { captureLabel as capturedDate } from './photo-presentation'
import { DocumentaryPhoto } from './DocumentaryPhoto'

export function PhotoEvidence({ photo, onRecovered, actions }: { photo: PhotoEvidenceType; onRecovered?: () => Promise<void>; actions?: ReactNode }) {
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
  return <DocumentaryPhoto photo={photo} expandable actions={actions} />
}
