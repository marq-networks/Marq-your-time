import { NextRequest, NextResponse } from 'next/server'
import { listBreakApprovals, listTeamMemberIds } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const status = searchParams.get('status') || undefined
  const member_id = searchParams.get('member_id') || searchParams.get('memberId') || undefined
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actorId = req.headers.get('x-user-id') || ''
  const allowedRoles = ['super_admin', 'org_admin', 'admin', 'owner', 'hr', 'manager']
  if (!allowedRoles.includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  let items = await listBreakApprovals(org_id, status as any || undefined, member_id)
  if (role === 'manager' && actorId && !member_id) {
    const teamIds = await listTeamMemberIds(org_id, actorId)
    items = items.filter(it => teamIds.includes(it.memberId))
  }
  const out = items.map(it => ({
    id: it.id,
    org_id: it.orgId,
    member_id: it.memberId,
    break_session_id: it.breakSessionId,
    status: it.status,
    reason: it.reason || '',
    review_note: it.reviewNote || '',
    created_at: new Date(it.createdAt).toISOString(),
    reviewed_at: it.reviewedAt ? new Date(it.reviewedAt).toISOString() : null,
    reviewed_by: it.reviewedBy || null
  }))
  return NextResponse.json({ items: out })
}

