import { NextRequest, NextResponse } from 'next/server'
import { updateSupportTicket } from '@lib/db'

function allow(role: string) { return ['admin','owner','hr','it','super_admin','manager'].includes(role.toLowerCase()) }

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const id = body.id || body.ticket_id
  const status = body.status
  const priority = body.priority
  const assigned_to_user_id = body.assigned_to_user_id || body.assignedToUserId
  if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
  const res = await updateSupportTicket(String(id), { status, priority, assignedToUserId: assigned_to_user_id })
  if (res === 'NOT_FOUND') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (res === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ ticket: res })
}

