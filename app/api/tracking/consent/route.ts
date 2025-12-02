import { NextRequest, NextResponse } from 'next/server'
import { trackingConsent } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const trackingSessionId = body.tracking_session_id || body.trackingSessionId
  const accepted = !!body.accepted
  const consentText = String(body.consent_text || body.consentText || '')
  const actor = req.headers.get('x-user-id') || undefined
  if (!trackingSessionId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await trackingConsent({ trackingSessionId, accepted, consentText, actorUserId: actor })
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json(res)
}

