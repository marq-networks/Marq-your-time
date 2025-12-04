import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

function allowed(role: string) { return ['admin','owner','integration_manager','super_admin'].includes(role) }

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allowed(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const webhook_id = searchParams.get('webhook_id') || ''
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200)
  if (!webhook_id) return NextResponse.json({ items: [] })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ items: [] })
  const { data } = await sb.from('webhook_events').select('*').eq('webhook_id', webhook_id).order('created_at', { ascending: false }).limit(limit)
  const items = (data || []).map((r: any) => ({ id: r.id, event_type: r.event_type, status: r.status, attempt_count: Number(r.attempt_count || 0), last_attempt_at: r.last_attempt_at || null, error_message: r.error_message || null, created_at: r.created_at }))
  return NextResponse.json({ items })
}
