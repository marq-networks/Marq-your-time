import { NextRequest, NextResponse } from 'next/server'
import { reviewTimesheetChangeRequest } from '@lib/db'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  const allowed = ['admin','manager','owner','super_admin']
  if (!allowed.includes(role) || !actor) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json()
  const id = body.change_request_id || body.changeRequestId
  const decision = (body.decision || '').toLowerCase()
  const note = body.review_note || body.reviewNote || ''
  if (!id || !['approve','reject'].includes(decision)) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await reviewTimesheetChangeRequest({ changeRequestId: id, decision: decision as 'approve'|'reject', reviewNote: note, actorUserId: actor })
  const codes: Record<string, number> = { NOT_FOUND: 404, DB_ERROR: 500, SUPABASE_REQUIRED: 500 }
  if (typeof res === 'string' && res !== 'OK') return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  return NextResponse.json({ ok: true })
}
