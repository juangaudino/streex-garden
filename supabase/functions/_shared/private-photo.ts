import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.115.0'

export type AuthorizedPhoto = {
  id: string
  storage_path: string
  content_type: string
  byte_size: number
}

function renditionPath(originalPath: string): string {
  const separator = originalPath.lastIndexOf('/')
  return separator < 0 ? originalPath : `${originalPath.slice(0, separator)}/display.jpg`
}

/**
 * Downloads only a path returned by the owner-scoped context wrapper. The
 * owner prefix check prevents a future caller from turning this into an
 * arbitrary service-role Storage reader.
 */
export async function readAuthorizedPhoto(
  storage: SupabaseClient,
  ownerId: string,
  photo: AuthorizedPhoto,
): Promise<{ bytes: Uint8Array; contentType: string; usedRendition: boolean }> {
  if (!photo.storage_path.startsWith(`${ownerId}/`)) throw new Error('Photo path is outside the owner scope')
  const candidates = [renditionPath(photo.storage_path), photo.storage_path]
  for (const [index, path] of candidates.entries()) {
    const { data, error } = await storage.storage.from('garden-originals').download(path)
    if (!error && data) return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: index === 0 ? 'image/jpeg' : photo.content_type, usedRendition: index === 0 }
  }
  throw new Error('Authorized photo is unavailable')
}
