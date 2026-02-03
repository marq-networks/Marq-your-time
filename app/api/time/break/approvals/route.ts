import { NextRequest, NextResponse } from 'next/server'
import { listBreakApprovals, listTeamMemberIds, listUsers } from '@lib/db'

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
  
  // Fetch users for the org to map details
  const allUsers = await listUsers(org_id)
  const userMap = new Map(allUsers.map(u => [u.id, u]))

  let items = await listBreakApprovals(org_id, status as any || undefined, member_id)
  if (role === 'manager' && actorId && !member_id) {
    const teamIds = await listTeamMemberIds(org_id, actorId)
    items = items.filter(it => teamIds.includes(it.memberId))
  }
  const out = items.map(it => {
    const u = userMap.get(it.memberId)
    return {
      id: it.id,
      org_id: it.orgId,
      member_id: it.memberId,
      break_session_id: it.breakSessionId,
      status: it.status,
      reason: it.reason || '',
      review_note: it.reviewNote || '',
      created_at: new Date(it.createdAt).toISOString(),
      reviewed_at: it.reviewedAt ? new Date(it.reviewedAt).toISOString() : null,
      reviewed_by: it.reviewedBy || null,
      member: u ? {
        first_name: u.firstName,
        last_name: u.lastName,
        email: u.email,
        photo_url: u.profileImage
      } : undefined
    }
  })
  return NextResponse.json({ items: out })
}
