import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

function allow(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (auth.toLowerCase().startsWith('bearer ')) return true
  const allowed = ['admin','manager','owner','super_admin']
  return allowed.includes(role)
}

export async function GET(req: NextRequest) {
  if (!allow(req)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const device_id = searchParams.get('device_id') || undefined
  const member_id = searchParams.get('member_id') || undefined
  const org_id = searchParams.get('org_id') || undefined
  const limit = Number(searchParams.get('limit') || 50)
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'NOT_SUPPORTED_IN_MEMORY_MODE' }, { status: 400 })
  let q = sb.from('agent_sync_queues').select('*').order('received_at', { ascending: false }).limit(limit)
  if (device_id) q = q.eq('device_id', device_id)
  if (member_id) q = q.eq('member_id', member_id)
  if (org_id) q = q.eq('org_id', org_id)
  const { data: batches } = await q
  let c = sb.from('agent_sync_conflicts').select('*').order('created_at', { ascending: false }).limit(limit)
  if (device_id) c = c.eq('device_id', device_id)
  if (member_id) c = c.eq('member_id', member_id)
  if (org_id) c = c.eq('org_id', org_id)
  const { data: conflicts } = await c
  const outBatches = (batches || []).map((r: any) => ({ id: r.id, device_id: r.device_id, member_id: r.member_id, org_id: r.org_id, local_batch_id: r.local_batch_id, batch_type: r.batch_type, status: r.status, item_count: r.item_count, received_at: r.received_at, processed_at: r.processed_at ?? null, error_message: r.error_message ?? null }))
  const outConflicts = (conflicts || []).map((r: any) => ({ id: r.id, device_id: r.device_id, member_id: r.member_id, org_id: r.org_id, conflict_type: r.conflict_type, created_at: r.created_at }))
  return NextResponse.json({ batches: outBatches, conflicts: outConflicts })
}
