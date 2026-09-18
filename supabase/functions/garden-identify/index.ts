import { createClient } from 'npm:@supabase/supabase-js@2.115.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const openAiKey = Deno.env.get('OPENAI_API_KEY')
if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase configuration')

const allowed = new Set([
  'https://garden.getstreex.com',
  'https://streex-garden.vercel.app',
])
const cors = (origin: string | null) => ({
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': origin && allowed.has(origin) ? origin : 'https://garden.getstreex.com',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
})
const json = (body: unknown, status: number, origin: string | null) => new Response(JSON.stringify(body), { status, headers: cors(origin) })

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin')
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin)
  if (origin && !allowed.has(origin)) return json({ error: 'Origin not allowed' }, 403, origin)
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401, origin)
  const token = authorization.slice(7)
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } })
  const user = await userClient.auth.getUser(token)
  if (user.error || !user.data.user) return json({ error: 'Authentication required' }, 401, origin)
  if (!openAiKey) return json({ error: 'Identification is temporarily unavailable' }, 503, origin)

  const requestKey = 'identify:' + crypto.randomUUID()
  const started = await userClient.rpc('garden_ai_start_request', {
    p_request_key: requestKey,
    p_request_type: 'identify',
    p_evidence_refs: [{ kind: 'ephemeral_photo', id: 'identify_upload' }],
    p_proposal_schema_version: 'garden_identify_v1',
  })
  const auditId = !started.error && started.data && typeof started.data === 'object' ? (started.data as { id?: string }).id : undefined

  let body: { image_data_url?: unknown }
  try { body = await request.json() } catch { return json({ error: 'Invalid request' }, 400, origin) }
  if (typeof body.image_data_url !== 'string' || !body.image_data_url.startsWith('data:image/') || body.image_data_url.length > 7_000_000) {
    return json({ error: 'A valid plant photo is required' }, 400, origin)
  }

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['candidates','uncertainty'],
    properties: {
      candidates: { type: 'array', minItems: 1, maxItems: 3, items: {
        type: 'object', additionalProperties: false,
        required: ['species','scientific','variety','confidence'],
        properties: {
          species: { type: 'string' },
          scientific: { type: 'string' },
          variety: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        }
      }},
      uncertainty: { type: 'string' },
    }
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-5.6-luna',
      instructions: 'Identify the plant visible in the user photo. Return up to three plausible candidates. Do not claim certainty from weak visual evidence. Variety/cultivar may be empty when not visually supportable. This is a non-canonical suggestion that requires user confirmation.',
      input: [{ role: 'user', content: [
        { type: 'input_text', text: 'Suggest the most plausible plant identity candidates from this photo.' },
        { type: 'input_image', image_url: body.image_data_url },
      ]}],
      text: { format: { type: 'json_schema', name: 'garden_identify_v1', strict: true, schema } },
    }),
  })
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok || !payload) return json({ error: 'Identification failed' }, 502, origin)
  const output = Array.isArray(payload.output) ? payload.output : []
  let text = ''
  for (const item of output) {
    if (!item || typeof item !== 'object') continue
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as Record<string, unknown>).content as Array<Record<string, unknown>> : []
    for (const part of content) if (typeof part.text === 'string') text += part.text
  }
  let result: unknown
  try { result = JSON.parse(text) } catch {
    if (auditId) await userClient.rpc('garden_ai_finish_request', { p_request_id: auditId, p_status: 'failed', p_proposal: null, p_model_identifier: 'gpt-5.6-luna', p_duration_ms: null, p_usage_metadata: {}, p_error_code: 'invalid_structured_output' })
    return json({ error: 'Identification returned an invalid result' }, 502, origin)
  }
  if (auditId) await userClient.rpc('garden_ai_finish_request', { p_request_id: auditId, p_status: 'completed', p_proposal: result, p_model_identifier: 'gpt-5.6-luna', p_duration_ms: null, p_usage_metadata: {}, p_error_code: null })
  return json({ result }, 200, origin)
})
