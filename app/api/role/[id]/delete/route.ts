import { NextRequest, NextResponse } from 'next/server'
import { deleteRole, logAuditEvent } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = req.headers.get('x-user-id') || ''
  const allowed = actor ? await checkPermission(actor, 'manage_settings') : false
  if (!allowed) return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
  const res = await deleteRole(params.id)
  if (res === 'ROLE_NOT_FOUND') return NextResponse.json({ error: res }, { status: 404 })
  if (res === 'ROLE_PROTECTED') return NextResponse.json({ error: res }, { status: 400 })
  if (res !== 'OK') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  try {
    const orgId = req.headers.get('x-org-id') || ''
    const actor = req.headers.get('x-user-id') || undefined
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-ip') || undefined
    const ua = req.headers.get('user-agent') || undefined
    if (orgId) await logAuditEvent({ orgId, actorUserId: actor, actorIp: ip || undefined, actorUserAgent: ua, eventType: 'role.deleted', entityType: 'role', entityId: params.id })
  } catch {}
  return NextResponse.json({ ok: true })
}
import { checkPermission } from '@lib/permissions'
