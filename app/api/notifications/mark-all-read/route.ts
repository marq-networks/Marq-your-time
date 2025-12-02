import { NextRequest, NextResponse } from 'next/server'
import { markAllNotificationsRead } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const memberId = body.member_id || body.memberId
  if (!memberId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await markAllNotificationsRead(memberId)
  if (typeof res === 'string' && res !== 'OK') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json({ status: 'OK' })
}
