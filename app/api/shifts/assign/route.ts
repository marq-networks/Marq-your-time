import { NextRequest, NextResponse } from 'next/server'
import { assignShift, listShiftAssignments, listTeamMemberIds } from '@lib/db'

function role(req: NextRequest) { return (req.headers.get('x-role') || '').toLowerCase() }

export async function POST(req: NextRequest) {
  const r = role(req)
  const body = await req.json()
  const memberId = body.member_id || body.memberId
  const shiftId = body.shift_id || body.shiftId
  const effectiveFrom = body.effective_from || body.effectiveFrom
  const effectiveTo = body.effective_to || body.effectiveTo || undefined
  if (!memberId || !shiftId || !effectiveFrom) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  if (!['owner','admin','manager'].includes(r)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (r === 'manager') {
    const orgId = req.headers.get('x-org-id') || ''
    const actor = req.headers.get('x-user-id') || ''
    const allowIds = orgId && actor ? await listTeamMemberIds(orgId, actor) : []
    if (!allowIds.includes(memberId)) return NextResponse.json({ error: 'FORBIDDEN_TEAM' }, { status: 403 })
  }
  const res = await assignShift({ memberId, shiftId, effectiveFrom, effectiveTo })
  const codes: Record<string, number> = { DB_ERROR: 500 }
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  return NextResponse.json({ assignment: res })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || undefined
  const memberId = searchParams.get('member_id') || searchParams.get('memberId') || undefined
  const r = role(req)
  const actor = req.headers.get('x-user-id') || ''
  let mid = memberId
  if (r === 'member') mid = actor || undefined
  if (r === 'manager' && !mid && orgId && actor) {
    const allowIds = await listTeamMemberIds(orgId, actor)
    const items = await listShiftAssignments({ orgId })
    const filtered = items.filter(a => allowIds.includes(a.memberId))
    return NextResponse.json({ items: filtered })
  }
  const items = await listShiftAssignments({ orgId, memberId: mid })
  return NextResponse.json({ items })
}

