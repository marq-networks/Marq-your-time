import { NextRequest, NextResponse } from 'next/server'
import { publish } from '@lib/notifications'
import { getUser } from '@lib/db'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actorOrgId = req.headers.get('x-org-id') || ''
  if (!['admin','owner','super_admin'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json()
  const orgId = body.org_id || body.orgId
  const memberId = body.member_id ?? body.memberId ?? null
  const type = body.type
  const title = body.title
  const message = body.message
  const meta = body.meta
  const eventType = body.event_type || body.eventType
  if (!orgId || !type || !title || !message) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  if (role !== 'super_admin' && actorOrgId && orgId && actorOrgId !== orgId) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (memberId) {
    const u = await getUser(String(memberId))
    if (!u || (u.orgId !== String(orgId))) return NextResponse.json({ error: 'INVALID_TARGET' }, { status: 400 })
  }
  const res = await publish({ orgId, memberId, type, title, message, meta, eventType })
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json({ item: res })
}
