import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || null
  if (role && !['admin','owner','super_admin','manager'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const level = body.level
  const department_id = body.department_id || body.departmentId || null
  const member_id = body.member_id || body.memberId || null
  const title = body.title
  const period_start = body.period_start || body.periodStart
  const period_end = body.period_end || body.periodEnd
  if (!org_id || !level || !title || !period_start || !period_end) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })
  const now = new Date()
  const payload = { org_id, level, department_id, member_id, title, period_start, period_end, created_at: now, created_by: actor }
  const { data, error } = await sb.from('okr_sets').insert(payload).select('*').single()
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
