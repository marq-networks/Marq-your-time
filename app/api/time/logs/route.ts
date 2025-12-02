import { NextRequest, NextResponse } from 'next/server'
import { listDailyLogs, listUsers, listDepartments } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const date = searchParams.get('date') || ''
  const memberId = searchParams.get('member_id') || searchParams.get('memberId') || undefined
  if (!orgId || !date) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const data = await listDailyLogs({ orgId, date, memberId: memberId || undefined })
  const users = await listUsers(orgId)
  const departments = await listDepartments(orgId)
  const deptMap = new Map(departments.map(d => [d.id, d.name]))
  const userMap = new Map(users.map(u => [u.id, { name: `${u.firstName} ${u.lastName}`, departmentId: u.departmentId || '' }]))
  const items = (data.summaries || []).map(s => ({
    ...s,
    memberName: userMap.get(s.memberId)?.name || '',
    departmentName: deptMap.get(userMap.get(s.memberId)?.departmentId || '') || ''
  }))
  return NextResponse.json({ items })
}

