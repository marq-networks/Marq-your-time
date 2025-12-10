import { NextRequest, NextResponse } from 'next/server'
import { updateRole, logAuditEvent } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const actor = req.headers.get('x-user-id') || ''
  const allowed = actor ? await checkPermission(actor, 'manage_settings') : false
  if (!allowed) return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
  const res = await updateRole(params.id, { name: body.name, permissions: body.permissions })
  if (res === 'INVALID_PERMISSION' || res === 'RESERVED_ROLE_NAME') return NextResponse.json({ error: res === 'INVALID_PERMISSION' ? 'INVALID_PERMISSION_KEY' : res }, { status: 400 })
  if (res === 'ROLE_PROTECTED') return NextResponse.json({ error: res }, { status: 400 })
  if (res === 'DB_ERROR') return NextResponse.json({ error: res }, { status: 500 })
  if (!res) return NextResponse.json({ error: 'ROLE_NOT_FOUND' }, { status: 404 })
  try {
    const orgId = body.orgId || ''
    const actor = req.headers.get('x-user-id') || undefined
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-ip') || undefined
    const ua = req.headers.get('user-agent') || undefined
    if (orgId) await logAuditEvent({ orgId, actorUserId: actor, actorIp: ip || undefined, actorUserAgent: ua, eventType: 'role.updated', entityType: 'role', entityId: params.id, metadata: { name: body.name, permissions: body.permissions } })
  } catch {}
  return NextResponse.json({ role: res })
}
import { checkPermission } from '@lib/permissions'
