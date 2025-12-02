import { NextRequest, NextResponse } from 'next/server'
import { getNotificationPreferences } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id') || searchParams.get('memberId') || ''
  if (!memberId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const prefs = await getNotificationPreferences(memberId)
  return NextResponse.json({ prefs })
}
