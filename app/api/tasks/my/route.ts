import { NextRequest, NextResponse } from 'next/server'
import { listMyTasks } from '@lib/tracking_db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id')
  const orgId = searchParams.get('org_id')
  if (!memberId || !orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const items = await listMyTasks(memberId, orgId)
  return NextResponse.json({ items })
}