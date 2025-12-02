import { NextRequest, NextResponse } from 'next/server'
import { payrollMember } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id') || ''
  const orgId = searchParams.get('org_id') || ''
  const periodId = searchParams.get('period_id') || ''
  if (!memberId || !orgId || !periodId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await payrollMember(orgId, periodId, memberId)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 404 })
  return NextResponse.json(res)
}

