import { NextRequest, NextResponse } from 'next/server'
import { upsertEventNotificationPreferences } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}))
  const member_id = body.member_id || body.memberId
  const items = Array.isArray(body.items) ? body.items : []
  if (!member_id) return NextResponse.json({ error: 'MISSING_MEMBER' }, { status: 400 })
  const payload = items.map((i: any) => ({ eventType: String(i.event_type ?? i.eventType ?? ''), channel: String(i.channel === 'in_app' ? 'in_app' : 'email') as any, enabled: !!(i.enabled) }))
  const filtered = payload.filter((p: { eventType: string }) => !!p.eventType)
  const res = await upsertEventNotificationPreferences(member_id, filtered)
  return NextResponse.json({ items: res })
}
