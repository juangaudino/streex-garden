import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function hasSupabaseConfiguration(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
}

export function getSupabaseClient(): SupabaseClient {
  if (!hasSupabaseConfiguration()) {
    throw new Error('Streex Garden todavía no está conectado a su proyecto Supabase.')
  }
  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        global: {
          fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
        },
      },
    )
  }
  return client
}
