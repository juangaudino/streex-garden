import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.115.0'
import { getR2PhotoObject, type R2PhotoTier } from './r2-photo-storage.ts'

export type AuthorizedPhoto = {
  id: string
  storage_path: string
  content_type: string
  byte_size: number
}

/**
 * Downloads only the exact rendition of a path returned by an owner-scoped
 * context wrapper. R2 object existence is never treated as authorization.
 */
export async function readAuthorizedPhoto(
  _storage: SupabaseClient,
  ownerId: string,
  photo: AuthorizedPhoto,
  rendition: R2PhotoTier = 'display',
): Promise<{ bytes: Uint8Array; contentType: string; usedRendition: boolean }> {
  if (!photo.storage_path.startsWith(`${ownerId}/`)) throw new Error('Photo path is outside the owner scope')
  const object = await getR2PhotoObject(photo.storage_path, rendition)
  return { bytes: object.bytes, contentType: object.contentType, usedRendition: rendition !== 'master' }
}
