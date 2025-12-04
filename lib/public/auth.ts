import { NextRequest } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import crypto from 'crypto'

export type PublicClient = { clientId: string, orgId: string, scopes: string[] }

function getBearer(req: NextRequest) {
  const h = req.headers.get('authorization') || ''
  const parts = h.split(' ')
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') return parts[1]
  return ''
}

export function hashApiKey(key: string) {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export async function authenticatePublicApi(req: NextRequest): Promise<PublicClient | null> {
  const key = getBearer(req)
  if (!key) return null
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return null
  const hash = hashApiKey(key)
  const { data } = await sb.from('api_clients').select('*').eq('api_key_hash', hash).eq('is_active', true).limit(1).maybeSingle()
  if (!data) return null
  const now = new Date()
  await sb.from('api_clients').update({ last_used_at: now }).eq('id', data.id)
  const scopes: string[] = Array.isArray(data.scopes) ? data.scopes : []
  return { clientId: String(data.id), orgId: String(data.org_id), scopes }
}

export function hasScope(scopes: string[], required: string) {
  if (scopes.includes(required)) return true
  for (const s of scopes) {
    const idx = s.indexOf(':')
    if (idx > 0 && s.endsWith(':*')) {
      const pref = s.slice(0, idx)
      if (required.startsWith(pref + ':')) return true
    }
  }
  return false
}
