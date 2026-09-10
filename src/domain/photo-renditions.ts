export type PhotoRendition = 'thumbnail' | 'history' | 'story' | 'portrait' | 'card' | 'hero' | 'original'
export type StoredPhotoRendition = 'preview' | 'display'

/**
 * The source image is always the canonical private original. Free-plan
 * renditions are independent private JPEG objects stored beside it.
 */
export function storedRenditionFor(rendition: PhotoRendition): StoredPhotoRendition | null {
  switch (rendition) {
    case 'thumbnail':
    case 'history':
    case 'card':
      return 'preview'
    case 'story':
    case 'portrait':
    case 'hero':
      return 'display'
    case 'original':
      return null
  }
}

export function photoRenditionPath(originalPath: string, rendition: StoredPhotoRendition): string {
  const separator = originalPath.lastIndexOf('/')
  if (separator < 0) throw new Error('La ruta del original no tiene una carpeta de fotografía válida.')
  return `${originalPath.slice(0, separator)}/${rendition}.jpg`
}

export function renditionDimensions(rendition: StoredPhotoRendition): { maxEdge: number; quality: number } {
  return rendition === 'preview'
    ? { maxEdge: 640, quality: 0.68 }
    : { maxEdge: 1600, quality: 0.78 }
}

export interface PhotoTransform {
  width?: number
  height?: number
  resize?: 'cover' | 'contain' | 'fill'
  quality?: number
}

/** Reserved only for installations that explicitly enable a paid transform service. */
export function photoTransformFor(rendition: PhotoRendition): PhotoTransform | null {
  switch (rendition) {
    case 'thumbnail': return { width: 480, height: 360, resize: 'cover', quality: 60 }
    case 'history': return { width: 360, height: 360, resize: 'cover', quality: 64 }
    case 'story': return { width: 900, height: 1125, resize: 'cover', quality: 72 }
    case 'portrait': return { width: 1200, height: 1500, resize: 'cover', quality: 76 }
    case 'card': return { width: 720, height: 540, resize: 'cover', quality: 68 }
    case 'hero': return { width: 1600, quality: 78 }
    case 'original': return null
  }
}
