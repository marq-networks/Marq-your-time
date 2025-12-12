import { NextRequest, NextResponse } from 'next/server'
import { createInvite, getUser, isSuperAdmin } from '@lib/db'
import { sendInviteMail } from '@lib/mailer'
import { checkPermission } from '@lib/permissions'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = req.headers.get('x-user-id') || ''
  if (!actor) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const actorUser = await getUser(actor)
  const superAdmin = await isSuperAdmin(actor)
  const allowed = superAdmin || (actorUser && actorUser.orgId === params.id && await checkPermission(actor, 'manage_users'))
  if (!allowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json()
  const required = ['invitedEmail','role']
  for (const k of required) if (body[k] === undefined || body[k] === '') return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createInvite({ invitedEmail: body.invitedEmail, role: body.role, orgId: params.id, invitedBy: 'system', assignSeat: !!body.assignSeat })
  if (res === 'ORG_NOT_FOUND' || res === 'DB_ERROR') return NextResponse.json({ error: res }, { status: 400 })
  if (res === 'SEATS_EXHAUSTED') {
    return NextResponse.json({ requires_seat_upgrade: true })
  }
  const host = req.headers.get('host') || 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`
  const url = `${base.replace(/\/$/,'')}/invite/${res.orgId}/${res.token}`
  const mail = await sendInviteMail(res.invitedEmail, 'Your MARQ invitation', `<div>Invite link: <a href=\"${url}\">${url}</a></div>`)
  return NextResponse.json({ ...res, mail })
}
