import { NextRequest } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') || ''
  if (!id) return new Response(JSON.stringify({ error: 'MISSING_ID' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('privacy_requests').select('*').eq('id', id).maybeSingle()
    if (!data) return new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    const payload = data.notes || ''
    return new Response(payload || '{}', { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="export_${id}.json"` } })
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="export_${id}.json"` } })
}
