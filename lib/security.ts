import { supabaseServer, isSupabaseConfigured } from './supabase'
import { MFASettings, OrgSecurityPolicy, TrustedDevice, MFAType } from './types'
import { generateTotpSecret, verifyTotp, buildOtpauthUri } from './totp'
import { sendMail } from './mailer'

const TRUST_DAYS = 30
const memMfa: Map<string, MFASettings> = new Map()
const memPolicy: Map<string, OrgSecurityPolicy> = new Map()
const memDevices: Map<string, TrustedDevice[]> = new Map()
const memOtps: Map<string, { code: string, expiresAt: number }> = new Map()

export async function getMFASettings(userId: string): Promise<MFASettings | null> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('mfa_settings').select('*').eq('user_id', userId).limit(1).maybeSingle()
    if (!data) return null
    return { id: String(data.id), userId: String(data.user_id), mfaType: data.mfa_type, secret: data.secret ?? undefined, isEnabled: !!data.is_enabled, createdAt: new Date(data.created_at).getTime() }
  }
  return memMfa.get(userId) || null
}

export async function upsertMFASettings(userId: string, mfaType: MFAType, secret?: string): Promise<MFASettings> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: existing } = await sb.from('mfa_settings').select('*').eq('user_id', userId).limit(1).maybeSingle()
    if (existing) {
      const { data } = await sb.from('mfa_settings').update({ mfa_type: mfaType, secret: secret ?? existing.secret, created_at: existing.created_at }).eq('id', existing.id).select('*').single()
      return { id: String(data.id), userId: String(data.user_id), mfaType: data.mfa_type, secret: data.secret ?? undefined, isEnabled: !!data.is_enabled, createdAt: new Date(data.created_at).getTime() }
    } else {
      const { data } = await sb.from('mfa_settings').insert({ user_id: userId, mfa_type: mfaType, secret: secret ?? null, is_enabled: false, created_at: now }).select('*').single()
      return { id: String(data.id), userId: String(data.user_id), mfaType: data.mfa_type, secret: data.secret ?? undefined, isEnabled: !!data.is_enabled, createdAt: new Date(data.created_at).getTime() }
    }
  }
  const item: MFASettings = { id: userId, userId, mfaType, secret, isEnabled: false, createdAt: now.getTime() }
  memMfa.set(userId, item)
  return item
}

export async function setMFAEnabled(userId: string, enabled: boolean): Promise<MFASettings | null> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('mfa_settings').update({ is_enabled: enabled }).eq('user_id', userId).select('*').maybeSingle()
    if (!data) return null
    return { id: String(data.id), userId: String(data.user_id), mfaType: data.mfa_type, secret: data.secret ?? undefined, isEnabled: !!data.is_enabled, createdAt: new Date(data.created_at).getTime() }
  }
  const item = memMfa.get(userId)
  if (!item) return null
  item.isEnabled = enabled
  return item
}

export async function getOrgPolicy(orgId: string): Promise<OrgSecurityPolicy> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: existing } = await sb.from('org_security_policies').select('*').eq('org_id', orgId).limit(1).maybeSingle()
    if (existing) return { id: String(existing.id), orgId: String(existing.org_id), requireMfa: !!existing.require_mfa, sessionTimeoutMinutes: existing.session_timeout_minutes ?? undefined, allowedIpRanges: existing.allowed_ip_ranges ?? undefined, createdAt: new Date(existing.created_at).getTime() }
    const { data } = await sb.from('org_security_policies').insert({ org_id: orgId, require_mfa: false, session_timeout_minutes: 60, allowed_ip_ranges: null, created_at: new Date() }).select('*').single()
    return { id: String(data.id), orgId: String(data.org_id), requireMfa: !!data.require_mfa, sessionTimeoutMinutes: data.session_timeout_minutes ?? undefined, allowedIpRanges: data.allowed_ip_ranges ?? undefined, createdAt: new Date(data.created_at).getTime() }
  }
  const d = memPolicy.get(orgId)
  if (d) return d
  const base: OrgSecurityPolicy = { id: orgId, orgId, requireMfa: false, sessionTimeoutMinutes: 60, allowedIpRanges: [], createdAt: Date.now() }
  memPolicy.set(orgId, base)
  return base
}

export async function updateOrgPolicy(orgId: string, patch: Partial<Pick<OrgSecurityPolicy,'requireMfa'|'sessionTimeoutMinutes'|'allowedIpRanges'>>): Promise<OrgSecurityPolicy> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: existing } = await sb.from('org_security_policies').select('*').eq('org_id', orgId).limit(1).maybeSingle()
    if (existing) {
      const { data } = await sb.from('org_security_policies').update({ require_mfa: patch.requireMfa ?? existing.require_mfa, session_timeout_minutes: patch.sessionTimeoutMinutes ?? existing.session_timeout_minutes, allowed_ip_ranges: patch.allowedIpRanges ?? existing.allowed_ip_ranges }).eq('id', existing.id).select('*').single()
      return { id: String(data.id), orgId: String(data.org_id), requireMfa: !!data.require_mfa, sessionTimeoutMinutes: data.session_timeout_minutes ?? undefined, allowedIpRanges: data.allowed_ip_ranges ?? undefined, createdAt: new Date(data.created_at).getTime() }
    } else {
      const { data } = await sb.from('org_security_policies').insert({ org_id: orgId, require_mfa: patch.requireMfa ?? false, session_timeout_minutes: patch.sessionTimeoutMinutes ?? 60, allowed_ip_ranges: patch.allowedIpRanges ?? null, created_at: new Date() }).select('*').single()
      return { id: String(data.id), orgId: String(data.org_id), requireMfa: !!data.require_mfa, sessionTimeoutMinutes: data.session_timeout_minutes ?? undefined, allowedIpRanges: data.allowed_ip_ranges ?? undefined, createdAt: new Date(data.created_at).getTime() }
    }
  }
  const base = await getOrgPolicy(orgId)
  base.requireMfa = patch.requireMfa ?? base.requireMfa
  base.sessionTimeoutMinutes = patch.sessionTimeoutMinutes ?? base.sessionTimeoutMinutes
  base.allowedIpRanges = patch.allowedIpRanges ?? base.allowedIpRanges
  memPolicy.set(orgId, base)
  return base
}

export async function listTrustedDevices(userId: string): Promise<TrustedDevice[]> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('trusted_devices').select('*').eq('user_id', userId).order('last_used_at', { ascending: false })
    return (data || []).map((d: any) => ({ id: String(d.id), userId: String(d.user_id), deviceLabel: d.device_label ?? undefined, lastIp: d.last_ip ?? undefined, lastUsedAt: d.last_used_at ? new Date(d.last_used_at).getTime() : undefined, createdAt: new Date(d.created_at).getTime() }))
  }
  return memDevices.get(userId) || []
}

export async function saveTrustedDevice(userId: string, label: string, ip?: string): Promise<TrustedDevice> {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('trusted_devices').insert({ user_id: userId, device_label: label, last_ip: ip ?? null, last_used_at: now, created_at: now }).select('*').single()
    return { id: String(data.id), userId: String(data.user_id), deviceLabel: data.device_label ?? undefined, lastIp: data.last_ip ?? undefined, lastUsedAt: data.last_used_at ? new Date(data.last_used_at).getTime() : undefined, createdAt: new Date(data.created_at).getTime() }
  }
  const item: TrustedDevice = { id: `${userId}:${Date.now()}`, userId, deviceLabel: label, lastIp: ip, lastUsedAt: now.getTime(), createdAt: now.getTime() }
  const list = memDevices.get(userId) || []
  list.push(item)
  memDevices.set(userId, list)
  return item
}

export async function revokeTrustedDevice(deviceId: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    await sb.from('trusted_devices').delete().eq('id', deviceId)
    return true
  }
  for (const [uid, arr] of memDevices.entries()) {
    const idx = arr.findIndex(a => a.id === deviceId)
    if (idx >= 0) { arr.splice(idx, 1); memDevices.set(uid, arr); return true }
  }
  return false
}

export async function issueEmailOtp(userId: string, email: string): Promise<{ status: 'OK' } | { status: 'ERROR', error: string }> {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = Date.now() + 10 * 60 * 1000
  memOtps.set(userId, { code, expiresAt })
  const html = `<div>Your MARQ login code is <b>${code}</b>. It expires in 10 minutes.</div>`
  try {
    await sendMail(email, 'Your MARQ login code', html)
    return { status: 'OK' }
  } catch (e: any) {
    return { status: 'ERROR', error: String(e?.message || e) }
  }
}

export async function verifyMFA(userId: string, orgId: string, inputCode: string): Promise<boolean> {
  const s = await getMFASettings(userId)
  if (!s || !s.isEnabled) return false
  if (s.mfaType === 'email_otp') {
    const rec = memOtps.get(userId)
    if (!rec) return false
    const ok = rec.code === inputCode && rec.expiresAt > Date.now()
    if (ok) memOtps.delete(userId)
    return ok
  }
  if (s.mfaType === 'totp') return !!(s.secret && verifyTotp(inputCode, s.secret))
  return false
}

export async function setupMFA(userId: string, type: MFAType, accountLabel: string): Promise<{ settings: MFASettings, totpSecret?: string, otpauthUri?: string }> {
  if (type === 'totp') {
    const secret = generateTotpSecret()
    const s = await upsertMFASettings(userId, 'totp', secret)
    return { settings: s, totpSecret: secret, otpauthUri: buildOtpauthUri(secret, accountLabel) }
  }
  const s = await upsertMFASettings(userId, 'email_otp', undefined)
  return { settings: s }
}

export async function shouldRequireMFA(userId: string, orgId: string, currentIp: string, userAgent: string): Promise<boolean> {
  const policy = await getOrgPolicy(orgId)
  if (!policy.requireMfa) return false
  const s = await getMFASettings(userId)
  if (!s || !s.isEnabled) return false
  const devices = await listTrustedDevices(userId)
  const cutoff = Date.now() - TRUST_DAYS * 24 * 60 * 60 * 1000
  const match = devices.find(d => (d.deviceLabel || '') === userAgent && (!!currentIp ? (d.lastIp || '') === currentIp : true) && (d.lastUsedAt || 0) > cutoff)
  return !match
}
