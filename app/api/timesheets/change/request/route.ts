import { NextRequest, NextResponse } from 'next/server'
import { createTimesheetChangeRequest } from '@lib/db'

export async function POST(req: NextRequest) {
  const actor = req.headers.get('x-user-id') || ''
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const body = await req.json()
  const orgId = body.org_id || body.orgId
  const memberId = body.member_id || body.memberId
  const reason = body.reason
  const items = Array.isArray(body.items) ? body.items : []
  if (!actor || !orgId || !memberId || !reason || items.length === 0) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  if (role && ['admin','manager','owner','super_admin'].includes(role)) {
  } else {
    if (actor !== memberId) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const res = await createTimesheetChangeRequest({ orgId, memberId, requestedBy: actor, reason, items: items.map((i:any)=>({ targetDate: i.target_date || i.targetDate, originalStart: i.original_start || i.originalStart, originalEnd: i.original_end || i.originalEnd, originalMinutes: i.original_minutes || i.originalMinutes, newStart: i.new_start || i.newStart, newEnd: i.new_end || i.newEnd, newMinutes: i.new_minutes || i.newMinutes, note: i.note })) })
  const codes: Record<string, number> = { DB_ERROR: 500, SUPABASE_REQUIRED: 500 }
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  return NextResponse.json({ id: res.id })
}
