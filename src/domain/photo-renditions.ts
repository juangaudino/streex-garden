export type PhotoRendition = 'thumbnail' | 'history' | 'story' | 'portrait' | 'card' | 'hero' | 'original'

export interface PhotoTransform {
  width?: number
  height?: number
  resize?: 'cover' | 'contain' | 'fill'
  quality?: number
}

/**
 * Presentation-only variants. Originals remain the canonical private evidence
 * and are requested only when a user opens an image at full size.
 */
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
