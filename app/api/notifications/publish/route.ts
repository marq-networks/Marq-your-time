import { NextRequest, NextResponse } from 'next/server'
import { publish } from '@lib/notifications'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const orgId = body.org_id || body.orgId
  const memberId = body.member_id ?? body.memberId ?? null
  const type = body.type
  const title = body.title
  const message = body.message
  const meta = body.meta
  if (!orgId || !type || !title || !message) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await publish({ orgId, memberId, type, title, message, meta })
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json({ item: res })
}
