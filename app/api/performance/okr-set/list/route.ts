import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listTeamMemberIds } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const level = searchParams.get('level') || undefined
  const department_id = searchParams.get('department_id') || searchParams.get('departmentId') || undefined
  const member_id = searchParams.get('member_id') || searchParams.get('memberId') || undefined
  const period_start = searchParams.get('period_start') || searchParams.get('periodStart') || undefined
  const period_end = searchParams.get('period_end') || searchParams.get('periodEnd') || undefined
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ items: [] })
  let q = sb.from('okr_sets').select('*, okr_objectives(*, okr_key_results(*))').eq('org_id', org_id)
  if (level) q = q.eq('level', level)
  if (department_id) q = q.eq('department_id', department_id)
  if (member_id) q = q.eq('member_id', member_id)
  if (period_start && period_end) q = q.gte('period_start', period_start).lte('period_end', period_end)
  if (role === 'manager' && actor) {
    const allow = await listTeamMemberIds(org_id, actor)
    if (allow.length) q = q.or(`level.eq.company,level.eq.department,member_id.in.(${allow.join(',')})`)
  }
  if (role === 'member' && actor) {
    q = q.eq('member_id', actor)
  }
  const { data } = await q.order('created_at', { ascending: false })
  const items = (data || []).map((s: any) => ({
    id: s.id,
    org_id: s.org_id,
    level: s.level,
    department_id: s.department_id || null,
    member_id: s.member_id || null,
    title: s.title,
    period_start: s.period_start,
    period_end: s.period_end,
    objectives: (s.okr_objectives || []).map((o: any) => ({
      id: o.id,
      title: o.title,
      description: o.description || '',
      weight: Number(o.weight || 1),
      key_results: (o.okr_key_results || []).map((k: any) => ({
        id: k.id,
        label: k.label,
        target_value: k.target_value !== null ? Number(k.target_value) : null,
        current_value: Number(k.current_value || 0),
        unit: k.unit || null,
        direction: k.direction || null
      }))
    }))
  }))
  return NextResponse.json({ items })
}
