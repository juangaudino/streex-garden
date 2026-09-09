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

/** Reads the standard JPEG EXIF DateTimeOriginal/OffsetTimeOriginal pair without modifying bytes. */
export async function readExifCapture(file: Blob): Promise<string | null> {
  if (file.type !== 'image/jpeg') return null
  const bytes = new Uint8Array(await file.slice(0, 2_000_000).arrayBuffer())
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue }
    const marker = bytes[offset + 1]
    const size = (bytes[offset + 2] << 8) | bytes[offset + 3]
    if (marker === 0xe1 && bytes.slice(offset + 4, offset + 10).every((value, index) => value === [0x45, 0x78, 0x69, 0x66, 0x00, 0x00][index])) {
      const start = offset + 10
      const view = new DataView(bytes.buffer)
      const little = view.getUint16(start) === 0x4949
      const u16 = (at: number) => view.getUint16(at, little)
      const u32 = (at: number) => view.getUint32(at, little)
      const tagValue = (ifd: number, wanted: number): number | null => {
        const count = u16(ifd)
        for (let index = 0; index < count; index += 1) {
          const entry = ifd + 2 + index * 12
          if (u16(entry) === wanted) return entry
        }
        return null
      }
      const ifd0 = start + u32(start + 4)
      const exifPointer = tagValue(ifd0, 0x8769)
      if (exifPointer !== null) {
        const exifIfd = start + u32(exifPointer + 8)
        const dateEntry = tagValue(exifIfd, 0x9003)
        if (dateEntry !== null) {
          const pointer = start + u32(dateEntry + 8)
          const text = new TextDecoder().decode(bytes.slice(pointer, pointer + 20)).replace(/\0.*$/, '')
          const match = text.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
          if (match) return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`
        }
      }
      return null
    }
    offset += 2 + size
  }
  return null
}
