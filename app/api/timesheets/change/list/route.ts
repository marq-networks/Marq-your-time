import { NextRequest, NextResponse } from 'next/server'
import { listTimesheetChangeRequests, listTeamMemberIds } from '@lib/db'

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const allowed = ['admin','manager','owner','super_admin']
  if (!allowed.includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const status = searchParams.get('status') as any || undefined
  let memberId = searchParams.get('member_id') || searchParams.get('memberId') || undefined
  if (!orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const actor = req.headers.get('x-user-id') || ''
  if (role === 'manager' && actor && !memberId) {
    const ids = await listTeamMemberIds(orgId, actor)
    // Backend store supports filtering by memberId; return all then filter client side
    const itemsAll = await listTimesheetChangeRequests({ orgId, status })
    if (typeof itemsAll === 'string') return NextResponse.json({ error: itemsAll }, { status: itemsAll === 'SUPABASE_REQUIRED' ? 500 : 400 })
    const filtered = (itemsAll || []).filter((it: any) => ids.includes(String(it.member_id || it.memberId)))
    return NextResponse.json({ items: filtered })
  }
  const items = await listTimesheetChangeRequests({ orgId, status, memberId: memberId || undefined })
  if (typeof items === 'string') return NextResponse.json({ error: items }, { status: items === 'SUPABASE_REQUIRED' ? 500 : 400 })
  return NextResponse.json({ items })
}
