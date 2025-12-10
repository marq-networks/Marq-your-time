import { NextRequest, NextResponse } from 'next/server'
import { updateDigestFrequency } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}))
  const member_id = body.member_id || body.memberId
  const frequency = String(body.frequency || '').toLowerCase()
  if (!member_id) return NextResponse.json({ error: 'MISSING_MEMBER' }, { status: 400 })
  if (!['none','daily','weekly'].includes(frequency)) return NextResponse.json({ error: 'INVALID_FREQUENCY' }, { status: 400 })
  const res = await updateDigestFrequency(member_id, frequency as any)
  return NextResponse.json({ frequency: res })
}

