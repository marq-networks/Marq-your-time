import { NextRequest, NextResponse } from 'next/server'
import { listBreakTypes } from '@lib/db'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const orgId = url.searchParams.get('org_id') || url.searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const items = await listBreakTypes(orgId)
  return NextResponse.json({ items })
}

