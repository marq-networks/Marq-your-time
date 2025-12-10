import { NextRequest, NextResponse } from 'next/server'
import { createPrivacyRequest } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const user_id = body.user_id || body.userId || undefined
  const subject_type = body.subject_type || body.subjectType
  const subject_id = body.subject_id || body.subjectId
  const request_type = body.request_type || body.requestType
  if (!org_id || !subject_type || !subject_id || !request_type) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createPrivacyRequest({ orgId: org_id, userId: user_id, subjectType: subject_type, subjectId: subject_id, requestType: request_type })
  if (res === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ request: res })
}
