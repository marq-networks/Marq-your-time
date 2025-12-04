import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listOrganizations } from '@lib/db'

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (role !== 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const orgFilter = (new URL(req.url)).searchParams.get('org') || ''
  const statusFilter = (new URL(req.url)).searchParams.get('status') || ''
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ devices: [] })
  const orgs = await listOrganizations()
  const orgMap = new Map(orgs.map(o => [o.id, o.orgName]))
  let q = sb.from('devices').select('*')
  if (orgFilter) q = q.eq('org_id', orgFilter)
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
