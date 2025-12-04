import { NextRequest, NextResponse } from 'next/server'
import { approveAll, approveForTeam } from '@lib/payroll/store'
import { listTeamMemberIds } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const payroll_period_id = body.payroll_period_id
  const org_id = body.org_id || ''
  const actor = req.headers.get('x-user-id') || ''
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const allowed = ['admin','manager','finance','super_admin']
  if (!allowed.includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!payroll_period_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  if (role === 'manager' && actor && org_id) {
    const teamIds = await listTeamMemberIds(org_id, actor)
    const res = await approveForTeam(payroll_period_id, actor, org_id, teamIds)
    if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
    return NextResponse.json(res)
  }
  const res = await approveAll(payroll_period_id, actor, org_id)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json(res)
}
