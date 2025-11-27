import { Organization, OrganizationInvite, SaaSSettings, User, Department, Role, Permission } from './types'
import { newId, newToken } from './token'
import { canConsumeSeat, canReduceSeats, isInviteExpired, inviteWindowHours } from './rules'
import { isSupabaseConfigured, supabaseServer } from './supabase'

const organizations: Organization[] = []
const invites: OrganizationInvite[] = []
const roles: Role[] = []
const departments: Department[] = []
const users: User[] = []
let settings: SaaSSettings = { id: 'saas', defaultSeatPrice: 5, defaultSeatLimit: 50, landingPageInviteEnabled: true }

export async function createOrganization(input: Omit<Organization, 'id'|'createdAt'|'updatedAt'|'usedSeats'>) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const now = new Date()
    const payload = {
      org_name: input.orgName,
      org_logo: input.orgLogo ?? null,
      owner_name: input.ownerName,
      owner_email: input.ownerEmail,
      billing_email: input.billingEmail,
      subscription_type: input.subscriptionType,
      price_per_login: input.pricePerLogin,
      total_licensed_seats: input.totalLicensedSeats,
      used_seats: 0,
      created_at: now,
      updated_at: now
    }
    const { data, error } = await sb.from('organizations').insert(payload).select('*').single()
    if (error) return 'DB_ERROR'
    return mapOrgFromRow(data)
  }
  const id = newId()
  const now = Date.now()
  const org: Organization = { ...input, id, createdAt: now, updatedAt: now, usedSeats: 0 }
  organizations.push(org)
  return org
}

export async function listOrganizations() {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('organizations').select('*').order('created_at', { ascending: false })
    if (error) return []
    return data.map(mapOrgFromRow)
  }
  return organizations
}

export async function getOrganization(id: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('organizations').select('*').eq('id', id).single()
    if (error || !data) return undefined
    return mapOrgFromRow(data)
  }
  return organizations.find(o => o.id === id)
}

export async function updateOrganization(id: string, patch: Partial<Organization>) {
  if (isSupabaseConfigured()) {
    const org = await getOrganization(id)
    if (!org) return undefined
    if (patch.totalLicensedSeats !== undefined && !canReduceSeats(org, patch.totalLicensedSeats)) return 'SEAT_LIMIT_BELOW_USED'
    const sb = supabaseServer()
    const { data, error } = await sb.from('organizations').update({
      org_name: patch.orgName ?? org.orgName,
      org_logo: patch.orgLogo ?? org.orgLogo ?? null,
      owner_name: patch.ownerName ?? org.ownerName,
      owner_email: patch.ownerEmail ?? org.ownerEmail,
      billing_email: patch.billingEmail ?? org.billingEmail,
      subscription_type: patch.subscriptionType ?? org.subscriptionType,
      price_per_login: patch.pricePerLogin ?? org.pricePerLogin,
      total_licensed_seats: patch.totalLicensedSeats ?? org.totalLicensedSeats,
      used_seats: org.usedSeats,
      updated_at: new Date()
    }).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    return mapOrgFromRow(data)
  }
  const org = organizations.find(o => o.id === id)
  if (!org) return undefined
  if (patch.totalLicensedSeats !== undefined && !canReduceSeats(org, patch.totalLicensedSeats)) return 'SEAT_LIMIT_BELOW_USED'
  Object.assign(org, patch)
  org.updatedAt = Date.now()
  return org
}

export async function createInvite(params: { invitedEmail: string, orgId: string, invitedBy: string, role: string, assignSeat: boolean }) {
  if (isSupabaseConfigured()) {
    const org = await getOrganization(params.orgId)
    if (!org) return 'ORG_NOT_FOUND'
    if (params.assignSeat && !canConsumeSeat(org)) return 'SEATS_EXHAUSTED'
    const sb = supabaseServer()
    const now = new Date()
    const expires = new Date(now.getTime() + inviteWindowHours() * 60 * 60 * 1000)
    const token = newToken()
    const { data, error } = await sb.from('organization_invites').insert({
      invited_email: params.invitedEmail,
      org_id: params.orgId,
      invited_by: params.invitedBy,
      role: params.role,
      invite_status: 'pending',
      created_at: now,
      expires_at: expires,
      token,
      assign_seat: params.assignSeat
    }).select('*').single()
    if (error) return 'DB_ERROR'
    return mapInviteFromRow(data)
  }
  const org = organizations.find(o => o.id === params.orgId)
  if (!org) return 'ORG_NOT_FOUND'
  if (params.assignSeat && !canConsumeSeat(org)) return 'SEATS_EXHAUSTED'
  const id = newId()
  const token = newToken()
  const now = Date.now()
  const expiresAt = now + inviteWindowHours() * 60 * 60 * 1000
  const invite: OrganizationInvite = { id, token, createdAt: now, expiresAt, inviteStatus: 'pending', orgId: params.orgId, invitedEmail: params.invitedEmail, invitedBy: params.invitedBy, role: params.role, assignSeat: params.assignSeat }
  invites.push(invite)
  return invite
}

export async function listInvites(orgId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('organization_invites').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    if (error) return []
    return data.map(mapInviteFromRow)
  }
  return invites.filter(i => i.orgId === orgId)
}

export async function acceptInvite(token: string, grantPermissions: boolean) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: invRow, error } = await sb.from('organization_invites').select('*').eq('token', token).single()
    if (error || !invRow) return 'INVITE_NOT_FOUND'
    const inv = mapInviteFromRow(invRow)
    if (isInviteExpired(inv) || inv.inviteStatus !== 'pending') return 'INVITE_INVALID'
    if (!grantPermissions) {
      const { data } = await sb.from('organization_invites').update({ invite_status: 'revoked' }).eq('id', inv.id).select('*').single()
      return mapInviteFromRow(data)
    }
    const org = await getOrganization(inv.orgId)
    if (!org) return 'ORG_NOT_FOUND'
    if (inv.assignSeat) {
      if (!canConsumeSeat(org)) return 'SEATS_EXHAUSTED'
      await sb.rpc('increment_used_seats', { org: org.id })
    }
    const { data: updated } = await sb.from('organization_invites').update({ invite_status: 'accepted' }).eq('id', inv.id).select('*').single()
    return mapInviteFromRow(updated)
  }
  const inv = invites.find(i => i.token === token)
  if (!inv) return 'INVITE_NOT_FOUND'
  if (isInviteExpired(inv) || inv.inviteStatus !== 'pending') return 'INVITE_INVALID'
  if (!grantPermissions) {
    inv.inviteStatus = 'revoked'
    return inv
  }
  const org = organizations.find(o => o.id === inv.orgId)
  if (!org) return 'ORG_NOT_FOUND'
  if (inv.assignSeat) {
    if (!canConsumeSeat(org)) return 'SEATS_EXHAUSTED'
    org.usedSeats += 1
    org.updatedAt = Date.now()
  }
  inv.inviteStatus = 'accepted'
  return inv
}

export async function rejectInvite(token: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: invRow, error } = await sb.from('organization_invites').select('*').eq('token', token).single()
    if (error || !invRow) return 'INVITE_NOT_FOUND'
    const inv = mapInviteFromRow(invRow)
    if (isInviteExpired(inv) || inv.inviteStatus !== 'pending') return 'INVITE_INVALID'
    const { data } = await sb.from('organization_invites').update({ invite_status: 'revoked' }).eq('id', inv.id).select('*').single()
    return mapInviteFromRow(data)
  }
  const inv = invites.find(i => i.token === token)
  if (!inv) return 'INVITE_NOT_FOUND'
  if (isInviteExpired(inv) || inv.inviteStatus !== 'pending') return 'INVITE_INVALID'
  inv.inviteStatus = 'revoked'
  return inv
}

export async function getSettings() {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('saas_settings').select('*').eq('id', 'saas').single()
    if (!data) return settings
    return { id: data.id, defaultSeatPrice: Number(data.default_seat_price), defaultSeatLimit: Number(data.default_seat_limit), landingPageInviteEnabled: !!data.landing_page_invite_enabled }
  }
  return settings
}

export async function generateLandingLink(orgId: string, priceOverride?: number, prefillEmail?: string, baseUrl?: string) {
  const org = await getOrganization(orgId)
  if (!org) return 'ORG_NOT_FOUND'
  const token = newToken()
  const urlBase = baseUrl || process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const url = `${urlBase.replace(/\/$/,'')}/invite/${orgId}/${token}`
  return { url, orgConfig: { pricePerLogin: priceOverride ?? org.pricePerLogin, totalLicensedSeats: org.totalLicensedSeats }, prefillEmail }
}

function mapOrgFromRow(row: any): Organization {
  return {
    id: row.id,
    orgName: row.org_name,
    orgLogo: row.org_logo ?? undefined,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    billingEmail: row.billing_email,
    subscriptionType: row.subscription_type,
    pricePerLogin: Number(row.price_per_login),
    totalLicensedSeats: Number(row.total_licensed_seats),
    usedSeats: Number(row.used_seats),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }
}

function mapInviteFromRow(row: any): OrganizationInvite {
  return {
    id: row.id,
    invitedEmail: row.invited_email,
    orgId: row.org_id,
    invitedBy: row.invited_by,
    role: row.role,
    inviteStatus: row.invite_status,
    createdAt: new Date(row.created_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
    token: row.token,
    assignSeat: !!row.assign_seat
  }
}

export async function updateSettings(patch: Partial<SaaSSettings>) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const payload = {
      id: 'saas',
      default_seat_price: patch.defaultSeatPrice,
      default_seat_limit: patch.defaultSeatLimit,
      landing_page_invite_enabled: patch.landingPageInviteEnabled
    }
    const { data, error } = await sb.from('saas_settings').upsert(payload, { onConflict: 'id' }).select('*').single()
    if (error) return 'DB_ERROR'
    return { id: data.id, defaultSeatPrice: Number(data.default_seat_price), defaultSeatLimit: Number(data.default_seat_limit), landingPageInviteEnabled: !!data.landing_page_invite_enabled }
  }
  settings = { id: 'saas', defaultSeatPrice: patch.defaultSeatPrice ?? settings.defaultSeatPrice, defaultSeatLimit: patch.defaultSeatLimit ?? settings.defaultSeatLimit, landingPageInviteEnabled: patch.landingPageInviteEnabled ?? settings.landingPageInviteEnabled }
  return settings
}

export async function listDepartments(orgId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('departments').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    if (error) return []
    return data.map(mapDepartmentFromRow)
  }
  return departments.filter(d => d.orgId === orgId)
}

export async function createDepartment(input: { orgId: string, name: string }) {
  if (isSupabaseConfigured()) {
    const org = await getOrganization(input.orgId)
    if (!org) return 'ORG_NOT_FOUND'
    const sb = supabaseServer()
    const now = new Date()
    const { data, error } = await sb.from('departments').insert({ org_id: input.orgId, name: input.name, created_at: now }).select('*').single()
    if (error) {
      const code = (error as any).code
      if (code === '42501') return 'DB_FORBIDDEN'
      if (code === '42P01') return 'DB_TABLE_MISSING'
      if (code === '23505') return 'DEPARTMENT_DUPLICATE'
      return 'DB_ERROR'
    }
    return mapDepartmentFromRow(data)
  }
  const org = organizations.find(o => o.id === input.orgId)
  if (!org) return 'ORG_NOT_FOUND'
  const id = newId()
  const now = Date.now()
  const dep: Department = { id, orgId: input.orgId, name: input.name, createdAt: now }
  departments.push(dep)
  return dep
}

export async function updateDepartment(id: string, patch: { name: string }) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('departments').update({ name: patch.name }).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    return mapDepartmentFromRow(data)
  }
  const d = departments.find(x => x.id === id)
  if (!d) return undefined
  d.name = patch.name
  return d
}

export async function deleteDepartment(id: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: depRow, error: depErr } = await sb.from('departments').select('*').eq('id', id).single()
    if (depErr || !depRow) return 'DEPARTMENT_NOT_FOUND'
    const { count } = await sb.from('users').select('*', { count: 'exact', head: true }).eq('department_id', id)
    if ((count ?? 0) > 0) return 'DEPT_HAS_USERS'
    const { error } = await sb.from('departments').delete().eq('id', id)
    if (error) return 'DB_ERROR'
    return 'OK'
  }
  const dep = departments.find(d => d.id === id)
  if (!dep) return 'DEPARTMENT_NOT_FOUND'
  const attached = users.some(u => u.departmentId === id)
  if (attached) return 'DEPT_HAS_USERS'
  const idx = departments.findIndex(d => d.id === id)
  if (idx >= 0) departments.splice(idx, 1)
  return 'OK'
}

export async function listRoles(orgId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('roles').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    if (error) return []
    return data.map(mapRoleFromRow)
  }
  return roles.filter(r => r.orgId === orgId)
}

function isValidPermissions(perms: Permission[]) {
  const allowed: Permission[] = ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings']
  return perms.every(p => allowed.includes(p))
}

export async function createRole(input: { orgId: string, name: string, permissions: Permission[] }) {
  if (!isValidPermissions(input.permissions)) return 'INVALID_PERMISSION'
  if (isSupabaseConfigured()) {
    const org = await getOrganization(input.orgId)
    if (!org) return 'ORG_NOT_FOUND'
    const sb = supabaseServer()
    const now = new Date()
    const { data, error } = await sb.from('roles').insert({ org_id: input.orgId, name: input.name, permissions: input.permissions, created_at: now }).select('*').single()
    if (error) return 'DB_ERROR'
    return mapRoleFromRow(data)
  }
  const org = organizations.find(o => o.id === input.orgId)
  if (!org) return 'ORG_NOT_FOUND'
  const id = newId()
  const now = Date.now()
  const role: Role = { id, orgId: input.orgId, name: input.name, permissions: input.permissions, createdAt: now }
  roles.push(role)
  return role
}

export async function updateRole(id: string, patch: { name?: string, permissions?: Permission[] }) {
  if (patch.permissions && !isValidPermissions(patch.permissions)) return 'INVALID_PERMISSION'
  if (patch.name && (patch.name === 'Owner' || patch.name === 'Admin' || patch.name === 'Employee')) return 'RESERVED_ROLE_NAME'
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('roles').update({ name: patch.name, permissions: patch.permissions }).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    return mapRoleFromRow(data)
  }
  const r = roles.find(x => x.id === id)
  if (!r) return undefined
  if (patch.name) r.name = patch.name
  if (patch.permissions) r.permissions = patch.permissions
  return r
}

async function ensureEmployeeRole(orgId: string) {
  const existing = (await listRoles(orgId)).find(r => r.name === 'Employee')
  if (existing) return existing
  const created = await createRole({ orgId, name: 'Employee', permissions: [] })
  return created as Role
}

export async function deleteRole(id: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: roleRow, error: roleErr } = await sb.from('roles').select('*').eq('id', id).single()
    if (roleErr || !roleRow) return 'ROLE_NOT_FOUND'
    const role = mapRoleFromRow(roleRow)
    const employee = await ensureEmployeeRole(role.orgId)
    await sb.from('users').update({ role_id: employee.id }).eq('role_id', id)
    const { error } = await sb.from('roles').delete().eq('id', id)
    if (error) return 'DB_ERROR'
    return 'OK'
  }
  const r = roles.find(x => x.id === id)
  if (!r) return 'ROLE_NOT_FOUND'
  const employee = await ensureEmployeeRole(r.orgId)
  users.forEach(u => { if (u.roleId === id) u.roleId = employee.id })
  const idx = roles.findIndex(x => x.id === id)
  if (idx >= 0) roles.splice(idx, 1)
  return 'OK'
}

export async function listUsers(orgId: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('users').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    if (error) return []
    return data.map(mapUserFromRow)
  }
  return users.filter(u => u.orgId === orgId)
}

export async function getUser(id: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('users').select('*').eq('id', id).single()
    if (error || !data) return undefined
    return mapUserFromRow(data)
  }
  return users.find(u => u.id === id)
}

export async function createUser(input: Omit<User, 'id'|'createdAt'|'updatedAt'|'status'> & { status?: User['status'] }) {
  const org = await getOrganization(input.orgId)
  if (!org) return 'ORG_NOT_FOUND'
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    if (input.roleId) {
      const { data: rRow, error: rErr } = await sb.from('roles').select('id, org_id').eq('id', input.roleId).single()
      if (rErr || !rRow) return 'ROLE_NOT_FOUND'
      if (rRow.org_id !== input.orgId) return 'ORG_MISMATCH_ROLE'
    }
    if (input.departmentId) {
      const { data: dRow, error: dErr } = await sb.from('departments').select('id, org_id').eq('id', input.departmentId).single()
      if (dErr || !dRow) return 'DEPARTMENT_NOT_FOUND'
      if (dRow.org_id !== input.orgId) return 'ORG_MISMATCH_DEPARTMENT'
    }
    const { count } = await sb.from('users').select('*', { count: 'exact', head: true }).eq('org_id', input.orgId).eq('email', input.email)
    if ((count ?? 0) > 0) return 'EMAIL_ALREADY_EXISTS'
    const now = new Date()
    const payload = {
      org_id: input.orgId,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      password_hash: input.passwordHash,
      role_id: input.roleId || null,
      department_id: input.departmentId || null,
      position_title: input.positionTitle ?? null,
      profile_image: input.profileImage ?? null,
      salary: input.salary ?? null,
      working_days: input.workingDays,
      working_hours_per_day: input.workingHoursPerDay ?? null,
      status: input.status ?? 'active',
      created_at: now,
      updated_at: now
    }
    const { data, error } = await sb.from('users').insert(payload).select('*').single()
    if (error) return 'DB_ERROR'
    return mapUserFromRow(data)
  }
  if (users.some(u => u.orgId === input.orgId && u.email === input.email)) return 'EMAIL_ALREADY_EXISTS'
  const id = newId()
  const now = Date.now()
  const user: User = {
    id,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    passwordHash: input.passwordHash,
    roleId: input.roleId,
    orgId: input.orgId,
    departmentId: input.departmentId,
    positionTitle: input.positionTitle,
    profileImage: input.profileImage,
    salary: input.salary,
    workingDays: input.workingDays,
    workingHoursPerDay: input.workingHoursPerDay,
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now
  }
  users.push(user)
  return user
}

export async function updateUser(id: string, patch: Partial<Pick<User,'departmentId'|'roleId'|'salary'|'workingDays'|'workingHoursPerDay'|'status'>>) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: row, error: gErr } = await sb.from('users').select('*').eq('id', id).single()
    if (gErr || !row) return undefined
    if (patch.roleId) {
      const { data: rRow, error: rErr } = await sb.from('roles').select('id, org_id').eq('id', patch.roleId).single()
      if (rErr || !rRow) return 'ROLE_NOT_FOUND'
      if (rRow.org_id !== row.org_id) return 'ORG_MISMATCH_ROLE'
    }
    if (patch.departmentId) {
      const { data: dRow, error: dErr } = await sb.from('departments').select('id, org_id').eq('id', patch.departmentId).single()
      if (dErr || !dRow) return 'DEPARTMENT_NOT_FOUND'
      if (dRow.org_id !== row.org_id) return 'ORG_MISMATCH_DEPARTMENT'
    }
    const now = new Date()
    const { data, error } = await sb.from('users').update({
      department_id: patch.departmentId ?? row.department_id ?? null,
      role_id: patch.roleId ?? row.role_id ?? null,
      salary: patch.salary ?? row.salary ?? null,
      working_days: patch.workingDays ?? row.working_days,
      working_hours_per_day: patch.workingHoursPerDay ?? row.working_hours_per_day ?? null,
      status: patch.status ?? row.status,
      updated_at: now
    }).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    return mapUserFromRow(data)
  }
  const u = users.find(x => x.id === id)
  if (!u) return undefined
  if (patch.departmentId !== undefined) u.departmentId = patch.departmentId
  if (patch.roleId !== undefined) u.roleId = patch.roleId
  if (patch.salary !== undefined) u.salary = patch.salary
  if (patch.workingDays !== undefined) u.workingDays = patch.workingDays
  if (patch.workingHoursPerDay !== undefined) u.workingHoursPerDay = patch.workingHoursPerDay
  if (patch.status !== undefined) u.status = patch.status
  u.updatedAt = Date.now()
  return u
}

export async function suspendUser(id: string) {
  const res = await updateUser(id, { status: 'suspended' })
  if (!res) return 'USER_NOT_FOUND'
  return res
}

export async function activateUser(id: string) {
  const res = await updateUser(id, { status: 'active' })
  if (!res) return 'USER_NOT_FOUND'
  return res
}

function mapDepartmentFromRow(row: any): Department {
  return { id: row.id, orgId: row.org_id, name: row.name, createdAt: new Date(row.created_at).getTime() }
}

function mapRoleFromRow(row: any): Role {
  return { id: row.id, orgId: row.org_id, name: row.name, permissions: (row.permissions ?? []) as Permission[], createdAt: new Date(row.created_at).getTime() }
}

function mapUserFromRow(row: any): User {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    passwordHash: row.password_hash,
    roleId: row.role_id ?? undefined,
    orgId: row.org_id,
    departmentId: row.department_id ?? undefined,
    positionTitle: row.position_title ?? undefined,
    profileImage: row.profile_image ?? undefined,
    salary: row.salary === null ? undefined : Number(row.salary),
    workingDays: row.working_days ?? [],
    workingHoursPerDay: row.working_hours_per_day === null ? undefined : Number(row.working_hours_per_day),
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime()
  }
}
