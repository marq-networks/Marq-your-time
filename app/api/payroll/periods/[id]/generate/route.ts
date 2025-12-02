import { NextRequest, NextResponse } from 'next/server'
import { generatePayrollLines, listPayrollLines, listPayrollPeriods } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  const body = await req.json().catch(()=>({}))
  const orgId = body.org_id || body.orgId
  if (!id || !orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const periods = await listPayrollPeriods(orgId)
  const period = periods.find(p => p.id === id)
  if (!period) return NextResponse.json({ error: 'PERIOD_NOT_FOUND' }, { status: 404 })
  const r = await generatePayrollLines(orgId, id)
  if (typeof r === 'string' && r !== 'OK') return NextResponse.json({ error: r }, { status: 400 })
  const items = await listPayrollLines(id)
  const totals = items.reduce((acc, l) => { acc.members += 1; acc.net += l.netPayable; acc.worked += l.totalWorkedMinutes; return acc }, { members: 0, net: 0, worked: 0 })
  return NextResponse.json({ processed: items.length, totals })
}

