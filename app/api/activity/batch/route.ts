import { NextRequest, NextResponse } from 'next/server'
import { ingestActivityBatch } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const trackingSessionId = body.tracking_session_id || body.trackingSessionId
  const events = body.events || []
  if (!trackingSessionId || !Array.isArray(events)) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await ingestActivityBatch({ trackingSessionId, events })
  const codes: Record<string, number> = { TRACKING_NOT_ALLOWED: 403, TRACKING_DISABLED: 403, DB_ERROR: 500 }
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  return NextResponse.json(res)
}

