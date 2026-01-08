import { createClient } from '@supabase/supabase-js'

export function isSupabaseConfigured() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY
  return !!url && !!key
}

export function supabaseServer() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) as string
  const key = (process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY) as string
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      fetch: (url, options) => {
        return fetch(url, { ...options, cache: 'no-store' })
      }
    }
  })
}
