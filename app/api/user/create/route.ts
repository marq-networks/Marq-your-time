import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createUser, getOrganization, logAuditEvent, listRoles, createRole } from '@lib/db'
import { canConsumeSeat } from '@lib/rules'

function isEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) }

export async function POST(req: NextRequest) {
  const body = await req.json()
  const actor = req.headers.get('x-user-id') || ''
  const roleHeader = (req.headers.get('x-role') || '').toLowerCase()
  const token = body.invite_token || body.inviteToken || ''
  const required = ['firstName','lastName','email','orgId']
  for (const k of required) if (body[k] === undefined || body[k] === '' || (k==='workingDays' && !Array.isArray(body[k]))) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  if (!isEmail(body.email)) return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 })
  const org = await getOrganization(body.orgId)
  if (!org) return NextResponse.json({ error: 'ORG_NOT_FOUND' }, { status: 404 })
  // Resolve role by name if provided
  let roleId = body.roleId ?? undefined
  const roleNameRaw = body.role_name ?? body.roleName
  if (!roleId && typeof roleNameRaw === 'string' && roleNameRaw.trim()) {
    const roleName = roleNameRaw.trim().toLowerCase()
    const roles = await listRoles(org.id)
    const found = roles.find(r => r.name.toLowerCase() === roleName)
    if (found) {
      roleId = found.id
    } else {
      const FULL: any[] = ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings']
      const ADMIN: any[] = ['manage_org','manage_users','manage_reports','manage_settings']
      const EMP: any[] = []
      const perms = roleName === 'super admin' || roleName === 'super_admin' ? FULL
        : roleName === 'admin' ? ADMIN
        : EMP
      const created = await createRole({ orgId: org.id, name: roleNameRaw, permissions: perms as any })
      if (typeof created !== 'string') roleId = (created as any).id
    }
  }
  if (roleHeader === 'admin') {
    const roles = await listRoles(org.id)
    const employee = roles.find(r => r.name.toLowerCase() === 'employee')
    if (employee) roleId = employee.id
    else {
      const created = await createRole({ orgId: org.id, name: 'Employee', permissions: [] as any })
      if (typeof created !== 'string') roleId = (created as any).id
    }
  }
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
    roleId: roleId ?? undefined,
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
