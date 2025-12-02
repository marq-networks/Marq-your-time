import { NextRequest, NextResponse } from 'next/server'
import { stopBreak } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const timeSessionId = body.time_session_id || body.timeSessionId
  const memberId = body.member_id || body.memberId
  const orgId = body.org_id || body.orgId
  const res = await stopBreak({ timeSessionId, memberId, orgId })
  const codes: Record<string, number> = { NO_OPEN_SESSION: 409, NO_OPEN_BREAK: 409, DB_ERROR: 500 }
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  return NextResponse.json({ break: res })
}
