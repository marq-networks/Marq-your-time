import { NextRequest, NextResponse } from 'next/server'
import { listMemberRows } from '@lib/payroll/store'
import { listUsers, listTeamMemberIds } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const payroll_period_id = searchParams.get('payroll_period_id') || ''
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const department_id = searchParams.get('department_id') || searchParams.get('departmentId') || undefined
  const manager_id = searchParams.get('manager_id') || searchParams.get('managerId') || undefined
  const member_role_id = searchParams.get('member_role_id') || searchParams.get('memberRoleId') || undefined
  if (!payroll_period_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  let items = await listMemberRows(payroll_period_id)
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  if (role === 'manager' && actor && org_id) {
    const teamIds = await listTeamMemberIds(org_id, actor)
    items = (items || []).filter(r => teamIds.includes(String(r.member_id)))
  }
  if (org_id && (department_id || manager_id || member_role_id)) {
    const users = await listUsers(org_id)
    const userMap = new Map(users.map(u => [u.id, u]))
    items = items.filter(r => {
      const u = userMap.get(String(r.member_id))
      if (!u) return false
      if (department_id && u.departmentId !== department_id) return false
      if (manager_id && u.managerId !== manager_id) return false
      if (member_role_id && u.memberRoleId !== member_role_id) return false
      return true
    })
  }
  return NextResponse.json({ items })
}
