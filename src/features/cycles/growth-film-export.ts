import type { FilmComposition, FilmMoment } from './growth-film-composition'
import { createFilmPainter, type FilmImage, type FilmTypography } from './growth-film-renderer'

export interface FilmArtifact {
  readonly compositionKey: string
  readonly blob: Blob
  readonly url: string
  readonly mimeType: string
  readonly durationMs: number
  /** The owner releases this on a new selection or when the editor closes. */
  dispose: () => void
}
export type FilmExportProgress = Readonly<{ phase: 'preparing' | 'rendering'; completed: number; total: number }>
export type FilmPhotoResolver = (moment: FilmMoment, signal: AbortSignal) => Promise<string>

function cancelled(): DOMException { return new DOMException('La creación del clip fue cancelada.', 'AbortError') }
function check(signal: AbortSignal) { if (signal.aborted) throw signal.reason ?? cancelled() }

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  check(signal)
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? cancelled())
    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export function growthFilmMimeType(withAudio: boolean): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  // Prefer MP4 for native iOS video. Do not advertise an audio codec in a silent clip.
  const candidates = [withAudio ? 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' : 'video/mp4;codecs=avc1.42E01E', 'video/mp4', withAudio ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp9', 'video/webm']
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) ?? null
}

async function decodePhoto(url: string, signal: AbortSignal): Promise<FilmImage> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('No se pudo preparar una fotografía. Vuelve a intentarlo.')
  const blob = await response.blob()
  check(signal)
  if (typeof createImageBitmap === 'function') {
    try {
      const image = await createImageBitmap(blob)
      if (signal.aborted) { image.close(); check(signal) }
      return image
    } catch (reason) { if (signal.aborted) throw reason /* Safari can decode some images only via img. */ }
  }
  const objectUrl = URL.createObjectURL(blob)
  const image = new Image()
  try {
    image.src = objectUrl
    await abortable(image.decode(), signal)
    return image
  } catch (reason) { image.src = ''; throw reason }
  finally { URL.revokeObjectURL(objectUrl) }
}

async function prepareTypography(signal: AbortSignal): Promise<FilmTypography> {
  // Freeze the available family once per artifact. Download uses the same pixels even
  // if fonts arrive later or the OS has a different serif fallback.
  if (!document.fonts) return { serif: 'Georgia, serif', sans: 'sans-serif' }
  await abortable(Promise.allSettled([document.fonts.load('400 52px Fraunces'), document.fonts.load('400 25px "DM Sans"')]), signal)
  const loaded = [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family.replace(/["']/g, ''))
  return { serif: loaded.includes('Fraunces') ? 'Fraunces, Georgia, serif' : 'Georgia, serif', sans: loaded.includes('DM Sans') ? '"DM Sans", sans-serif' : 'sans-serif' }
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

/** Called directly from a tap, before any network await, so Safari can unlock audio. */
export async function renderGrowthFilm(plan: FilmComposition, input: {
  resolvePhotoUrl: FilmPhotoResolver
  signal: AbortSignal
  onProgress?: (progress: FilmExportProgress) => void
}): Promise<FilmArtifact> {
  check(input.signal)
  const mimeType = growthFilmMimeType(Boolean(plan.music))
  if (!mimeType || !HTMLCanvasElement.prototype.captureStream) throw new Error('Este navegador no puede crear el video. Puedes seguir mirando las fotografías.')
  const controller = new AbortController()
  const signal = controller.signal
  const abort = () => controller.abort(input.signal.reason ?? cancelled())
  input.signal.addEventListener('abort', abort, { once: true })
  const timeout = window.setTimeout(() => controller.abort(new Error('El video tardó demasiado en prepararse. Vuelve a intentarlo.')), 120_000 + plan.durationMs)
  const hidden = () => { if (document.visibilityState === 'hidden') controller.abort(new Error('La preparación se interrumpió al salir de la app. Vuelve a crear el video.')) }
  document.addEventListener('visibilitychange', hidden)
  let audioContext: AudioContext | null = null
  let audioSource: AudioBufferSourceNode | null = null
  let audioDestination: MediaStreamAudioDestinationNode | null = null
  let audioGain: GainNode | null = null
  let stream: MediaStream | null = null
  const images: FilmImage[] = []
  try {
    hidden(); check(signal)
    if (plan.music) {
      const AudioCtor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
      if (!AudioCtor) throw new Error('Este navegador no puede añadir música. Puedes elegir «Sin música».')
      audioContext = new AudioCtor()
      await abortable(audioContext.resume(), signal)
      if (audioContext.state !== 'running') throw new Error('No se pudo activar la música. Vuelve a pulsar «Preparar video».')
    }
    input.onProgress?.({ phase: 'preparing', completed: 0, total: plan.moments.length })
    for (const moment of plan.moments) {
      check(signal)
      const url = await abortable(input.resolvePhotoUrl(moment, signal), signal)
      images.push(await decodePhoto(url, signal))
      input.onProgress?.({ phase: 'preparing', completed: images.length, total: plan.moments.length })
    }
    const typography = await prepareTypography(signal)
    if (plan.music && audioContext) {
      const response = await fetch(plan.music.url, { signal })
      if (!response.ok) throw new Error('No se pudo cargar la pista elegida. Reintenta o elige «Sin música».')
      const buffer = await abortable(audioContext.decodeAudioData(await response.arrayBuffer()), signal)
      audioDestination = audioContext.createMediaStreamDestination()
      audioGain = audioContext.createGain()
      audioSource = audioContext.createBufferSource()
      audioSource.buffer = buffer; audioSource.loop = true
      audioSource.connect(audioGain); audioGain.connect(audioDestination)
    }
    check(signal)
    const canvas = document.createElement('canvas')
    canvas.width = plan.width; canvas.height = plan.height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('No se pudo preparar el lienzo del video.')
    const paint = createFilmPainter(plan, images, typography)
    paint(context, 0) // Establish the first image before capture, never a blank first frame.
    stream = canvas.captureStream(plan.fps)
    if (audioDestination) {
      const track = audioDestination.stream.getAudioTracks()[0]
      if (!track) throw new Error('No se pudo incorporar la música elegida.')
      stream.addTrack(track)
    }
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_500_000, ...(plan.music ? { audioBitsPerSecond: 128_000 } : {}) })
    const blob = await recordFilm(recorder, plan, signal, elapsed => paint(context, elapsed), () => {
      if (audioContext && audioSource && audioGain && plan.music) {
        const start = audioContext.currentTime
        audioGain.gain.setValueAtTime(plan.music.volume, start)
        audioGain.gain.setValueAtTime(plan.music.volume, start + plan.durationMs / 1_000 - .35)
        audioGain.gain.linearRampToValueAtTime(0, start + plan.durationMs / 1_000)
        audioSource.start(start, 0)
      }
    }, input.onProgress)
    check(signal)
    if (!blob.size) throw new Error('El navegador produjo un video vacío. Vuelve a intentarlo.')
    const url = URL.createObjectURL(blob)
    let disposed = false
    return { compositionKey: plan.key, blob, url, mimeType: blob.type, durationMs: plan.durationMs, dispose: () => { if (!disposed) { URL.revokeObjectURL(url); disposed = true } } }
  } finally {
    window.clearTimeout(timeout)
    input.signal.removeEventListener('abort', abort)
    document.removeEventListener('visibilitychange', hidden)
    stream?.getTracks().forEach(track => track.stop())
    audioDestination?.stream.getTracks().forEach(track => track.stop())
    try { audioSource?.stop() } catch { /* A cancelled preparation may not have started it. */ }
    await audioContext?.close().catch(() => undefined)
    images.forEach(image => { if ('close' in image) image.close(); else image.src = '' })
  }
}

function recordFilm(recorder: MediaRecorder, plan: FilmComposition, signal: AbortSignal, paint: (timeMs: number) => void, startAudio: () => void, onProgress?: (value: FilmExportProgress) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = []
    let animation = 0
    let failure: unknown = null
    let complete = false
    let settled = false
    let startedAt = 0
    let lastFrame = 0
    let previousIndex = -1
    let stopTimeout = 0
    const finish = () => {
      if (settled) return
      settled = true
      cancelAnimationFrame(animation); window.clearTimeout(stopTimeout)
      signal.removeEventListener('abort', abort)
      recorder.ondataavailable = null; recorder.onstop = null; recorder.onerror = null; recorder.onstart = null
      if (failure || !complete) reject(failure ?? new Error('El video se interrumpió antes de terminar.'))
      else resolve(new Blob(chunks, { type: recorder.mimeType }))
    }
    const stop = (reason?: unknown) => {
      if (reason) failure = reason
      cancelAnimationFrame(animation)
      if (!stopTimeout) stopTimeout = window.setTimeout(() => { failure ??= new Error('No se pudo finalizar el archivo de video.'); finish() }, 5_000)
      if (recorder.state !== 'inactive') { try { recorder.stop() } catch (error) { failure = error; finish() } }
      else finish()
    }
    const abort = () => stop(signal.reason ?? cancelled())
    const frame = (now: number) => {
      if (signal.aborted) { abort(); return }
      if (now - lastFrame > 750) { stop(new Error('El dispositivo interrumpió la grabación. Vuelve a intentarlo con la app abierta.')); return }
      lastFrame = now
      const elapsed = now - startedAt
      try {
        paint(Math.min(elapsed, plan.durationMs - 1))
        const index = Math.min(plan.moments.length, Math.floor(elapsed / plan.momentDurationMs))
        if (index !== previousIndex) { previousIndex = index; onProgress?.({ phase: 'rendering', completed: index, total: plan.moments.length }) }
        if (elapsed >= plan.durationMs) { complete = true; stop(); return }
        animation = requestAnimationFrame(frame)
      } catch (reason) { stop(reason) }
    }
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }
    recorder.onstop = finish
    recorder.onerror = () => stop(new Error('No se pudo codificar el video.'))
    signal.addEventListener('abort', abort, { once: true })
    try {
      check(signal)
      // The start event can arrive hundreds of milliseconds after capture starts.
      // Start both clocks here, not in that event, to avoid a frozen opening/audio delay.
      startedAt = performance.now(); lastFrame = startedAt
      recorder.start(500); startAudio()
      animation = requestAnimationFrame(frame)
    } catch (reason) { failure = reason; stop(reason) }
  })
}

/** Download the artifact that was previewed, with no second render or hidden audio change. */
export function downloadFilmArtifact(artifact: FilmArtifact, filename = 'garden-x-growth-film'): void {
  const anchor = document.createElement('a')
  anchor.href = artifact.url
  anchor.download = `${filename.replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 100)}.${artifact.mimeType.includes('mp4') ? 'mp4' : 'webm'}`
  document.body.append(anchor); anchor.click(); anchor.remove()
}
