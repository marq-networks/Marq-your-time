import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  const allowed = ['admin','manager','owner','super_admin']
  if (!allowed.includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const conflict_id = body.conflict_id
  const resolution_note = body.resolution_note || ''
  if (!conflict_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'NOT_SUPPORTED_IN_MEMORY_MODE' }, { status: 400 })
  const now = new Date()
  const { data: prev } = await sb.from('agent_sync_conflicts').select('*').eq('id', conflict_id).limit(1).maybeSingle()
  if (!prev) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const details = { ...(prev.details || {}), resolution_note }
  const { data } = await sb.from('agent_sync_conflicts').update({ resolved: true, resolved_at: now, resolved_by: actor || null, details }).eq('id', conflict_id).select('*').single()
  return NextResponse.json({ conflict: { id: data.id, resolved: data.resolved, resolved_at: data.resolved_at, resolved_by: data.resolved_by } })
}

