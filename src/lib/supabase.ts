import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null
let refreshingSession: Promise<void> | null = null

export function hasSupabaseConfiguration(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
}

export function getSupabaseClient(): SupabaseClient {
  if (!hasSupabaseConfiguration()) {
    throw new Error('Streex Garden todavía no está conectado a su proyecto Supabase.')
  }
  const sessionFetch = async (input: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
    const response = await fetch(input, { ...options, cache: 'no-store' })
    const target = String(input)
    if (response.status !== 401 || target.includes('/auth/v1/')) return response
    refreshingSession ??= Promise.resolve(client?.auth.refreshSession()).then(() => undefined).finally(() => { refreshingSession = null })
    await refreshingSession
    const session = await client?.auth.getSession()
    const headers = new Headers(options?.headers)
    if (session?.data.session?.access_token) headers.set('Authorization', `Bearer ${session.data.session.access_token}`)
    return fetch(input, { ...options, headers, cache: 'no-store' })
  }
  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        global: {
          fetch: sessionFetch,
        },
      },
    )
  }
  return client
}
