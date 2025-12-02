import { NextRequest, NextResponse } from 'next/server'
import { createOrganization, updateSettings, createDepartment, createRole, createUser, createInvite, startWorkSession, stopWorkSession, createPayrollPeriod, addFine, addAdjustment, generatePayrollLines, listUsers } from '@lib/db'
import { createInvoice } from '@lib/billing'

export async function POST(_req: NextRequest) {
  if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const out: any = { settings: null, org: null, departments: [], roles: [], users: [], invites: [] }

  const settings = await updateSettings({ defaultSeatPrice: 5, defaultSeatLimit: 50, landingPageInviteEnabled: true })
  out.settings = settings

  const org = await createOrganization({
    orgName: 'MARQ Test Org',
    orgLogo: undefined,
    ownerName: 'Owner One',
    ownerEmail: 'owner@example.com',
    billingEmail: 'billing@example.com',
    subscriptionType: 'monthly',
    pricePerLogin: 5,
    totalLicensedSeats: 100
  } as any)
  if (typeof org === 'string') return NextResponse.json({ error: org }, { status: 500 })
  out.org = org

  const depNames = ['Engineering', 'HR', 'Finance']
  for (const name of depNames) {
    const d = await createDepartment({ orgId: org.id, name })
    if (typeof d === 'string') return NextResponse.json({ error: d }, { status: d==='ORG_NOT_FOUND'?404:500 })
    out.departments.push(d)
  }

  const permsAll = ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings'] as const
  const rOwner = await createRole({ orgId: org.id, name: 'Owner', permissions: permsAll as any })
  if (typeof rOwner === 'string') return NextResponse.json({ error: rOwner }, { status: 500 })
  const rAdmin = await createRole({ orgId: org.id, name: 'Admin', permissions: ['manage_org','manage_users','manage_reports','manage_settings'] as any })
  if (typeof rAdmin === 'string') return NextResponse.json({ error: rAdmin }, { status: 500 })
  const rEmployee = await createRole({ orgId: org.id, name: 'Employee', permissions: [] })
  if (typeof rEmployee === 'string') return NextResponse.json({ error: rEmployee }, { status: 500 })
  out.roles.push(rOwner, rAdmin, rEmployee)

  const dEng = out.departments.find((d: any) => d.name === 'Engineering')
  const dHR = out.departments.find((d: any) => d.name === 'HR')

  const usersPayload = [
    { firstName:'Olivia', lastName:'Owner', email:'olivia.owner@example.com', roleId: rOwner.id, departmentId: dEng?.id },
    { firstName:'Alan', lastName:'Admin', email:'alan.admin@example.com', roleId: rAdmin.id, departmentId: dHR?.id },
    { firstName:'Eve', lastName:'Employee', email:'eve.employee@example.com', roleId: rEmployee.id, departmentId: dEng?.id },
  ]

  for (const u of usersPayload) {
    const created = await createUser({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      passwordHash: 'hashed:dev',
      roleId: u.roleId,
      orgId: org.id,
      departmentId: u.departmentId,
      positionTitle: 'Staff',
      profileImage: undefined,
      salary: 5000,
      workingDays: ['Mon','Tue','Wed','Thu','Fri'],
      workingHoursPerDay: 8,
      status: 'active',
      createdAt: 0,
      updatedAt: 0
    } as any)
    if (typeof created === 'string') return NextResponse.json({ error: created }, { status: created==='EMAIL_ALREADY_EXISTS'?409:500 })
    out.users.push(created)
  }

  const inv = await createInvite({ invitedEmail: 'new.user@example.com', role: 'Employee', orgId: org.id, invitedBy: 'seed', assignSeat: false })
  if (typeof inv === 'string') return NextResponse.json({ error: inv }, { status: 400 })
  out.invites.push(inv)

  const today = new Date().toISOString().slice(0,10)
  const users = await listUsers(org.id)
  for (const u of users) {
    await startWorkSession({ memberId: u.id, orgId: org.id, source: 'seed' })
    await stopWorkSession({ memberId: u.id, orgId: org.id })
  }

  const period = await createPayrollPeriod({ orgId: org.id, name: `Demo ${today}`, startDate: today, endDate: today, createdBy: (users[0]?.id || 'seed') })
  if (typeof period === 'string') return NextResponse.json({ error: period }, { status: 500 })
  const eve = users.find(u => u.email.includes('eve.employee'))
  if (eve) {
    await addFine({ memberId: eve.id, orgId: org.id, date: today, reason: 'Late arrival', amount: 50, currency: 'USD', createdBy: 'seed' })
    await addAdjustment({ memberId: eve.id, orgId: org.id, date: today, reason: 'Overtime bonus', amount: 25, currency: 'USD', createdBy: 'seed' })
  }
  await generatePayrollLines(org.id, (period as any).id)

  const invoice = await createInvoice({ orgId: org.id, invoiceDate: today, periodStart: today, periodEnd: today, basePrice: 100, perLoginCost: 2, manualItems: [{ title: 'Setup Fee', description: 'Initial setup', quantity: 1, unitPrice: 20 }] })
  out.invoice = invoice

  return NextResponse.json(out)
}
