import { NextRequest, NextResponse } from 'next/server'
import { getOrgPolicy } from '@lib/security'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const policy = await getOrgPolicy(orgId)
  return NextResponse.json({ policy })
}
