import { createClient } from 'npm:@supabase/supabase-js@2.115.0'

const allowedOrigin = Deno.env.get('GARDEN_AI_ALLOWED_ORIGIN') ?? 'https://garden.getstreex.com'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': allowedOrigin,
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders })
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const requestKey = (value: unknown): value is string => typeof value === 'string' && value.length >= 16 && value.length <= 160 && /^[a-zA-Z0-9:_-]+$/.test(value)

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const featureEnabled = Deno.env.get('GARDEN_AI_ENABLED') === 'true'
const provider = Deno.env.get('GARDEN_AI_PROVIDER') ?? 'mock'
if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase server configuration')

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const origin = request.headers.get('Origin')
  if (origin && origin !== allowedOrigin) return json({ error: 'Origin not allowed' }, 403)
  if (!featureEnabled) return json({ error: 'Garden AI is disabled' }, 503)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401)
  const token = authorization.slice('Bearer '.length)
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
  const { data: userData, error: userError } = await userClient.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'Authentication required' }, 401)

  let body: { operation?: unknown; grow_cycle_id?: unknown; photo_id?: unknown; compare_photo_id?: unknown; question?: unknown; request_key?: unknown }
  try { body = await request.json() as typeof body } catch { return json({ error: 'Invalid request' }, 400) }
  if (!requestKey(body.request_key)) return json({ error: 'A valid request key is required' }, 400)

  if (body.operation === 'ai_check') {
    if (!uuid(body.grow_cycle_id) || !uuid(body.photo_id) || (body.compare_photo_id !== undefined && body.compare_photo_id !== null && !uuid(body.compare_photo_id))) return json({ error: 'AI Check requires valid cycle and photo identifiers' }, 400)
    // The real adapter is intentionally absent until the provider is approved.
    // Keep this endpoint fail-closed; it must never fabricate a proposal.
    if (provider !== 'mock') return json({ error: 'AI provider is not configured' }, 503)
    return json({ error: 'Mock AI gateway is available in local tests only', owner_id: userData.user.id, request_key: body.request_key }, 503)
  }
  if (body.operation === 'ask_garden') {
    if (typeof body.question !== 'string' || body.question.trim().length < 2 || body.question.length > 2000) return json({ error: 'Ask Garden question is invalid' }, 400)
    if (provider !== 'mock') return json({ error: 'AI provider is not configured' }, 503)
    return json({ error: 'Mock AI gateway is available in local tests only', owner_id: userData.user.id, request_key: body.request_key }, 503)
  }
  return json({ error: 'Unsupported AI operation' }, 400)
})
