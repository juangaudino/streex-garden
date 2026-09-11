export const GROWTH_FILM_MAX_EXPORT_FRAMES = 12
export const GROWTH_FILM_MOMENT_DURATION_MS = 2_600

/**
 * Keeps a generated film concise while retaining the first and last moments.
 * The film never creates intermediate imagery: every selected index maps to a
 * stored photograph.
 */
export function selectFilmFrameIndexes(total: number, limit = GROWTH_FILM_MAX_EXPORT_FRAMES): number[] {
  if (total <= 0 || limit <= 0) return []
  if (total <= limit) return Array.from({ length: total }, (_, index) => index)
  return Array.from({ length: limit }, (_, index) => Math.round((index * (total - 1)) / (limit - 1)))
}

export function nearbyFilmIndexes(total: number, active: number): number[] {
  if (total <= 0) return []
  return [...new Set([active, active - 1, active + 1].filter((index) => index >= 0 && index < total))]
}

export function preferredFilmMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  return [
    'video/mp4;codecs=avc1.42E01E',
    'video/webm;codecs=vp9',
    'video/webm',
  ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? null
}

type DecodedImage = ImageBitmap | HTMLImageElement

async function decodeImage(url: string): Promise<DecodedImage> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('No se pudo preparar una de las fotografías del clip.')
  const blob = await response.blob()
  if ('createImageBitmap' in window) return createImageBitmap(blob)
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('El navegador no pudo leer una fotografía del clip.'))
      element.src = objectUrl
    })
    return image
  } finally { URL.revokeObjectURL(objectUrl) }
}

function drawCover(context: CanvasRenderingContext2D, image: DecodedImage, alpha: number): void {
  const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width
  const sourceHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height
  const scale = Math.max(context.canvas.width / sourceWidth, context.canvas.height / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  context.save()
  context.globalAlpha = alpha
  context.drawImage(image, (context.canvas.width - width) / 2, (context.canvas.height - height) / 2, width, height)
  context.restore()
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

async function renderMoment(context: CanvasRenderingContext2D, current: DecodedImage, next: DecodedImage | null, durationMs: number, signal: AbortSignal): Promise<void> {
  const startedAt = performance.now()
  while (performance.now() - startedAt < durationMs) {
    if (signal.aborted) throw new DOMException('La creación del clip fue cancelada.', 'AbortError')
    const elapsed = performance.now() - startedAt
    const dissolveStart = durationMs * 0.74
    const blend = next ? Math.max(0, Math.min(1, (elapsed - dissolveStart) / (durationMs - dissolveStart))) : 0
    context.fillStyle = '#102018'
    context.fillRect(0, 0, context.canvas.width, context.canvas.height)
    drawCover(context, current, 1 - blend)
    if (next) drawCover(context, next, blend)
    await nextFrame()
  }
}

export async function createPrivateGrowthFilm(input: { urls: string[]; signal: AbortSignal; onProgress?: (completed: number, total: number) => void }): Promise<{ blob: Blob; mimeType: string }> {
  const mimeType = preferredFilmMimeType()
  if (!mimeType || typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) throw new Error('Este navegador no puede crear un clip local. Puedes seguir reproduciendo Growth Film.')
  if (input.urls.length < 2) throw new Error('Se necesitan al menos dos fotografías para crear un clip.')
  const images = await Promise.all(input.urls.map(decodeImage))
  const canvas = document.createElement('canvas')
  // A 720 × 900 4:5 master stays smooth on phones and still creates a real,
  // shareable video from the private display renditions.
  canvas.width = 720
  canvas.height = 900
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('El navegador no puede preparar el lienzo del clip.')
  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_500_000 })
  const chunks: BlobPart[] = []
  const completed = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data) }
    recorder.onerror = () => reject(new Error('No se pudo codificar el clip.'))
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
  })
  recorder.start(800)
  try {
    for (let index = 0; index < images.length; index += 1) {
      input.onProgress?.(index, images.length)
      await renderMoment(context, images[index], images[index + 1] ?? null, GROWTH_FILM_MOMENT_DURATION_MS, input.signal)
    }
    input.onProgress?.(images.length, images.length)
    recorder.stop()
    return { blob: await completed, mimeType }
  } catch (reason) {
    if (recorder.state !== 'inactive') recorder.stop()
    await completed.catch(() => undefined)
    throw reason
  } finally {
    stream.getTracks().forEach((track) => track.stop())
    images.forEach((image) => { if ('close' in image) image.close() })
  }
}

export function downloadPrivateGrowthFilm(blob: Blob, mimeType: string, filename: string): void {
  const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${filename}.${extension}`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
