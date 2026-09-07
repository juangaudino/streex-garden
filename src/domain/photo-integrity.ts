import type { PhotoContentType } from './types'

const supportedPhotoTypes = new Set<PhotoContentType>(['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'])

const extensionTypes: Record<string, PhotoContentType> = {
  jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp',
}

export function photoContentType(file: File): PhotoContentType | null {
  if (supportedPhotoTypes.has(file.type as PhotoContentType)) return file.type as PhotoContentType
  const extension = file.name.split('.').pop()?.toLowerCase()
  return extension ? extensionTypes[extension] ?? null : null
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  if (!crypto.subtle) {
    throw new Error('La verificación de integridad de fotos requiere una conexión segura (HTTPS).')
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
