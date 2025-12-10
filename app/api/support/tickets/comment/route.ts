import { NextRequest, NextResponse } from 'next/server'
import { addSupportComment } from '@lib/db'

function allow(role: string) { return ['employee','manager','admin','owner','hr','it','super_admin'].includes(role.toLowerCase()) }

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const ticket_id = body.ticket_id || body.ticketId
  const user_id = body.user_id || body.userId || actor
  const text = body.body || body.text
  if (!ticket_id || !user_id || !text) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await addSupportComment({ ticketId: ticket_id, userId: user_id, body: text })
  if (res === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ comment: res })
}

