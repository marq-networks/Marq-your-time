import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  if (role && !['admin','owner','super_admin','manager','member'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const member_id = body.member_id || body.memberId
  const period_start = body.period_start || body.periodStart
  const period_end = body.period_end || body.periodEnd
  const summary = body.summary || null
  const self_score = body.self_score ?? body.selfScore
  const manager_score = body.manager_score ?? body.managerScore
  if (!org_id || !member_id || !period_start || !period_end) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  if (role === 'member' && String(member_id) !== String(actor)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })
  const now = new Date()
  const payload = { org_id, member_id, period_start, period_end, summary, self_score, manager_score, created_at: now, created_by: actor || null }
  const { data, error } = await sb.from('performance_checkins').insert(payload).select('*').single()
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
