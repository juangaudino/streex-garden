import { createClient } from 'npm:@supabase/supabase-js@2.115.0'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}
const lifetime = 5 * 60

function displayPath(originalPath: string): string {
  const separator = originalPath.lastIndexOf('/')
  return separator < 0 ? originalPath : `${originalPath.slice(0, separator)}/display.jpg`
}
const urlHash = async (value: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders })
const validToken = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase server configuration')
const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  let body: { token?: unknown }
  try { body = await request.json() as { token?: unknown } } catch { return json({ error: 'Invalid request' }, 400) }
  if (!validToken(body.token)) return json({ error: 'Guest garden story not found' }, 404)
  const { data, error } = await admin.rpc('garden_get_guest_garden_story', { p_token_hash: await urlHash(body.token.toLowerCase()) })
  if (error || !data) return json({ error: 'Guest garden story not found' }, 404)
  const story = data as { history?: Array<{ photo?: { storage_path?: string; [key: string]: unknown } | null }>; [key: string]: unknown }
  const originalPaths = (story.history ?? []).flatMap((event) => event.photo?.storage_path ? [event.photo.storage_path] : [])
  const paths = [...new Set(originalPaths.flatMap((path) => [displayPath(path), path]))]
  let signedByPath = new Map<string, string>()
  if (paths.length > 0) {
    const signed = await admin.storage.from('garden-originals').createSignedUrls(paths, lifetime)
    if (signed.error) return json({ error: 'Guest garden story temporarily unavailable' }, 503)
    signedByPath = new Map((signed.data ?? []).flatMap((item) => item.signedUrl ? [[item.path, item.signedUrl] as [string, string]] : []))
  }
  const safeHistory = (story.history ?? []).map((event) => {
    if (!event.photo?.storage_path) return event
    const originalUrl = signedByPath.get(event.photo.storage_path)
    const displayUrl = signedByPath.get(displayPath(event.photo.storage_path))
    return { ...event, photo: originalUrl ? { ...event.photo, url: displayUrl ?? originalUrl, original_url: displayUrl ? originalUrl : undefined, storage_path: undefined } : null }
  })
  return json({ story: { ...story, history: safeHistory }, expires_in: lifetime })
})
