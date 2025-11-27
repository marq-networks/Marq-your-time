import { NextRequest, NextResponse } from 'next/server'
import { createInvite } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const required = ['invitedEmail','role']
  for (const k of required) if (body[k] === undefined || body[k] === '') return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createInvite({ invitedEmail: body.invitedEmail, role: body.role, orgId: params.id, invitedBy: 'system', assignSeat: !!body.assignSeat })
  if (res === 'ORG_NOT_FOUND' || res === 'SEATS_EXHAUSTED' || res === 'DB_ERROR') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json(res)
}
