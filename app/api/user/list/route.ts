import { NextRequest, NextResponse } from 'next/server'
import { listAllOrgMembers } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const items = await listAllOrgMembers(orgId)
  return NextResponse.json({ items })
}

