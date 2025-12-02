import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listOrganizations, listUsers } from '@lib/db'
import { getInvoices } from '@lib/billing'

function dateISO(d: Date) { return d.toISOString().slice(0,10) }
function addDays(base: string, days: number) { const dt = new Date(base + 'T00:00:00'); dt.setDate(dt.getDate() + days); return dateISO(dt) }

export async function GET(req: NextRequest) {
  const role = req.headers.get('x-role') || ''
  if (role !== 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const orgs = await listOrganizations()
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const today = dateISO(new Date())
  const start30 = addDays(today, -29)

  const items: any[] = []
  for (const org of orgs) {
    const members = await listUsers(org.id)
    let activeDevices = 0
    let monthlyTrackedMinutes = 0
    if (sb) {
      const since = new Date()
      since.setDate(since.getDate() - 1)
      const { data: tRows } = await sb.from('tracking_sessions').select('member_id, started_at').eq('org_id', org.id).gte('started_at', since)
      const uniqMembers = new Set<string>((tRows || []).map((r: any) => r.member_id))
      activeDevices = uniqMembers.size
      const { data: dRows } = await sb.from('daily_time_summaries').select('worked_minutes').eq('org_id', org.id).gte('date', start30).lte('date', today)
      monthlyTrackedMinutes = (dRows || []).reduce((s: number, r: any) => s + Number(r.worked_minutes || 0), 0)
    } else {
      activeDevices = 0
      // fallback: approximate monthly tracked from today summary endpoints not available globally; keep 0 in memory mode
      monthlyTrackedMinutes = 0
    }
    const invoices = await getInvoices(org.id)
    const curMonth = today.slice(0,7)
    const mrr = (invoices || []).filter(i => String(i.invoiceDate || '').slice(0,7) === curMonth).reduce((s, r) => s + Number(r.total || 0), 0)
    items.push({
      org_id: org.id,
      name: org.orgName,
      created_at: new Date(org.createdAt).toISOString(),
      members_count: members.length,
      active_devices: activeDevices,
      active_seats: org.usedSeats,
      monthly_tracked_hours: Math.round(monthlyTrackedMinutes / 60),
      mrr: Math.round(mrr)
    })
  }

  return NextResponse.json({ orgs: items })
}

