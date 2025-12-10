import { NextRequest, NextResponse } from 'next/server'
import { setMFAEnabled } from '@lib/security'
import { logAuditEvent } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const userId = body.user_id || body.userId || (req.headers.get('x-user-id') || '')
  if (!userId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const s = await setMFAEnabled(userId, true)
  const orgId = req.headers.get('x-org-id') || ''
  const actor = req.headers.get('x-user-id') || undefined
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-ip') || undefined
  const ua = req.headers.get('user-agent') || undefined
  try { if (orgId) await logAuditEvent({ orgId, actorUserId: actor, actorIp: ip || undefined, actorUserAgent: ua, eventType: 'mfa.enabled', entityType: 'user', entityId: userId, metadata: { method: s?.mfaType } }) } catch {}
  return NextResponse.json({ mfa: s })
}
