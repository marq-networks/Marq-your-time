import { NextRequest, NextResponse } from 'next/server'
import { unassignShift, listShiftAssignments, listTeamMemberIds } from '@lib/db'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!['owner','admin','manager'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (role === 'manager') {
    const orgId = req.headers.get('x-org-id') || ''
    const actor = req.headers.get('x-user-id') || ''
    const allowIds = orgId && actor ? await listTeamMemberIds(orgId, actor) : []
    const items = await listShiftAssignments({ orgId })
    const target = items.find(a => a.id === params.id)
    if (!target || !allowIds.includes(target.memberId)) return NextResponse.json({ error: 'FORBIDDEN_TEAM' }, { status: 403 })
  }
  const r = await unassignShift(params.id)
  const codes: Record<string, number> = { DB_ERROR: 500, NOT_FOUND: 404 }
  if (r !== 'OK') return NextResponse.json({ error: r }, { status: codes[r] || 400 })
  return NextResponse.json({ ok: true })
}

