import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@lib/tracking_db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.org_id || !body.name) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const client = await createClient({
    orgId: body.org_id,
    name: body.name,
    email: body.email,
    address: body.address,
    currency: body.currency,
    status: body.status || 'active'
  })
  if (!client) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json(client)
}