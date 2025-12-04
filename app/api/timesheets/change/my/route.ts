import { NextRequest, NextResponse } from 'next/server'
import { listMyTimesheetChangeRequests } from '@lib/db'

export async function GET(req: NextRequest) {
  const actor = req.headers.get('x-user-id') || ''
  if (!actor) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id') || searchParams.get('memberId') || ''
  if (!memberId || memberId !== actor) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const items = await listMyTimesheetChangeRequests(memberId)
  if (typeof items === 'string') return NextResponse.json({ error: items }, { status: items === 'SUPABASE_REQUIRED' ? 500 : 400 })
  return NextResponse.json({ items })
}
