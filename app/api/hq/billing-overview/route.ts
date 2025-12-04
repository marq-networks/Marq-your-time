import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listOrganizations } from '@lib/db'

function dateISO(d: Date) { return d.toISOString().slice(0,10) }
function addDays(base: string, days: number) { const dt = new Date(base + 'T00:00:00Z'); dt.setDate(dt.getDate() + days); return dateISO(dt) }

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (role !== 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const orgs = await listOrganizations()
  const today = dateISO(new Date())
  const start30 = addDays(today, -29)

  const resultOrgs: any[] = []
  let totalMRR = 0
  let cancelledLast30 = 0
  let activeCount = 0

  for (const org of orgs) {
    if (!sb) {
      resultOrgs.push({ org_id: org.id, org_name: org.orgName, plan_code: 'legacy/manual', seats: org.totalLicensedSeats || 0, mrr: 0, arr: 0 })
      continue
    }
    const { data: sub } = await sb.from('org_subscriptions').select('*').eq('org_id', org.id).in('status', ['trial','active','past_due']).order('started_at', { ascending: false }).limit(1).maybeSingle()
    if (!sub) {
      resultOrgs.push({ org_id: org.id, org_name: org.orgName, plan_code: 'legacy/manual', seats: org.totalLicensedSeats || 0, mrr: 0, arr: 0 })
      continue
    }
    const { data: plan } = await sb.from('billing_plans').select('*').eq('id', sub.plan_id).maybeSingle()
    const priceSeat = plan ? Number(plan.price_per_seat || 0) : 0
    const priceLogin = plan?.price_per_login ? Number(plan.price_per_login) : null
    let usageMRR = 0
    if (priceLogin && plan) {
      const { data: usageRows } = await sb.from('daily_time_summaries').select('member_id').eq('org_id', org.id).gte('date', start30).lte('date', today)
      const uniqMembers = new Set<string>((usageRows||[]).map((r:any)=> r.member_id))
      usageMRR = uniqMembers.size * priceLogin
    }
    const mrr = sub.seats * priceSeat + usageMRR
    const arr = mrr * 12
    totalMRR += mrr
    if (sub.status === 'active') activeCount++
    if (sub.cancelled_at && new Date(sub.cancelled_at).toISOString().slice(0,10) >= start30) cancelledLast30++
    resultOrgs.push({ org_id: org.id, org_name: org.orgName, plan_code: plan?.code || 'unknown', seats: sub.seats, mrr, arr })
  }

  const arrTotal = totalMRR * 12
  const churnRate = activeCount ? (cancelledLast30 / activeCount) : 0

  return NextResponse.json({ mrr: totalMRR, arr: arrTotal, churn_rate: churnRate, orgs: resultOrgs })
}

