import { NextRequest, NextResponse } from 'next/server'
import { listProjects } from '@lib/tracking_db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id')
  const clientId = searchParams.get('client_id') || undefined
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG_ID' }, { status: 400 })
  const items = await listProjects(orgId, clientId)
  return NextResponse.json({ items })
}