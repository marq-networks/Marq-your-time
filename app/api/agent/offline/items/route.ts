import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const allowed = ['admin','manager','owner','super_admin']
  if (!allowed.includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const sync_queue_id = searchParams.get('sync_queue_id') || ''
  if (!sync_queue_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'NOT_SUPPORTED_IN_MEMORY_MODE' }, { status: 400 })
  const { data } = await sb.from('agent_sync_items').select('*').eq('sync_queue_id', sync_queue_id).order('item_index', { ascending: true })
  const redact = role === 'super_admin'
  const items = (data || []).map((r: any) => {
    let payload = r.payload_json
    if (redact && payload && typeof payload === 'object') {
      if ('url' in payload) payload = { ...payload, url: undefined }
      if ('image_base64' in payload) payload = { ...payload, image_base64: undefined }
    }
    return { item_index: r.item_index, payload_type: r.payload_type, payload }
  })
  return NextResponse.json({ items })
}

