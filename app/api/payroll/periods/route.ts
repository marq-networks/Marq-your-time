import { NextRequest, NextResponse } from 'next/server'
import { createPayrollPeriod, listPayrollPeriods } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const orgId = body.org_id || body.orgId
  const name = body.name
  const startDate = body.start_date || body.startDate
  const endDate = body.end_date || body.endDate
  const actor = req.headers.get('x-user-id') || ''
  if (!orgId || !name || !startDate || !endDate) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createPayrollPeriod({ orgId, name, startDate, endDate, createdBy: actor })
  const codes: Record<string, number> = { DB_ERROR: 500 }
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  return NextResponse.json({ period: res })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const items = await listPayrollPeriods(orgId)
  return NextResponse.json({ items })
}

