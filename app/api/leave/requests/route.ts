import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listRequests as memListRequests } from '@lib/memory/leave'
import { listUsers, listTeamMemberIds } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const status = searchParams.get('status') || undefined
  const member_id = searchParams.get('member_id') || searchParams.get('memberId') || undefined
  const start_date = searchParams.get('start_date') || searchParams.get('startDate') || undefined
  const end_date = searchParams.get('end_date') || searchParams.get('endDate') || undefined
  const department_id = searchParams.get('department_id') || searchParams.get('departmentId') || undefined
  const manager_id = searchParams.get('manager_id') || searchParams.get('managerId') || undefined
  const member_role_id = searchParams.get('member_role_id') || searchParams.get('memberRoleId') || undefined
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) {
    let items = memListRequests({ org_id, status: status || undefined, member_id: member_id || undefined, start_date: start_date || undefined, end_date: end_date || undefined })
    if (department_id || manager_id || member_role_id) {
      const users = await listUsers(org_id)
      const allow = new Set(users.filter(u => (!department_id || u.departmentId === department_id) && (!manager_id || u.managerId === manager_id) && (!member_role_id || u.memberRoleId === member_role_id)).map(u => u.id))
      items = (items || []).filter((it:any)=> allow.has(String(it.member_id || it.memberId)))
    }
    return NextResponse.json({ items })
  }
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  let allowedIds: string[] | undefined
  if (role === 'manager' && actor) {
    allowedIds = await listTeamMemberIds(org_id, actor)
  }
  let q = sb.from('leave_requests').select('*, leave_types(code, name)').eq('org_id', org_id)
  if (status) q = q.eq('status', status)
  if (member_id) q = q.eq('member_id', member_id)
  else if (allowedIds && allowedIds.length) q = q.in('member_id', allowedIds)
  if (start_date && end_date) q = q.gte('start_date', start_date).lte('end_date', end_date)
  const { data } = await q.order('created_at', { ascending: false })
  let items = (data||[]).map((r:any)=> ({ id: r.id, org_id: r.org_id, member_id: r.member_id, leave_type_id: r.leave_type_id, type_code: r.leave_types?.code, type_name: r.leave_types?.name, start_date: r.start_date, end_date: r.end_date, days_count: Number(r.days_count||0), status: r.status, reason: r.reason||'', created_at: r.created_at, reviewed_at: r.reviewed_at, review_note: r.review_note||'' }))
  if (department_id || manager_id || member_role_id) {
    const users = await listUsers(org_id)
    const allow = new Set(users.filter(u => (!department_id || u.departmentId === department_id) && (!manager_id || u.managerId === manager_id) && (!member_role_id || u.memberRoleId === member_role_id)).map(u => u.id))
    items = (items || []).filter((it:any)=> allow.has(String(it.member_id)))
  }
  return NextResponse.json({ items })
}
