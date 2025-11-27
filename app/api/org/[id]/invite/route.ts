import { NextRequest, NextResponse } from 'next/server'
import { createInvite } from '@lib/db'
import { sendInviteMail } from '@lib/mailer'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const required = ['invitedEmail','role']
  for (const k of required) if (body[k] === undefined || body[k] === '') return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createInvite({ invitedEmail: body.invitedEmail, role: body.role, orgId: params.id, invitedBy: 'system', assignSeat: !!body.assignSeat })
  if (res === 'ORG_NOT_FOUND' || res === 'SEATS_EXHAUSTED' || res === 'DB_ERROR') return NextResponse.json({ error: res }, { status: 400 })
  const url = `https://marqtimeos.com/invite/${res.orgId}/${res.token}`
  const mail = await sendInviteMail(res.invitedEmail, 'Your MARQ invitation', `<div>Invite link: <a href=\"${url}\">${url}</a></div>`)
  return NextResponse.json({ ...res, mail })
}
