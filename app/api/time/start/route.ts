import { NextRequest, NextResponse } from 'next/server'
import { startWorkSession } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const memberId = body.member_id || body.memberId
  const orgId = body.org_id || body.orgId
  const source = body.source || 'web'
  if (!memberId || !orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await startWorkSession({ memberId, orgId, source })
  const codes: Record<string, number> = { SESSION_ALREADY_OPEN: 409, USER_NOT_IN_ORG: 400, USER_INACTIVE: 409, DB_ERROR: 500 }
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  return NextResponse.json({ session: res })
}

