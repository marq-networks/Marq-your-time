import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@lib/db'

function isEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) }

export async function POST(req: NextRequest) {
  const body = await req.json()
  const required = ['firstName','lastName','email','orgId','roleId','departmentId','salary','workingDays','workingHoursPerDay']
  for (const k of required) if (body[k] === undefined || body[k] === '' || (k==='workingDays' && !Array.isArray(body[k]))) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  if (!isEmail(body.email)) return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 })
  const res = await createUser({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    passwordHash: body.passwordHash ?? '',
    roleId: body.roleId,
    orgId: body.orgId,
    departmentId: body.departmentId,
    positionTitle: body.positionTitle,
    profileImage: body.profileImage,
    salary: Number(body.salary),
    workingDays: body.workingDays,
    workingHoursPerDay: Number(body.workingHoursPerDay),
    status: 'active'
  })
  if (typeof res === 'string') {
    const bad = ['INVALID_EMAIL','MISSING_FIELDS','ROLE_NOT_FOUND','DEPARTMENT_NOT_FOUND','ORG_MISMATCH_ROLE','ORG_MISMATCH_DEPARTMENT']
    const code = res === 'ORG_NOT_FOUND' ? 404 : res === 'EMAIL_ALREADY_EXISTS' ? 409 : bad.includes(res) ? 400 : 500
    return NextResponse.json({ error: res }, { status: code })
  }
  return NextResponse.json({ user: res })
}
