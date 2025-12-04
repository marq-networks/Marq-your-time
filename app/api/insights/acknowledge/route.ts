import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { getUser } from '@lib/db'

export async function POST(req: NextRequest) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'NOT_SUPPORTED_IN_MEMORY_MODE' }, { status: 400 })
  const body = await req.json().catch(()=>({}))
  const insight_id = body.insight_id || body.insightId
  const actor = (req.headers.get('x-user-id') || '').trim() || null
  const role = (req.headers.get('x-role') || '').trim() || null
  if (!insight_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const { data: existing } = await sb.from('productivity_insights').select('*').eq('id', insight_id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const isSuper = role === 'super_admin'
  const actorUser = actor ? await getUser(actor) : undefined
  const sameOrg = actorUser ? existing.org_id && actorUser.orgId === String(existing.org_id) : false
  const selfAck = actor && existing.member_id && actor === String(existing.member_id)
  if (!isSuper && !sameOrg) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!isSuper && !selfAck) {
    const allowed = true
    if (!allowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const now = new Date()
  const { data, error } = await sb.from('productivity_insights').update({ acknowledged: true, acknowledged_at: now, acknowledged_by: actor }).eq('id', insight_id).select('*').single()
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ item: data })
}
