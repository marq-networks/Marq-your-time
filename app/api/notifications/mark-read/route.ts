import { NextRequest, NextResponse } from 'next/server'
import { markNotificationRead } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const id = body.notification_id || body.id
  if (!id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await markNotificationRead(id)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json({ item: res })
}
