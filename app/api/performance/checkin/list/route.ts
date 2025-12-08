import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listTeamMemberIds } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const member_id = searchParams.get('member_id') || searchParams.get('memberId') || undefined
  const period_start = searchParams.get('period_start') || searchParams.get('periodStart') || undefined
  const period_end = searchParams.get('period_end') || searchParams.get('periodEnd') || undefined
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ items: [] })
  let q = sb.from('performance_checkins').select('*').eq('org_id', org_id)
  if (member_id) q = q.eq('member_id', member_id)
  if (period_start && period_end) q = q.gte('period_start', period_start).lte('period_end', period_end)
  if (role === 'manager' && actor && !member_id) {
    const allow = await listTeamMemberIds(org_id, actor)
    if (allow.length) q = q.in('member_id', allow)
  }
  if (role === 'member' && actor) q = q.eq('member_id', actor)
  const { data } = await q.order('created_at', { ascending: false })
  const items = (data || []).map((r: any) => ({
    id: r.id,
    org_id: r.org_id,
    member_id: r.member_id,
    period_start: r.period_start,
    period_end: r.period_end,
    summary: r.summary || '',
    self_score: r.self_score !== null ? Number(r.self_score) : null,
    manager_score: r.manager_score !== null ? Number(r.manager_score) : null,
    created_at: r.created_at,
    created_by: r.created_by || null
  }))
  return NextResponse.json({ items })
}

