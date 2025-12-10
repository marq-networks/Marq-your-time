import { NextRequest, NextResponse } from 'next/server'
import { listRetentionPolicies } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const items = await listRetentionPolicies(org_id)
  return NextResponse.json({ items })
}
