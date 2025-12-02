import { NextRequest, NextResponse } from 'next/server'
import { updateNotificationPreferences } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const memberId = body.member_id || body.memberId
  if (!memberId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await updateNotificationPreferences(memberId, { emailEnabled: body.email_enabled ?? body.emailEnabled, inappEnabled: body.inapp_enabled ?? body.inappEnabled })
  return NextResponse.json({ prefs: res })
}
