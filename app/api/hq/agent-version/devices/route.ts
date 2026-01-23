import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listOrganizations } from '@lib/db'

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const isSuper = role === 'super_admin'
  if (!isSuper && !['owner', 'admin'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ devices: [] })

  let orgId = (new URL(req.url)).searchParams.get('org') || ''
  
  // Non-super admins restricted to their org
  if (!isSuper) {
    const userOrgId = req.headers.get('x-org-id') || req.cookies.get('current_org_id')?.value || ''
    if (!userOrgId) return NextResponse.json({ error: 'MISSING_ORG_CONTEXT' }, { status: 400 })
    orgId = userOrgId
  }

  const orgMap = new Map<string, string>()
  if (isSuper) {
    const orgs = await listOrganizations()
    orgs.forEach(o => orgMap.set(o.id, o.orgName))
  } else {
    // Optimize: only fetch current org name
    if (orgId) {
      const { data: o } = await sb.from('organizations').select('id, org_name').eq('id', orgId).maybeSingle()
      if (o) orgMap.set(o.id, o.org_name)
    }
  }

  const statusFilter = (new URL(req.url)).searchParams.get('status') || ''
  
  let q = sb.from('devices').select('*')
  if (orgId) q = q.eq('org_id', orgId)
  if (statusFilter) q = q.eq('update_status', statusFilter)
  const { data } = await q
  const items = (data || []).map((r: any) => ({
    device_name: r.device_name || 'Unknown',
    org: orgMap.get(String(r.org_id)) || 'Unknown',
    agent_version: r.agent_version || null,
    update_status: r.update_status || null,
    last_seen: r.last_seen || null
  }))
  return NextResponse.json({ devices: items })
}
