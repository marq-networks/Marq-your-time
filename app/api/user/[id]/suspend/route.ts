import { NextRequest, NextResponse } from 'next/server'
import { suspendUser, logAuditEvent } from '@lib/db'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const req = arguments[0] as NextRequest
  const actor = (req as any).headers?.get('x-user-id') || ''
  const allowed = actor ? await checkPermission(actor, 'manage_users') : false
  if (!allowed) return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
  const res = await suspendUser(params.id)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 404 })
  try {
    const orgId = (req.headers.get('x-org-id') || '')
    const actor = (req.headers.get('x-user-id') || undefined)
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-ip') || undefined
    const ua = req.headers.get('user-agent') || undefined
    if (orgId) await logAuditEvent({ orgId, actorUserId: actor, actorIp: ip || undefined, actorUserAgent: ua, eventType: 'user.suspended', entityType: 'user', entityId: params.id })
  } catch {}
  return NextResponse.json({ user: res })
}
import { checkPermission } from '@lib/permissions'
