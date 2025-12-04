import { NextRequest, NextResponse } from 'next/server'
import { listTimesheetChangeRequests } from '@lib/db'

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const allowed = ['admin','manager','owner','super_admin']
  if (!allowed.includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const status = searchParams.get('status') as any || undefined
  const memberId = searchParams.get('member_id') || searchParams.get('memberId') || undefined
  if (!orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const items = await listTimesheetChangeRequests({ orgId, status, memberId: memberId || undefined })
  if (typeof items === 'string') return NextResponse.json({ error: items }, { status: items === 'SUPABASE_REQUIRED' ? 500 : 400 })
  return NextResponse.json({ items })
}
