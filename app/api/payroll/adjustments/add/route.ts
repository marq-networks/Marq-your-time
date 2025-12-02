import { NextRequest, NextResponse } from 'next/server'
import { addAdjustment } from '@lib/payroll/store'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const member_payroll_id = body.member_payroll_id
  const type = body.type
  const amount = Number(body.amount)
  const reason = body.reason
  const actor = req.headers.get('x-user-id') || ''
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const allowed = ['admin','manager','finance','super_admin']
  if (!allowed.includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!member_payroll_id || !type || (amount === undefined || amount === null) || !reason) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await addAdjustment({ member_payroll_id, type, amount, reason, created_by: actor })
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json({ adjustment: res })
}

