import { NextRequest, NextResponse } from 'next/server'
import { stopTracking } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const trackingSessionId = body.tracking_session_id || body.trackingSessionId
  if (!trackingSessionId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await stopTracking(trackingSessionId)
  const codes: Record<string, number> = { TRACKING_NOT_FOUND: 404, DB_ERROR: 500 }
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  return NextResponse.json({ tracking: res })
}

