import { NextRequest, NextResponse } from 'next/server'
import { listNotifications } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || undefined
  const memberId = searchParams.get('member_id') || searchParams.get('memberId') || undefined
  const limit = Number(searchParams.get('limit') || '50')
  const cursor = searchParams.get('cursor') || undefined
  const { items, nextCursor } = await listNotifications({ orgId, memberId, limit, cursor })
  return NextResponse.json({ items, nextCursor })
}
