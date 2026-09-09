import { createClient } from 'npm:@supabase/supabase-js@2.115.0'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}
const signedUrlLifetimeSeconds = 5 * 60

type StoryPhoto = {
  id: string
  storage_path: string
  original_filename: string
  content_type: string
  byte_size: number
  captured_at: string | null
  captured_at_precision: string
  upload_status: string
}

type StoryEvent = {
  id: string
  event_type: string
  occurred_at: string | null
  occurred_at_precision: string
  occurred_on: string | null
  note: string | null
  photo: StoryPhoto | null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function isGuestToken(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server configuration')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { token?: unknown }
  try { body = await request.json() as { token?: unknown } } catch { return json({ error: 'Invalid request' }, 400) }
  if (!isGuestToken(body.token)) return json({ error: 'Guest story not found' }, 404)

  const { data, error } = await admin.rpc('garden_get_guest_plant_story', { p_token_hash: await sha256Hex(body.token.toLowerCase()) })
  if (error || !data) return json({ error: 'Guest story not found' }, 404)

  const story = data as { history?: StoryEvent[]; [key: string]: unknown }
  const history = story.history ?? []
  const photoEvents = history.filter((event) => event.photo?.upload_status === 'uploaded' && event.photo.storage_path)
  const paths = photoEvents.map((event) => event.photo!.storage_path)
  let signedByPath = new Map<string, string>()
  if (paths.length > 0) {
    const signed = await admin.storage.from('garden-originals').createSignedUrls(paths, signedUrlLifetimeSeconds)
    if (signed.error) return json({ error: 'Guest story temporarily unavailable' }, 503)
    signedByPath = new Map((signed.data?.signedUrls ?? []).flatMap((item) => item.signedUrl ? [[item.path, item.signedUrl] as [string, string]] : []))
  }

  const safeHistory = history.map((event) => {
    if (!event.photo) return event
    const signedUrl = signedByPath.get(event.photo.storage_path)
    return { ...event, photo: signedUrl ? { ...event.photo, url: signedUrl, storage_path: undefined } : null }
  })
  return json({ story: { ...story, history: safeHistory }, expires_in: signedUrlLifetimeSeconds })
})
