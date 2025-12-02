import { NextRequest, NextResponse } from 'next/server'
import { setPeriodStatus, generateForPeriod } from '@lib/payroll/store'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const payroll_period_id = body.payroll_period_id
  const org_id = body.org_id || ''
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const allowed = ['admin','manager','finance','super_admin']
  if (!allowed.includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!payroll_period_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  await setPeriodStatus(payroll_period_id, 'processing')
  const r = await generateForPeriod(payroll_period_id, org_id)
  if (typeof r === 'string' && r !== 'OK') return NextResponse.json({ error: r }, { status: 400 })
  return NextResponse.json({ ok: true })
}

