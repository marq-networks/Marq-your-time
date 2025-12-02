import { NextRequest, NextResponse } from 'next/server'
import { createPeriod } from '@lib/payroll/store'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const org_id = body.org_id
  const period_start = body.period_start
  const period_end = body.period_end
  const actor = req.headers.get('x-user-id') || ''
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const allowed = ['admin','manager','finance','super_admin']
  if (!allowed.includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!org_id || !period_start || !period_end) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const period = await createPeriod({ org_id, period_start, period_end, created_by: actor })
  if (typeof period === 'string') return NextResponse.json({ error: period }, { status: period === 'DB_ERROR' ? 500 : 400 })
  return NextResponse.json({ period })
}

