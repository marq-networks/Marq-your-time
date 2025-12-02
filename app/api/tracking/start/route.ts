import { NextRequest, NextResponse } from 'next/server'
import { startTracking } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const timeSessionId = body.time_session_id || body.timeSessionId
  const memberId = body.member_id || body.memberId
  const orgId = body.org_id || body.orgId
  const res = await startTracking({ timeSessionId, memberId, orgId })
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 500 })
  return NextResponse.json(res)
}

