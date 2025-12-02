import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listOrganizations, listUsers } from '@lib/db'

export async function GET(req: NextRequest) {
  const role = req.headers.get('x-role') || ''
  if (role !== 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const orgs = await listOrganizations()
  const devices: any[] = []
  const now = new Date().getTime()
  const dayAgo = new Date(now - 24*60*60*1000)

  if (sb) {
    for (const org of orgs) {
      const { data: rows } = await sb.from('tracking_sessions').select('id, member_id, org_id, started_at, ended_at').eq('org_id', org.id).gte('started_at', dayAgo).order('started_at', { ascending: false })
      const users = await listUsers(org.id)
      const userMap = new Map(users.map(u => [u.id, u]))
      for (const r of (rows || []) as any[]) {
        const u = userMap.get(String(r.member_id))
        const last = r.ended_at ? new Date(r.ended_at) : new Date(r.started_at)
        devices.push({
          device_id: r.id,
          org_name: org.orgName,
          device_name: u ? `${u.firstName}-${u.lastName}` : 'Unknown Device',
          device_os: 'unknown',
          last_seen: last.toISOString(),
          status: (new Date(last).getTime() >= dayAgo.getTime()) ? 'active' : 'inactive'
        })
      }
    }
  } else {
    // memory mode: we do not track devices globally; return empty list
  }

  return NextResponse.json({ devices })
}

