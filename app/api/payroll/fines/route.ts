import { NextRequest, NextResponse } from 'next/server'
import { addFine, listFines } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const memberId = body.member_id || body.memberId
  const orgId = body.org_id || body.orgId
  const date = body.date
  const reason = body.reason
  const amount = Number(body.amount)
  const currency = body.currency || 'USD'
  const actor = req.headers.get('x-user-id') || ''
  if (!memberId || !orgId || !date || !reason || !amount) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const r = await addFine({ memberId, orgId, date, reason, amount, currency, createdBy: actor })
  const codes: Record<string, number> = { DB_ERROR: 500 }
  if (typeof r === 'string' && r !== 'OK') return NextResponse.json({ error: r }, { status: codes[r] || 400 })
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id') || undefined
  const orgId = searchParams.get('org_id') || ''
  const periodId = searchParams.get('period_id') || undefined
  if (!orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const items = await listFines({ memberId, orgId, periodId })
  return NextResponse.json({ items })
}

