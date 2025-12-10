import { NextRequest, NextResponse } from 'next/server'
import { listPrivacyRequests } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const status = searchParams.get('status') || undefined
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const items = await listPrivacyRequests(org_id, status as any)
  return NextResponse.json({ items })
}
