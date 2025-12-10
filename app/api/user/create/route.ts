import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createUser, getOrganization, logAuditEvent } from '@lib/db'
import { canConsumeSeat } from '@lib/rules'

function isEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) }

export async function POST(req: NextRequest) {
  const body = await req.json()
  const actor = req.headers.get('x-user-id') || ''
  const allowed = actor ? await checkPermission(actor, 'manage_users') : false
  if (!allowed) return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
  const required = ['firstName','lastName','email','orgId']
  for (const k of required) if (body[k] === undefined || body[k] === '' || (k==='workingDays' && !Array.isArray(body[k]))) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  if (!isEmail(body.email)) return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 })
  const org = await getOrganization(body.orgId)
  if (!org) return NextResponse.json({ error: 'ORG_NOT_FOUND' }, { status: 404 })
  const desiredStatus = (body.status as any) || 'active'
  if (desiredStatus === 'active' && !canConsumeSeat(org)) {
    return NextResponse.json({ requires_seat_upgrade: true })
  }
  const passwordHash = typeof body.password === 'string' && body.password.length > 0
    ? crypto.createHash('sha256').update(body.password).digest('hex')
    : (body.passwordHash ?? '')
  const res = await createUser({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    passwordHash,
    roleId: body.roleId ?? undefined,
    orgId: body.orgId,
    departmentId: body.departmentId ?? undefined,
    positionTitle: body.positionTitle,
    profileImage: body.profileImage,
    salary: body.salary !== undefined ? Number(body.salary) : undefined,
    workingDays: Array.isArray(body.workingDays) ? body.workingDays : ['Mon','Tue','Wed','Thu','Fri'],
    workingHoursPerDay: body.workingHoursPerDay !== undefined ? Number(body.workingHoursPerDay) : 8,
    status: (body.status as any) || 'active'
  })
  if (typeof res === 'string') {
    const bad = ['INVALID_EMAIL','MISSING_FIELDS','ROLE_NOT_FOUND','DEPARTMENT_NOT_FOUND','ORG_MISMATCH_ROLE','ORG_MISMATCH_DEPARTMENT']
    const code = res === 'ORG_NOT_FOUND' ? 404 : res === 'EMAIL_ALREADY_EXISTS' ? 409 : bad.includes(res) ? 400 : 500
    return NextResponse.json({ error: res }, { status: code })
  }
  try {
    const orgId = body.orgId
    const actor = req.headers.get('x-user-id') || undefined
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-ip') || undefined
    const ua = req.headers.get('user-agent') || undefined
    await logAuditEvent({ orgId, actorUserId: actor, actorIp: ip || undefined, actorUserAgent: ua, eventType: 'user.created', entityType: 'user', entityId: (res as any).id, metadata: { email: (res as any).email, roleId: (res as any).roleId } })
  } catch {}
  return NextResponse.json({ user: res })
}
import { checkPermission } from '@lib/permissions'
