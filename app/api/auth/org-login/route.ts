import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getOrganization, listOrganizations } from '@lib/db'
import { isSupabaseConfigured } from '@lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>null)
  if (!body) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const orgId = String(body.org_id || body.orgId || '')
  const orgName = String(body.org_name || body.orgName || '')
  const orgPassword = String(body.org_password || body.orgPassword || '')
  if (!orgId && !orgName) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  let org = null as any
  if (orgId) org = await getOrganization(orgId)
  if (!org && orgName) {
    if (isSupabaseConfigured()) {
      // Look up by name via supabase
      const sb = (await import('@lib/supabase')).supabaseServer()
      const { data } = await sb.from('organizations').select('*').eq('org_name', orgName).limit(1).maybeSingle()
      if (data) org = { id: String(data.id), orgName: String(data.org_name), orgLogo: data.org_logo ?? undefined, orgPasswordHash: undefined }
    } else {
      const list = await listOrganizations()
      org = list.find(o => (o.orgName || '').toLowerCase() === orgName.toLowerCase()) || null
    }
  }
  if (!org) return NextResponse.json({ error: 'ORG_NOT_FOUND' }, { status: 404 })
  if (!isSupabaseConfigured()) {
    const hash = orgPassword ? crypto.createHash('sha256').update(orgPassword).digest('hex') : ''
    const ok = !org.orgPasswordHash || (hash && org.orgPasswordHash === hash)
    if (!ok) return NextResponse.json({ error: 'ORG_PASSWORD_INVALID' }, { status: 401 })
  }
  const res = NextResponse.json({ success: true, current_org_id: orgId })
  res.cookies.set('current_org_id', orgId, { path: '/', sameSite: 'lax' })
  return res
}
