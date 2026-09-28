import { createClient } from 'npm:@supabase/supabase-js@2.115.0'
import { deleteR2PhotoObjects, getR2PhotoObject, putR2PhotoObject, type R2PhotoTier, sha256Hex } from '../_shared/r2-photo-storage.ts'
import { verifyGuestMediaSignature } from '../_shared/guest-media-ticket.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const allowedOrigin = Deno.env.get('GARDEN_MEDIA_ALLOWED_ORIGIN') ?? 'https://garden.getstreex.com'
if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Missing Supabase server configuration')

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, GET, OPTIONS, POST',
  'Access-Control-Allow-Origin': allowedOrigin,
  'Cache-Control': 'no-store',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })
const forbidden = () => new Response(JSON.stringify({ error: 'Photo is not available to this user' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })
const conflict = (message: string) => new Response(JSON.stringify({ error: message }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })
const uuid = (value: string | undefined): value is string => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
const tier = (value: string | undefined): R2PhotoTier | null => value === 'master' || value === 'display' || value === 'preview' ? value : null
const maxBytes = 30 * 1024 * 1024

function pathParts(request: Request) {
  const url = new URL(request.url)
  const parts = url.pathname.split('/').filter(Boolean)
  const photoIndex = parts.findIndex((part) => part === 'photos')
  const gardenIndex = parts.findIndex((part) => part === 'gardens')
  const guestIndex = parts.findIndex((part) => part === 'guest')
  return { photoId: photoIndex >= 0 ? parts[photoIndex + 1] : guestIndex >= 0 ? parts[guestIndex + 2] : undefined, tier: photoIndex >= 0 ? parts[photoIndex + 2] : guestIndex >= 0 ? parts[guestIndex + 3] : undefined, gardenId: gardenIndex >= 0 ? parts[gardenIndex + 1] : undefined, guest: guestIndex >= 0 }
}

function authenticatedClient(authorization: string) {
  return createClient(supabaseUrl!, anonKey!, { global: { headers: { Authorization: authorization } }, auth: { autoRefreshToken: false, persistSession: false } })
}

function adminClient() {
  return createClient(supabaseUrl!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function requireUser(request: Request) {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) throw new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })
  const client = authenticatedClient(authorization)
  const { data, error } = await client.auth.getUser(authorization.slice('Bearer '.length))
  if (error || !data.user) throw new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })
  return { client, user: data.user }
}

async function authorizedPhoto(client: ReturnType<typeof authenticatedClient>, photoId: string, operation: 'upload' | 'read' | 'delete') {
  const { data, error } = await client.rpc('garden_media_authorize_photo', { p_photo_id: photoId, p_operation: operation })
  if (error || !data || typeof data !== 'object') throw forbidden()
  const photo = data as { photo_id: string; owner_id: string; storage_path: string; content_type: string; checksum_sha256: string | null; upload_status: string; width: number | null; height: number | null }
  if (!uuid(photo.photo_id) || !uuid(photo.owner_id)) throw conflict('Photo identity is invalid')
  const canonicalPath = `${photo.owner_id}/${photo.photo_id}/original.jpg`
  if (photo.storage_path !== canonicalPath) throw conflict('Photo path is not eligible for R2 media')
  return { ...photo, storage_path: canonicalPath }
}

function imageFile(form: FormData, name: string) {
  const value = form.get(name)
  return value instanceof File && value.type === 'image/jpeg' && value.size > 0 && value.size <= maxBytes ? value : null
}

async function upload(request: Request, photoId: string) {
  const { client } = await requireUser(request)
  const photo = await authorizedPhoto(client, photoId, 'upload')
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ error: 'Photo media upload body is invalid' }, 400)
  }
  const storagePath = form.get('storage_path')
  if (storagePath !== photo.storage_path) return json({ error: 'Photo storage path mismatch' }, 400)
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/original\.jpg$/i.test(photo.storage_path)) return json({ error: 'Photo path is not eligible for R2 media' }, 409)
  const files = { master: imageFile(form, 'master'), display: imageFile(form, 'display'), preview: imageFile(form, 'preview') }
  if (!files.master || !files.display || !files.preview) return json({ error: 'All Garden photo renditions are required' }, 400)
  const expectedMasterChecksum = form.get('master_sha256')
  if (typeof expectedMasterChecksum !== 'string' || !/^[0-9a-f]{64}$/i.test(expectedMasterChecksum)) return json({ error: 'Master checksum is required' }, 400)
  if (photo.checksum_sha256 !== expectedMasterChecksum) return json({ error: 'Master checksum does not match canonical metadata' }, 409)
  const dimensions = { width: Number(form.get('width')), height: Number(form.get('height')) }
  if (!Number.isInteger(dimensions.width) || dimensions.width < 1 || !Number.isInteger(dimensions.height) || dimensions.height < 1) return json({ error: 'Photo dimensions are invalid' }, 400)

  const written: R2PhotoTier[] = []
  try {
    for (const current of ['master', 'display', 'preview'] as const) {
      const bytes = new Uint8Array(await files[current]!.arrayBuffer())
      const checksum = await sha256Hex(bytes)
      const result = await putR2PhotoObject({ storagePath: photo.storage_path, tier: current, bytes, contentType: 'image/jpeg', cacheControl: 'private, max-age=31536000, immutable', checksumSha256: checksum })
      if (current === 'master' && checksum !== expectedMasterChecksum) throw new Error('Master checksum does not match uploaded bytes')
      if (result.created) written.push(current)
    }
    const finalized = await adminClient().rpc('garden_media_finalize_photo', { p_photo_id: photoId, p_checksum_sha256: expectedMasterChecksum, p_width: dimensions.width, p_height: dimensions.height })
    if (finalized.error) throw new Error('Photo finalization failed')
    return json({ photo_id: photoId, upload_status: 'uploaded', renditions: ['master', 'display', 'preview'] })
  } catch (error) {
    if (written.length) {
      try {
        // Cleanup is limited to keys created by this attempt. Existing immutable
        // objects are never removed during a retry or collision.
        await deleteR2PhotoObjects(photo.storage_path, written)
      } catch { /* pending canonical state remains retryable */ }
    }
    console.error('garden-media upload failed', error instanceof Error ? error.message : 'unknown error')
    return json({ error: 'Photo media upload could not be completed' }, 502)
  }
}

async function read(request: Request, photoId: string, rendition: string | undefined) {
  const currentTier = tier(rendition)
  if (!currentTier) return json({ error: 'A valid rendition is required' }, 400)
  const { client } = await requireUser(request)
  const photo = await authorizedPhoto(client, photoId, 'read')
  const object = await getR2PhotoObject(photo.storage_path, currentTier)
    return new Response(object.bytes.buffer.slice(object.bytes.byteOffset, object.bytes.byteOffset + object.bytes.byteLength) as ArrayBuffer, { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=3600', 'Content-Type': object.contentType, 'Content-Length': String(object.bytes.byteLength), 'X-Content-Type-Options': 'nosniff' } })
}

function containsGuestPhoto(value: unknown, photoId: string): { storage_path: string; upload_status?: string } | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = containsGuestPhoto(item, photoId)
      if (found) return found
    }
    return null
  }
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (record.id === photoId && typeof record.storage_path === 'string') return { storage_path: record.storage_path, upload_status: typeof record.upload_status === 'string' ? record.upload_status : undefined }
  for (const child of Object.values(record)) {
    const found = containsGuestPhoto(child, photoId)
    if (found) return found
  }
  return null
}

async function guestRead(request: Request, photoId: string, rendition: string | undefined) {
  const currentTier = tier(rendition)
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const expires = Number(url.searchParams.get('expires'))
  const signature = url.searchParams.get('sig') ?? ''
  if (!currentTier || !token || !uuid(photoId) || !/^[0-9a-f-]{36}$/i.test(token) || !(await verifyGuestMediaSignature(token, photoId, currentTier, expires, signature))) return json({ error: 'Guest photo not found' }, 404)
  const admin = adminClient()
  const tokenHash = await sha256Hex(new TextEncoder().encode(token.toLowerCase()))
  let photo: { storage_path: string; upload_status?: string } | null = null
  for (const rpc of ['garden_get_guest_garden_story', 'garden_get_guest_plant_story_v2']) {
    const response = await admin.rpc(rpc, { p_token_hash: tokenHash })
    if (!response.error) {
      photo = containsGuestPhoto(response.data, photoId)
      if (photo) break
    }
  }
  if (!photo || photo.upload_status !== 'uploaded') return json({ error: 'Guest photo not found' }, 404)
  try {
    const object = await getR2PhotoObject(photo.storage_path, currentTier)
    return new Response(object.bytes.buffer.slice(object.bytes.byteOffset, object.bytes.byteOffset + object.bytes.byteLength) as ArrayBuffer, { status: 200, headers: { ...corsHeaders, 'Cache-Control': 'private, max-age=300', 'Content-Type': object.contentType, 'Content-Length': String(object.bytes.byteLength), 'X-Content-Type-Options': 'nosniff' } })
  } catch {
    return json({ error: 'Guest photo not found' }, 404)
  }
}

async function remove(request: Request, photoId: string) {
  const { client } = await requireUser(request)
  await authorizedPhoto(client, photoId, 'delete')
  const deleted = await client.rpc('garden_x_delete_photo', { p_request_id: crypto.randomUUID(), p_photo_id: photoId })
  if (deleted.error) return json({ error: 'Photo deletion was not authorized' }, 403)
  const response = deleted.data as { storage_path?: string } | null
  if (response?.storage_path) {
    try { await deleteR2PhotoObjects(response.storage_path) } catch (error) {
      console.error('garden-media delete cleanup failed', error instanceof Error ? error.message : 'unknown error')
      return json({ error: 'Photo record deleted; media cleanup is pending' }, 202)
    }
  }
  return json({ photo_id: photoId, deleted: true })
}

async function removeGarden(request: Request, gardenId: string) {
  const { client } = await requireUser(request)
  const deleted = await client.rpc('garden_x_delete_garden', { p_request_id: crypto.randomUUID(), p_garden_id: gardenId })
  if (deleted.error) return json({ error: 'Garden deletion was not authorized' }, 403)
  const response = deleted.data as { storage_paths?: string[]; storage_path_count?: number } | null
  const paths = Array.isArray(response?.storage_paths) ? response.storage_paths.filter((path): path is string => typeof path === 'string' && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/original\.jpg$/i.test(path)) : []
  try {
    await Promise.all(paths.map((path) => deleteR2PhotoObjects(path)))
    return json({ deleted: true, storage_path_count: response?.storage_path_count ?? paths.length })
  } catch (error) {
    console.error('garden-media garden cleanup failed', error instanceof Error ? error.message : 'unknown error')
    return json({ deleted: true, storage_path_count: response?.storage_path_count ?? paths.length, cleanup_pending: true }, 202)
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const origin = request.headers.get('Origin')
  if (origin && origin !== allowedOrigin) return json({ error: 'Origin not allowed' }, 403)
  const { photoId, tier: rendition, gardenId, guest } = pathParts(request)
  if (request.method === 'GET' && guest && photoId) return await guestRead(request, photoId, rendition)
  if (request.method === 'DELETE' && gardenId && uuid(gardenId)) return await removeGarden(request, gardenId)
  if (!uuid(photoId)) return json({ error: 'A valid photo id is required' }, 400)
  try {
    if (request.method === 'POST') return await upload(request, photoId)
    if (request.method === 'GET') return await read(request, photoId, rendition)
    if (request.method === 'DELETE') return await remove(request, photoId)
    return json({ error: 'Method not allowed' }, 405)
  } catch (error) {
    if (error instanceof Response) return error
    console.error('garden-media request failed', error instanceof Error ? error.message : 'unknown error')
    return json({ error: 'Garden media request failed' }, 502)
  }
})
