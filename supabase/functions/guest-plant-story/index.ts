import { createClient } from 'npm:@supabase/supabase-js@2.115.0'
import { guestMediaSignature } from '../_shared/guest-media-ticket.ts'

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

  const { data, error } = await admin.rpc('garden_get_guest_plant_story_v2', { p_token_hash: await sha256Hex(body.token.toLowerCase()) })
  if (error || !data) return json({ error: 'Guest story not found' }, 404)

  const story = data as { history?: StoryEvent[]; [key: string]: unknown }
  const history = story.history ?? []
  const mediaUrl = async (photo: StoryPhoto, requestedTier: 'master' | 'display') => {
    if (photo.upload_status !== 'uploaded' || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/original\.jpg$/i.test(photo.storage_path)) return null
    const expires = Math.floor(Date.now() / 1000) + signedUrlLifetimeSeconds
    const sig = await guestMediaSignature(body.token as string, photo.id, requestedTier, expires)
    return `${supabaseUrl}/functions/v1/garden-media/guest/photos/${photo.id}/${requestedTier}?token=${encodeURIComponent(body.token as string)}&expires=${expires}&sig=${sig}`
  }

  const safeHistory = await Promise.all(history.map(async (event) => {
    if (!event.photo) return event
    const originalUrl = await mediaUrl(event.photo, 'master')
    const displayUrl = await mediaUrl(event.photo, 'display')
    return { ...event, photo: displayUrl ? { ...event.photo, url: displayUrl, original_url: originalUrl ?? undefined, storage_path: undefined } : null }
  }))
  return json({ story: { ...story, history: safeHistory }, expires_in: signedUrlLifetimeSeconds })
})
