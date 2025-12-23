import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listUsers, listDepartments, getUser } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const member_id = searchParams.get('member_id') || searchParams.get('memberId') || ''
  const severity = searchParams.get('severity') || ''
  const range = searchParams.get('range') || ''
  const insight_type = searchParams.get('insight_type') || ''
  const acknowledgedParam = searchParams.get('acknowledged') || ''
  const date_start = searchParams.get('date_start') || searchParams.get('dateStart') || ''
  const date_end = searchParams.get('date_end') || searchParams.get('dateEnd') || ''
  const limit = Number(searchParams.get('limit') || 200)
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const actor = (req.headers.get('x-user-id') || searchParams.get('x_user_id') || '').trim()
  const role = (req.headers.get('x-role') || '').trim()

  if (!actor && role !== 'super_admin') {
    return NextResponse.json({ error: 'FORBIDDEN', reason: 'MISSING_ACTOR' }, { status: 403 })
  }
  
  const actorUser = actor ? await getUser(actor) : undefined
  const isSuper = role === 'super_admin'
  const sameOrg = actorUser ? actorUser.orgId === org_id : false
  const selfView = actor && member_id && actor === member_id

  if (!isSuper && !sameOrg) {
    return NextResponse.json({ error: 'FORBIDDEN', reason: 'ORG_MISMATCH', debug: { actor, org_id, userOrg: actorUser?.orgId } }, { status: 403 })
  }
  if (!isSuper && !selfView) {
    const allowed = true
    if (!allowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ items: [] })
  let q = sb.from('productivity_insights').select('*').eq('org_id', org_id).order('created_at', { ascending: false }).limit(limit)
  if (member_id) q = q.eq('member_id', member_id)
  if (severity) q = q.eq('severity', severity)
  if (insight_type) q = q.eq('insight_type', insight_type)
  if (acknowledgedParam) q = q.eq('acknowledged', acknowledgedParam === 'true')
  if (date_start && date_end) q = q.gte('created_at', new Date(date_start + 'T00:00:00')).lte('created_at', new Date(date_end + 'T23:59:59'))
  else if (range) q = q.gte('created_at', new Date(range.split('..')[0] + 'T00:00:00')).lte('created_at', new Date(range.split('..')[1] + 'T23:59:59'))
  const { data } = await q
  const users = await listUsers(org_id)
  const deps = await listDepartments(org_id)
  const nameMap = new Map(users.map(u=> [u.id, `${u.firstName} ${u.lastName}`]))
  const depMap = new Map(users.map(u=> [u.id, deps.find(d=> d.id === u.departmentId)?.name || '' ]))
  const avatarMap = new Map(users.map(u=> [u.id, u.profileImage || '' ]))
  function parseRange(dr: string) {
    const m = String(dr || '').match(/\[(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})\)/)
    if (!m) return { start: null, end: null }
    return { start: m[1], end: m[2] }
  }
  const insights = (data||[]).map((r:any)=> {
    const re = parseRange(r.date_range)
    return {
      id: r.id,
      org_id: r.org_id,
      member_id: r.member_id,
      member_name: nameMap.get(String(r.member_id)) || 'Unknown',
      department_name: depMap.get(String(r.member_id)) || '',
      avatar_url: avatarMap.get(String(r.member_id)) || '',
      date_start: re.start,
      date_end: re.end,
      insight_type: r.insight_type,
      severity: r.severity,
      summary: r.summary,
      details: r.details,
      created_at: r.created_at,
      acknowledged: !!r.acknowledged
    }
  })
  const items = insights
  return NextResponse.json({ insights, items })
}
