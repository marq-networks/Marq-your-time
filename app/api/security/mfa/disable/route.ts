import { NextRequest, NextResponse } from 'next/server'
import { setMFAEnabled } from '@lib/security'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const userId = body.user_id || body.userId || (req.headers.get('x-user-id') || '')
  if (!userId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const s = await setMFAEnabled(userId, false)
  return NextResponse.json({ mfa: s })
}
