import { NextRequest, NextResponse } from 'next/server'
import { listMemberRows } from '@lib/payroll/store'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const payroll_period_id = searchParams.get('payroll_period_id') || ''
  if (!payroll_period_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const items = await listMemberRows(payroll_period_id)
  return NextResponse.json({ items })
}

