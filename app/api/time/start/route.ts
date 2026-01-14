import { NextRequest, NextResponse } from 'next/server'
import { startWorkSession } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const memberId = body.member_id || body.memberId
  const orgId = body.org_id || body.orgId
  const source = body.source || 'web'
  const projectId = body.project_id || body.projectId
  const taskId = body.task_id || body.taskId
  if (!memberId || !orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await startWorkSession({ memberId, orgId, source, projectId, taskId })
  const codes: Record<string, number> = { SESSION_ALREADY_OPEN: 409, USER_NOT_IN_ORG: 400, USER_INACTIVE: 409, CHECKIN_COOLDOWN: 403, DB_ERROR: 500, ALREADY_CHECKED_IN_TODAY: 409 }
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  return NextResponse.json({ session: res })
}

