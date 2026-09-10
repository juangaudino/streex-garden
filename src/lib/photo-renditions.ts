import { photoRenditionPath, renditionDimensions, type StoredPhotoRendition } from '../domain/photo-renditions'

function loadImage(source: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('El navegador no pudo leer la fotografía para crear sus vistas rápidas.')) }
    image.src = url
  })
}

function jpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo crear una vista rápida de la fotografía.')), 'image/jpeg', quality))
}

async function createRendition(source: Blob, rendition: StoredPhotoRendition): Promise<ArrayBuffer> {
  const image = await loadImage(source)
  const { maxEdge, quality } = renditionDimensions(rendition)
  const ratio = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * ratio))
  const height = Math.max(1, Math.round(image.naturalHeight * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('El navegador no puede preparar vistas rápidas de fotografías.')
  context.drawImage(image, 0, 0, width, height)
  return (await jpegBlob(canvas, quality)).arrayBuffer()
}

/**
 * Best-effort local derivative preparation. It never changes or replaces the
 * canonical original; callers may safely leave an original view available when
 * an older browser cannot decode its source format.
 */
export async function createPhotoRenditions(originalBytes: ArrayBuffer, contentType: string): Promise<Array<{ rendition: StoredPhotoRendition; bytes: ArrayBuffer }>> {
  if (typeof document === 'undefined' || !contentType.startsWith('image/')) return []
  const source = new Blob([originalBytes], { type: contentType })
  const generated = await Promise.all((['preview', 'display'] as const).map(async (rendition) => ({ rendition, bytes: await createRendition(source, rendition) })))
  return generated
}

export { photoRenditionPath }
