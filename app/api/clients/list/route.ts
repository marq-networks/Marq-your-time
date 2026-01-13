import { NextRequest, NextResponse } from 'next/server'
import { listClients } from '@lib/tracking_db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id')
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG_ID' }, { status: 400 })
  const items = await listClients(orgId)
  return NextResponse.json({ items })
}