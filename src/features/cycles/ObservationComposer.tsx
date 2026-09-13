import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Camera, ImagePlus, Send } from 'lucide-react'
import type { ObservationDraft, ObservationInput } from '../../domain/types'
import { validatesObservation } from '../../domain/invariants'
import { photoContentType, readExifCapture } from '../../domain/photo-integrity'
import { saveObservationDraft } from '../../lib/offline-observation-store'
import { syncObservationDraft } from '../../lib/observation-sync'
import { requestDraftAiCheck } from '../../lib/ai-gateway'
import type { GardenAiCheckProposalV1 } from '../../domain/ai'

function getPhotoMetadata(file: File): ObservationInput['photoMetadata'] | undefined {
  const contentType = photoContentType(file)
  if (!contentType) return undefined
  return { originalFilename: file.name || 'captura', contentType, byteSize: file.size }
}

export function ObservationComposer({ growCycleId, onSaved, onDraftQueued, compact = false, onDraftAiProposal, onPhotoChange, embedded = false, onCancel, onBusyChange, children }: { growCycleId: string; onSaved: () => Promise<void>; onDraftQueued: () => Promise<void>; compact?: boolean; onDraftAiProposal?: (proposal: GardenAiCheckProposalV1) => void; onPhotoChange?: () => void; embedded?: boolean; onCancel?: () => void; onBusyChange?: (busy: boolean) => void; children?: ReactNode }) {
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [capturedAt, setCapturedAt] = useState<string | null>(null)
  const [draftAiBusy, setDraftAiBusy] = useState(false)
  const [captureSource, setCaptureSource] = useState<'camera' | 'picker'>('picker')
  const alive = useRef(true)
  const working = useRef(false)
  const photoVersion = useRef(0)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current) }
  }, [])

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    if (working.current) return
    const version = ++photoVersion.current
    onPhotoChange?.()
    const nextFile = event.target.files?.[0] ?? null
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const nextPreviewUrl = nextFile ? URL.createObjectURL(nextFile) : null
    previewUrlRef.current = nextPreviewUrl
    setFile(nextFile)
    setPreviewUrl(nextPreviewUrl)
    const source = event.target.capture ? 'camera' : 'picker'
    setCaptureSource(source)
    setCapturedAt(null)
    if (nextFile) void readExifCapture(nextFile).then((exif) => { if (!alive.current || version !== photoVersion.current) return; if (exif) setCapturedAt(exif); else if (source === 'camera') setCapturedAt(new Date().toISOString()) })
    setMessage(nextFile && !getPhotoMetadata(nextFile) ? 'Usa una imagen JPEG, PNG, HEIC, HEIF o WebP.' : null)
  }

  const analyzeDraft = async () => {
    if (!file || working.current) return
    working.current = true
    setDraftAiBusy(true); onBusyChange?.(true); setMessage(null)
    try { const proposal = await requestDraftAiCheck({ growCycleId, file, requestKey: `ai-check-draft:${growCycleId}:${crypto.randomUUID()}` }); if (!alive.current) return; onDraftAiProposal?.(proposal); setMessage('Análisis listo. La foto aún no se ha guardado.') }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Garden AI no está disponible ahora.') }
    finally { working.current = false; setDraftAiBusy(false); onBusyChange?.(false) }
  }

  const saveDraft = (draft: ObservationDraft): Promise<IDBValidKey> => saveObservationDraft(draft)

  const resetEditor = () => {
    ++photoVersion.current
    setNote('')
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setFile(null)
    setPreviewUrl(null)
    setCapturedAt(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const input: ObservationInput = { requestId: crypto.randomUUID(), growCycleId, note, photo: file ?? undefined, photoMetadata: file ? getPhotoMetadata(file) : undefined, capturedAt, capturedAtPrecision: capturedAt ? (captureSource === 'camera' ? 'exact' : 'approximate') : 'unknown', captureSource }
    const validation = validatesObservation(input)
    if (validation) { setMessage(validation); return }
    if (working.current) return
    working.current = true
    setBusy(true)
    onBusyChange?.(true)
    setMessage(null)
    const persistedPhoto = file && input.photoMetadata
      ? new Blob([file], { type: input.photoMetadata.contentType })
      : undefined
    const draft: ObservationDraft = { ...input, photo: persistedPhoto, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'queued' }
    try {
      await saveDraft(draft)
      resetEditor()
      if (!navigator.onLine) {
        setMessage('Pendiente de subir: se guardó en este dispositivo.')
        await onDraftQueued()
      } else {
        await onDraftQueued()
        const result = await syncObservationDraft(draft)
        if (result.result === 'synced') {
          setMessage('Guardado en tu cuenta.')
          await onSaved()
        } else if (result.result === 'needs_review') {
          setMessage(`Revisar conflicto: ${result.error}`)
          await onDraftQueued()
        } else {
          setMessage(`Pendiente de subir: ${result.error}`)
          await onDraftQueued()
        }
      }
    } catch (reason) {
      const error = reason instanceof Error ? reason.message : 'No se pudo guardar la observación.'
      try {
        await saveDraft({ ...draft, status: 'retryable_error', lastError: error })
        setMessage(`Pendiente de subir: ${error}`)
        await onDraftQueued()
      } catch {
        setMessage(`Error: ${error} No se pudo guardar una copia local.`)
      }
    } finally {
      working.current = false
      setBusy(false)
      onBusyChange?.(false)
    }
  }

  return <form className={`observation-composer${embedded ? ' bs-embedded-form' : ''}`} onSubmit={(event) => void handleSubmit(event)}>
    {!compact && <div className="section-heading"><h2>Añadir observación</h2></div>}
    <label className="sr-only" htmlFor="observation-note">Lo que observas</label>
    <textarea id="observation-note" value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} placeholder="¿Qué observas hoy?" rows={3} maxLength={1000} />
    {previewUrl && <div className="photo-preview"><img src={previewUrl} alt="Vista previa de la fotografía que guardarás" /><button className="secondary-button secondary-button--compact" type="button" disabled={busy || draftAiBusy} onClick={() => { ++photoVersion.current; onPhotoChange?.(); if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; setFile(null); setPreviewUrl(null); setCapturedAt(null) }}>Quitar foto</button></div>}
    <div className="composer-actions">
      <label className="file-button"><ImagePlus size={18} aria-hidden="true" /> Elegir foto<input type="file" disabled={busy || draftAiBusy} accept="image/jpeg,image/png,image/heic,image/heif,image/webp" onChange={handleFile} /></label>
      <label className="file-button file-button--camera"><Camera size={18} aria-hidden="true" /> Cámara<input type="file" disabled={busy || draftAiBusy} accept="image/*" capture="environment" onChange={handleFile} /></label>
      {file && onDraftAiProposal && <button className="secondary-button secondary-button--compact" type="button" disabled={busy || draftAiBusy} onClick={() => void analyzeDraft()}>{draftAiBusy ? 'Analizando…' : 'Analizar con Garden AI'}</button>}{!embedded && <button className="primary-button primary-button--compact" type="submit" disabled={busy || draftAiBusy}><Send size={17} aria-hidden="true" />{busy ? 'Guardando…' : 'Guardar'}</button>}
    </div>
    {message && <p className={message.startsWith('Error:') ? 'inline-message inline-message--error' : 'inline-message'} role="status">{message}</p>}
    {children}
    {embedded && <div className="bs-sheet-footer"><button className="secondary-button" type="button" disabled={busy || draftAiBusy} onClick={onCancel}>Cancelar</button><button className="primary-button" type="submit" disabled={busy || draftAiBusy}>{busy ? 'Guardando…' : 'Guardar'}</button></div>}
  </form>
}
