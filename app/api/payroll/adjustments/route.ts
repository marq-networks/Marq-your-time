import { NextRequest, NextResponse } from 'next/server'
import { listAdjustments } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id') || undefined
  const orgId = searchParams.get('org_id') || ''
  const periodId = searchParams.get('period_id') || undefined
  if (!orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const items = await listAdjustments({ memberId, orgId, periodId })
  return NextResponse.json({ items })
}

