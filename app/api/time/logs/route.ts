import { NextRequest, NextResponse } from 'next/server'
import { listDailyLogs, listAllOrgMembers, listDepartments, listTeamMemberIds } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const date = searchParams.get('date') || ''
  const memberId = searchParams.get('member_id') || searchParams.get('memberId') || undefined
  const departmentId = searchParams.get('department_id') || searchParams.get('departmentId') || undefined
  const managerId = searchParams.get('manager_id') || searchParams.get('managerId') || undefined
  const memberRoleId = searchParams.get('member_role_id') || searchParams.get('memberRoleId') || undefined
  if (!orgId || !date) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  let allowedMemberId = memberId || undefined
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  if (role === 'manager' && actor) {
    const team = await listTeamMemberIds(orgId, actor)
    if (allowedMemberId && !team.includes(allowedMemberId)) allowedMemberId = undefined
  }
  const data = await listDailyLogs({ orgId, date, memberId: allowedMemberId || undefined })
  const users = await listAllOrgMembers(orgId)
  const departments = await listDepartments(orgId)
  const deptMap = new Map(departments.map(d => [d.id, d.name]))
  const userMap = new Map(users.map(u => [u.id, { name: `${u.firstName} ${u.lastName}`, departmentId: u.departmentId || '', managerId: u.managerId || '', memberRoleId: u.memberRoleId || '' }]))
  let items = (data.summaries || []).map(s => ({
    ...s,
    memberName: userMap.get(s.memberId)?.name || '',
    departmentName: deptMap.get(userMap.get(s.memberId)?.departmentId || '') || ''
  }))
  if (departmentId) items = items.filter(it => (userMap.get(it.memberId)?.departmentId || '') === departmentId)
  if (managerId) items = items.filter(it => (userMap.get(it.memberId)?.managerId || '') === managerId)
  if (memberRoleId) items = items.filter(it => (userMap.get(it.memberId)?.memberRoleId || '') === memberRoleId)
  return NextResponse.json({ items })
}
