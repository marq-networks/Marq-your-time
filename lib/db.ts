import { Organization, OrganizationInvite, SaaSSettings } from './types'
import { newId, newToken } from './token'
import { canConsumeSeat, canReduceSeats, isInviteExpired, inviteWindowHours } from './rules'
import { isSupabaseConfigured, supabaseServer } from './supabase'

const organizations: Organization[] = []
const invites: OrganizationInvite[] = []
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

export async function generateLandingLink(orgId: string, priceOverride?: number, prefillEmail?: string) {
  const org = await getOrganization(orgId)
  if (!org) return 'ORG_NOT_FOUND'
  const token = newToken()
  const url = `https://marqtimeos.com/invite/${orgId}/${token}`
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
