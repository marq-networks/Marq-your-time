import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getUser, listUsers, listUserOrganizations, getOrganization, getRole } from '@lib/db'
import { getMFASettings } from '@lib/security'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>null)
  if (!body) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const email = String(body.email || '')
  const password = String(body.password || '')
  // organization password handled in a separate step
  if (!email || !password) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  let user: any = null
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: urow } = await sb.from('users').select('*').eq('email', email).limit(1).maybeSingle()
    if (urow) user = { id: String(urow.id), email: String(urow.email), passwordHash: String(urow.password_hash||''), roleId: urow.role_id ? String(urow.role_id) : undefined, orgId: urow.org_id ? String(urow.org_id) : undefined }
  }
  if (!user) {
    try {
      const orgsAll = await listUserOrganizations('demo-user')
      for (const o of orgsAll) {
        const items = await listUsers(o.id)
        const match = items.find(u => (u.email || '').toLowerCase() === email.toLowerCase())
        if (match) { user = match; break }
      }
    } catch {}
  }
  if (!user) user = await getUser('demo-user')
  if (!user) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 })
  const inputHash = crypto.createHash('sha256').update(password).digest('hex')
  const ok = !!user.passwordHash && (user.passwordHash.length === 64 ? user.passwordHash === inputHash : user.passwordHash === password)
  if (!ok) return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 })
  let orgs = await listUserOrganizations(user.id)
  if (isSupabaseConfigured() && (!orgs || orgs.length === 0) && user.orgId) {
    // Fallback: ensure direct org
    const direct = await getOrganization(user.orgId)
    if (direct) orgs = [direct]
  }
  // If single org and it has a password, require org-login step instead of inline
  let requireOrgLogin = false
  if (orgs.length === 1) {
    const org = await getOrganization(orgs[0].id)
    if (org?.orgPasswordHash) requireOrgLogin = true
  }
  const mfa = await getMFASettings(user.id)
  const role = await getRole(user.roleId)
  const memberships = orgs.map(()=>({ role: (role?.name?.toLowerCase() || 'member') as any }))
  const res = NextResponse.json({ mfaRequired: !!(mfa && mfa.isEnabled), memberships, role: (role?.name?.toLowerCase() || 'member'), org_login_required: requireOrgLogin })
  res.cookies.set('current_user_id', String(user.id), { path: '/', sameSite: 'lax' })
  res.cookies.set('current_role', (role?.name?.toLowerCase() || 'member'), { path: '/', sameSite: 'lax' })
  if (orgs.length === 1 && !requireOrgLogin) {
    res.cookies.set('current_org_id', orgs[0].id, { path: '/', sameSite: 'lax' })
  }
  return res
}
