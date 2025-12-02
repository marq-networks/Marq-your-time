import { NextRequest, NextResponse } from 'next/server'
import { payrollSummary } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || ''
  const periodId = searchParams.get('period_id') || ''
  if (!orgId || !periodId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await payrollSummary(orgId, periodId)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 404 })
  return NextResponse.json(res)
}

