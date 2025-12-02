import { NextRequest, NextResponse } from 'next/server'
import { getInvoices } from '@lib/billing'
import { listOrganizations } from '@lib/db'

function ym(d: string | Date) { const s = typeof d === 'string' ? d : (d as Date).toISOString().slice(0,10); return s.slice(0,7) }

export async function GET(req: NextRequest) {
  const role = req.headers.get('x-role') || ''
  if (role !== 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const orgs = await listOrganizations()
  const byMonth = new Map<string, number>()
  const orgBreakdown = new Map<string, number>()
  const curYM = ym(new Date())

  for (const org of orgs) {
    const invoices = await getInvoices(org.id)
    orgBreakdown.set(org.orgName, (orgBreakdown.get(org.orgName) || 0) + (invoices || []).reduce((s, r) => s + Number(r.total || 0), 0))
    for (const inv of (invoices || [])) {
      const m = ym(inv.invoiceDate)
      byMonth.set(m, (byMonth.get(m) || 0) + Number(inv.total || 0))
    }
  }

  const monthly = Array.from(byMonth.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([month, revenue]) => ({ month, revenue: Math.round(revenue) }))
  const mrr = Math.round(monthly.find(m => m.month === curYM)?.revenue || 0)
  const arr = mrr * 12
  const org_breakdown = Array.from(orgBreakdown.entries()).sort((a,b)=>b[1]-a[1]).map(([org_name, revenue]) => ({ org_name, revenue: Math.round(revenue) }))

  return NextResponse.json({ mrr, arr, monthly, org_breakdown })
}

