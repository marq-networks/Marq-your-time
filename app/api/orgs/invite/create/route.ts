import { NextRequest, NextResponse } from 'next/server'
import { createOrgCreationInvite } from '@lib/db'
import { sendInviteMail, verifyEmailConfig } from '@lib/mailer'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (role !== 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const invitedEmail = body.invited_email || body.invitedEmail || undefined
  const created = await createOrgCreationInvite({ invitedEmail, createdBy: 'system' })
  if (created === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  const host = req.headers.get('host') || 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const invite_url = `${proto}://${host}/orgs/invite/${created.token}`
  if (invitedEmail) {
    const verify = await verifyEmailConfig()
    const html = `<div><h3>Organization Invitation</h3><p>You have been invited to create an organization on MARQ.</p><p><a href="${invite_url}">Open the form</a></p></div>`
    if (verify.status === 'OK') await sendInviteMail(invitedEmail, 'Create your organization on MARQ', html)
  }
  return NextResponse.json({ token: created.token, invite_url })
}
