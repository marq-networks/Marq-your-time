import { NextRequest, NextResponse } from 'next/server'
import { getInvoices } from '@lib/billing'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const items = await getInvoices(orgId)
  return NextResponse.json({ items })
}

