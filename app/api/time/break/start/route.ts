import { NextRequest, NextResponse } from 'next/server'
import { startBreak } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const timeSessionId = body.time_session_id || body.timeSessionId
  const memberId = body.member_id || body.memberId
  const orgId = body.org_id || body.orgId
  const breakRuleId = body.break_rule_id || body.breakRuleId
  const label = body.label
  if (!timeSessionId && (!memberId || !orgId)) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await startBreak({ timeSessionId, memberId, orgId, breakRuleId, label })
  const codes: Record<string, number> = { SESSION_NOT_OPEN: 409, NO_OPEN_SESSION: 409, BREAK_ALREADY_OPEN: 409, DB_ERROR: 500 }
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  return NextResponse.json({ break: res })
}
