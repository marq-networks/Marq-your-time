import { NextRequest, NextResponse } from 'next/server'
import { stopWorkSession } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const memberId = body.member_id || body.memberId
  const orgId = body.org_id || body.orgId
  if (!memberId || !orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await stopWorkSession({ memberId, orgId })
  const codes: Record<string, number> = { NO_OPEN_SESSION: 409, DB_ERROR: 500 }
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  return NextResponse.json({ session: res })
}
