import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listOrganizations, listUsers } from '@lib/db'
import { getInvoices } from '@lib/billing'

function dateISO(d: Date) { return d.toISOString().slice(0,10) }
function addDays(base: string, days: number) { const dt = new Date(base + 'T00:00:00'); dt.setDate(dt.getDate() + days); return dateISO(dt) }

export async function GET(req: NextRequest) {
  const role = req.headers.get('x-role') || ''
  if (role !== 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const metric = (searchParams.get('metric') || 'mrr').toLowerCase()
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const orgs = await listOrganizations()

  const today = dateISO(new Date())
  const start30 = addDays(today, -29)
  const start7 = addDays(today, -6)
  const prev7Start = addDays(today, -13)
  const prev7End = addDays(today, -7)

  const scores: { org_id: string, name: string, mrr: number, active_members: number, tracked_hours: number, usage_growth: number }[] = []
  for (const org of orgs) {
    let trackedMinutes30 = 0
    let trackedMinutesPrev7 = 0
    let trackedMinutesCur7 = 0
    let activeMembers = 0
    if (sb) {
      const { data: rows30 } = await sb.from('daily_time_summaries').select('date, member_id, worked_minutes').eq('org_id', org.id).gte('date', start30).lte('date', today)
      trackedMinutes30 = (rows30 || []).reduce((s:number,r:any)=> s + Number(r.worked_minutes||0), 0)
      const { data: rowsCur7 } = await sb.from('daily_time_summaries').select('date, member_id, worked_minutes').eq('org_id', org.id).gte('date', start7).lte('date', today)
      const { data: rowsPrev7 } = await sb.from('daily_time_summaries').select('date, member_id, worked_minutes').eq('org_id', org.id).gte('date', prev7Start).lte('date', prev7End)
      trackedMinutesCur7 = (rowsCur7 || []).reduce((s:number,r:any)=> s + Number(r.worked_minutes||0), 0)
      trackedMinutesPrev7 = (rowsPrev7 || []).reduce((s:number,r:any)=> s + Number(r.worked_minutes||0), 0)
      const activeSet = new Set<string>()
      for (const r of (rows30 || []) as any[]) if (Number(r.worked_minutes||0)>0) activeSet.add(String(r.member_id))
      activeMembers = activeSet.size
    } else {
      activeMembers = (await listUsers(org.id)).filter(u => u.status === 'active').length
    }
    const invoices = await getInvoices(org.id)
    const curMonth = today.slice(0,7)
    const mrr = (invoices || []).filter(i => String(i.invoiceDate || '').slice(0,7) === curMonth).reduce((s, r) => s + Number(r.total || 0), 0)
    const usage_growth = Math.round((trackedMinutesCur7 - trackedMinutesPrev7) / 60)
    scores.push({ org_id: org.id, name: org.orgName, mrr: Math.round(mrr), active_members: activeMembers, tracked_hours: Math.round(trackedMinutes30/60), usage_growth })
  }

  let chosen = scores
  if (metric === 'mrr') chosen = [...scores].sort((a,b)=>b.mrr-a.mrr)
  else if (metric === 'arr') chosen = [...scores].sort((a,b)=>b.mrr-a.mrr)
  else if (metric === 'members') chosen = [...scores].sort((a,b)=>b.active_members-a.active_members)
  else if (metric === 'hours') chosen = [...scores].sort((a,b)=>b.tracked_hours-a.tracked_hours)
  else if (metric === 'growth') chosen = [...scores].sort((a,b)=>b.usage_growth-a.usage_growth)

  const top = chosen.slice(0, 10).map(o => ({ org_id: o.org_id, name: o.name, rank_metric: metric, value: metric==='mrr'?o.mrr:metric==='arr'?o.mrr*12:metric==='members'?o.active_members:metric==='hours'?o.tracked_hours:o.usage_growth }))
  return NextResponse.json({ top })
}
