import { NextRequest, NextResponse } from 'next/server'
import { listAuditLogs } from '@lib/db'

function allow(role: string) { return ['admin','owner','super_admin'].includes(role.toLowerCase()) }

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const event_type = searchParams.get('event_type') || undefined
  const actor_user_id = searchParams.get('actor_user_id') || undefined
  const date_start = searchParams.get('date_start') || undefined
  const date_end = searchParams.get('date_end') || undefined
  const limit = Number(searchParams.get('limit') || '50')
  const cursor = searchParams.get('cursor') || undefined
  const { items, nextCursor } = await listAuditLogs({ orgId: org_id, eventType: event_type || undefined, actorUserId: actor_user_id || undefined, dateStart: date_start || undefined, dateEnd: date_end || undefined, limit, cursor })
  return NextResponse.json({ items, nextCursor })
}
