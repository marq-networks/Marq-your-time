import { NextRequest, NextResponse } from 'next/server'
import { computeMRR, computeARR, listOrgRevenueBreakdown, computeSeatUtilization } from '@lib/billing'

function ym(d: string | Date) { const s = typeof d === 'string' ? d : (d as Date).toISOString().slice(0,10); return s.slice(0,7) }

export async function GET(req: NextRequest) {
  const role = req.headers.get('x-role') || ''
  if (role !== 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const mrr = Math.round(await computeMRR())
  const arr = Math.round(await computeARR())
  const seat_utilization = await computeSeatUtilization()
  const { orgs } = await listOrgRevenueBreakdown()
  const org_breakdown = orgs.map(o => ({ org_name: o.org_name, plan_code: o.plan_code, seats: o.seats, mrr: Math.round(o.mrr), arr: Math.round(o.arr), status: o.status }))

  return NextResponse.json({ mrr, arr, seat_utilization, orgs, org_breakdown })
}
